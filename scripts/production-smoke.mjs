import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { chromium, expect } from "@playwright/test";

loadEnvConfig(process.cwd());
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
    if (request.method() !== "GET" && pathname !== "/api/demo-auth") {
      errors.push(`Blocked mutation: ${request.method()} ${pathname}`);
      await route.abort();
      return;
    }
    await route.continue();
  });
  const denied = await context.request.get("/api/generation-logs");
  assert.equal(denied.status(), 401);
  await page.goto("/");
  await expect(page.getByTestId("demo-access-code")).toBeVisible();
  await page.getByTestId("demo-access-code").fill(process.env.DEMO_ACCESS_CODE || "202607");
  await page.getByTestId("demo-login-submit").click();
  await page.waitForURL(`${baseURL}/`);
  await expect(page.getByTestId("input-wizard-step-references")).toBeVisible();
  const logs = await context.request.get("/api/generation-logs");
  assert.equal(logs.status(), 200);
  assert.equal((await logs.json()).ok, true);
  await page.getByTestId("reference-text-0").fill("公開前確認用の一時入力。生成・保存は実行しません。");
  for (const step of ["competitors", "theme", "primary-info", "visual-tone", "word-count"]) {
    await page.getByTestId(`input-wizard-step-button-${step}`).click();
    await expect(page.getByTestId(`input-wizard-step-${step}`)).toBeVisible();
    if (step === "theme") {
      await page.getByTestId("audience-type-select").selectOption("btoc");
      await page.getByTestId("article-structure-select").selectOption("faq");
    }
    if (step === "primary-info") {
      await page.getByTestId("primary-info-type-criteria-knowhow").click();
      await page.getByTestId("primary-info-textarea").fill("当社では公開前に根拠と条件を確認します。");
    }
  }
  await page.getByTestId("word-count-select").selectOption("3000");
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  await page.getByTestId("input-wizard-step-button-theme").click();
  const directory = path.join(process.cwd(), ".verification-files");
  await mkdir(directory, { recursive: true });
  const screenshot = path.join(directory, "production-smoke.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", baseURL, checks: [
    "unauthenticated API denied", "login", "durable logs read", "six input steps",
    "audience/structure controls", "required primary information", "ready-to-generate state",
    "no console/page/network errors", "no application mutations",
  ], screenshot }));
} finally {
  await browser.close();
}
