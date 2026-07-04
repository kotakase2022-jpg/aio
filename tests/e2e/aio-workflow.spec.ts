import { expect, test, type Page } from "@playwright/test";
import extractFileSuccess from "../fixtures/api/extract-file-success.json";
import themeCandidates from "../fixtures/api/theme-candidates.json";
import { createCompletedGenerationJob } from "../fixtures/article";

test("PC browser can complete the core AIO draft workflow with mocked external services", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/wordpress\/connect$/],
  });
  const completedJob = createCompletedGenerationJob();
  completedJob.draft = {
    ...completedJob.draft!,
    images: [
      {
        ...completedJob.draft!.images[0],
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      },
    ],
  };

  const calls = await mockCommonApiRoutes(page, completedJob);
  await login(page);

  await expect(page.getByText("AIO記事 半自動生成ツール")).toBeVisible();
  await page.locator('a[href="#theme"]').click();
  await expect(page).toHaveURL(/#theme/);

  await page.getByTestId("reference-url-0").fill("https://example.com/reference");
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text about AIO workflows and AI search optimization.");

  await page.getByTestId("reference-file-input").setInputFiles({
    name: "reference.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Uploaded reference text"),
  });
  await expect(page.getByText("reference.txt")).toBeVisible();

  await page.getByTestId("theme-candidates-button").click();
  await expect(page.getByText("AIO Content Operations Guide")).toBeVisible();
  await page.getByTestId("theme-candidate-apply-0").click();
  await expect(page.getByText("反映しました")).toBeVisible();
  await expect(page.getByTestId("theme-textarea")).toHaveValue(/AIO Content Operations Guide/);
  await page
    .getByTestId("primary-info-textarea")
    .fill("In our field support, small teams often approve AI drafts in chat before formal review.");

  await page.getByTestId("article-primary-button").click();
  expect(calls.articlePrimaryInfo).toContain("small teams");
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  await expect(page.getByText("編集品質チェック")).toBeVisible();
  await expect(page.getByText("AI風の汎用表現")).toBeVisible();
  await page.getByTestId("quality-improve-regenerate-button").click();
  await expect(page.getByRole("dialog", { name: "記事の再作成" })).toBeVisible();
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /編集品質チェックの結果/,
  );
  await page.getByTestId("article-regeneration-cancel").click();
  await expect(page.locator('img[alt="AIO workflow hero image"]').first()).toHaveAttribute(
    "src",
    /data:image\/png/,
  );

  await page.getByTestId("copy-title-button").click();
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "タイトルをコピーしました。",
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-html-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("aio-content-operations-guide.html");
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "HTMLファイルを書き出しました。",
  );

  await page.getByTestId("image-regenerate-all-button").click();
  await page
    .getByTestId("image-regeneration-instruction")
    .fill("Use a brighter white background and a more concrete B2B workflow diagram.");
  await page.getByTestId("image-regeneration-start").click();
  await expect(page.getByTestId("image-regeneration-progress")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(page.locator('img[alt="AIO workflow hero image"]').first()).toHaveAttribute(
    "src",
    /cmVnZW4tMQ==/,
  );
  await page.getByTestId("image-regeneration-close").click();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("image-regenerate-single-featured").click();
  await page
    .getByTestId("single-image-regeneration-instruction")
    .fill("Make the featured image more executive and less abstract.");
  await page.getByTestId("single-image-regeneration-start").click();
  await expect(page.getByTestId("single-image-regeneration-progress")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.getByTestId("single-image-regeneration-close").click();
  expect(calls.generateImage).toBe(2);
  expect(calls.generateImagePrompts[0]).toContain("brighter white background");
  expect(calls.generateImagePrompts[1]).toContain("more executive");

  await page.getByTestId("save-draft-button").click();
  expect(calls.saveDraft).toBe(1);

  await page.getByTestId("approve-draft-button").click();
  expect(calls.approveDraft).toBe(1);
  await expect(page.getByTestId("wordpress-site-url")).toBeVisible();

  await page.getByTestId("wordpress-site-url").fill("https://wordpress.example.com");
  await page.getByTestId("wordpress-username").fill("editor");
  await page.getByTestId("wordpress-connect-button").click();
  await expect(page.getByText("Application Passwordを入力してください。")).toBeVisible();

  expect(errors()).toEqual([]);
});

test("API failure is shown in the UI without console errors or crashes", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/theme-candidates$/],
  });
  const completedJob = createCompletedGenerationJob();
  await mockCommonApiRoutes(page, completedJob, { themeCandidatesShouldFail: true });
  await login(page);

  await page.getByTestId("reference-text-0").fill("Reference text for failure handling.");
  await page.getByTestId("theme-candidates-button").click();

  await expect(page.getByTestId("theme-candidates-error")).toContainText("theme candidate failed");
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  expect(errors()).toEqual([]);
});

test("stale generation job state is cleared with a Japanese recovery message", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/generation-jobs\/stale-job$/],
  });

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs/stale-job", async (route) => {
    await route.fulfill({
      status: 404,
      json: { ok: false, error: "Generation job not found." },
    });
  });

  await page.goto("/demo-login");
  await page.evaluate(() => {
    window.localStorage.setItem("aio-active-generation-job-id", "stale-job");
  });
  await page.getByTestId("demo-access-code").fill("202607");
  await page.getByTestId("demo-login-submit").click();
  await page.waitForURL("**/");

  await expect(page.getByText("生成ジョブが見つかりません。")).toBeVisible();
  await expect(page.getByTestId("article-primary-button")).toContainText("AIによる記事作成");
  await expect(
    page.evaluate(() => window.localStorage.getItem("aio-active-generation-job-id")),
  ).resolves.toBeNull();
  expect(errors()).toEqual([]);
});

async function login(page: Page) {
  await page.goto("/demo-login");
  await page.getByTestId("demo-access-code").fill("202607");
  await page.getByTestId("demo-login-submit").click();
  await page.waitForURL("**/");
}

async function mockCommonApiRoutes(
  page: Page,
  completedJob: ReturnType<typeof createCompletedGenerationJob>,
  options: { themeCandidatesShouldFail?: boolean } = {},
) {
  const calls = {
    saveDraft: 0,
    approveDraft: 0,
    generateImage: 0,
    generateImagePrompts: [] as string[],
    articlePrimaryInfo: "",
  };

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });

  await page.route("**/api/extract-file-content", async (route) => {
    await route.fulfill({ json: extractFileSuccess });
  });

  await page.route("**/api/theme-candidates", async (route) => {
    if (options.themeCandidatesShouldFail) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "theme candidate failed" },
      });
      return;
    }

    await route.fulfill({ json: themeCandidates });
  });

  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as {
      form?: { primaryInfo?: string };
    };
    calls.articlePrimaryInfo = body.form?.primaryInfo ?? "";
    await route.fulfill({ json: { ok: true, job: completedJob } });
  });

  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: completedJob } });
  });

  await page.route("**/api/generate-image", async (route) => {
    calls.generateImage += 1;
    const body = route.request().postDataJSON() as {
      prompt?: string;
      slot?: "featured" | "inline-1" | "inline-2";
      altText?: string;
    };
    calls.generateImagePrompts.push(body.prompt ?? "");
    await route.fulfill({
      json: {
        ok: true,
        image: {
          id: `regenerated-${calls.generateImage}`,
          slot: body.slot ?? "featured",
          url: `data:image/png;base64,${Buffer.from(`regen-${calls.generateImage}`).toString("base64")}`,
          path: `generated/regenerated-${calls.generateImage}.png`,
          prompt: body.prompt,
          altText: body.altText ?? "Regenerated image",
          source: "generated",
        },
      },
    });
  });

  await page.route("**/api/save-draft", async (route) => {
    calls.saveDraft += 1;
    const body = route.request().postDataJSON() as { draft?: unknown };
    await route.fulfill({ json: { ok: true, draft: body.draft, storageMode: "local" } });
  });

  await page.route("**/api/approve-draft", async (route) => {
    calls.approveDraft += 1;
    const body = route.request().postDataJSON() as { draft?: Record<string, unknown> };
    await route.fulfill({
      json: {
        ok: true,
        draft: {
          ...(body.draft ?? completedJob.draft),
          status: "approved",
          updatedAt: "2026-07-02T00:01:00.000Z",
        },
      },
    });
  });

  return calls;
}

function collectUnexpectedBrowserErrors(
  page: Page,
  options: { allowedFailedResponses?: RegExp[] } = {},
) {
  const errors: string[] = [];

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      // Chrome mirrors failed fetch responses into the console without the URL.
      // The response listener below performs the URL-aware failure check.
      if (/^Failed to load resource: the server responded with a status of \d+/.test(text)) {
        return;
      }
      errors.push(`console.error: ${text}`);
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !options.allowedFailedResponses?.some((pattern) => pattern.test(url))) {
      errors.push(`HTTP ${status}: ${url}`);
    }
  });

  page.on("requestfailed", (request) => {
    errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
  });

  return () => errors;
}
