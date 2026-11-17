import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium, expect } from "@playwright/test";

nextEnv.loadEnvConfig(process.cwd());
// The operator sets a production login; values committed in this public repository are no gate.
const loginEmail = process.env.AIO_SMOKE_LOGIN_EMAIL?.trim();
const loginPassword = process.env.AIO_SMOKE_LOGIN_PASSWORD;
assert.ok(
  loginEmail && loginPassword,
  "Set AIO_SMOKE_LOGIN_EMAIL and AIO_SMOKE_LOGIN_PASSWORD to a production login; this smoke has no fallback. Nothing was changed.",
);
const baseURL = process.env.AIO_SMOKE_BASE_URL || "https://aio-article-generator.vercel.app";
const target = new URL(baseURL);
assert.equal(target.protocol, "https:");
assert.ok(target.hostname === "aio-article-generator.vercel.app" ||
  /^aio-article-generator-[a-z0-9]+-sl2026\.vercel\.app$/.test(target.hostname));
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("requestfailed", (request) => errors.push(`network failure: ${new URL(request.url()).pathname}`));
page.on("response", (response) => {
  if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
});
try {
  // Fail closed: this smoke may authenticate, but must never write application data.
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    // Logging in and out only sets or clears the session cookie.
    const sessionRequest = pathname === "/api/auth/session" && ["POST", "DELETE"].includes(request.method());
    if (request.method() !== "GET" && !sessionRequest) {
      errors.push(`Blocked mutation: ${request.method()} ${pathname}`);
      await route.abort();
      return;
    }
    await route.continue();
  });
  const denied = await context.request.get("/api/generation-logs");
  assert.equal(denied.status(), 401);
  // The retired access-code login is gone: its API admits nobody and its screen leads to the login.
  const retiredLogin = await context.request.post("/api/demo-auth", { data: { code: "202607" } });
  assert.equal(retiredLogin.status(), 401, "the retired access-code login still answers");
  await page.goto("/demo-login");
  await expect(page).toHaveURL(`${baseURL}/login`);
  await expect(page.getByTestId("login-email")).toBeVisible();
  await page.getByTestId("login-email").fill(loginEmail);
  await page.getByTestId("login-password").fill(loginPassword);
  const loginAnswer = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/session");
  await page.getByTestId("login-submit").click();
  const loginStatus = (await loginAnswer).status();
  if (loginStatus === 401) {
    throw new Error("Production rejected the login (メールアドレスまたはパスワードが違います). Nothing was changed. Check AIO_SMOKE_LOGIN_EMAIL and AIO_SMOKE_LOGIN_PASSWORD.");
  }
  assert.equal(loginStatus, 200, `login returned HTTP ${loginStatus}`);
  await page.waitForURL(`${baseURL}/`);
  await expect(page.getByTestId("input-wizard-step-references")).toBeVisible();
  await expect(page.getByTestId("account-email")).toHaveText(loginEmail.normalize("NFKC").toLowerCase());
  const logs = await context.request.get("/api/generation-logs");
  assert.equal(logs.status(), 200);
  const firstLogPage = await logs.json();
  assert.equal(firstLogPage.ok, true);
  // Paged logs (November 16): every older page must be reachable read-only, without duplicates.
  assert.ok(Array.isArray(firstLogPage.logs), "generation logs response has no logs array");
  assert.ok("nextCursor" in firstLogPage && typeof firstLogPage.complete === "boolean",
    "deployed generation logs API is not the paged version");
  const listedLogIds = new Set();
  const addListedLogs = (logs) => {
    for (const log of logs) {
      assert.ok(!listedLogIds.has(log.id), "a generation log was listed twice");
      listedLogIds.add(log.id);
    }
  };
  addListedLogs(firstLogPage.logs);
  const isUnpostedCompleted = (log) => log.status === "completed" && !log.wordpressPostStatus;
  let unpostedCompletedLogs = firstLogPage.logs.filter(isUnpostedCompleted).length;
  let logPages = 1;
  let logsComplete = firstLogPage.complete;
  for (let cursor = firstLogPage.nextCursor; cursor; logPages += 1) {
    assert.ok(logPages < 50, "generation log paging did not end");
    const next = await context.request.get(`/api/generation-logs?cursor=${encodeURIComponent(cursor)}`);
    assert.equal(next.status(), 200);
    const body = await next.json();
    assert.equal(body.ok, true);
    assert.ok(body.logs.length > 0, "an issued cursor returned an empty page");
    addListedLogs(body.logs);
    unpostedCompletedLogs += body.logs.filter(isUnpostedCompleted).length;
    logsComplete = logsComplete && body.complete;
    cursor = body.nextCursor;
  }
  await page.getByTestId("generation-logs-toggle").click();
  const logRows = page.getByTestId("generation-logs-content").locator("tbody tr");
  if (firstLogPage.nextCursor) {
    await expect(logRows).toHaveCount(firstLogPage.logs.length);
    await page.getByTestId("generation-logs-load-more").click();
    await expect.poll(() => logRows.count()).toBeGreaterThan(firstLogPage.logs.length);
  } else {
    await expect(page.getByTestId("generation-logs-load-more")).toHaveCount(0);
  }
  await page.getByTestId("generation-logs-toggle").click();
  await page.getByTestId("reference-text-0").fill("公開前確認用の一時入力。生成・保存は実行しません。");
  for (const step of ["competitors", "theme", "primary-info", "visual-tone", "word-count"]) {
    await page.getByTestId(`input-wizard-step-button-${step}`).click();
    await expect(page.getByTestId(`input-wizard-step-${step}`)).toBeVisible();
    if (step === "theme") {
      await page.getByTestId("audience-type-select").selectOption("btoc");
      await page.getByTestId("article-structure-select").selectOption("faq");
      for (const structure of ["comparison", "problem_solution"]) {
        await page.getByTestId("article-structure-select").selectOption(structure);
        await expect(page.getByTestId("article-structure-select")).toHaveValue(structure);
      }
      await page.getByTestId("structure-instruction").fill("問題、原因、対処方法、判断基準、行動の順に説明する。");
      for (const mode of ["auto", "on", "none"]) {
        await page.getByTestId("table-mode-select").selectOption(mode);
        await page.getByTestId("supplemental-faq-mode-select").selectOption(mode);
      }
    }
    if (step === "primary-info") {
      await page.getByTestId("primary-info-type-criteria-knowhow").click();
      await page.getByTestId("primary-info-textarea").fill("当社では公開前に根拠と条件を確認します。");
    }
  }
  await page.getByTestId("word-count-select").selectOption("3000");
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  await page.getByTestId("input-wizard-step-button-theme").click();
  await expect(page.getByTestId("article-structure-select")).toHaveValue("problem_solution");
  await expect(page.getByTestId("table-mode-select")).toHaveValue("none");
  await expect(page.getByTestId("supplemental-faq-mode-select")).toHaveValue("none");
  await page.getByTestId("supplemental-faq-mode-select").scrollIntoViewIfNeeded();
  const directory = path.join(process.cwd(), ".verification-files");
  await mkdir(directory, { recursive: true });
  const screenshot = path.join(directory, "production-smoke.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.getByTestId("logout-button").click();
  await page.waitForURL(`${baseURL}/login`);
  await expect(page.getByTestId("login-email")).toBeVisible();
  const afterLogout = await context.request.get("/api/generation-logs");
  assert.equal(afterLogout.status(), 401, "the session survived logout");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", baseURL, checks: [
    "unauthenticated API denied", "retired access-code login gone", "email/password login",
    "durable logs read", "older log pages reachable without duplicates",
    "load-more control", "six input steps",
    "audience/structure controls including comparison/problem-solution", "table/supplemental FAQ modes",
    "required primary information", "ready-to-generate state",
    "logout ends the session", "no console/page/network errors", "no application mutations",
  ], logs: { pages: logPages, listed: listedLogIds.size, unpostedCompleted: unpostedCompletedLogs, complete: logsComplete },
  screenshot }));
} finally {
  await browser.close();
}
