import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import extractFileSuccess from "../fixtures/api/extract-file-success.json";
import themeCandidates from "../fixtures/api/theme-candidates.json";
import { createCompletedGenerationJob } from "../fixtures/article";

const competitorResearchFixture = {
  summary: "Generic automation LPs emphasize fast publishing and broad efficiency.",
  queries: ["AIO article generation competitor workflow"],
  insights: [
    {
      url: "https://competitor.example.com/aio",
      title: "Generic Automation LP",
      majorPoints: ["Speed-first publishing", "Template-based article generation"],
      differentiationPoints: ["Less emphasis on editorial approval and primary information"],
      recommendations: ["Lead with human editorial review and field-specific examples"],
    },
  ],
};

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
  await expect(page.getByTestId("generation-logs-panel")).toBeVisible();
  await expect(page.getByTestId("generation-logs-content")).toBeHidden();
  await page.getByTestId("generation-logs-toggle").click();
  await expect(page.getByTestId("generation-logs-content")).toContainText(
    "まだ生成ログはありません。",
  );
  await page.getByTestId("generation-logs-toggle").click();
  await expect(page.getByTestId("generation-logs-content")).toBeHidden();

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

  await page
    .getByTestId("competitor-text-0")
    .fill("Competitor emphasizes generic automation and one-click publishing.");
  await page.getByTestId("competitor-file-input").setInputFiles({
    name: "competitor.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Uploaded competitor file text"),
  });
  await expect(page.getByText("competitor.txt")).toBeVisible();

  await page.getByTestId("competitor-research-button").click();
  expect(calls.competitorResearch).toBe(1);
  await expect(page.getByTestId("competitor-research-progress")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(page.getByTestId("competitor-research-json")).toHaveValue(
    /Generic automation LP/,
  );
  await page.getByTestId("competitor-research-json").fill(
    JSON.stringify(
      {
        ...competitorResearchFixture,
        summary: "Edited competitor summary for E2E",
      },
      null,
      2,
    ),
  );

  await page.getByTestId("theme-candidates-button").click();
  expect(calls.themeCandidateCompetitorSummary).toBe("Edited competitor summary for E2E");
  await expect(page.getByText("AIO Content Operations Guide")).toBeVisible();
  await page.getByTestId("theme-candidate-apply-0").click();
  await expect(page.getByText("反映しました")).toBeVisible();
  await expect(page.getByTestId("theme-textarea")).toHaveValue(/AIO Content Operations Guide/);
  await page
    .getByTestId("closing-textarea")
    .fill("AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。");
  await page
    .getByTestId("primary-info-textarea")
    .fill("当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く帳票不在も多い。");

  await page.getByTestId("article-primary-button").click();
  expect(calls.articlePrimaryInfo).toContain("一人親方");
  expect(calls.articleClosingText).toContain("無料相談");
  expect(calls.articleCompetitorResearchSummary).toBe("Edited competitor summary for E2E");
  expect(calls.articleCompetitorFileNames).toEqual(["competitor.txt"]);
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  await expect(page.getByText("編集品質チェック")).toBeVisible();
  await expect(page.getByText("AI風の汎用表現")).toBeVisible();
  await expect(page.getByText("一次情報の反映")).toBeVisible();
  await expect(page.getByText(/一次情報の固有語彙/)).toBeVisible();
  await expect(page.getByText("結び文章/CTAの反映")).toBeVisible();
  await expect(page.getByText(/結び文章\/CTAの固有語彙/)).toBeVisible();
  await page.getByTestId("quality-improve-regenerate-button").click();
  await expect(page.getByRole("dialog", { name: "記事の再作成" })).toBeVisible();
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /編集品質チェックの結果/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /一次情報の固有語彙/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(/一人親方/);
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /結び文章\/CTAの固有語彙/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(/無料相談/);
  await page.getByTestId("article-regeneration-start").click();
  expect(calls.articleGenerationJobs).toBe(2);
  expect(calls.articleRegenerationInstruction).toContain("一次情報の固有語彙");
  expect(calls.articleRegenerationInstruction).toContain("一人親方");
  expect(calls.articleRegenerationInstruction).toContain("結び文章/CTAの固有語彙");
  expect(calls.articleRegenerationInstruction).toContain("無料相談");
  await expect(page.getByRole("dialog", { name: "記事の再作成" })).toBeHidden();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  await expect(page.locator('img[alt="AIO workflow hero image"]').first()).toHaveAttribute(
    "src",
    /data:image\/png/,
  );
  await page.getByTestId("fullscreen-preview-button").click();
  await expect(page.getByRole("dialog", { name: "全画面プレビュー" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "全画面プレビュー" })).toBeHidden();

  await page.getByTestId("copy-title-button").click();
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "タイトルをコピーしました。",
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-html-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("aio-content-operations-guide.html");
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const downloadedHtml = await readFile(downloadedPath!, "utf8");
  expect(downloadedHtml).toContain("<!doctype html>");
  expect(downloadedHtml).toContain("<title>AIO Content Operations Guide</title>");
  expect(downloadedHtml).toContain("<article>");
  expect(downloadedHtml).toContain("AIO content answers the main question first.");
  expect(downloadedHtml).toContain("Workflow checklist");
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
  await expect(page.getByTestId("draft-action-message")).toContainText(
    "編集内容を保存しました。",
  );

  await page.getByTestId("approve-draft-button").click();
  expect(calls.approveDraft).toBe(1);
  await expect(page.getByTestId("draft-action-message")).toContainText(
    "承認済みに変更しました。",
  );
  await expect(page.getByTestId("wordpress-site-url")).toBeVisible();

  await page.getByTestId("wordpress-site-url").fill("https://wordpress.example.com");
  await page.getByTestId("wordpress-username").fill("editor");
  await page.getByTestId("wordpress-connect-button").click();
  await expect(page.getByText("Application Passwordを入力してください。")).toBeVisible();

  await page.getByTestId("wordpress-application-password").fill("app password");
  await page.getByTestId("wordpress-connect-button").click();
  expect(calls.wordpressConnect).toBe(1);
  await expect(page.getByTestId("wordpress-connection-message")).toContainText(
    "WordPress接続情報を保存しました。",
  );

  await expect(page.getByTestId("wordpress-post-button")).toBeEnabled();
  await page.getByTestId("wordpress-post-button").click();
  expect(calls.wordpressPost).toBe(1);
  await expect(page.getByTestId("wordpress-post-message")).toContainText(
    "WordPressへ下書き投稿しました。",
  );
  await expect(page.getByRole("link", { name: "投稿URL" })).toHaveAttribute(
    "href",
    "https://wordpress.example.com/aio-content-operations-guide",
  );

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

test("competitor research failure resets progress and remains recoverable", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/competitor-research$/],
  });
  const completedJob = createCompletedGenerationJob();
  const calls = await mockCommonApiRoutes(page, completedJob, {
    competitorResearchShouldFail: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for competitor research failure.");
  await page
    .getByTestId("competitor-text-0")
    .fill("Competitor memo for recoverable research failure.");
  await page.getByTestId("competitor-research-button").click();

  expect(calls.competitorResearch).toBe(1);
  await expect(page.getByText("競合情報調査に失敗しました。")).toBeVisible();
  await expect(page.getByTestId("competitor-research-button")).toBeEnabled();
  await expect(page.getByTestId("competitor-research-progress")).toBeHidden();
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  expect(errors()).toEqual([]);
});

test("image regeneration failure shows a recoverable error and resets progress", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/generate-image$/],
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
  const calls = await mockCommonApiRoutes(page, completedJob, {
    generateImageShouldFail: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for image regeneration failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("image-regenerate-all-button").click();
  await page
    .getByTestId("image-regeneration-instruction")
    .fill("Make the image more concrete and less abstract.");
  await page.getByTestId("image-regeneration-start").click();

  expect(calls.generateImage).toBe(1);
  await expect(page.getByText("画像再作成に失敗しました。")).toBeVisible();
  await expect(page.getByTestId("image-regeneration-progress")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(page.getByTestId("image-regeneration-start")).toBeEnabled();
  await expect(page.getByRole("dialog", { name: "画像のみ再作成" })).toBeVisible();
  expect(errors()).toEqual([]);
});

test("article regeneration start failure keeps the existing draft visible", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/generation-jobs$/],
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
  const calls = await mockCommonApiRoutes(page, completedJob, {
    generationJobFailureCall: 2,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for article regeneration failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("article-primary-button").click();
  await expect(page.getByRole("dialog", { name: "記事の再作成" })).toBeVisible();
  await page
    .getByTestId("article-regeneration-instruction")
    .fill("Keep the existing article visible if the regeneration job cannot start.");
  await page.getByTestId("article-regeneration-start").click();

  expect(calls.articleGenerationJobs).toBe(2);
  expect(calls.articleRegenerationInstruction).toContain("existing article visible");
  await expect(page.getByText("記事再作成ジョブを開始できませんでした。").first()).toBeVisible();
  await expect(page.getByText("記事再作成ジョブを開始できませんでした。")).toHaveCount(2);
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  await expect(page.getByTestId("article-primary-button")).toContainText("記事の再作成");
  expect(errors()).toEqual([]);
});

test("file extraction failure is visible and does not block generation with manual fallback", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/extract-file-content$/],
  });
  const completedJob = createCompletedGenerationJob();
  let generationReferenceFiles: Array<{ ok?: boolean; error?: string; name?: string }> = [];

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/extract-file-content", async (route) => {
    await route.fulfill({
      status: 422,
      json: {
        ok: false,
        error: "PDFから十分な本文を抽出できませんでした。",
        detail: "スキャンPDFの可能性があります。手動テキストで補ってください。",
      },
    });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as {
      form?: { referenceFiles?: Array<{ ok?: boolean; error?: string; name?: string }> };
    };
    generationReferenceFiles = body.form?.referenceFiles ?? [];
    await route.fulfill({
      json: { ok: true, job: buildCompletedJobForForm(completedJob, body.form ?? {}) },
    });
  });
  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: completedJob } });
  });

  await login(page);
  await page.getByTestId("reference-file-input").setInputFiles({
    name: "scanned-reference.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF scanned image only"),
  });
  await expect(page.getByText("scanned-reference.pdf")).toBeVisible();
  await expect(page.getByText(/解析エラー/)).toBeVisible();
  await expect(page.getByText(/手動テキストで補ってください/)).toBeVisible();

  await page
    .getByTestId("reference-text-0")
    .fill("Manual fallback text after scanned PDF extraction failed.");
  await page.getByTestId("article-primary-button").click();

  expect(generationReferenceFiles).toEqual([
    expect.objectContaining({
      name: "scanned-reference.pdf",
      ok: false,
      error: expect.stringContaining("手動テキストで補ってください"),
    }),
  ]);
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(errors()).toEqual([]);
});

test("invalid editable competitor research JSON can be fixed before generation", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
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

  await page.getByTestId("reference-text-0").fill("Reference text for invalid JSON recovery.");
  await page.getByTestId("competitor-research-button").click();
  await expect(page.getByTestId("competitor-research-json")).toHaveValue(
    /Generic automation LP/,
  );

  await page.getByTestId("competitor-research-json").fill("{ invalid competitor json");
  await page.getByTestId("article-primary-button").click();

  await expect(page.getByTestId("competitor-research-json-error")).toContainText(
    "競合調査JSONの形式を確認してください。",
  );
  await expect(page.getByTestId("article-primary-button")).toContainText("AIによる記事作成");
  expect(calls.articlePrimaryInfo).toBe("");
  expect(calls.articleGenerationJobs).toBe(0);

  await page.getByTestId("competitor-research-json").fill(
    JSON.stringify({
      summary: "Syntactically valid but missing required arrays",
    }),
  );
  await page.getByTestId("article-primary-button").click();
  await expect(page.getByTestId("competitor-research-json-error")).toContainText(
    "summary、queries、insights",
  );
  expect(calls.articleGenerationJobs).toBe(0);

  await page.getByTestId("competitor-research-json").fill(
    JSON.stringify(
      {
        ...competitorResearchFixture,
        summary: "Recovered competitor JSON summary",
      },
      null,
      2,
    ),
  );
  await expect(page.getByTestId("competitor-research-json-error")).toBeHidden();
  await page.getByTestId("article-primary-button").click();

  expect(calls.articleCompetitorResearchSummary).toBe("Recovered competitor JSON summary");
  expect(calls.articleGenerationJobs).toBe(1);
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(errors()).toEqual([]);
});

test("generation logs show previous output and can reopen a saved draft", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  completedJob.id = "job-log-e2e";
  completedJob.draftId = "draft-log-e2e";
  completedJob.wordpressPostStatus = "draft";
  completedJob.wordpressPostUrl = "https://wordpress.example.com/recovered-log-article";
  completedJob.inputPayload = {
    ...completedJob.inputPayload,
    theme: "ログから再利用するAIO記事",
  };
  completedJob.draft = {
    ...completedJob.draft!,
    id: "draft-log-e2e",
    editedTitle: "Recovered Log Article",
    editedSlug: "recovered-log-article",
    images: [
      {
        ...completedJob.draft!.images[0],
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      },
    ],
  };

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        logs: [
          {
            id: "job-log-e2e",
            status: "completed",
            createdAt: "2026-07-02T00:00:00.000Z",
            updatedAt: "2026-07-02T00:02:00.000Z",
            completedAt: "2026-07-02T00:02:00.000Z",
            inputSummary: "ログから再利用するAIO記事 / 参照1件 / 競合1件",
            outputTitle: "Recovered Log Article",
            outputSlug: "recovered-log-article",
            draftStatus: "posted",
            wordpressPostStatus: "draft",
            wordpressPostUrl: "https://wordpress.example.com/recovered-log-article",
          },
        ],
      },
    });
  });
  await page.route("**/api/generation-jobs/job-log-e2e", async (route) => {
    await route.fulfill({ json: { ok: true, job: completedJob } });
  });

  await login(page);
  await expect(page.getByTestId("generation-logs-panel")).toContainText("1件");
  await expect(page.getByTestId("generation-logs-content")).toBeHidden();
  await page.getByTestId("generation-logs-toggle").click();

  await expect(page.getByTestId("generation-logs-content")).toContainText(
    "ログから再利用するAIO記事",
  );
  await expect(page.getByTestId("generation-logs-content")).toContainText(
    "Recovered Log Article",
  );
  await expect(page.getByTestId("generation-logs-content")).toContainText("recovered-log-article");
  await expect(page.getByTestId("generation-logs-content")).toContainText("下書き投稿");
  await expect(page.getByTestId("generation-logs-content")).toContainText("完了");

  await page.getByTestId("generation-log-open-job-log-e2e").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Recovered Log Article" }),
  ).toBeVisible();
  await expect(page.getByTestId("download-html-button")).toBeVisible();
  expect(errors()).toEqual([]);
});

test("generation log loading failure stays local to the logs panel", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/generation-logs$/],
  });

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({
      status: 503,
      json: { ok: false, error: "生成ログの取得に失敗しました。" },
    });
  });

  await login(page);
  await expect(page.getByTestId("generation-logs-panel")).toBeVisible();
  await page.getByTestId("generation-logs-toggle").click();

  await expect(page.getByTestId("generation-logs-error")).toContainText(
    "生成ログの取得に失敗しました。",
  );
  await page.getByTestId("reference-text-0").fill("Reference text after log failure.");
  await expect(page.getByTestId("reference-text-0")).toHaveValue(
    "Reference text after log failure.",
  );
  expect(errors()).toEqual([]);
});

test("approved drafts can be published to WordPress with Japanese publish status", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
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
  await page.getByTestId("reference-text-0").fill("Reference text for WordPress publish flow.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("approve-draft-button").click();
  await expect(page.getByTestId("draft-action-message")).toContainText(
    "承認済みに変更しました。",
  );

  await page.getByTestId("wordpress-site-url").fill("https://wordpress.example.com");
  await page.getByTestId("wordpress-username").fill("editor");
  await page.getByTestId("wordpress-application-password").fill("app password");
  await page.getByTestId("wordpress-connect-button").click();
  await expect(page.getByTestId("wordpress-connection-message")).toContainText(
    "WordPress接続情報を保存しました。",
  );

  await page.getByTestId("wordpress-status-select").selectOption("publish");
  await page.getByTestId("wordpress-post-button").click();

  expect(calls.wordpressPost).toBe(1);
  expect(calls.wordpressPostStatus).toBe("publish");
  await expect(page.getByTestId("wordpress-post-message")).toContainText(
    "WordPressへ公開投稿しました。",
  );
  expect(errors()).toEqual([]);
});

test("WordPress post failure keeps the approved draft recoverable", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/wordpress\/post$/],
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
  const calls = await mockCommonApiRoutes(page, completedJob, {
    wordpressPostShouldFail: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for WordPress post failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("approve-draft-button").click();
  await expect(page.getByTestId("draft-action-message")).toContainText(
    "承認済みに変更しました。",
  );

  await page.getByTestId("wordpress-site-url").fill("https://wordpress.example.com");
  await page.getByTestId("wordpress-username").fill("editor");
  await page.getByTestId("wordpress-application-password").fill("app password");
  await page.getByTestId("wordpress-connect-button").click();
  await expect(page.getByTestId("wordpress-connection-message")).toContainText(
    "WordPress接続情報を保存しました。",
  );

  await page.getByTestId("wordpress-post-button").click();

  expect(calls.wordpressPost).toBe(1);
  await expect(page.getByText("WordPress投稿に失敗しました。")).toBeVisible();
  await expect(page.getByTestId("wordpress-post-button")).toBeEnabled();
  await expect(page.getByTestId("wordpress-post-message")).toBeHidden();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(errors()).toEqual([]);
});

test("WordPress connection validation errors are normalized near the connection form", async ({
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
  const calls = await mockCommonApiRoutes(page, completedJob, {
    wordpressConnectShouldReturnRawValidation: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for WordPress connection failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("approve-draft-button").click();
  await page.getByTestId("wordpress-site-url").fill("https://wordpress.example.com");
  await page.getByTestId("wordpress-username").fill("editor");
  await page.getByTestId("wordpress-application-password").fill("app password");
  await page.getByTestId("wordpress-connect-button").click();

  expect(calls.wordpressConnect).toBe(1);
  await expect(page.getByText("Application Passwordを入力してください。")).toBeVisible();
  await expect(page.getByTestId("wordpress-connection-message")).toBeHidden();
  await expect(page.getByTestId("wordpress-post-button")).toBeDisabled();
  expect(errors()).toEqual([]);
});

test("draft save failure keeps edits visible and recoverable", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/save-draft$/],
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
  const calls = await mockCommonApiRoutes(page, completedJob, {
    saveDraftShouldFail: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for draft save failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("draft-title-input").fill("Edited title kept after save failure");
  await page.getByTestId("save-draft-button").click();

  expect(calls.saveDraft).toBe(1);
  await expect(page.getByText("ドラフト保存に失敗しました。")).toBeVisible();
  await expect(page.getByTestId("draft-title-input")).toHaveValue(
    "Edited title kept after save failure",
  );
  await expect(page.getByTestId("save-draft-button")).toBeEnabled();
  await expect(page.getByTestId("draft-action-message")).toBeHidden();
  expect(errors()).toEqual([]);
});

test("draft approval failure keeps the editable draft visible and recoverable", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/approve-draft$/],
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
  const calls = await mockCommonApiRoutes(page, completedJob, {
    approveDraftShouldFail: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for draft approval failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("draft-title-input").fill("Edited title kept after approval failure");
  await page.getByTestId("approve-draft-button").click();

  expect(calls.approveDraft).toBe(1);
  await expect(page.getByText("ドラフト承認に失敗しました。")).toBeVisible();
  await expect(page.getByTestId("draft-title-input")).toHaveValue(
    "Edited title kept after approval failure",
  );
  await expect(page.getByTestId("approve-draft-button")).toBeEnabled();
  await expect(page.getByTestId("wordpress-post-button")).toBeDisabled();
  await expect(page.getByTestId("draft-action-message")).toBeHidden();
  expect(errors()).toEqual([]);
});

test("copy failure shows manual recovery guidance without breaking the draft preview", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("clipboard denied")),
      },
    });
    document.execCommand = () => false;
  });
  const errors = collectUnexpectedBrowserErrors(page);
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
  await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for clipboard failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("copy-body-html-button").click();

  await expect(page.getByTestId("copy-export-status")).toContainText("コピーできませんでした。");
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "本文HTML欄から手動でコピーしてください。",
  );
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
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

test("user can stop an in-progress generation job from the primary CTA", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const runningJob = {
    ...createCompletedGenerationJob(),
    id: "job-cancel-e2e",
    status: "running" as const,
    draft: undefined,
    draftId: undefined,
    completedAt: undefined,
    steps: [
      { id: "fetch_refs", label: "参照URL本文抽出", status: "running" as const, detail: "処理中" },
      { id: "fetch_competitors", label: "競合URL本文抽出", status: "pending" as const },
      { id: "merge_research", label: "競合調査統合", status: "pending" as const },
      { id: "generate_outline", label: "記事構成案生成", status: "pending" as const },
      { id: "generate_body", label: "AIO本文生成", status: "pending" as const },
      { id: "generate_meta", label: "タイトル・メタ・FAQ生成", status: "pending" as const },
      { id: "image_prompts", label: "画像プロンプト生成", status: "pending" as const },
      { id: "images", label: "画像生成または反映", status: "pending" as const },
      { id: "save", label: "ドラフト保存", status: "pending" as const },
    ],
  };
  let cancelCalls = 0;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs/job-cancel-e2e/cancel", async (route) => {
    cancelCalls += 1;
    await route.fulfill({
      json: {
        ok: true,
        job: {
          ...runningJob,
          status: "canceled",
          error: "記事作成を停止しました。",
        },
      },
    });
  });
  await page.route("**/api/generation-jobs/job-cancel-e2e", async (route) => {
    await route.fulfill({ json: { ok: true, job: runningJob } });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    await route.fulfill({ json: { ok: true, job: runningJob } });
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for cancel handling.");
  await page.getByTestId("article-primary-button").click();
  await expect(page.getByTestId("article-primary-button")).toContainText("記事作成をストップ");
  await page.getByTestId("article-primary-button").click();

  expect(cancelCalls).toBe(1);
  await expect(page.getByText("記事作成を停止しました。")).toBeVisible();
  await expect(page.getByTestId("article-primary-button")).toContainText("AIによる記事作成");
  await expect(
    page.evaluate(() => window.localStorage.getItem("aio-active-generation-job-id")),
  ).resolves.toBeNull();
  expect(errors()).toEqual([]);
});

test("failed generation job shows recovery guidance and clears active state", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const runningJob = {
    ...createCompletedGenerationJob(),
    id: "job-failed-e2e",
    status: "running" as const,
    draft: undefined,
    draftId: undefined,
    completedAt: undefined,
    steps: [
      { id: "generate_body", label: "AIO本文生成", status: "running" as const, detail: "処理中" },
    ],
  };
  const failedJob = {
    ...runningJob,
    status: "failed" as const,
    completedAt: "2026-07-02T00:05:00.000Z",
    error:
      "OpenAIの利用上限またはレート制限に達しました。少し時間をおくか、画像枚数・入力量を減らして再実行してください。",
    steps: runningJob.steps.map((step) => ({
      ...step,
      status: "error" as const,
      detail:
        "OpenAIの利用上限またはレート制限に達しました。少し時間をおくか、画像枚数・入力量を減らして再実行してください。",
    })),
  };
  let pollCalls = 0;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs/job-failed-e2e", async (route) => {
    pollCalls += 1;
    await route.fulfill({ json: { ok: true, job: failedJob } });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    await route.fulfill({ json: { ok: true, job: runningJob } });
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for failed job handling.");
  await page.getByTestId("article-primary-button").click();

  await expect(
    page.getByText("OpenAIの利用上限またはレート制限に達しました。").first(),
  ).toBeVisible();
  await expect(page.getByText("AIO本文生成")).toBeVisible();
  await expect(
    page.getByText("OpenAIの利用上限またはレート制限に達しました。"),
  ).toHaveCount(2);
  await expect(page.getByTestId("article-primary-button")).toContainText("AIによる記事作成");
  await expect(
    page.evaluate(() => window.localStorage.getItem("aio-active-generation-job-id")),
  ).resolves.toBeNull();
  expect(pollCalls).toBeGreaterThanOrEqual(1);
  expect(errors()).toEqual([]);
});

test("uploaded visual tone image is sent to generation as upload mode", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  let uploadCalls = 0;
  let generationVisualTone: Record<string, unknown> | undefined;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/upload-image", async (route) => {
    uploadCalls += 1;
    await route.fulfill({
      json: {
        ok: true,
        url: "data:image/png;base64,dXBsb2FkZWQtdG9uZQ==",
        path: "article-inserts/uploaded-tone.png",
        filename: "tone.png",
        storageMode: "local",
      },
    });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as {
      form?: { visualTone?: Record<string, unknown> };
    };
    generationVisualTone = body.form?.visualTone;
    await route.fulfill({ json: { ok: true, job: completedJob } });
  });
  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: completedJob } });
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for uploaded visual tone.");
  await page.getByTestId("visual-tone-mode-upload").click();
  await expect(
    page.getByText(
      "画像アップロード方式では、AI画像生成は行わず、アップロード画像1枚を反映します。",
    ),
  ).toBeVisible();
  await page.getByTestId("visual-tone-upload-input").setInputFiles({
    name: "tone.png",
    mimeType: "image/png",
    buffer: Buffer.from("uploaded-tone"),
  });
  await expect(page.locator('img[alt="挿入画像"]')).toHaveAttribute("src", /data:image\/png/);

  await page.getByTestId("article-primary-button").click();

  expect(uploadCalls).toBe(1);
  expect(generationVisualTone).toMatchObject({
    mode: "upload",
    uploadedImageUrl: "data:image/png;base64,dXBsb2FkZWQtdG9uZQ==",
    uploadedImagePath: "article-inserts/uploaded-tone.png",
    uploadedImageName: "tone.png",
  });
  expect(errors()).toEqual([]);
});

test("previous closing text and author inputs can be reused from local storage", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const previousAuthorImageUrl = "data:image/png;base64,cHJldmlvdXMtYXV0aG9y";

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });

  await page.goto("/demo-login");
  await page.evaluate((imageUrl) => {
    window.localStorage.setItem(
      "aio-last-closing-text",
      "前回保存した問い合わせ誘導文です。",
    );
    window.localStorage.setItem(
      "aio-last-author",
      JSON.stringify({
        name: "前回 太郎",
        title: "編集責任者",
        bio: "AIO記事の編集と公開前レビューを担当しています。",
        imageUrl,
      }),
    );
  }, previousAuthorImageUrl);
  await page.getByTestId("demo-access-code").fill("202607");
  await page.getByTestId("demo-login-submit").click();
  await page.waitForURL("**/");

  await page.getByTestId("closing-reuse-checkbox").setChecked(true);
  await expect(page.getByTestId("closing-textarea")).toHaveValue(
    "前回保存した問い合わせ誘導文です。",
  );
  await expect(page.getByText("前回の結び文章を反映しました。")).toBeVisible();

  await page.getByTestId("author-reuse-checkbox").setChecked(true);
  await expect(page.getByTestId("author-name-input")).toHaveValue("前回 太郎");
  await expect(page.getByTestId("author-title-input")).toHaveValue("編集責任者");
  await expect(page.getByTestId("author-bio-textarea")).toHaveValue(
    "AIO記事の編集と公開前レビューを担当しています。",
  );
  await expect(page.getByText("前回の執筆者情報を反映しました。")).toBeVisible();
  await expect(page.locator('img[alt="執筆者画像"]')).toHaveAttribute(
    "src",
    previousAuthorImageUrl,
  );
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
  options: {
    themeCandidatesShouldFail?: boolean;
    competitorResearchShouldFail?: boolean;
    generateImageShouldFail?: boolean;
    generationJobFailureCall?: number;
    wordpressPostShouldFail?: boolean;
    wordpressConnectShouldReturnRawValidation?: boolean;
    saveDraftShouldFail?: boolean;
    approveDraftShouldFail?: boolean;
  } = {},
) {
  let latestCompletedJob = completedJob;
  const calls = {
    saveDraft: 0,
    approveDraft: 0,
    generateImage: 0,
    generateImagePrompts: [] as string[],
    competitorResearch: 0,
    extractFile: 0,
    themeCandidateCompetitorSummary: "",
    articleGenerationJobs: 0,
    articlePrimaryInfo: "",
    articleClosingText: "",
    articleRegenerationInstruction: "",
    articleCompetitorResearchSummary: "",
    articleCompetitorFileNames: [] as string[],
    wordpressConnect: 0,
    wordpressPost: 0,
    wordpressPostStatus: "" as "" | "draft" | "publish",
  };

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });

  await page.route("**/api/extract-file-content", async (route) => {
    calls.extractFile += 1;
    const name = calls.extractFile === 1 ? "reference.txt" : "competitor.txt";
    await route.fulfill({
      json: {
        ...extractFileSuccess,
        attachment: {
          ...extractFileSuccess.attachment,
          id: `file-${calls.extractFile}`,
          name,
          text:
            calls.extractFile === 1
              ? "Uploaded reference file text for AIO article generation."
              : "Uploaded competitor file text for AIO article generation.",
        },
      },
    });
  });

  await page.route("**/api/competitor-research", async (route) => {
    calls.competitorResearch += 1;
    if (options.competitorResearchShouldFail) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "競合情報調査に失敗しました。" },
      });
      return;
    }

    await route.fulfill({ json: { ok: true, result: competitorResearchFixture } });
  });

  await page.route("**/api/theme-candidates", async (route) => {
    if (options.themeCandidatesShouldFail) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "theme candidate failed" },
      });
      return;
    }

    const body = route.request().postDataJSON() as {
      competitorResearch?: { summary?: string };
    };
    calls.themeCandidateCompetitorSummary = body.competitorResearch?.summary ?? "";
    await route.fulfill({ json: themeCandidates });
  });

  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as {
      form?: {
        primaryInfo?: string;
        closingText?: string;
        regenerationInstruction?: string;
        competitorFiles?: Array<{ name?: string }>;
      };
      competitorResearch?: { summary?: string };
    };
    calls.articleGenerationJobs += 1;
    calls.articlePrimaryInfo = body.form?.primaryInfo ?? "";
    calls.articleClosingText = body.form?.closingText ?? "";
    calls.articleRegenerationInstruction = body.form?.regenerationInstruction ?? "";
    calls.articleCompetitorFileNames =
      body.form?.competitorFiles?.map((file) => file.name ?? "") ?? [];
    calls.articleCompetitorResearchSummary = body.competitorResearch?.summary ?? "";
    if (options.generationJobFailureCall === calls.articleGenerationJobs) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "記事再作成ジョブを開始できませんでした。" },
      });
      return;
    }

    latestCompletedJob = buildCompletedJobForForm(completedJob, body.form ?? {});
    await route.fulfill({ json: { ok: true, job: latestCompletedJob } });
  });

  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: latestCompletedJob } });
  });

  await page.route("**/api/generate-image", async (route) => {
    calls.generateImage += 1;
    if (options.generateImageShouldFail) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "画像再作成に失敗しました。" },
      });
      return;
    }

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
    if (options.saveDraftShouldFail) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "ドラフト保存に失敗しました。" },
      });
      return;
    }

    const body = route.request().postDataJSON() as { draft?: unknown };
    await route.fulfill({ json: { ok: true, draft: body.draft, storageMode: "local" } });
  });

  await page.route("**/api/approve-draft", async (route) => {
    calls.approveDraft += 1;
    if (options.approveDraftShouldFail) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "ドラフト承認に失敗しました。" },
      });
      return;
    }

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

  await page.route("**/api/wordpress/connect", async (route) => {
    calls.wordpressConnect += 1;
    if (options.wordpressConnectShouldReturnRawValidation) {
      await route.fulfill({
        status: 400,
        json: {
          ok: false,
          error:
            '[ { "origin": "string", "code": "too_small", "minimum": 1, "inclusive": true, "path": [ "applicationPassword" ], "message": "Too small: expected string to have >=1 characters" } ]',
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        ok: true,
        connection: {
          id: "wp-connection-1",
          siteUrl: "https://wordpress.example.com",
          username: "editor",
          createdAt: "2026-07-02T00:02:00.000Z",
        },
      },
    });
  });

  await page.route("**/api/wordpress/post", async (route) => {
    calls.wordpressPost += 1;
    const body = route.request().postDataJSON() as {
      draft?: Record<string, unknown>;
      status?: "draft" | "publish";
    };
    calls.wordpressPostStatus = body.status ?? "draft";
    if (options.wordpressPostShouldFail) {
      await route.fulfill({
        status: 502,
        json: { ok: false, error: "WordPress投稿に失敗しました。" },
      });
      return;
    }

    await route.fulfill({
      json: {
        ok: true,
        postUrl: "https://wordpress.example.com/aio-content-operations-guide",
        draft: {
          ...(body.draft ?? completedJob.draft),
          status: "posted",
          wordpressPostUrl: "https://wordpress.example.com/aio-content-operations-guide",
          updatedAt: "2026-07-02T00:03:00.000Z",
        },
        wordpressStatus: body.status ?? "draft",
      },
    });
  });

  return calls;
}

function buildCompletedJobForForm(
  completedJob: ReturnType<typeof createCompletedGenerationJob>,
  form: Record<string, unknown>,
) {
  const inputPayload = {
    ...completedJob.inputPayload,
    ...form,
  };

  return {
    ...completedJob,
    inputPayload,
    draft: completedJob.draft
      ? {
          ...completedJob.draft,
          inputPayload: {
            ...completedJob.draft.inputPayload,
            ...form,
          },
        }
      : completedJob.draft,
  };
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
