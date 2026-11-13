import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium, expect } from "@playwright/test";
import { load } from "cheerio";
import { deltaNov11Form } from "../tests/fixtures/delta-nov11.ts";

// Deliberately separate from the default read-only production smoke.
nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.AIO_SMOKE_WRITE_CONFIRM, "create-one-disposable-article");
const baseURL = "https://aio-article-generator.vercel.app";
const marker = `AIO-RELEASE-SMOKE-${randomUUID()}`;
const directory = path.resolve(".verification-files", marker);
await mkdir(directory, { recursive: true });
const record = { marker, baseURL, startedAt: new Date().toISOString(), jobId: null, draftId: null, result: "RUNNING" };
const persist = () => writeFile(path.join(directory, "manifest.json"), JSON.stringify(record, null, 2));
await persist();
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
let generationRequests = 0;
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("requestfailed", (request) => errors.push(`network: ${new URL(request.url()).pathname}`));
page.on("response", (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`); });
try {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let allowed = url.origin === baseURL && request.method() === "GET";
    if (url.origin === baseURL && request.method() === "POST") {
      const body = request.postDataJSON();
      if (url.pathname === "/api/demo-auth") allowed = true;
      if (url.pathname === "/api/generation-jobs" && generationRequests === 0 && body.form?.theme?.startsWith(marker) && body.form.imageCount === 0) {
        generationRequests += 1;
        allowed = true;
      }
      if (url.pathname === "/api/save-draft" && record.draftId && body.draft?.id === record.draftId && body.draft.inputPayload?.theme?.startsWith(marker) && body.draft.status === "draft") allowed = true;
    }
    if (!allowed) {
      errors.push(`Blocked request: ${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await page.getByTestId("demo-access-code").fill(process.env.DEMO_ACCESS_CODE || "202607");
  await page.getByTestId("demo-login-submit").click();
  await page.waitForURL(`${baseURL}/`);
  await page.getByTestId("reference-text-0").fill(deltaNov11Form.references[0].text);
  const step = async (name) => page.getByTestId(`input-wizard-step-button-${name}`).click();
  await step("theme");
  await page.getByTestId("theme-textarea").fill(`${marker}\n検証専用。公開しない。\n${deltaNov11Form.theme}`);
  await page.getByTestId("audience-type-select").selectOption("btob");
  await page.getByTestId("article-structure-select").selectOption("comparison");
  await page.getByTestId("structure-instruction").fill(deltaNov11Form.structureInstruction);
  await page.getByTestId("table-mode-select").selectOption("none");
  await page.getByTestId("supplemental-faq-mode-select").selectOption("none");
  await step("primary-info");
  await page.getByTestId("primary-info-type-criteria-knowhow").click();
  await page.getByTestId("primary-info-textarea").fill(deltaNov11Form.primaryInfo);
  await step("visual-tone");
  await page.getByRole("button", { name: "0枚", exact: true }).click();
  await step("word-count");
  await page.getByTestId("word-count-select").selectOption("1000");
  const started = page.waitForResponse((response) => response.url().endsWith("/api/generation-jobs") && response.request().method() === "POST");
  await page.getByTestId("article-primary-button").click();
  const startResponse = await started;
  assert.equal(startResponse.status(), 202);
  record.jobId = (await startResponse.json()).job.id;
  await persist();
  const completedResponse = await page.waitForResponse(async (response) => {
    if (!response.url().endsWith(`/api/generation-jobs/${record.jobId}`)) return false;
    const result = await response.json();
    if (result.job?.status === "failed") throw new Error(result.job.error);
    return result.job?.status === "completed";
  }, { timeout: 240_000 });
  const draft = (await completedResponse.json()).job.draft;
  record.draftId = draft.id;
  await persist();
  assert.equal(draft.aiResult.content_policy_version, 2);
  assert.equal(draft.inputPayload.tableMode, "none");
  assert.equal(draft.inputPayload.supplementalFaqMode, "none");
  await expect(page.getByRole("article")).toContainText(draft.editedTitle);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const editMarker = "検証用の編集保存確認。契約条件は個別に確認してください。";
  await page.getByTestId("draft-body-html-textarea").fill(`${draft.editedBodyHtml}<p>${editMarker}</p>`);
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/save-draft"));
  await page.getByTestId("save-draft-button").click();
  const savedResponse = await saved;
  assert.equal(savedResponse.status(), 200);
  const savedResult = await savedResponse.json();
  assert.equal(savedResult.ok, true);
  assert.deepEqual(savedResult.warnings, []);
  await page.reload();
  await page.getByTestId("generation-logs-toggle").click();
  await page.getByTestId(`generation-log-open-${record.jobId}`).click();
  const article = page.getByRole("article");
  await expect(article).toContainText(editMarker);
  await expect(article.locator("table, .aio-faq-block")).toHaveCount(0);
  const preview = await article.locator(":scope > div").innerHTML();
  await page.getByTestId("copy-body-html-button").click();
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "success");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const normalize = (html) => load(html, null, false).root().html().trim();
  assert.equal(normalize(copied), normalize(preview));
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-html-button").click();
  const download = await downloadPromise;
  const exportPath = path.join(directory, "article.html");
  await download.saveAs(exportPath);
  const exported = load(await readFile(exportPath, "utf8"));
  exported("body > h1").remove();
  assert.equal(normalize(exported("body").html()), normalize(copied));
  await page.screenshot({ path: path.join(directory, "preview.png"), fullPage: true });
  await step("theme");
  await expect(page.getByTestId("article-structure-select")).toHaveValue("comparison");
  await expect(page.getByTestId("table-mode-select")).toHaveValue("none");
  await expect(page.getByTestId("supplemental-faq-mode-select")).toHaveValue("none");
  assert.deepEqual(errors, []);
  record.result = "PASS";
  record.completedAt = new Date().toISOString();
  console.log(JSON.stringify(record));
} finally {
  await persist();
  await browser.close();
}
