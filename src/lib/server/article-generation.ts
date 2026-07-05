import sanitizeHtml from "sanitize-html";
import { articleGenerationSchema } from "@/lib/server/ai-schemas";
import { createStructuredResponse } from "@/lib/server/openai";
import { evaluateArticleQuality } from "@/lib/article-quality";
import { evaluateTitleQuality } from "@/lib/title-quality";
import { truncateText } from "@/lib/utils";
import type { ArticleGenerationResult } from "@/types/aio";

export type ArticleGenerationPayload = {
  form: Record<string, unknown>;
  fetchedReferences: Array<Record<string, unknown>>;
  fetchedCompetitors: Array<Record<string, unknown>>;
  competitorResearch?: Record<string, unknown> | null;
};

export async function generateAioArticle(payload: ArticleGenerationPayload) {
  const compactPayload = {
    form: compactForm(payload.form),
    fetchedReferences: payload.fetchedReferences.slice(0, 8).map(compactFetchResult),
    fetchedCompetitors: payload.fetchedCompetitors.slice(0, 8).map(compactFetchResult),
    competitorResearch: payload.competitorResearch,
  };

  const result = await createStructuredResponse<ArticleGenerationResult>({
    schemaName: "aio_article_generation",
    schema: articleGenerationSchema,
    instructions: [
      "You are an expert Japanese AIO/SEO editor for BtoB content.",
      "Create original article drafts from the provided reference and competitor material.",
      "Do not copy source phrasing. Do not state uncertain facts as facts.",
      "The article must be useful for AI answer engines: clear definitions, concise sentences, structured headings, lists, tables, FAQ, and source notes.",
      "Treat payload.form.theme as the editorial brief. Reflect its topic, keywords, target reader, search intent, and article goal in the title, opening answer, headings, examples, FAQ, tags, and categories.",
      "When competitor material or competitorResearch is provided, use it to identify comparison axes, missing perspectives, objections, and differentiation points. Do not merely summarize competitors.",
      "Treat payload.form.primaryInfo as high-priority first-party information. Use it to add original field observations, concrete examples, company-specific viewpoints, caveats, and practical nuance so the article does not become commodity content.",
      "When primaryInfo is provided, weave it naturally into the introduction, examples, body sections, and key takeaways. Do not overstate it as universal fact; attribute it as company experience or observed tendency when appropriate.",
      "Make the first 400 Japanese characters answer-first: state the conclusion, definition, or most important editorial judgment before background explanation.",
      "Avoid commodity content and generic AI-like filler. Do not lean on vague phrases such as 近年, 重要です, 注目されています, と言えるでしょう, いかがでしょうか, or 本記事では unless they are genuinely necessary and supported by the material.",
      "Avoid verbose AI-like predicates such as することができます, することが可能です, 可能となります, or することが重要です. Prefer shorter, more concrete verbs such as 確認します, 分けます, 判断します, 減らせます, or できます when accurate.",
      "Avoid unsupported strong claims such as 必ず, 絶対に, 完全に, 誰でも, 唯一, すべて解決, or 確実に unless the source material proves them and the sentence includes conditions or caveats.",
      "Write as a human editor who has interviewed the business: each major section should include at least one concrete decision criterion, field example, operational caveat, failure pattern, or source-backed detail.",
      "Avoid thin H2/H3 sections. Every H2/H3 body should include at least two concrete signals such as a number, field observation, decision criterion, failure/risk note, team/cost/timing detail, or source/caveat note.",
      "Across the full article, include at least three different types of editorial evidence: field observations, decision criteria, failure/risk notes, team/cost/timing details, and source/caveat notes.",
      "Make headings editorial and useful, not mechanical keyword strings. Vary sentence rhythm and endings so the body does not read like a template.",
      "Make title candidates specific and editorial. Avoid generic titles such as 重要なポイント, メリット, デメリット, まとめ, 概要, 基本, 活用方法, 注意点, 完全ガイド, or 徹底解説 unless paired with a concrete reader decision, first-party insight, or comparison axis from the inputs.",
      "Do not start many consecutive sentences with the same connector such as また, さらに, そのため, 一方で, or このように. Mix short direct sentences, examples, conditions, and caveats instead.",
      "Avoid generic H2/H3 labels such as 重要なポイント, メリット, デメリット, まとめ, 概要, 基本, 活用方法, or 注意点. Make each heading convey a concrete reader decision, failure pattern, comparison axis, or field-specific insight.",
      "Do not use vague heading patterns such as 導入について, 注意点について, 活用方法, or メリットについて. Replace them with headings that reveal the editorial angle, such as which decision, failure, comparison, or field observation the section explains.",
      "In aio_score_self_evaluation, explicitly judge concreteness, use of first-party information, source fidelity, and absence of AI-like generic phrasing.",
      "Respect payload.form.wordCount as the target Japanese character count. Natural variance is acceptable, but stay close to the requested scale.",
      "Respect payload.form.imageCount when creating image_prompts. Return zero image_prompts when imageCount is 0, otherwise return exactly that many prompts up to 3.",
      "Return only JSON matching the schema. body_html must be safe article HTML, not Markdown.",
    ].join("\n"),
    input: JSON.stringify({
      task:
        "AIO最適化済みの記事ドラフトを日本語で生成してください。payload.form.regenerationInstruction がある場合は、既存入力を前提にその再作成方針を優先して、構成・本文・タイトル・FAQ・画像プロンプトを再作成してください。冒頭に結論、明確なH2/H3、定義文、箇条書き、必要なら表、FAQを含めてください。各H2では、一次情報・参照情報・競合情報から得られる具体例、判断基準、注意点、現場で起きる失敗パターンのいずれかを必ず入れ、薄い1段落だけで終えないでください。根拠が薄い内容は断定しないでください。body_htmlはHTML込みで9000文字以内に収め、JSONを必ず最後まで閉じてください。結び文章が入力されている場合は、記事末尾に自然に反映してください。執筆者情報がある場合は本文末尾に「この記事の執筆者」ブロックを入れてください。payload.form.wordCount を目標文字数として本文量を調整してください。payload.form.imageCount が0の場合は image_prompts を空配列にし、1以上の場合は featured から順に指定枚数分だけ返してください。",
      payload: compactPayload,
    }),
    timeoutMs: 105_000,
    maxOutputTokens: 16_000,
  });

  const sanitizedBodyHtml = sanitizeArticleHtml(result.body_html);
  const qualityEvaluation = evaluateArticleQuality(sanitizedBodyHtml, {
    primaryInfo:
      typeof compactPayload.form.primaryInfo === "string"
        ? compactPayload.form.primaryInfo
        : undefined,
    closingText:
      typeof compactPayload.form.closingText === "string"
        ? compactPayload.form.closingText
        : undefined,
    themeText:
      typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : undefined,
    referenceTexts: collectReferenceTexts(compactPayload.form, compactPayload.fetchedReferences),
    competitorTexts: collectCompetitorTexts(
      compactPayload.form,
      compactPayload.fetchedCompetitors,
      compactPayload.competitorResearch,
    ),
  });
  const titleEvaluation = evaluateTitleQuality({
    selectedTitle: result.selected_title,
    titleCandidates: result.title_candidates,
    themeText: typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : "",
    primaryInfo:
      typeof compactPayload.form.primaryInfo === "string" ? compactPayload.form.primaryInfo : "",
  });

  return {
    ...result,
    body_html: sanitizedBodyHtml,
    image_prompts: normalizeImagePrompts(result, compactPayload.form),
    aio_score_self_evaluation: {
      score: Math.min(
        result.aio_score_self_evaluation.score,
        qualityEvaluation.score,
        titleEvaluation.score,
      ),
      strengths: uniqueItems([
        ...result.aio_score_self_evaluation.strengths,
        ...qualityEvaluation.strengths.map((item) => `編集品質チェック: ${item}`),
        ...titleEvaluation.strengths.map((item) => `タイトル品質チェック: ${item}`),
      ]).slice(0, 8),
      improvements: uniqueItems([
        ...titleEvaluation.improvements,
        ...qualityEvaluation.improvements,
        ...result.aio_score_self_evaluation.improvements,
      ]).slice(0, 8),
    },
  } satisfies ArticleGenerationResult;
}

function compactFetchResult(value: Record<string, unknown>) {
  return {
    ...value,
    text: typeof value.text === "string" ? truncateText(value.text, 3000) : value.text,
    reason: typeof value.reason === "string" ? truncateText(value.reason, 300) : value.reason,
  };
}

function compactForm(form: Record<string, unknown>) {
  const visualTone = isRecord(form.visualTone) ? form.visualTone : {};
  const author = isRecord(form.author) ? form.author : {};
  const referenceFiles = Array.isArray(form.referenceFiles) ? form.referenceFiles : [];
  const competitorFiles = Array.isArray(form.competitorFiles) ? form.competitorFiles : [];

  return {
    ...form,
    theme: typeof form.theme === "string" ? truncateText(form.theme, 1800) : form.theme,
    primaryInfo:
      typeof form.primaryInfo === "string"
        ? truncateText(form.primaryInfo, 2400)
        : form.primaryInfo,
    closingText:
      typeof form.closingText === "string" ? truncateText(form.closingText, 1000) : form.closingText,
    regenerationInstruction:
      typeof form.regenerationInstruction === "string"
        ? truncateText(form.regenerationInstruction, 1200)
        : form.regenerationInstruction,
    visualTone: {
      ...visualTone,
      uploadedImageUrl: visualTone.uploadedImageUrl ? "[uploaded image]" : undefined,
    },
    author: {
      ...author,
      bio: typeof author.bio === "string" ? truncateText(author.bio, 800) : author.bio,
      imageUrl: author.imageUrl ? "[uploaded author image]" : undefined,
    },
    referenceFiles: referenceFiles.slice(0, 8).map(compactFileInput),
    competitorFiles: competitorFiles.slice(0, 8).map(compactFileInput),
    imageCount: normalizeImageCount(form.imageCount),
    wordCount: normalizeWordCount(form.wordCount),
  };
}

function compactFileInput(value: unknown) {
  if (!isRecord(value)) {
    return value;
  }

  return {
    name: value.name,
    type: value.type,
    ok: value.ok,
    text: typeof value.text === "string" ? truncateText(value.text, 2200) : undefined,
    error: typeof value.error === "string" ? truncateText(value.error, 220) : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeArticleHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "p",
      "a",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "figure",
      "figcaption",
      "img",
      "br",
      "hr",
      "section",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title"],
      figure: ["data-image-slot"],
      div: ["class"],
      section: ["class"],
    },
    allowedSchemes: ["http", "https", "data"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

function normalizeImagePrompts(result: ArticleGenerationResult, form: Record<string, unknown>) {
  const imageCount = normalizeImageCount(form.imageCount);
  if (imageCount === 0) {
    return [];
  }

  const prompts = result.image_prompts.slice(0, imageCount);
  const slots = ["featured", "inline-1", "inline-2"] as const;
  const visualTone = getVisualToneText(form);

  return slots.slice(0, imageCount).map((slot, index) => {
    const existing = prompts.find((prompt) => prompt.slot === slot) ?? prompts[index];
    const purpose =
      existing?.purpose ||
      (slot === "featured" ? "Article featured image" : "Article body explanatory image");
    const basePrompt =
      existing?.prompt ||
      `BtoB article illustration about ${result.selected_title}, clean editorial style`;

    return {
      slot,
      purpose,
      prompt: buildPremiumImagePrompt({
        basePrompt,
        purpose,
        selectedTitle: result.selected_title,
        slot,
        visualTone,
      }),
      alt_text:
        existing?.alt_text ||
        `${result.selected_title} - ${slot === "featured" ? "featured image" : "explanatory image"}`,
    };
  });
}

function getVisualToneText(form: Record<string, unknown>) {
  const visualTone = isRecord(form.visualTone) ? form.visualTone : {};
  const mode = typeof visualTone.mode === "string" ? visualTone.mode : "";

  if (mode === "custom" && typeof visualTone.custom === "string") {
    return visualTone.custom;
  }

  if (mode === "preset" && typeof visualTone.preset === "string") {
    return visualTone.preset;
  }

  return "clean Japanese B2B whitepaper editorial style";
}

function buildPremiumImagePrompt({
  basePrompt,
  purpose,
  selectedTitle,
  slot,
  visualTone,
}: {
  basePrompt: string;
  purpose: string;
  selectedTitle: string;
  slot: "featured" | "inline-1" | "inline-2";
  visualTone: string;
}) {
  const slotBrief =
    slot === "featured"
      ? "Featured image: make a wide, polished hero visual with a clear central metaphor for the article topic."
      : "Inline image: make a simple explanatory diagram-like visual that clarifies one concept from the article.";

  return [
    basePrompt.trim(),
    "",
    `Article title: ${selectedTitle}`,
    `Image purpose: ${purpose}`,
    `Requested visual tone: ${visualTone}`,
    slotBrief,
    "Style direction: premium Japanese B2B SaaS / consulting / financial whitepaper, clean editorial art direction, refined composition, crisp geometry, subtle depth, high-end corporate polish.",
    "Composition: 3:2 landscape, generous whitespace, one clear focal idea, balanced margins, light background, restrained accent colors, scalable at thumbnail size.",
    "Content: use abstract dashboards, process cards, geometric diagrams, data-flow shapes, or symbolic business/AI elements as appropriate.",
    "Avoid: readable text, random letters, logos, watermarks, fake brand marks, cluttered dashboards, distorted hands, unnecessary people, clip-art, cheap stock-photo look, dark blurry neon backgrounds.",
  ].join("\n");
}

function normalizeImageCount(value: unknown) {
  const parsed = Number(value);
  return [0, 1, 2, 3].includes(parsed) ? parsed : 2;
}

function normalizeWordCount(value: unknown) {
  const parsed = Number(value);
  return [1000, 2000, 3000, 4000, 5000, 6000].includes(parsed) ? parsed : 3000;
}

function collectReferenceTexts(
  form: Record<string, unknown>,
  fetchedReferences: Array<Record<string, unknown>>,
) {
  return uniqueItems([
    ...fetchedReferences.map(readTextField),
    ...readTextFieldList(form.references),
    ...readTextFieldList(form.referenceFiles),
  ]);
}

function collectCompetitorTexts(
  form: Record<string, unknown>,
  fetchedCompetitors: Array<Record<string, unknown>>,
  competitorResearch: unknown,
) {
  return uniqueItems([
    ...fetchedCompetitors.map(readTextField),
    ...readTextFieldList(form.competitors),
    ...readTextFieldList(form.competitorFiles),
    ...readCompetitorResearchTexts(competitorResearch),
  ]);
}

function readCompetitorResearchTexts(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const insights = Array.isArray(value.insights) ? value.insights : [];

  return [
    typeof value.summary === "string" ? value.summary : "",
    ...insights.flatMap(readCompetitorInsightTexts),
  ];
}

function readCompetitorInsightTexts(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return [
    typeof value.title === "string" ? value.title : "",
    ...readStringList(value.majorPoints),
    ...readStringList(value.differentiationPoints),
    ...readStringList(value.recommendations),
  ];
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readTextFieldList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readTextField);
}

function readTextField(value: unknown) {
  return isRecord(value) && typeof value.text === "string" ? value.text : "";
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}
