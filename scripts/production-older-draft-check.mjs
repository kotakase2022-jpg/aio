import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import nextEnv from "@next/env";
import { chromium, expect as baseExpect } from "@playwright/test";

// November 16 release check, run once with explicit approval.
// 1. Read-only: an unposted customer article older than the first 20 logs opens from page 2 and the
//    editor shows exactly the stored title, body, structure, table and FAQ settings. It is never saved.
// 2. One write: the release team's own synthetic article (theme starts with AIO-RELEASE-SMOKE- and is
//    marked 検証専用) is saved without changes, then reloaded and compared field by field.
// Every other mutation is blocked, and the save itself is blocked before sending if its payload differs
// from the stored article. Output holds IDs, pages and booleans only, never article content.
nextEnv.loadEnvConfig(process.cwd());
assert.equal(
  process.env.AIO_SMOKE_WRITE_CONFIRM,
  "save-own-test-draft-unchanged",
  "Set AIO_SMOKE_WRITE_CONFIRM=save-own-test-draft-unchanged to run this check.",
);
const accessCode = process.env.DEMO_ACCESS_CODE?.trim();
assert.ok(accessCode, "Set DEMO_ACCESS_CODE to the production access code; this check has no fallback.");
const baseURL = "https://aio-article-generator.vercel.app";
// Production reads (job + canonical draft) and the save round trip can take several seconds.
const expect = baseExpect.configure({ timeout: 30_000 });
const ownMarker = "AIO-RELEASE-SMOKE-";
const ownLabel = "検証専用。公開しない。";
const pageSize = 20;
// Columns a draft save writes (draftToRow); only updatedAt may change on an unchanged save.
const savedFields = [
  "id", "inputPayload", "fetchedReferences", "fetchedCompetitors", "competitorResearch", "aiResult",
  "editedTitle", "editedSlug", "editedMetaDescription", "editedBodyHtml", "faqItems", "tags", "categories",
  "images", "author", "status", "wordpressPostUrl", "createdAt",
];
const changedFields = (actual, expected) =>
  savedFields.filter((field) => !isDeepStrictEqual(actual?.[field] ?? null, expected?.[field] ?? null));
// A textarea reports CRLF as LF; compare the editor text the way the browser exposes it.
const asEditorText = (value) => String(value ?? "").replace(/\r\n?/g, "\n");

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const directory = path.resolve(".verification-files", `older-draft-check-${runId}`);
await mkdir(directory, { recursive: true });
const record = {
  check: "older unposted article opens from page 2; own synthetic article saves unchanged",
  baseURL,
  startedAt: new Date().toISOString(),
  result: "RUNNING",
  // Whether the production code equals the value committed in this public repository's test config.
  accessCodeIsRepositoryTestValue: accessCode === "202607",
};
const persist = () => writeFile(path.join(directory, "manifest.json"), JSON.stringify(record, null, 2));
await persist();

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
// Older articles may embed images on other hosts (for example expired storage links). Those do not
// decide this check; they are only counted, without URLs, which can carry access tokens.
record.externalResourceFailures = 0;
const isAppUrl = (value) => {
  try {
    return new URL(value).origin === baseURL;
  } catch {
    return true;
  }
};
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  const source = message.location().url;
  if (source && !isAppUrl(source) && message.text().startsWith("Failed to load resource")) {
    record.externalResourceFailures += 1;
    return;
  }
  errors.push(message.text());
});
page.on("requestfailed", (request) => {
  if (!isAppUrl(request.url())) record.externalResourceFailures += 1;
  else errors.push(`network failure: ${new URL(request.url()).pathname}`);
});
page.on("response", (response) => {
  if (response.status() < 400) return;
  if (!isAppUrl(response.url())) record.externalResourceFailures += 1;
  else errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
});
// Set only around the one approved save: the stored draft that the save payload must equal.
let saveGate = null;
let savesSent = 0;
let saveBlocked = null;
try {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const sameOrigin = url.origin === baseURL;
    let allowed = sameOrigin && request.method() === "GET";
    if (sameOrigin && request.method() === "POST" && url.pathname === "/api/demo-auth") allowed = true;
    if (sameOrigin && request.method() === "POST" && url.pathname === "/api/save-draft" && saveGate) {
      const sent = request.postDataJSON()?.draft;
      const differs = changedFields(sent, saveGate.draft);
      if (differs.length === 0 && sent?.status === "draft" && savesSent === 0) {
        allowed = true;
        savesSent += 1;
      } else {
        saveBlocked = `Blocked save before sending: payload differs from the stored article in [${differs.join(", ")}]`;
        errors.push(saveBlocked);
      }
      saveGate = null;
    }
    if (!allowed) {
      errors.push(`Blocked request: ${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    await route.continue();
  });

  const readAllLogs = async () => {
    const listed = [];
    let complete = true;
    let cursor = null;
    for (let pageNumber = 1; ; pageNumber += 1) {
      assert.ok(pageNumber <= 50, "generation log paging did not end");
      const response = await context.request.get(
        cursor ? `/api/generation-logs?cursor=${encodeURIComponent(cursor)}` : "/api/generation-logs",
      );
      assert.equal(response.status(), 200);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.ok(Array.isArray(body.logs) && "nextCursor" in body, "deployed generation logs API is not the paged version");
      assert.ok(pageNumber === 1 || body.logs.length > 0, "an issued cursor returned an empty page");
      for (const log of body.logs) {
        assert.ok(!listed.some((item) => item.id === log.id), "a generation log was listed twice");
        listed.push(log);
      }
      complete = complete && body.complete;
      cursor = body.nextCursor;
      if (!cursor) return { listed, complete, pages: pageNumber };
    }
  };
  const readJob = async (jobId) => {
    const response = await context.request.get(`/api/generation-jobs/${encodeURIComponent(jobId)}`);
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    return body.job;
  };
  const isUnpostedCompleted = (log) =>
    log.status === "completed" && !log.wordpressPostStatus && !log.wordpressPostUrl;
  const isOwn = (log) => typeof log.inputSummary === "string" && log.inputSummary.startsWith(ownMarker);
  const pageOf = (index) => Math.floor(index / pageSize) + 1;
  const same = (label, actual, expected) =>
    assert.ok(actual === expected, `${label} shown in the editor did not match the stored article`);
  const draftStatusLabels = { draft: "下書き", approved: "承認済み", posted: "投稿済み", failed: "失敗" };

  await page.goto("/");
  await page.getByTestId("demo-access-code").fill(accessCode);
  const loginAnswer = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/demo-auth");
  await page.getByTestId("demo-login-submit").click();
  // A rejected code stops here at once; nothing has been sent except the login attempt.
  const loginStatus = (await loginAnswer).status();
  if (loginStatus === 401) throw new Error("Production rejected DEMO_ACCESS_CODE (アクセスコードが違います). Nothing was changed. Set the production access code and run again.");
  assert.equal(loginStatus, 200, `login returned HTTP ${loginStatus}`);
  await page.waitForURL(`${baseURL}/`);
  await expect(page.getByTestId("input-wizard-step-references")).toBeVisible();

  const before = await readAllLogs();
  record.logs = {
    pages: before.pages,
    listed: before.listed.length,
    unpostedCompleted: before.listed.filter(isUnpostedCompleted).length,
    complete: before.complete,
  };
  const indexed = before.listed.map((log, index) => ({ log, index }));
  const ownCandidates = indexed.filter(({ log }) => isOwn(log) && isUnpostedCompleted(log));
  const own = ownCandidates.find(({ index }) => index >= pageSize) ?? ownCandidates[0] ?? null;
  const customer = indexed.find(({ log, index }) => index >= pageSize && isUnpostedCompleted(log) && !isOwn(log)) ?? null;
  await persist();

  const rows = page.getByTestId("generation-logs-content").locator("tbody tr");
  const rowOf = (jobId) => rows.filter({ has: page.getByTestId(`generation-log-open-${jobId}`) });
  await page.getByTestId("generation-logs-toggle").click();
  await expect(rows.first()).toBeVisible();
  const openFromList = async (jobId) => {
    const button = page.getByTestId(`generation-log-open-${jobId}`);
    for (let attempt = 0; (await button.count()) === 0; attempt += 1) {
      // Never more clicks than the pages listed through the API before this check.
      assert.ok(attempt < before.pages, "the log did not appear after loading every listed page");
      const shown = await rows.count();
      await page.getByTestId("generation-logs-load-more").click();
      await expect.poll(() => rows.count(), { timeout: 30_000 }).toBeGreaterThan(shown);
    }
    await expect(rowOf(jobId)).toContainText("完了");
    await expect(rowOf(jobId)).toContainText("未投稿");
    await button.click();
  };
  const verifyEditorShows = async (job) => {
    const draft = job.draft;
    await page.getByTestId("draft-edit-tab").click();
    await expect
      .poll(async () => (await page.getByTestId("draft-title-input").inputValue()) === draft.editedTitle, {
        message: "the editor shows the stored title",
        timeout: 30_000,
      })
      .toBe(true);
    same("body", await page.getByTestId("draft-body-html-textarea").inputValue(), asEditorText(draft.editedBodyHtml));
    await expect(page.getByTestId("draft-status-badge")).toHaveText(draftStatusLabels[draft.status]);
    await expect(page.getByTestId("generation-step-save")).not.toContainText("処理中");
    await page.getByTestId("input-wizard-step-button-theme").click();
    const input = job.inputPayload;
    same("structure", await page.getByTestId("article-structure-select").inputValue(), input.articleStructure ?? "auto");
    same("table setting", await page.getByTestId("table-mode-select").inputValue(), input.tableMode ?? "auto");
    same("FAQ setting", await page.getByTestId("supplemental-faq-mode-select").inputValue(), input.supplementalFaqMode ?? "auto");
  };

  // Read-only first: nothing is written if an older customer article does not open correctly.
  if (customer) {
    const job = await readJob(customer.log.id);
    // Draft or approved-but-unposted; either way it is only opened here.
    assert.ok(job.status === "completed" && job.draft && job.draft.status !== "posted", "the page-2 article is not an unposted article");
    await openFromList(customer.log.id);
    await verifyEditorShows(job);
    record.pageTwoReadOnlyOpen = { jobId: customer.log.id, page: pageOf(customer.index), saved: false, editorMatchesStored: true };
  } else {
    record.pageTwoReadOnlyOpen = { checked: false, reason: "no unposted customer article beyond the first 20 logs" };
  }
  await persist();

  if (own) {
    const job = await readJob(own.log.id);
    const draft = job.draft;
    assert.ok(job.status === "completed" && !job.wordpressPostStatus && !job.wordpressPostUrl, "own article is not an unposted completed log");
    assert.ok(draft?.status === "draft" && !draft.wordpressPostUrl, "own article is not an unposted draft");
    assert.ok(
      job.inputPayload.theme.startsWith(ownMarker) &&
        draft.inputPayload.theme.startsWith(ownMarker) &&
        draft.inputPayload.theme.includes(ownLabel),
      "the selected article is not the release team's synthetic article",
    );
    record.ownSave = { jobId: job.id, draftId: draft.id, page: pageOf(own.index) };
    await persist();
    await openFromList(job.id);
    await verifyEditorShows(job);

    saveGate = { draft };
    const saved = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/save-draft");
    saved.catch(() => {});
    await page.getByTestId("save-draft-button").click();
    await expect
      .poll(() => savesSent > 0 || saveBlocked !== null, { message: "the save request left the browser", timeout: 30_000 })
      .toBe(true);
    // Fail fast with the reason; nothing was written when the guard refused the save.
    assert.equal(saveBlocked, null);
    const savedResponse = await saved;
    assert.equal(savedResponse.status(), 200);
    const savedBody = await savedResponse.json();
    assert.equal(savedBody.ok, true);
    assert.deepEqual(savedBody.warnings, []);
    await expect(page.getByTestId("draft-action-message")).toContainText("編集内容を保存しました。");
    await expect(page.getByTestId("save-draft-button")).toBeEnabled();
    await expect(page.getByTestId("save-draft-button").locator(".animate-spin")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("input-wizard-step-references")).toBeVisible();
    await page.getByTestId("generation-logs-toggle").click();
    await openFromList(job.id);
    const reloaded = await readJob(job.id);
    assert.deepEqual(changedFields(reloaded.draft, draft), [], "the unchanged save altered stored fields");
    assert.ok(Date.parse(reloaded.draft.updatedAt) > Date.parse(draft.updatedAt), "the save did not reach the stored article");
    await verifyEditorShows(reloaded);

    const after = await readAllLogs();
    const knownBefore = new Set(before.listed.map((log) => log.id));
    const indexAfter = after.listed.findIndex((log) => log.id === job.id);
    assert.ok(indexAfter >= 0, "the saved article disappeared from the log list");
    assert.deepEqual(
      after.listed.slice(0, indexAfter).map((log) => log.id).filter((id) => knownBefore.has(id)),
      before.listed.slice(0, own.index).map((log) => log.id),
      "saving moved the article within the log list",
    );
    assert.ok(isUnpostedCompleted(after.listed[indexAfter]), "the saved article is no longer listed as unposted");
    Object.assign(record.ownSave, {
      savedMessageShown: true,
      storedFieldsUnchanged: true,
      revisionAdvanced: true,
      listPositionUnchanged: true,
      pageAfter: pageOf(indexAfter),
    });
  } else {
    record.ownSave = { checked: false, reason: "no own synthetic article is listed" };
  }

  assert.equal(savesSent, own ? 1 : 0);
  assert.deepEqual(errors, []);
  record.result = own ? "PASS" : "PASS_READ_ONLY";
  record.completedAt = new Date().toISOString();
  console.log(JSON.stringify(record));
} catch (error) {
  record.result = "FAIL";
  record.errors = errors;
  throw error;
} finally {
  await persist();
  await browser.close();
}
