import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  evaluateArticleQuality,
  type ArticleQualityEvaluation,
} from "@/lib/article-quality";
import { evaluateFaqQuality } from "@/lib/faq-quality";
import { evaluateMetaDescriptionQuality } from "@/lib/meta-description-quality";
import { evaluateTitleQuality } from "@/lib/title-quality";
import type {
  ArticleFormPayload,
  ArticleGenerationResult,
  CompetitorResearchResult,
  FetchResult,
} from "@/types/aio";

type OpenAILiveArtifactInput = {
  sampleName: string;
  textModel: string;
  minScore: number;
  generatedAt?: string;
  form: ArticleFormPayload;
  fetchedReferences: FetchResult[];
  fetchedCompetitors: FetchResult[];
  competitorResearch?: CompetitorResearchResult | null;
  result: ArticleGenerationResult;
};

type OpenAILiveArtifactWriteResult = {
  jsonPath: string;
  htmlPath: string;
};

type LiveArtifactEnv = Record<string, string | undefined>;

type QualityReviewItem = {
  category: string;
  score: number;
  failedChecks: {
    id: string;
    label: string;
    detail: string;
  }[];
};

export function shouldWriteOpenAILiveArtifacts(env: LiveArtifactEnv = process.env) {
  return cleanEnvValue(env.AIO_LIVE_OPENAI_WRITE_ARTIFACTS) === "1";
}

export async function writeOpenAILiveArtifact(
  input: OpenAILiveArtifactInput,
  env: LiveArtifactEnv = process.env,
): Promise<OpenAILiveArtifactWriteResult | null> {
  if (!shouldWriteOpenAILiveArtifacts(env)) {
    return null;
  }

  const artifactDir = resolveOpenAILiveArtifactDir(env);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const baseName = `${generatedAt.replace(/[:.]/g, "-")}-${sanitizeLiveArtifactName(
    input.sampleName,
  )}`;
  const payload = buildOpenAILiveArtifact({ ...input, generatedAt });
  const jsonPath = path.join(artifactDir, `${baseName}.json`);
  const htmlPath = path.join(artifactDir, `${baseName}.html`);

  await mkdir(artifactDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(htmlPath, renderArtifactHtml(payload), "utf8");

  return { jsonPath, htmlPath };
}

export function resolveOpenAILiveArtifactDir(env: LiveArtifactEnv = process.env) {
  const configuredDir =
    cleanEnvValue(env.AIO_LIVE_OPENAI_ARTIFACT_DIR) || path.join("test-results", "live-openai");
  const resolvedDir = path.resolve(configuredDir);
  const allowedRoots = [path.resolve("test-results"), path.resolve(os.tmpdir())];
  const isAllowed = allowedRoots.some((root) => pathIsInsideOrEqual(resolvedDir, root));

  if (!isAllowed) {
    throw new Error(
      `AIO_LIVE_OPENAI_ARTIFACT_DIR must resolve inside test-results or the OS temp directory. Received: ${configuredDir}`,
    );
  }

  return resolvedDir;
}

export function buildOpenAILiveArtifact(input: OpenAILiveArtifactInput) {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sampleName: input.sampleName,
    textModel: input.textModel,
    minScore: input.minScore,
    score: input.result.aio_score_self_evaluation.score,
    input: {
      theme: input.form.theme,
      primaryInfo: input.form.primaryInfo ?? "",
      closingText: input.form.closingText,
      wordCount: input.form.wordCount,
      imageCount: input.form.imageCount,
      referenceUrls: input.fetchedReferences.map((item) => item.url).filter(Boolean),
      competitorUrls: input.fetchedCompetitors.map((item) => item.url).filter(Boolean),
      competitorResearchSummary: input.competitorResearch?.summary ?? "",
    },
    output: {
      selectedTitle: input.result.selected_title,
      titleCandidates: input.result.title_candidates,
      metaDescription: input.result.meta_description,
      targetReader: input.result.target_reader,
      searchIntent: input.result.search_intent,
      articleSummary: input.result.article_summary,
      headings: input.result.headings,
      keyTakeaways: input.result.key_takeaways,
      faqItems: input.result.faq_items,
      tags: input.result.tags,
      categories: input.result.categories,
      sources: input.result.sources,
      competitorInsights: input.result.competitor_insights,
      improvements: input.result.aio_score_self_evaluation.improvements,
      strengths: input.result.aio_score_self_evaluation.strengths,
      bodyHtml: input.result.body_html,
    },
    qualityReview: buildQualityReview(input),
    reviewChecklist: [
      "冒頭400字以内で、対象読者の判断に必要な結論・定義・条件が具体的に分かるか。",
      "一次情報が単なる引用ではなく、現場観察、判断基準、失敗例、注意点として本文に溶け込んでいるか。",
      "FAQ回答が一般論で終わらず、条件、判断基準、失敗例、費用・期間・体制、参照元への注意のいずれかを含むか。",
      "見出しが機械的なキーワード列ではなく、読者の意思決定、比較軸、失敗パターンを示しているか。",
      "近年、重要です、一般的に、多くの場合などのAI風・汎用表現が目立たないか。",
      "未確認の数値・制度・効果を断定せず、出典URL、条件、時点、推定、注意書きを添えているか。",
    ],
  };
}

function buildQualityReview(input: OpenAILiveArtifactInput): QualityReviewItem[] {
  const themeText = input.form.theme;
  const primaryInfo = input.form.primaryInfo ?? "";
  const referenceTexts = [
    ...input.fetchedReferences.map((item) => item.text),
    ...input.form.references.map((item) => item.text),
    ...(input.form.referenceFiles ?? []).map((item) => item.text),
  ].filter(isNonEmptyString);
  const competitorTexts = [
    ...input.fetchedCompetitors.map((item) => item.text),
    ...input.form.competitors.map((item) => item.text),
    ...(input.form.competitorFiles ?? []).map((item) => item.text),
    input.competitorResearch?.summary,
    ...(
      input.competitorResearch?.insights.flatMap((insight) => [
        insight.title,
        ...insight.majorPoints,
        ...insight.differentiationPoints,
        ...insight.recommendations,
      ]) ?? []
    ),
  ].filter(isNonEmptyString);
  const sourceUrls = uniqueNonEmptyStrings([
    ...input.fetchedReferences.map((item) => item.url),
    ...input.fetchedCompetitors.map((item) => item.url),
    ...input.result.sources.map((item) => item.url),
    ...(input.competitorResearch?.insights.map((item) => item.url) ?? []),
  ]);

  return [
    toQualityReviewItem(
      "Article body",
      evaluateArticleQuality(input.result.body_html, {
        themeText,
        targetReaderText: input.result.target_reader,
        searchIntentText: input.result.search_intent,
        primaryInfo,
        closingText: input.form.closingText,
        referenceTexts,
        sourceUrls,
        competitorTexts,
        targetWordCount: input.form.wordCount,
      }),
    ),
    toQualityReviewItem(
      "Title",
      evaluateTitleQuality({
        selectedTitle: input.result.selected_title,
        titleCandidates: input.result.title_candidates,
        themeText,
        primaryInfo,
      }),
    ),
    toQualityReviewItem(
      "FAQ",
      evaluateFaqQuality({
        faqItems: input.result.faq_items,
        themeText,
        primaryInfo,
        referenceTexts,
        competitorTexts,
      }),
    ),
    toQualityReviewItem(
      "Meta description",
      evaluateMetaDescriptionQuality({
        metaDescription: input.result.meta_description,
        themeText,
        primaryInfo,
      }),
    ),
  ];
}

function toQualityReviewItem(
  category: string,
  evaluation: ArticleQualityEvaluation,
): QualityReviewItem {
  return {
    category,
    score: evaluation.score,
    failedChecks: evaluation.checks
      .filter((check) => !check.passed)
      .map((check) => ({
        id: check.id,
        label: check.label,
        detail: check.detail,
      })),
  };
}

export function sanitizeLiveArtifactName(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sample"
  );
}

function renderArtifactHtml(payload: ReturnType<typeof buildOpenAILiveArtifact>) {
  return [
    "<!doctype html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(payload.output.selectedTitle)} - OpenAI live artifact</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<style>",
    "body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;max-width:960px;margin:40px auto;padding:0 24px;color:#172033;background:#fff;}",
    "header{border-bottom:1px solid #d7dde8;margin-bottom:28px;padding-bottom:18px;}",
    "dl{display:grid;grid-template-columns:180px 1fr;gap:8px 16px;background:#f7f9fc;padding:16px;border:1px solid #d7dde8;}",
    "dt{font-weight:700;color:#4b5871;} dd{margin:0;} article{margin-top:32px;} pre{white-space:pre-wrap;background:#f7f9fc;padding:16px;border:1px solid #d7dde8;}",
    "</style>",
    "</head>",
    "<body>",
    "<header>",
    `<h1>${escapeHtml(payload.output.selectedTitle)}</h1>`,
    "<dl>",
    `<dt>Sample</dt><dd>${escapeHtml(payload.sampleName)}</dd>`,
    `<dt>Generated at</dt><dd>${escapeHtml(payload.generatedAt)}</dd>`,
    `<dt>Model</dt><dd>${escapeHtml(payload.textModel)}</dd>`,
    `<dt>Score</dt><dd>${payload.score} / 100 (minimum ${payload.minScore})</dd>`,
    `<dt>Theme</dt><dd>${escapeHtml(payload.input.theme)}</dd>`,
    `<dt>Primary info</dt><dd>${escapeHtml(payload.input.primaryInfo)}</dd>`,
    "</dl>",
    "</header>",
    "<section>",
    "<h2>Review Notes</h2>",
    `<pre>${escapeHtml(payload.output.improvements.join("\n") || "No improvements reported.")}</pre>`,
    "</section>",
    "<section>",
    "<h2>Editorial Review Checklist</h2>",
    "<ul>",
    ...payload.reviewChecklist.map((item) => `<li>${escapeHtml(item)}</li>`),
    "</ul>",
    "</section>",
    "<section>",
    "<h2>Deterministic Quality Checks</h2>",
    "<ul>",
    ...payload.qualityReview.map(renderQualityReviewItem),
    "</ul>",
    "</section>",
    "<section>",
    "<h2>Reader And Structure Snapshot</h2>",
    "<dl>",
    `<dt>Target reader</dt><dd>${escapeHtml(payload.output.targetReader)}</dd>`,
    `<dt>Search intent</dt><dd>${escapeHtml(payload.output.searchIntent)}</dd>`,
    `<dt>Headings</dt><dd>${escapeHtml(payload.output.headings.map((heading) => `${heading.level}: ${heading.text}`).join(" / "))}</dd>`,
    `<dt>FAQ</dt><dd>${escapeHtml(payload.output.faqItems.map((item) => `${item.question} -> ${item.answer}`).join(" / "))}</dd>`,
    "</dl>",
    "</section>",
    "<article>",
    payload.output.bodyHtml,
    "</article>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function renderQualityReviewItem(item: QualityReviewItem) {
  const failed =
    item.failedChecks.length > 0
      ? `<ul>${item.failedChecks
          .map(
            (check) =>
              `<li><strong>${escapeHtml(check.id)}</strong>: ${escapeHtml(check.detail)}</li>`,
          )
          .join("")}</ul>`
      : "<p>All deterministic checks passed.</p>";

  return `<li><strong>${escapeHtml(item.category)}</strong>: ${item.score} / 100${failed}</li>`;
}

function cleanEnvValue(value: string | undefined) {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function pathIsInsideOrEqual(child: string, parent: string) {
  const normalizedChild = path.normalize(child).toLowerCase();
  const normalizedParent = path.normalize(parent).toLowerCase();
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(`${normalizedParent}${path.sep}`)
  );
}

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function uniqueNonEmptyStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
