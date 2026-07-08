import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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

  const artifactDir = resolveArtifactDir(env);
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

function resolveArtifactDir(env: LiveArtifactEnv) {
  return cleanEnvValue(env.AIO_LIVE_OPENAI_ARTIFACT_DIR) || path.join("test-results", "live-openai");
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
    "<article>",
    payload.output.bodyHtml,
    "</article>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function cleanEnvValue(value: string | undefined) {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
