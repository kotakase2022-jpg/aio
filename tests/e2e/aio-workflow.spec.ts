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
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          window.localStorage.setItem("aio-e2e-last-copy", value);
        },
      },
    });
  });

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
  await expect(page.getByTestId("step-nav-disabled-approval")).toBeVisible();
  await expect(page.getByTestId("step-nav-disabled-wordpress")).toBeVisible();
  await expect(page.locator('a[href="#approval"]')).toHaveCount(0);
  await expect(page.locator('a[href="#wordpress"]')).toHaveCount(0);

  await expect(page.getByTestId("input-wizard-step-references")).toBeVisible();
  await expect(page.getByTestId("input-wizard-step-competitors")).toHaveCount(0);

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

  await page.getByTestId("input-wizard-next").click();
  await expect(page.getByTestId("input-wizard-step-competitors")).toBeVisible();
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

  await page.getByTestId("input-wizard-next").click();
  await expect(page.getByTestId("input-wizard-step-theme")).toBeVisible();
  await page.getByTestId("theme-candidates-button").click();
  expect(calls.themeCandidateCompetitorSummary).toBe("Edited competitor summary for E2E");
  await expect(page.getByTestId("theme-candidate-card-0")).toContainText(
    "AIO Content Operations Guide",
  );
  await page.getByTestId("theme-candidate-apply-0").click();
  await expect(page.getByTestId("theme-candidate-card-0")).toContainText("反映しました");
  await expect(page.getByTestId("theme-candidate-card-1")).not.toContainText("反映しました");
  await expect(page.getByTestId("theme-textarea")).toHaveValue(/AIO Content Operations Guide/);
  await page
    .getByTestId("closing-textarea")
    .fill("AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。");

  await page.getByTestId("input-wizard-next").click();
  await expect(page.getByTestId("input-wizard-step-primary-info")).toBeVisible();
  await page.getByTestId("primary-info-type-frequent-consultations").click();
  await page
    .getByTestId("primary-info-textarea")
    .fill("当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く帳票不在も多い。");

  const primaryInformationPanel = page.getByTestId("input-wizard-step-primary-info");
  await primaryInformationPanel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await primaryInformationPanel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.getByTestId("input-wizard-next").click();
  const visualTonePanel = page.getByTestId("input-wizard-step-visual-tone");
  await expect(visualTonePanel).toBeVisible();
  await expect.poll(() => visualTonePanel.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByTestId("input-wizard-next").click();
  await expect(page.getByTestId("input-wizard-step-word-count")).toBeVisible();
  await page.getByTestId("input-wizard-next").click();
  await expect(page.getByTestId("input-wizard-message")).toContainText("入力が完了しました");

  await page.getByTestId("article-primary-button").click();
  expect(calls.articlePrimaryInfo).toContain("一人親方");
  expect(calls.articlePrimaryInfoTypes).toEqual(
    expect.arrayContaining(["criteria-knowhow", "frequent-consultations"]),
  );
  expect(calls.articleClosingText).toContain("無料相談");
  expect(calls.articleCompetitorResearchSummary).toBe("Edited competitor summary for E2E");
  expect(calls.articleCompetitorFileNames).toEqual(["competitor.txt"]);
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  await expect(page.getByTestId("step-nav-disabled-approval")).toHaveCount(0);
  await expect(page.getByTestId("step-nav-disabled-wordpress")).toHaveCount(0);
  await expect(page.locator('a[href="#approval"]')).toHaveCount(1);
  await expect(page.locator('a[href="#wordpress"]')).toHaveCount(1);
  await page.locator('a[href="#approval"]').click();
  await expect(page).toHaveURL(/#approval/);
  await expect(page.locator("#approval")).toBeVisible();
  await expect(page.getByText("編集品質チェック")).toBeVisible();
  await expect(page.getByText("AI風の汎用表現")).toBeVisible();
  await expect(page.getByText("一次情報の反映")).toBeVisible();
  await expect(page.getByText(/^一次情報の固有語彙/).first()).toBeVisible();
  await expect(page.getByText("一次情報の冒頭反映")).toBeVisible();
  await expect(page.getByText(/冒頭の結論や読者の判断材料/)).toBeVisible();
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
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 一次情報の固有語彙を、当社の経験、相談傾向、現場観察/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(/冒頭400字以内/);
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(/一人親方/);
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /結び文章\/CTAの固有語彙/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 結び文章\/CTAの固有語彙を、本文末尾の自然な誘導文/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(/無料相談/);
  await page.getByTestId("article-regeneration-start").click();
  expect(calls.articleGenerationJobs).toBe(2);
  expect(calls.articleRegenerationInstruction).toContain("一次情報の固有語彙");
  expect(calls.articleRegenerationInstruction).toContain(
    "修正方針: 一次情報の固有語彙を",
  );
  expect(calls.articleRegenerationInstruction).toContain("冒頭400字以内");
  expect(calls.articleRegenerationInstruction).toContain("一人親方");
  expect(calls.articleRegenerationInstruction).toContain("結び文章/CTAの固有語彙");
  expect(calls.articleRegenerationInstruction).toContain("修正方針: 結び文章/CTAの固有語彙");
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
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "success");

  await page.getByTestId("copy-handoff-button").click();
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "入稿セットをコピーしました。",
  );
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "success");
  const handoffText = await page.evaluate(
    () => window.localStorage.getItem("aio-e2e-last-copy") ?? "",
  );
  expect(handoffText).toContain("タイトル: AIO Content Operations Guide");
  expect(handoffText).toContain("スラッグ: aio-content-operations-guide");
  expect(handoffText).toContain("メタディスクリプション:");
  expect(handoffText).toContain("タグ: AIO, AI search, B2B");
  expect(handoffText).toContain("カテゴリ: Content Marketing");
  expect(handoffText).toContain("本文HTML:");
  expect(handoffText).toContain("AIO content answers the main question first.");

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
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "success");

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
    /\/mock-images\/regenerated-1\.png/,
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
  await expect(page.locator('img[alt="AIO workflow hero image"]').first()).toHaveAttribute(
    "src",
    /\/mock-images\/regenerated-2\.png/,
  );
  expect(calls.generateImage).toBe(2);
  expect(calls.generateImagePrompts[0]).toContain("brighter white background");
  expect(calls.generateImagePrompts[0]).toContain("Article summary anchor");
  expect(calls.generateImagePrompts[0]).toContain("Key takeaways to preserve");
  expect(calls.generateImagePrompts[1]).toContain("more executive");
  expect(calls.generateImagePrompts[1]).toContain("Relevant headings");

  await page.getByTestId("draft-title-input").fill("Human Edited AIO Guide");
  await page.getByTestId("draft-slug-input").fill("human-edited-aio-guide");
  await page
    .getByTestId("draft-meta-textarea")
    .fill("Human-edited meta description for editorial handoff and WordPress.");
  await page
    .getByTestId("draft-body-html-textarea")
    .fill("<h2>Human edited section</h2><p>Human-edited body with a concrete review note.</p>");
  await page.getByTestId("draft-tags-input").fill("AIO, Editorial QA");
  await page.getByTestId("draft-categories-input").fill("Operations, Content");
  await page.getByTestId("draft-faq-question-0").fill("What did editorial review change?");
  await page
    .getByTestId("draft-faq-answer-0")
    .fill("It added a concrete FAQ answer that must appear in the final handoff.");
  await page.getByTestId("draft-faq-add-button").click();
  await page
    .getByTestId("draft-faq-question-3")
    .fill("Which added FAQ survives the editorial handoff?");
  await page
    .getByTestId("draft-faq-answer-3")
    .fill("The added FAQ is saved, previewed, and sent with the WordPress draft payload.");
  await page.getByTestId("draft-faq-remove-1").click();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Human Edited AIO Guide" }),
  ).toBeVisible();
  await expect(
    page.getByText("It added a concrete FAQ answer that must appear in the final handoff."),
  ).toBeVisible();
  await expect(
    page.getByText("The added FAQ is saved, previewed, and sent with the WordPress draft payload."),
  ).toBeVisible();
  await expect(page.getByText("Do humans still edit?")).toHaveCount(0);
  await page.getByTestId("copy-handoff-button").click();
  const editedHandoffText = await page.evaluate(
    () => window.localStorage.getItem("aio-e2e-last-copy") ?? "",
  );
  expect(editedHandoffText).toContain("タイトル: Human Edited AIO Guide");
  expect(editedHandoffText).toContain("スラッグ: human-edited-aio-guide");
  expect(editedHandoffText).toContain("タグ: AIO, Editorial QA");
  expect(editedHandoffText).toContain("カテゴリ: Operations, Content");
  expect(editedHandoffText).toContain("Human-edited body with a concrete review note.");
  expect(editedHandoffText).toContain(
    "It added a concrete FAQ answer that must appear in the final handoff.",
  );
  expect(editedHandoffText).toContain(
    "The added FAQ is saved, previewed, and sent with the WordPress draft payload.",
  );
  expect(editedHandoffText).not.toContain("Do humans still edit?");

  await page.getByTestId("save-draft-button").click();
  expect(calls.saveDraft).toBe(1);
  expect(calls.lastSavedDraft).toMatchObject({
    editedTitle: "Human Edited AIO Guide",
    editedSlug: "human-edited-aio-guide",
    editedMetaDescription: "Human-edited meta description for editorial handoff and WordPress.",
    tags: ["AIO", "Editorial QA"],
    categories: ["Operations", "Content"],
  });
  expect(calls.lastSavedDraft?.faqItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        question: "What did editorial review change?",
        answer: "It added a concrete FAQ answer that must appear in the final handoff.",
      }),
      expect.objectContaining({
        question: "Which added FAQ survives the editorial handoff?",
        answer: "The added FAQ is saved, previewed, and sent with the WordPress draft payload.",
      }),
    ]),
  );
  expect(
    (calls.lastSavedDraft?.faqItems as Array<{ question?: string }> | undefined)?.some(
      (item) => item.question === "Do humans still edit?",
    ),
  ).toBe(false);
  const savedImages = calls.lastSavedDraft?.images as
    | Array<{ url?: string; prompt?: string; path?: string }>
    | undefined;
  expect(savedImages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        url: "/mock-images/regenerated-2.png",
        path: "generated/regenerated-2.png",
        prompt: expect.stringContaining("more executive"),
      }),
    ]),
  );
  expect(String(calls.lastSavedDraft?.editedBodyHtml)).toContain("Human-edited body");
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
  expect(calls.lastWordpressDraft).toMatchObject({
    editedTitle: "Human Edited AIO Guide",
    editedSlug: "human-edited-aio-guide",
    tags: ["AIO", "Editorial QA"],
    categories: ["Operations", "Content"],
  });
  expect(calls.lastWordpressDraft?.faqItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        question: "What did editorial review change?",
        answer: "It added a concrete FAQ answer that must appear in the final handoff.",
      }),
      expect.objectContaining({
        question: "Which added FAQ survives the editorial handoff?",
        answer: "The added FAQ is saved, previewed, and sent with the WordPress draft payload.",
      }),
    ]),
  );
  expect(
    (calls.lastWordpressDraft?.faqItems as Array<{ question?: string }> | undefined)?.some(
      (item) => item.question === "Do humans still edit?",
    ),
  ).toBe(false);
  const wordpressImages = calls.lastWordpressDraft?.images as
    | Array<{ url?: string; prompt?: string; path?: string }>
    | undefined;
  expect(wordpressImages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        url: "/mock-images/regenerated-2.png",
        path: "generated/regenerated-2.png",
        prompt: expect.stringContaining("more executive"),
      }),
    ]),
  );
  expect(String(calls.lastWordpressDraft?.editedBodyHtml)).toContain("Human-edited body");
  await expect(page.getByTestId("wordpress-post-message")).toContainText(
    "WordPressへ下書き投稿しました。",
  );
  await expect(page.getByRole("link", { name: "投稿URL" })).toHaveAttribute(
    "href",
    "https://wordpress.example.com/aio-content-operations-guide",
  );

  expect(errors()).toEqual([]);
});

test("editing the title to a generic label updates the quality checklist", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  completedJob.draft = {
    ...completedJob.draft!,
    images: [
      {
        ...completedJob.draft!.images[0],
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        altText: "image",
      },
    ],
  };
  await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for title quality checklist.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("draft-title-input").fill("重要なポイント");
  await page.getByTestId("draft-meta-textarea").fill("この記事ではAIOについてわかりやすく解説します。");
  await page.getByTestId("draft-faq-question-0").fill("メリットは何ですか？");
  await page.getByTestId("draft-faq-answer-0").fill("重要です。");
  await page.getByTestId("draft-faq-remove-2").click();
  await page.getByTestId("draft-faq-remove-1").click();
  await page
    .getByTestId("draft-body-html-textarea")
    .fill(
      "<h2>重要なポイント</h2><p>近年、多くの企業で注目されています。重要です。問い合わせが300%増え、費用は50万円削減できます。当社の支援現場で出てきた参照元の制度説明と自社の観察と競合記事の比較軸と問い合わせ時の失敗例と費用や期間の条件と公開後の修正責任と承認担当の確認漏れと問い合わせ前後の読者の不安を一文に詰め込むと、読者がどこを判断すべきか追えなくなり、社内確認でも論点が戻りやすくなります。</p><p>また、参照元を確認します。また、一次情報を分けます。また、競合差分を見ます。また、公開前に見直します。具体的には、担当を確認します。具体的には、期限を確認します。具体的には、出典を確認します。</p><table><tr><th>項目</th><td>内容</td></tr></table><h2>まず準備すること</h2><p>確認します。</p><h2>次に確認すること</h2><p>整理します。</p><h2>最後に公開すること</h2><p>進めます。</p><p>いかがでしたでしょうか。ぜひ参考にしてください。</p>",
    );
  await page.getByTestId("draft-preview-tab").click();

  await expect(page.getByText("タイトルの具体性")).toBeVisible();
  await expect(page.getByText(/タイトルが汎用的です/)).toBeVisible();
  await expect(page.getByText("AI風の汎用表現")).toBeVisible();
  await expect(page.getByText("FAQ件数")).toBeVisible();
  await expect(page.getByText("FAQ質問の具体性")).toBeVisible();
  await expect(page.getByText("FAQ回答の実務具体性")).toBeVisible();
  await expect(page.getByText(/FAQ回答が一般論寄りです/)).toBeVisible();
  await expect(page.getByTestId("quality-priority-summary")).toContainText("改善優先:");
  await expect(page.getByTestId("quality-check-failed").first()).toContainText(
    "タイトルの具体性",
  );
  await expect(page.getByTestId("quality-check-failed").first()).toContainText("修正先: タイトル");
  await page.getByTestId("quality-edit-draft-button").first().click();
  await expect(page.getByTestId("draft-title-input")).toBeVisible();
  await expect(page.getByTestId("draft-title-input")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "メタディスクリプションの具体性" }),
  ).toContainText("修正先: メタディスクリプション");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "メタディスクリプションの具体性" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-meta-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-meta-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "画像altの具体性" }),
  ).toContainText("修正先: 生成画像");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "画像altの具体性" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-images-section")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "FAQ件数" }),
  ).toContainText("修正先: FAQ");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "FAQ件数" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-faq-add-button")).toBeVisible();
  await expect(page.getByTestId("draft-faq-add-button")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "FAQ質問の具体性" }),
  ).toContainText("修正先: FAQ質問");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "FAQ質問の具体性" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-faq-question-0")).toBeVisible();
  await expect(page.getByTestId("draft-faq-question-0")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "FAQ回答の実務具体性" }),
  ).toContainText("修正先: FAQ回答");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "FAQ回答の実務具体性" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-faq-answer-0")).toBeVisible();
  await expect(page.getByTestId("draft-faq-answer-0")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "冒頭のAI風フレーム" }),
  ).toContainText("修正先: 本文HTML。冒頭をテンプレ導入ではなく");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "冒頭のAI風フレーム" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "締めのAI風フレーム" }),
  ).toContainText("修正先: 本文HTML。末尾の定型句を削り");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "締めのAI風フレーム" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "数字・実績の根拠づけ" }),
  ).toContainText("修正先: 本文HTML。数字の近くに出典");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "数字・実績の根拠づけ" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(page.getByRole("heading", { name: "参照元" })).toBeVisible();
  await expect(page.getByLabel("参照元").getByRole("link", { name: "Reference page" })).toHaveAttribute(
    "href",
    "https://example.com/reference",
  );
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "見出しの企画性" }),
  ).toContainText("修正先: 本文HTML。まず/次に型の見出し");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "見出しの企画性" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "一文の読みやすさ" }),
  ).toContainText("修正先: 本文HTML。長い一文を");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "一文の読みやすさ" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "接続表現の単調さ" }),
  ).toContainText("修正先: 本文HTML。「また」「さらに」「そのため」の連続を減らし");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "定型的な文の入り方" }),
  ).toContainText("修正先: 本文HTML。「結論として」「具体的には」型の文頭を減らし");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "接続表現の単調さ" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "比較・整理のしやすさ" }),
  ).toContainText("表はありますが");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "比較・整理のしやすさ" }),
  ).toContainText("修正先: 本文HTML。表に判断基準、比較軸、条件");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "比較・整理のしやすさ" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "AI風の汎用表現" }),
  ).toContainText("修正先: 本文HTML。「近年」「重要です」「わかりやすく解説」などの汎用表現を削り");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "AI風の汎用表現" }),
  ).toContainText("参照元の事実、一次情報、判断基準、現場例へ置き換えます");
  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "AI風の汎用表現" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "冒頭の結論明示" }),
  ).toContainText("冒頭420字以内に、結論、定義、読者が最初に判断すべきこと");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "引用しやすい定義" }),
  ).toContainText("冒頭付近に「〇〇とは...」型の短い定義文");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "編集意図のある見出し" }),
  ).toContainText("判断軸、失敗例、比較観点");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "各セクションの濃さ" }),
  ).toContainText("数字、現場例、判断基準、失敗例、費用、期間、出典");
  await page.getByTestId("quality-improve-regenerate-button").click();
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /タイトルが汎用的です/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /FAQ回答が一般論寄りです/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 冒頭400字以内で、結論、定義、読者が最初に判断すべきこと/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 近年、重要です、一般的に、多くの場合、注目されています、わかりやすく解説/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /fast-paced digital landscape[\s\S]*unlock the potential/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /参照元の事実、一次情報、固有名詞、現場例、判断基準/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 数字の近くに、出典、条件、時点、目安、現場観察/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 表を項目\/内容だけで終えず、判断基準、比較軸、条件/,
  );
  expect(errors()).toEqual([]);
});

test("source digestion quality checks explain how to edit pasted inputs", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const primaryInfo =
    "当社の支援現場では、承認担当が決まらないままWordPress投稿前に出典確認で戻る相談が多い。";
  const referenceText =
    "AIO記事制作では、参照情報、一次情報、競合調査、構成案、本文HTML、FAQ、メタディスクリプション、WordPress下書き投稿までを分けて管理する必要がある。";
  const competitorText =
    "競合記事Aは料金表と導入期間を強調し、競合LP Bは補助金申請を訴求する一方、運用定着と承認フローの支援は薄い。";
  const completedJob = createCompletedGenerationJob();
  const draft = completedJob.draft!;
  completedJob.draft = {
    ...draft,
    inputPayload: {
      ...draft.inputPayload,
      primaryInfo,
      references: [{ id: "ref-verbatim", text: referenceText }],
      competitors: [{ id: "comp-verbatim", text: competitorText }],
    },
    fetchedReferences: [
      {
        url: "https://example.com/reference-verbatim",
        title: "Reference verbatim fixture",
        text: referenceText,
        ok: true,
        sourceType: "manual",
      },
    ],
    fetchedCompetitors: [
      {
        url: "https://example.com/competitor-verbatim",
        title: "Competitor verbatim fixture",
        text: competitorText,
        ok: true,
        sourceType: "manual",
      },
    ],
    editedBodyHtml: `
      <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
      <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。${primaryInfo}</p>
      <p>${referenceText}</p>
      <p>${competitorText}</p>
      <table><tr><th>判断基準</th><td>参照情報、一次情報、競合調査、WordPress投稿前の承認状態を比較します。</td></tr></table>
      <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない情報を条件なしで書かないことです。</li></ul>
      <h2>承認担当と出典確認を分ける編集判断</h2>
      <p>FAQとして、本文HTMLに貼る前に、判断基準、注意点、比較軸へ言い換えたかを確認します。出典: https://example.com/reference-verbatim</p>
    `,
  };
  completedJob.fetchedReferences = completedJob.draft.fetchedReferences;
  completedJob.fetchedCompetitors = completedJob.draft.fetchedCompetitors;

  await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await page.getByTestId("reference-text-0").fill(referenceText);
  await openInputStep(page, "competitors");
  await page.getByTestId("competitor-text-0").fill(competitorText);
  await openInputStep(page, "primary-info");
  await page.getByTestId("primary-info-textarea").fill(primaryInfo);
  await page.getByTestId("article-primary-button").click();

  await expect(page.getByText("一次情報の編集消化")).toBeVisible();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "一次情報の編集消化" }),
  ).toContainText("修正先: 本文HTML。一次情報の固有語彙を残しつつ");
  await expect(page.getByText("参照情報の編集消化")).toBeVisible();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "参照情報の編集消化" }),
  ).toContainText("修正先: 本文HTML。参照元の事実は保ち");
  await expect(page.getByText("競合情報の編集消化")).toBeVisible();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "競合情報の編集消化" }),
  ).toContainText("修正先: 本文HTML。競合文を写さず");

  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "参照情報の編集消化" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();
  await page.getByTestId("draft-preview-tab").click();
  await page.getByTestId("quality-improve-regenerate-button").click();
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 一次情報を丸写しせず、固有語彙は残して読者向けの判断材料/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 参照情報を丸写しせず、事実関係は保って出典注記/,
  );
  await expect(page.getByTestId("article-regeneration-instruction")).toHaveValue(
    /修正方針: 競合文を写さず、競合の主張を比較材料/,
  );
  expect(errors()).toEqual([]);
});

test("target word count quality check catches short generated drafts", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for checking whether generated article length matches the selected word count.");
  await openInputStep(page, "word-count");
  await expect(page.getByTestId("word-count-select")).toHaveAccessibleName("記事の文字数");
  await page.getByTestId("word-count-select").selectOption("6000");
  await page.getByTestId("article-primary-button").click();

  await expect(page.getByText("指定文字数との整合")).toBeVisible();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "指定文字数との整合" }),
  ).toContainText("指定された6,000字");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "指定文字数との整合" }),
  ).toContainText("修正先: 本文HTML。指定文字数に合わせて");

  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "指定文字数との整合" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();

  expect(errors()).toEqual([]);
});

test("target word count quality check catches overly long generated drafts", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  const longBodyHtml = `
    <h2>AIO記事では、参照情報と一次情報を分けて整理する</h2>
    <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。${"現場の判断基準、失敗例、担当者、費用、期間、注意点、比較軸を確認し、読者が公開前に迷わないよう整理します。".repeat(38)}</p>
    <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
    <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない情報を条件なしで書かないことです。</li></ul>
    <h2>公開前に担当者と出典確認を分ける理由</h2>
    <p>FAQとして、本文HTMLに貼る前に、判断基準、注意点、比較軸へ言い換えたかを確認します。出典: https://example.com/reference</p>
  `;
  completedJob.draft = {
    ...completedJob.draft!,
    editedBodyHtml: longBodyHtml,
  };
  await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for checking whether overly long generated article length is detected.");
  await openInputStep(page, "word-count");
  await page.getByTestId("word-count-select").selectOption("1000");
  await page.getByTestId("article-primary-button").click();

  await expect(page.getByText("指定文字数との整合")).toBeVisible();
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "指定文字数との整合" }),
  ).toContainText("指定された1,000字");
  await expect(
    page.getByTestId("quality-check-failed").filter({ hasText: "指定文字数との整合" }),
  ).toContainText("目安は700〜1,350字");

  await page
    .getByTestId("quality-check-failed")
    .filter({ hasText: "指定文字数との整合" })
    .getByTestId("quality-edit-draft-button")
    .click();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("draft-body-html-textarea")).toBeFocused();

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
  await openInputStep(page, "theme");
  await page.getByTestId("theme-candidates-button").click();

  await expect(page.getByTestId("theme-candidates-error")).toContainText("theme candidate failed");
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  expect(errors()).toEqual([]);
});

test("theme candidate failure can be retried and then applied", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/theme-candidates$/],
  });
  const completedJob = createCompletedGenerationJob();
  const calls = await mockCommonApiRoutes(page, completedJob, {
    themeCandidatesFailOnce: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for theme retry handling.");
  await openInputStep(page, "primary-info");
  await page
    .getByTestId("primary-info-textarea")
    .fill("Primary field observation for theme retry handling.");
  await openInputStep(page, "theme");
  await page.getByTestId("theme-candidates-button").click();

  expect(calls.themeCandidates).toBe(1);
  await expect(page.getByTestId("theme-candidates-error")).toContainText("theme candidate failed");
  await expect(page.getByTestId("theme-candidates-button")).toBeEnabled();

  await page.getByTestId("theme-candidates-button").click();

  expect(calls.themeCandidates).toBe(2);
  expect(calls.themeCandidatePrimaryInfo).toContain("Primary field observation");
  await expect(page.getByTestId("theme-candidates-error")).toHaveCount(0);
  await expect(page.getByTestId("theme-candidate-card-0")).toContainText(
    "AIO Content Operations Guide",
  );
  await page.getByTestId("theme-candidate-apply-0").click();
  await expect(page.getByTestId("theme-candidate-card-0")).toContainText("反映しました。");
  await expect(page.getByTestId("theme-textarea")).toHaveValue(/AIO Content Operations Guide/);
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  expect(errors()).toEqual([]);
});

test("primary generation CTA explains which required inputs are missing", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });

  await login(page, { preparePrimaryInfo: false });
  await expect(page.getByTestId("article-primary-button")).toBeDisabled();
  await expect(page.getByTestId("generate-requirement-message")).toContainText(
    "参照情報と一次情報を入力すると記事作成を開始できます。",
  );

  await page.getByTestId("reference-text-0").fill("Reference text for requirement guidance.");
  await expect(page.getByTestId("article-primary-button")).toBeDisabled();
  await expect(page.getByTestId("generate-requirement-message")).toContainText(
    "一次情報を入力すると記事作成を開始できます。",
  );

  await openInputStep(page, "primary-info");
  await page.getByTestId("input-wizard-next").click();
  await expect(page.getByTestId("input-wizard-message")).toContainText(
    "一次情報の種類を1つ以上選び、具体的な内容を入力してください。",
  );
  await page.getByTestId("primary-info-type-frequent-consultations").click();
  await page
    .getByTestId("primary-info-textarea")
    .fill("当社の支援現場では、公開前の根拠確認に関する相談が多い。");
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  await expect(page.getByTestId("generate-requirement-message")).toBeHidden();

  await openInputStep(page, "visual-tone");
  await page.getByTestId("visual-tone-mode-custom").click();
  await expect(page.getByTestId("article-primary-button")).toBeDisabled();
  await expect(page.getByTestId("generate-requirement-message")).toContainText(
    "画像トーンを入力すると記事作成を開始できます。",
  );

  await page
    .getByPlaceholder("例: 信頼感のある白背景、青と緑のアクセント、図解中心")
    .fill("信頼感のある白背景、青のアクセント、図解中心");
  await expect(page.getByTestId("article-primary-button")).toBeEnabled();
  await expect(page.getByTestId("generate-requirement-message")).toBeHidden();
  expect(errors()).toEqual([]);
});

test("image count zero creates a text-only draft from the PC form", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  const textOnlyJob = {
    ...completedJob,
    inputPayload: {
      ...completedJob.inputPayload,
      imageCount: 0 as const,
    },
    draft: completedJob.draft
      ? {
          ...completedJob.draft,
          inputPayload: {
            ...completedJob.draft.inputPayload,
            imageCount: 0 as const,
          },
          aiResult: {
            ...completedJob.draft.aiResult,
            image_prompts: [],
          },
          images: [],
          editedBodyHtml: completedJob.draft.aiResult.body_html,
        }
      : completedJob.draft,
  };
  let submittedImageCount: unknown;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as { form?: { imageCount?: unknown } };
    submittedImageCount = body.form?.imageCount;
    await route.fulfill({ json: { ok: true, job: textOnlyJob } });
  });
  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: textOnlyJob } });
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for text-only generation.");
  await openInputStep(page, "visual-tone");
  await page.getByRole("button", { name: "0枚" }).click();
  await expect(page.getByText("生成目安：画像生成なし")).toBeVisible();
  await page.getByTestId("article-primary-button").click();

  expect(submittedImageCount).toBe(0);
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  await expect(page.getByRole("article").locator("figure[data-image-slot]")).toHaveCount(0);
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
  await openInputStep(page, "competitors");
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

test("competitor research failure can be retried and edited", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/competitor-research$/],
  });
  const completedJob = createCompletedGenerationJob();
  const calls = await mockCommonApiRoutes(page, completedJob, {
    competitorResearchFailOnce: true,
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for competitor retry flow.");
  await openInputStep(page, "competitors");
  await page
    .getByTestId("competitor-text-0")
    .fill("Competitor memo for one failed research attempt followed by a retry.");
  await page.getByTestId("competitor-research-button").click();

  expect(calls.competitorResearch).toBe(1);
  await expect(page.getByTestId("active-error")).toBeVisible();
  await expect(page.getByTestId("competitor-research-button")).toBeEnabled();
  await expect(page.getByTestId("competitor-research-progress")).toBeHidden();

  await page.getByTestId("competitor-research-button").click();

  expect(calls.competitorResearch).toBe(2);
  await expect(page.getByTestId("active-error")).toHaveCount(0);
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
        summary: "Edited competitor retry summary for E2E",
      },
      null,
      2,
    ),
  );
  await expect(page.getByTestId("competitor-research-json")).toHaveValue(
    /Edited competitor retry summary for E2E/,
  );
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

test("bulk image regeneration preserves successful images when a later image fails", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/generate-image$/],
  });
  const completedJob = createCompletedGenerationJob();
  const originalImage = {
    ...completedJob.draft!.images[0],
    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  };
  completedJob.draft = {
    ...completedJob.draft!,
    images: [
      originalImage,
      {
        ...originalImage,
        id: "img-2",
        slot: "inline-1",
        path: "generated/inline-1.png",
        prompt: "Inline editorial workflow visual",
        altText: "Inline workflow image",
      },
    ],
  };
  const calls = await mockCommonApiRoutes(page, completedJob, {
    generateImageFailOnCalls: [2],
    generateImageDelayMs: 50,
  });

  await login(page);
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for partial image regeneration failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("image-regenerate-all-button").click();
  await page
    .getByTestId("image-regeneration-instruction")
    .fill("Regenerate both images with more concrete editorial detail.");
  await page.getByTestId("image-regeneration-start").click();

  await expect(page.getByText("一部の画像再作成に失敗しました。")).toBeVisible();
  expect(calls.generateImage).toBe(2);
  expect(calls.generateImageMaxConcurrency).toBe(2);
  await expect(page.getByTestId("image-regeneration-progress")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(page.locator('img[src*="regenerated-1.png"]').first()).toBeVisible();
  await expect(page.getByRole("dialog", { name: "画像のみ再作成" })).toBeVisible();
  expect(errors()).toEqual([]);
});

test("missing generated image recovery is visible when only some image slots failed", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  completedJob.draft = {
    ...completedJob.draft!,
    inputPayload: {
      ...completedJob.draft!.inputPayload,
      imageCount: 2,
    },
    aiResult: {
      ...completedJob.draft!.aiResult,
      image_prompts: [
        ...completedJob.draft!.aiResult.image_prompts,
        {
          slot: "inline-1",
          purpose: "Inline process image",
          prompt: "Detailed editorial workflow image for inline explanation",
          alt_text: "Inline editorial workflow image",
        },
      ],
    },
    images: [
      {
        ...completedJob.draft!.images[0],
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      },
    ],
  };
  await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for partial missing image recovery.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await expect(page.getByTestId("missing-generated-images-recovery")).toContainText(
    "画像プロンプトは残っている",
  );
  await expect(page.getByTestId("missing-generated-images-recovery")).toContainText("inline-1");
  await expect(page.locator('img[alt="AIO workflow hero image"]').first()).toBeVisible();
  expect(errors()).toEqual([]);
});

test("missing generated image recovery ignores prompts beyond requested image count", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  completedJob.draft = {
    ...completedJob.draft!,
    inputPayload: {
      ...completedJob.draft!.inputPayload,
      imageCount: 1,
    },
    aiResult: {
      ...completedJob.draft!.aiResult,
      image_prompts: [
        ...completedJob.draft!.aiResult.image_prompts,
        {
          slot: "inline-1",
          purpose: "Extra prompt beyond requested image count",
          prompt: "Extra workflow visual that should not be required",
          alt_text: "Extra workflow image",
        },
      ],
    },
    images: [
      {
        ...completedJob.draft!.images[0],
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      },
    ],
  };
  await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await openInputStep(page, "visual-tone");
  await page.getByRole("button", { name: "1枚" }).click();
  await openInputStep(page, "references");
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for intentionally single image generation.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await expect(page.getByTestId("missing-generated-images-recovery")).toHaveCount(0);
  await expect(page.locator('img[alt="AIO workflow hero image"]').first()).toBeVisible();
  expect(errors()).toEqual([]);
});

test("drafts with failed initial image generation can regenerate from saved prompts", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  completedJob.draft = {
    ...completedJob.draft!,
    images: [],
    editedBodyHtml: completedJob.draft!.aiResult.body_html,
  };
  const calls = await mockCommonApiRoutes(page, completedJob);

  await login(page);
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for missing initial image recovery.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await expect(page.getByTestId("missing-generated-images-recovery")).toContainText(
    "画像プロンプトは残っている",
  );
  await expect(page.getByTestId("missing-generated-images-recovery")).toContainText("featured");
  await expect(page.getByTestId("image-regenerate-all-button")).toBeEnabled();

  await page.getByTestId("image-regenerate-all-button").click();
  await page
    .getByTestId("image-regeneration-instruction")
    .fill("Recover the failed initial image with a concrete workflow visual.");
  await page.getByTestId("image-regeneration-start").click();

  expect(calls.generateImage).toBe(1);
  expect(calls.generateImagePrompts[0]).toContain("Recover the failed initial image");
  await expect(page.getByTestId("image-regeneration-progress")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page.getByTestId("image-regeneration-close").click();
  await expect(page.getByTestId("missing-generated-images-recovery")).toHaveCount(0);
  await expect(page.locator('img[src*="regenerated-1.png"]').first()).toBeVisible();
  await expect(page.locator('img[src*="regenerated-1.png"]')).toHaveCount(2);
  expect(errors()).toEqual([]);
});

test("single image regeneration failure keeps the dialog recoverable", async ({ page }) => {
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
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for single image regeneration failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("image-regenerate-single-featured").click();
  await page
    .getByTestId("single-image-regeneration-instruction")
    .fill("Make the featured image more concrete and less abstract.");
  await page.getByTestId("single-image-regeneration-start").click();

  expect(calls.generateImage).toBe(1);
  await expect(page.getByTestId("active-error")).toBeVisible();
  await expect(page.getByTestId("single-image-regeneration-progress")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(page.getByTestId("single-image-regeneration-start")).toBeEnabled();
  await expect(
    page.locator('[role="dialog"]').filter({
      has: page.getByTestId("single-image-regeneration-progress"),
    }),
  ).toBeVisible();
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

test("reference file extraction failure can be retried without duplicate rows", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/extract-file-content$/],
  });
  let extractionCalls = 0;
  const filePayload = {
    name: "retry-reference.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF retryable text document"),
  };

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/extract-file-content", async (route) => {
    extractionCalls += 1;
    if (extractionCalls === 1) {
      await route.fulfill({
        status: 422,
        json: {
          ok: false,
          error: "PDFから十分な本文を抽出できませんでした。",
          detail: "同じPDFを再添付できます。",
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        ok: true,
        attachment: {
          ...extractFileSuccess.attachment,
          id: "retry-reference-success",
          name: filePayload.name,
          type: filePayload.mimeType,
          size: filePayload.buffer.length,
          text: "Retried reference file text for article generation.",
          textLength: 51,
        },
      },
    });
  });

  await login(page);
  await page.getByTestId("reference-file-input").setInputFiles(filePayload);
  await expect(page.getByText("retry-reference.pdf")).toHaveCount(1);
  await expect(page.getByText(/解析エラー/)).toBeVisible();
  await expect(page.getByText(/同じPDFを再添付できます/)).toBeVisible();

  await page.getByTestId("reference-file-input").setInputFiles(filePayload);
  await expect(page.getByText("retry-reference.pdf")).toHaveCount(1);
  await expect(page.getByText(/解析済み/)).toBeVisible();
  await expect(page.getByText(/解析エラー/)).toBeHidden();
  expect(extractionCalls).toBe(2);
  expect(errors()).toEqual([]);
});

test("competitor file extraction retry replaces the failed row before generation", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/extract-file-content$/],
  });
  const completedJob = createCompletedGenerationJob();
  let extractionCalls = 0;
  let generationCompetitorFiles: Array<{ ok?: boolean; name?: string; text?: string }> = [];
  const filePayload = {
    name: "retry-competitor.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("retry competitor content"),
  };

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/extract-file-content", async (route) => {
    extractionCalls += 1;
    if (extractionCalls === 1) {
      await route.fulfill({
        status: 422,
        json: {
          ok: false,
          error: "DOCXから十分な本文を抽出できませんでした。",
          detail: "競合資料を再添付してください。",
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        ok: true,
        attachment: {
          ...extractFileSuccess.attachment,
          id: "retry-competitor-success",
          name: filePayload.name,
          type: filePayload.mimeType,
          size: filePayload.buffer.length,
          text: "Retried competitor file text about pricing tables and onboarding gaps.",
          textLength: 67,
        },
      },
    });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as {
      form?: { competitorFiles?: Array<{ ok?: boolean; name?: string; text?: string }> };
    };
    generationCompetitorFiles = body.form?.competitorFiles ?? [];
    await route.fulfill({
      json: { ok: true, job: buildCompletedJobForForm(completedJob, body.form ?? {}) },
    });
  });
  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: completedJob } });
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for competitor retry.");
  await openInputStep(page, "competitors");
  await page.getByTestId("competitor-file-input").setInputFiles(filePayload);
  await expect(page.getByText("retry-competitor.docx")).toHaveCount(1);
  await expect(page.getByText(/解析エラー/)).toBeVisible();
  await expect(page.getByText(/競合資料を再添付してください/)).toBeVisible();

  await page.getByTestId("competitor-file-input").setInputFiles(filePayload);
  await expect(page.getByText("retry-competitor.docx")).toHaveCount(1);
  await expect(page.getByText(/解析済み/)).toBeVisible();
  await expect(page.getByText(/解析エラー/)).toBeHidden();

  await page.getByTestId("article-primary-button").click();
  expect(generationCompetitorFiles).toEqual([
    expect.objectContaining({
      name: "retry-competitor.docx",
      ok: true,
      text: expect.stringContaining("pricing tables"),
    }),
  ]);
  expect(extractionCalls).toBe(2);
  expect(errors()).toEqual([]);
});

test("reference URL fetch failure is visible while manual fallback still generates a draft", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  const failedUrl = "https://reference.example.com/blocked";
  const fetchedReferences = [
    {
      url: failedUrl,
      ok: false,
      reason: "Could not extract enough page text.",
      sourceType: "url" as const,
    },
    {
      url: "manual-text",
      title: "手動入力テキスト",
      text: "Manual fallback reference text for blocked URL.",
      ok: true,
      sourceType: "manual" as const,
    },
  ];
  const completedWithFetchWarning = {
    ...completedJob,
    fetchedReferences,
    draft: completedJob.draft
      ? {
          ...completedJob.draft,
          fetchedReferences,
        }
      : completedJob.draft,
  };
  let submittedReferenceText = "";

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as {
      form?: { references?: Array<{ text?: string; url?: string }> };
    };
    submittedReferenceText = body.form?.references?.[0]?.text ?? "";
    await route.fulfill({ json: { ok: true, job: completedWithFetchWarning } });
  });
  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: completedWithFetchWarning } });
  });

  await login(page);
  await page.getByTestId("reference-url-0").fill(failedUrl);
  await page
    .getByTestId("reference-text-0")
    .fill("Manual fallback reference text for blocked URL.");
  await openInputStep(page, "word-count");
  await page.getByTestId("article-primary-button").click();

  await expect(page.getByTestId("input-wizard-step-word-count")).toBeVisible();
  const referenceFetchResults = page.getByTestId("reference-fetch-results");
  await expect(referenceFetchResults.getByText(failedUrl, { exact: true })).toBeVisible();
  await expect(
    referenceFetchResults.getByText("十分な本文を抽出できませんでした。"),
  ).toBeVisible();
  await referenceFetchResults.getByRole("button", { name: "参照情報を修正" }).click();
  await expect(page.getByTestId("input-wizard-step-references")).toBeVisible();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(submittedReferenceText).toBe("Manual fallback reference text for blocked URL.");
  expect(errors()).toEqual([]);
});

test("competitor URL fetch failure is visible while manual competitor notes still generate a draft", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const completedJob = createCompletedGenerationJob();
  const failedUrl = "https://competitor.example.com/blocked";
  const fetchedCompetitors = [
    {
      url: failedUrl,
      ok: false,
      reason: "Could not extract enough page text.",
      sourceType: "url" as const,
    },
    {
      url: "manual-text",
      title: "手動入力テキスト",
      text: "Manual competitor note about pricing-first messaging and weak approval workflow.",
      ok: true,
      sourceType: "manual" as const,
    },
  ];
  const completedWithCompetitorWarning = {
    ...completedJob,
    fetchedCompetitors,
    draft: completedJob.draft
      ? {
          ...completedJob.draft,
          fetchedCompetitors,
        }
      : completedJob.draft,
  };
  let submittedCompetitorText = "";

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON() as {
      form?: { competitors?: Array<{ text?: string; url?: string }> };
    };
    submittedCompetitorText = body.form?.competitors?.[0]?.text ?? "";
    await route.fulfill({ json: { ok: true, job: completedWithCompetitorWarning } });
  });
  await page.route("**/api/generation-jobs/job-completed-1", async (route) => {
    await route.fulfill({ json: { ok: true, job: completedWithCompetitorWarning } });
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for competitor URL fallback.");
  await openInputStep(page, "competitors");
  await page.getByTestId("competitor-url-0").fill(failedUrl);
  await page
    .getByTestId("competitor-text-0")
    .fill("Manual competitor note about pricing-first messaging and weak approval workflow.");
  await openInputStep(page, "word-count");
  await page.getByTestId("article-primary-button").click();

  await expect(page.getByTestId("input-wizard-step-word-count")).toBeVisible();
  const competitorFetchResults = page.getByTestId("competitor-fetch-results");
  await expect(competitorFetchResults.getByText(failedUrl, { exact: true })).toBeVisible();
  await expect(
    competitorFetchResults.getByText("十分な本文を抽出できませんでした。"),
  ).toBeVisible();
  await competitorFetchResults.getByRole("button", { name: "競合情報を修正" }).click();
  await expect(page.getByTestId("input-wizard-step-competitors")).toBeVisible();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(submittedCompetitorText).toBe(
    "Manual competitor note about pricing-first messaging and weak approval workflow.",
  );
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
  await openInputStep(page, "competitors");
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
  await expect(page.getByText("投稿済み").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "投稿URL" })).toHaveAttribute(
    "href",
    "https://wordpress.example.com/recovered-log-article",
  );
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

test("opening a stale generation log shows a recoverable error without removing the log list", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/generation-jobs\/job-log-missing$/],
  });

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({
      json: {
        ok: true,
        logs: [
          {
            id: "job-log-missing",
            status: "completed",
            createdAt: "2026-07-02T00:00:00.000Z",
            updatedAt: "2026-07-02T00:02:00.000Z",
            completedAt: "2026-07-02T00:02:00.000Z",
            inputSummary: "Missing log article / 参照1件 / 競合0件",
            outputTitle: "Missing Log Article",
            outputSlug: "missing-log-article",
            draftStatus: "posted",
            wordpressPostStatus: null,
          },
        ],
      },
    });
  });
  await page.route("**/api/generation-jobs/job-log-missing", async (route) => {
    await route.fulfill({
      status: 404,
      json: { ok: false, error: "生成ジョブが見つかりません。" },
    });
  });

  await login(page);
  await page.getByTestId("generation-logs-toggle").click();
  await expect(page.getByTestId("generation-logs-content")).toContainText(
    "Missing Log Article",
  );
  await page.getByTestId("generation-log-open-job-log-missing").click();

  await expect(page.getByText("生成ジョブが見つかりません。")).toBeVisible();
  await expect(page.getByTestId("generation-logs-content")).toContainText(
    "Missing Log Article",
  );
  await expect(page.getByTestId("reference-text-0")).toBeEditable();
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

  await expect(page.getByTestId("wordpress-status-select")).toHaveAccessibleName(
    "WordPress投稿ステータス",
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

test("invalid edited drafts require reapproval before WordPress post requests", async ({
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
  await page.getByTestId("reference-text-0").fill("Reference text for invalid WordPress post.");
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
  await expect(page.getByTestId("wordpress-post-button")).toBeEnabled();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("draft-body-html-textarea").fill("<h2></h2>");

  await expect(page.getByTestId("draft-status-badge")).toHaveText("下書き");
  await expect(page.getByTestId("wordpress-post-button")).toBeDisabled();
  expect(calls.wordpressPost).toBe(0);
  await page.getByTestId("approve-draft-button").click();
  await expect(page.getByTestId("draft-action-error")).toContainText(
    "本文HTMLを入力してください。",
  );
  await expect(page.getByTestId("draft-body-html-textarea")).toBeVisible();
  await expect(page.getByTestId("wordpress-post-message")).toBeHidden();
  expect(errors()).toEqual([]);
});

test("editing an approved draft returns it to draft before WordPress posting", async ({ page }) => {
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
  await page
    .getByTestId("reference-text-0")
    .fill("Reference text for approval invalidation after editing.");
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
  await expect(page.getByTestId("wordpress-post-button")).toBeEnabled();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("draft-title-input").fill("Edited after approval");

  await expect(page.getByTestId("wordpress-post-button")).toBeDisabled();
  await expect(page.getByTestId("draft-status-badge")).toHaveText("下書き");
  expect(calls.wordpressPost).toBe(0);

  await page.getByTestId("approve-draft-button").click();
  await expect(page.getByTestId("wordpress-post-button")).toBeEnabled();
  await page.getByTestId("wordpress-post-button").click();
  expect(calls.wordpressPost).toBe(1);
  await expect(page.getByTestId("wordpress-post-message")).toContainText(
    "WordPressへ下書き投稿しました。",
  );
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

test("invalid edited drafts are blocked before save or approval requests", async ({ page }) => {
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
  await page.getByTestId("reference-text-0").fill("Reference text for invalid draft validation.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("draft-edit-tab").click();
  await page.getByTestId("draft-title-input").fill("");
  await page.getByTestId("save-draft-button").click();

  expect(calls.saveDraft).toBe(0);
  await expect(page.getByTestId("draft-action-error")).toContainText(
    "タイトルを入力してください。",
  );
  await expect(page.getByTestId("draft-title-input")).toBeVisible();

  await page.getByTestId("approve-draft-button").click();
  expect(calls.approveDraft).toBe(0);
  await expect(page.getByTestId("draft-action-error")).toContainText(
    "保存・承認・WordPress投稿の前に編集内容を確認してください。",
  );
  await expect(page.getByTestId("wordpress-post-button")).toBeDisabled();

  await page.getByTestId("draft-title-input").fill("Recovered valid draft title");
  await expect(page.getByTestId("draft-action-error")).toBeHidden();
  await page.getByTestId("save-draft-button").click();
  expect(calls.saveDraft).toBe(1);
  await expect(page.getByTestId("draft-action-message")).toContainText(
    "編集内容を保存しました。",
  );
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

  await page.getByTestId("copy-title-button").click();
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "タイトルをコピーできませんでした。",
  );
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "error");
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "タイトル欄から手動でコピーしてください。",
  );

  await page.getByTestId("copy-body-html-button").click();
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "本文HTMLをコピーできませんでした。",
  );
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "error");
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "本文HTML欄から手動でコピーしてください。",
  );
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(errors()).toEqual([]);
});

test("copy fallback failure cleans up the temporary textarea", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("clipboard denied")),
      },
    });
    document.execCommand = () => {
      throw new Error("copy command denied");
    };
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
  await page.getByTestId("reference-text-0").fill("Reference text for clipboard cleanup.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("copy-body-html-button").click();

  await expect(page.getByTestId("copy-export-status")).toContainText(
    "本文HTMLをコピーできませんでした。",
  );
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "error");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll("textarea")).filter(
            (textarea) => textarea.style.left === "-9999px",
          ).length,
      ),
    )
    .toBe(0);
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(errors()).toEqual([]);
});

test("HTML export failure shows manual recovery guidance without breaking the draft preview", async ({
  page,
}) => {
  await page.addInitScript(() => {
    URL.createObjectURL = () => {
      throw new Error("download denied");
    };
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
  await page.getByTestId("reference-text-0").fill("Reference text for HTML export failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("download-html-button").click();

  await expect(page.getByTestId("copy-export-status")).toContainText("HTML出力に失敗しました。");
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "error");
  await expect(page.getByTestId("copy-export-status")).toContainText(
    "本文HTMLをコピーして手動で保存してください。",
  );
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(errors()).toEqual([]);
});

test("HTML export click failure cleans up the temporary download link", async ({ page }) => {
  await page.addInitScript(() => {
    URL.revokeObjectURL = (url: string) => {
      window.localStorage.setItem("aio-e2e-revoked-url", url);
    };
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function appendChildWithFailingDownload<T extends Node>(
      child: T,
    ): T {
      const appended = originalAppendChild.call(this, child) as T;
      if (
        child instanceof HTMLAnchorElement &&
        child.download === "aio-content-operations-guide.html"
      ) {
        child.click = () => {
          throw new Error("download click denied");
        };
      }
      return appended;
    };
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
  await page.getByTestId("reference-text-0").fill("Reference text for HTML cleanup failure.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();

  await page.getByTestId("download-html-button").click();

  await expect(page.getByTestId("copy-export-status")).toContainText("HTML出力に失敗しました。");
  await expect(page.getByTestId("copy-export-status")).toHaveAttribute("data-status", "error");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        links: document.querySelectorAll('a[download="aio-content-operations-guide.html"]').length,
        revokedUrl: window.localStorage.getItem("aio-e2e-revoked-url") ?? "",
      })),
    )
    .toEqual({ links: 0, revokedUrl: expect.stringMatching(/^blob:/) });
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  expect(errors()).toEqual([]);
});

test("demo login rejects a wrong code and then preserves the requested return path", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/demo-auth$/],
  });

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });

  await page.goto("/demo-login?next=%2F%3Ftab%3Dpreview");
  await page.getByTestId("demo-access-code").fill("wrong");
  await page.getByTestId("demo-login-submit").click();

  await expect(page).toHaveURL(/\/demo-login\?next=%2F%3Ftab%3Dpreview/);
  await expect(page.getByTestId("demo-login-error")).toBeVisible();
  await expect(page.getByTestId("demo-login-submit")).toBeEnabled();

  await page.getByTestId("demo-access-code").fill("202607");
  await page.getByTestId("demo-login-submit").click();

  await page.waitForURL("**/?tab=preview");
  await expect(page.getByTestId("article-primary-button")).toBeVisible();
  expect(errors()).toEqual([]);
});

test("legacy fixed authentication cookie cannot bypass the login screen", async ({
  page,
  context,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  await page.goto("/demo-login");
  const origin = new URL(page.url()).origin;
  await context.clearCookies();
  await context.addCookies([
    {
      name: "aio_demo_auth",
      value: "demo-access-granted",
      url: origin,
    },
  ]);

  await page.goto("/");

  await expect(page).toHaveURL(/\/demo-login\?next=/);
  await expect(page.getByTestId("demo-access-code")).toBeVisible();
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

test("active generation job is restored after a page reload and opens the completed draft", async ({
  page,
}) => {
  const errors = collectUnexpectedBrowserErrors(page);
  const runningJob = {
    ...createCompletedGenerationJob(),
    id: "job-reload-resume-e2e",
    status: "running" as const,
    draft: undefined,
    draftId: undefined,
    completedAt: undefined,
    steps: [
      { id: "generate_body", label: "AIO body generation", status: "running" as const },
      { id: "save", label: "Draft save", status: "pending" as const },
    ],
  };
  const completedJob = {
    ...createCompletedGenerationJob(),
    id: "job-reload-resume-e2e",
  };
  let shouldReturnCompleted = false;
  let pollCalls = 0;
  let generationJobStarts = 0;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs/job-reload-resume-e2e", async (route) => {
    pollCalls += 1;
    await route.fulfill({
      json: { ok: true, job: shouldReturnCompleted ? completedJob : runningJob },
    });
  });
  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }

    generationJobStarts += 1;
    await route.fulfill({ json: { ok: true, job: runningJob } });
  });

  await login(page);
  await page.getByTestId("reference-text-0").fill("Reference text for reload recovery.");
  await page.getByTestId("article-primary-button").click();
  await expect(
    page.evaluate(() => window.localStorage.getItem("aio-active-generation-job-id")),
  ).resolves.toBe("job-reload-resume-e2e");

  await page.reload();
  await expect(page.getByTestId("article-primary-button")).toContainText("記事作成をストップ");
  expect(generationJobStarts).toBe(1);

  shouldReturnCompleted = true;
  await expect(
    page.getByRole("article").getByRole("heading", { name: "AIO Content Operations Guide" }),
  ).toBeVisible();
  await expect(
    page.evaluate(() => window.localStorage.getItem("aio-active-generation-job-id")),
  ).resolves.toBeNull();
  expect(pollCalls).toBeGreaterThanOrEqual(1);
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

test("generation cancel failure keeps the job active and recoverable", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/generation-jobs\/job-cancel-failure-e2e\/cancel$/],
  });
  const runningJob = {
    ...createCompletedGenerationJob(),
    id: "job-cancel-failure-e2e",
    status: "running" as const,
    draft: undefined,
    draftId: undefined,
    completedAt: undefined,
    steps: [
      { id: "generate_body", label: "AIO本文生成", status: "running" as const, detail: "処理中" },
    ],
  };
  let cancelCalls = 0;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/generation-jobs/job-cancel-failure-e2e/cancel", async (route) => {
    cancelCalls += 1;
    await route.fulfill({
      status: 500,
      json: { ok: false, error: "生成停止に失敗しました。" },
    });
  });
  await page.route("**/api/generation-jobs/job-cancel-failure-e2e", async (route) => {
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
  await page.getByTestId("reference-text-0").fill("Reference text for cancel failure handling.");
  await page.getByTestId("article-primary-button").click();
  await expect(page.getByTestId("article-primary-button")).toContainText("記事作成をストップ");
  await page.getByTestId("article-primary-button").click();

  expect(cancelCalls).toBe(1);
  await expect(page.getByText(/記事作成の停止に失敗しました。/)).toBeVisible();
  await expect(page.getByTestId("article-primary-button")).toContainText("記事作成をストップ");
  await expect(
    page.evaluate(() => window.localStorage.getItem("aio-active-generation-job-id")),
  ).resolves.toBe("job-cancel-failure-e2e");
  await expect(page.getByTestId("reference-text-0")).toHaveValue(
    "Reference text for cancel failure handling.",
  );
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
  await openInputStep(page, "visual-tone");
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

test("visual tone upload failure can be retried with the same file", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/upload-image$/],
  });
  let uploadCalls = 0;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/upload-image", async (route) => {
    uploadCalls += 1;
    if (uploadCalls === 1) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "画像アップロードに失敗しました。" },
      });
      return;
    }

    await route.fulfill({
      json: {
        ok: true,
        url: "data:image/png;base64,cmV0cnktdG9uZQ==",
        path: "article-inserts/retry-tone.png",
        filename: "tone.png",
        storageMode: "local",
      },
    });
  });

  await login(page);
  await openInputStep(page, "visual-tone");
  await page.getByTestId("visual-tone-mode-upload").click();
  const filePayload = {
    name: "tone.png",
    mimeType: "image/png",
    buffer: Buffer.from("retry-tone"),
  };

  await page.getByTestId("visual-tone-upload-input").setInputFiles(filePayload);
  await expect(page.getByText("画像アップロードに失敗しました。")).toBeVisible();
  await expect(page.locator('img[alt="挿入画像"]')).toHaveCount(0);

  await page.getByTestId("visual-tone-upload-input").setInputFiles(filePayload);
  await expect(page.locator('img[alt="挿入画像"]')).toHaveAttribute("src", /data:image\/png/);
  await expect(page.getByText("画像アップロードに失敗しました。")).toBeHidden();
  expect(uploadCalls).toBe(2);
  expect(errors()).toEqual([]);
});

test("author image upload failure can be retried with the same file", async ({ page }) => {
  const errors = collectUnexpectedBrowserErrors(page, {
    allowedFailedResponses: [/\/api\/upload-image$/],
  });
  let uploadCalls = 0;

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });
  await page.route("**/api/upload-image", async (route) => {
    uploadCalls += 1;
    if (uploadCalls === 1) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "執筆者画像のアップロードに失敗しました。" },
      });
      return;
    }

    await route.fulfill({
      json: {
        ok: true,
        url: "data:image/png;base64,cmV0cnktYXV0aG9y",
        path: "authors/retry-author.png",
        filename: "author.png",
        storageMode: "local",
      },
    });
  });

  await login(page);
  await openInputStep(page, "theme");
  const filePayload = {
    name: "author.png",
    mimeType: "image/png",
    buffer: Buffer.from("retry-author"),
  };

  await page.getByTestId("author-image-upload-input").setInputFiles(filePayload);
  await expect(page.getByText("執筆者画像のアップロードに失敗しました。")).toBeVisible();
  await expect(page.locator('img[alt="執筆者画像"]')).toHaveCount(0);

  await page.getByTestId("author-image-upload-input").setInputFiles(filePayload);
  await expect(page.locator('img[alt="執筆者画像"]')).toHaveAttribute("src", /data:image\/png/);
  await expect(page.getByText("執筆者画像のアップロードに失敗しました。")).toBeHidden();
  expect(uploadCalls).toBe(2);
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

  await openInputStep(page, "theme");
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

async function openInputStep(
  page: Page,
  step:
    | "references"
    | "competitors"
    | "theme"
    | "primary-info"
    | "visual-tone"
    | "word-count",
) {
  await page.getByTestId(`input-wizard-step-button-${step}`).click();
  await expect(page.getByTestId(`input-wizard-step-${step}`)).toBeVisible();
}

async function login(
  page: Page,
  { preparePrimaryInfo = true }: { preparePrimaryInfo?: boolean } = {},
) {
  await page.goto("/demo-login");
  await page.getByTestId("demo-access-code").fill("202607");
  await page.getByTestId("demo-login-submit").click();
  await page.waitForURL("**/");

  if (preparePrimaryInfo) {
    await openInputStep(page, "primary-info");
    await page.getByTestId("primary-info-type-criteria-knowhow").click();
    await page
      .getByTestId("primary-info-textarea")
      .fill("当社では、公開前に根拠、条件、判断基準を分けて確認しています。");
    await openInputStep(page, "references");
  }
}

async function mockCommonApiRoutes(
  page: Page,
  completedJob: ReturnType<typeof createCompletedGenerationJob>,
  options: {
    themeCandidatesShouldFail?: boolean;
    themeCandidatesFailOnce?: boolean;
    competitorResearchShouldFail?: boolean;
    competitorResearchFailOnce?: boolean;
    generateImageShouldFail?: boolean;
    generateImageFailOnCalls?: number[];
    generateImageDelayMs?: number;
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
    generateImageActive: 0,
    generateImageMaxConcurrency: 0,
    generateImagePrompts: [] as string[],
    competitorResearch: 0,
    extractFile: 0,
    themeCandidates: 0,
    themeCandidateCompetitorSummary: "",
    themeCandidatePrimaryInfo: "",
    articleGenerationJobs: 0,
    articlePrimaryInfo: "",
    articlePrimaryInfoTypes: [] as string[],
    articleClosingText: "",
    articleRegenerationInstruction: "",
    articleCompetitorResearchSummary: "",
    articleCompetitorFileNames: [] as string[],
    wordpressConnect: 0,
    wordpressPost: 0,
    wordpressPostStatus: "" as "" | "draft" | "publish",
    lastSavedDraft: null as Record<string, unknown> | null,
    lastWordpressDraft: null as Record<string, unknown> | null,
  };

  await page.route("**/api/generation-logs", async (route) => {
    await route.fulfill({ json: { ok: true, logs: [] } });
  });

  await page.route("**/mock-images/**", async (route) => {
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
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
    if (
      options.competitorResearchShouldFail ||
      (options.competitorResearchFailOnce && calls.competitorResearch === 1)
    ) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "競合情報調査に失敗しました。" },
      });
      return;
    }

    await route.fulfill({ json: { ok: true, result: competitorResearchFixture } });
  });

  await page.route("**/api/theme-candidates", async (route) => {
    calls.themeCandidates += 1;
    if (
      options.themeCandidatesShouldFail ||
      (options.themeCandidatesFailOnce && calls.themeCandidates === 1)
    ) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "theme candidate failed" },
      });
      return;
    }

    const body = route.request().postDataJSON() as {
      competitorResearch?: { summary?: string };
      primaryInfo?: string;
    };
    calls.themeCandidateCompetitorSummary = body.competitorResearch?.summary ?? "";
    calls.themeCandidatePrimaryInfo = body.primaryInfo ?? "";
    await route.fulfill({
      json: {
        ...themeCandidates,
        result: {
          ...themeCandidates.result,
          candidates: themeCandidates.result.candidates.map((candidate, index) =>
            index === 1 ? { ...candidate, title: themeCandidates.result.candidates[0].title } : candidate,
          ),
        },
      },
    });
  });

  await page.route("**/api/generation-jobs", async (route) => {
    if (new URL(route.request().url()).pathname !== "/api/generation-jobs") {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as {
      form?: {
        primaryInfo?: string;
        primaryInfoTypes?: string[];
        closingText?: string;
        regenerationInstruction?: string;
        competitorFiles?: Array<{ name?: string }>;
      };
      competitorResearch?: { summary?: string };
    };
    calls.articleGenerationJobs += 1;
    calls.articlePrimaryInfo = body.form?.primaryInfo ?? "";
    calls.articlePrimaryInfoTypes = body.form?.primaryInfoTypes ?? [];
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
    calls.generateImageActive += 1;
    calls.generateImageMaxConcurrency = Math.max(
      calls.generateImageMaxConcurrency,
      calls.generateImageActive,
    );
    const callIndex = calls.generateImage;
    if (
      options.generateImageDelayMs &&
      options.generateImageDelayMs > 0
    ) {
      await new Promise((resolve) => setTimeout(resolve, options.generateImageDelayMs));
    }

    try {
      if (
        options.generateImageShouldFail ||
        options.generateImageFailOnCalls?.includes(callIndex)
      ) {
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
            id: `regenerated-${callIndex}`,
            slot: body.slot ?? "featured",
            url: `/mock-images/regenerated-${callIndex}.png`,
            path: `generated/regenerated-${callIndex}.png`,
            prompt: body.prompt,
            altText: body.altText ?? "Regenerated image",
            source: "generated",
          },
        },
      });
    } finally {
      calls.generateImageActive -= 1;
    }
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
    calls.lastSavedDraft = isRecord(body.draft) ? body.draft : null;
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
    calls.lastWordpressDraft = isRecord(body.draft) ? body.draft : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
