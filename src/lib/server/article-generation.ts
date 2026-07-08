import sanitizeHtml from "sanitize-html";
import { articleGenerationSchema } from "@/lib/server/ai-schemas";
import { createStructuredResponse } from "@/lib/server/openai";
import { evaluateArticleQuality } from "@/lib/article-quality";
import { evaluateFaqQuality } from "@/lib/faq-quality";
import { evaluateImageAltQuality } from "@/lib/image-alt-quality";
import { evaluateMetaDescriptionQuality } from "@/lib/meta-description-quality";
import { truncatePromptLine } from "@/lib/prompt-text";
import { evaluateTitleQuality } from "@/lib/title-quality";
import { compactOptionalText, truncateText } from "@/lib/utils";
import type { ArticleGenerationResult } from "@/types/aio";

export type ArticleGenerationPayload = {
  form: Record<string, unknown>;
  fetchedReferences: Array<Record<string, unknown>>;
  fetchedCompetitors: Array<Record<string, unknown>>;
  competitorResearch?: Record<string, unknown> | null;
};

const ARTICLE_GENERATION_TIMEOUT_MS = 150_000;

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
      "When using tables, make them useful decision tables. Avoid thin tables with only 項目/内容 or 概要/説明; include comparison axes, conditions, costs, timing, owner/team, caveats, source notes, or field observations.",
      "Treat payload.form.theme as the editorial brief. Reflect its topic, keywords, target reader, search intent, and article goal in the title, opening answer, headings, examples, FAQ, tags, and categories.",
      "When target reader or audience text includes explicit roles or job titles, preserve at least one role phrase in the opening answer and return the same audience signal in at least one heading, example, or FAQ item.",
      "If the target reader lists multiple roles separated by commas, do not collapse them into one broad team label. Reuse each explicit role phrase, or a very close natural equivalent, at least once across body_html, headings, examples, or FAQ.",
      "When competitor material or competitorResearch is provided, use it to identify comparison axes, missing perspectives, objections, and differentiation points. Do not merely summarize competitors.",
      "Do not paste long reference or competitor passages verbatim. Keep source meaning and facts, then rewrite them as definitions, decision criteria, caveats, comparison axes, or source notes.",
      "Treat payload.form.primaryInfo as high-priority first-party information. Use it to add original field observations, concrete examples, company-specific viewpoints, caveats, and practical nuance so the article does not become commodity content.",
      "When primaryInfo is provided, weave it naturally into the introduction, examples, body sections, and key takeaways. Do not overstate it as universal fact; attribute it as company experience or observed tendency when appropriate.",
      "Do not paste primaryInfo verbatim as article copy. Preserve its concrete nouns and meaning, then rewrite it into reader-facing editorial observations, decision criteria, caveats, or examples.",
      "If primaryInfo is long, do not reuse a full clause as-is. Break it into observed problem, affected reader, operational cause, decision criterion, and caveat, then write those pieces in new sentences.",
      "Make the first 400 Japanese characters answer-first: state the conclusion, definition, or most important editorial judgment before background explanation.",
      "Do not open with boilerplate framing such as 本記事では, この記事では, 近年, について解説します, を紹介します, in this article, or this article explains. Start with a concrete conclusion, definition, reader decision, field observation, condition, or caveat.",
      "Avoid commodity content and generic AI-like filler. Do not lean on vague phrases such as 近年, 重要です, 一般的に, 多くの場合, 重要になります, 注目されています, 求められます, 欠かせません, と言えるでしょう, いかがでしょうか, 本記事では, わかりやすく解説, 詳しく解説, を紹介します, 効率化につながります, 品質向上につながります, in this article, this article explains, it is important to, various, many companies, can help, improve efficiency, should consider, recommended to, best practices, streamline, enhance productivity, leverage, today's fast-paced digital landscape, today's digital landscape, today's rapidly evolving landscape, ever-evolving landscape, comprehensive guide, delve into, navigate the complexities, game-changer, unlock the potential, empower businesses, in conclusion, it is worth noting that, or at the end of the day unless they are genuinely necessary and supported by the material.",
      "Avoid verbose AI-like predicates such as することができます, することが可能です, 可能となります, することが重要です, it is important to, in order to, or utilize. Prefer shorter, more concrete verbs such as 確認します, 分けます, 判断します, 減らせます, or できます when accurate.",
      "Avoid unsupported strong claims such as 必ず, 絶対に, 完全に, 誰でも, 唯一, すべて解決, or 確実に unless the source material proves them and the sentence includes conditions or caveats.",
      "When using numbers, percentages, costs, timing, counts, or performance-like claims, attach a source, condition, date, caveat, estimate, or first-party observation near the number. Do not present unsupported figures as facts.",
      "If a number appears because it is part of a keyword or category label, such as a reader segment or service name, make that role explicit near the phrase or attach the source/context that provided it. Do not let keyword numerals read like unsupported research findings.",
      "When reference URLs or source URLs are available, keep the actual URLs visible in body_html as source notes or links so the WordPress draft remains independently checkable after publishing.",
      "In body_html itself, include at least one <ul> or <ol> and an FAQ section. Do not rely only on separate key_takeaways or faq_items arrays.",
      "The first paragraph of body_html must be answer-first and include a definition or decision sentence using a natural Japanese form such as '...とは...を指します' when the topic allows it.",
      "Write as a human editor who has interviewed the business: each major section should include at least one concrete decision criterion, field example, operational caveat, failure pattern, or source-backed detail.",
      "Avoid thin H2/H3 sections. Every H2/H3 body should include at least two concrete signals such as a number, field observation, decision criterion, failure/risk note, team/cost/timing detail, or source/caveat note.",
      "Across the full article, include at least three different types of editorial evidence: field observations, decision criteria, failure/risk notes, team/cost/timing details, and source/caveat notes.",
      "Across body_html, use at least three concrete anchor words when natural: 判断基準, 注意点, 失敗例, 現場観察, 出典, 条件, 費用, 期間, 担当. These anchors should introduce actual detail, not labels alone.",
      "Before returning JSON, run one silent editorial self-review of selected_title, body_html, headings, faq_items, and meta_description. If any part sounds like commodity AI copy, lacks first-party/source evidence, uses unsupported claims, or opens with generic framing, revise that part before final output.",
      "Make headings editorial and useful, not mechanical keyword strings. Vary sentence rhythm and endings so the body does not read like a template.",
      "Make title candidates specific and editorial. Avoid generic titles such as 重要なポイント, メリット, デメリット, まとめ, 概要, 基本, 活用方法, 注意点, 完全ガイド, 徹底解説, Best Practices, Strategy, Checklist, or Tips unless paired with a concrete reader decision, first-party insight, or comparison axis from the inputs.",
      "Make faq_items specific enough for publication. Avoid generic questions such as よくある質問, メリットは何ですか, 注意点は何ですか, AIOとは何ですか, AIOはなぜ重要ですか, AIOはどのように活用できますか, What is AIO?, Why is AIO important?, How does it work?, What are the benefits?, or What are the benefits of AIO? Avoid generic FAQ answer filler such as can help, helps improve, improve efficiency, should consider, recommended to, best practices, streamline, enhance productivity, or leverage unless the sentence includes a concrete condition, source boundary, field example, or decision criterion. Each answer should include a condition, decision criterion, field example, caveat, source note, cost/timing/team detail, or competitor comparison when available.",
      "At least two FAQ items should visibly reuse concrete input terms from the theme, primaryInfo, references, or competitor material, but the answers must explain the terms through a decision, condition, caveat, field example, or source boundary.",
      "Keep sentences short enough to read comfortably. Avoid single Japanese sentences over roughly 130 visible characters; split long sentences into conclusion, condition, exception, and example sentences.",
      "Do not start many consecutive sentences with the same connector such as また, さらに, そのため, 一方で, or このように. Mix short direct sentences, examples, conditions, and caveats instead.",
      "Do not overuse formulaic sentence openings such as 結論として, 具体的には, たとえば, 重要なのは, ポイントは, or 注意点は. Use direct editorial judgments, field observations, conditions, exceptions, and comparisons to vary paragraph openings.",
      "Avoid generic H2/H3 labels such as 重要なポイント, メリット, デメリット, まとめ, 概要, 基本, 活用方法, or 注意点. Make each heading convey a concrete reader decision, failure pattern, comparison axis, or field-specific insight.",
      "Do not use vague heading patterns such as 導入について, 注意点について, 活用方法, or メリットについて. Replace them with headings that reveal the editorial angle, such as which decision, failure, comparison, or field observation the section explains.",
      "Avoid mechanical heading sequences such as まず, 次に, 最後に, STEP1, STEP2, or generic '3つのポイント' unless the heading also states a concrete reader decision, failure pattern, comparison axis, or field observation.",
      "In aio_score_self_evaluation, explicitly judge concreteness, use of first-party information, source fidelity, and absence of AI-like generic phrasing.",
      "Respect payload.form.wordCount as the target visible Japanese body text length, not as a token budget and not including HTML tags. Aim for 90-110% of the requested count and use 130% as a hard maximum, leaving buffer below the evaluator's 135% limit. For a 2,000-character request, keep visible body text below about 2,600 characters. If the draft is short, add concrete field examples, caveats, comparison axes, table rows, FAQ detail, or source notes rather than generic filler. If it is long, cut background explanation before cutting evidence.",
      "The main article body before FAQ, author, source, and other auxiliary blocks must still carry enough substance. For a 2,000-character request, keep that main body above about 1,500 visible Japanese characters by adding source-backed examples, decision criteria, caveats, table rows, or field observations, not filler.",
      "Respect payload.form.imageCount when creating image_prompts. Return zero image_prompts when imageCount is 0, otherwise return exactly that many prompts up to 3.",
      "Set aio_score_self_evaluation.score on a 0-100 scale. For example, return 86 for a strong draft, not 8.6.",
      "Return only JSON matching the schema. body_html must be safe article HTML, not Markdown.",
    ].join("\n"),
    input: JSON.stringify({
      task:
        "AIO最適化済みの記事ドラフトを日本語で生成してください。payload.form.regenerationInstruction がある場合は、既存入力を前提にその再作成方針を優先して、構成・本文・タイトル・FAQ・画像プロンプトを再作成してください。冒頭に結論、明確なH2/H3、定義文、箇条書き、必要なら表、FAQを含めてください。想定読者に役割名や職種名がある場合は、冒頭と少なくとも1つの見出し・具体例・FAQにその読者語を自然に戻してください。各H2では、一次情報・参照情報・競合情報から得られる具体例、判断基準、注意点、現場で起きる失敗パターンのいずれかを必ず入れ、薄い1段落だけで終えないでください。根拠が薄い内容は断定しないでください。数字・費用・期間・件数・割合・人数・順位に見える表現は、近くに出典、条件、時点、目安、現場観察、または未確認である旨を添えてください。body_htmlはHTML込みで9000文字以内に収め、JSONを必ず最後まで閉じてください。結び文章が入力されている場合は、記事末尾に自然に反映してください。執筆者情報がある場合は本文末尾に「この記事の執筆者」ブロックを入れてください。payload.form.wordCount をHTMLタグを除いた本文の目標文字数として扱い、目標の90〜110%を狙い、130%を超えないよう本文量を調整してください。FAQ・執筆者・参照元ブロックを除いた主要本文だけでも、2,000字指定なら1,500字前後を下回らないよう、具体例、判断基準、注意点、表の行、現場観察を足してください。payload.form.imageCount が0の場合は image_prompts を空配列にし、1以上の場合は featured から順に指定枚数分だけ返してください。",
      payload: compactPayload,
    }),
    timeoutMs: ARTICLE_GENERATION_TIMEOUT_MS,
    maxOutputTokens: 16_000,
  });

  const sourceUrls = collectSourceUrls(
    compactPayload.form,
    compactPayload.fetchedReferences,
    compactPayload.fetchedCompetitors,
    compactPayload.competitorResearch,
    result.sources,
  );
  const sanitizedBodyHtml = ensureGeneratedSourceUrls(
    ensureGeneratedBodyStructure(sanitizeArticleHtml(result.body_html), result),
    sourceUrls,
  );
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
    targetReaderText: result.target_reader,
    searchIntentText: result.search_intent,
    referenceTexts: collectReferenceTexts(compactPayload.form, compactPayload.fetchedReferences),
    sourceUrls,
    competitorTexts: collectCompetitorTexts(
      compactPayload.form,
      compactPayload.fetchedCompetitors,
      compactPayload.competitorResearch,
    ),
    targetWordCount:
      typeof compactPayload.form.wordCount === "number" ? compactPayload.form.wordCount : undefined,
  });
  const titleEvaluation = evaluateTitleQuality({
    selectedTitle: result.selected_title,
    titleCandidates: result.title_candidates,
    themeText: typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : "",
    primaryInfo:
      typeof compactPayload.form.primaryInfo === "string" ? compactPayload.form.primaryInfo : "",
  });
  const faqEvaluation = evaluateFaqQuality({
    faqItems: result.faq_items,
    themeText: typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : "",
    primaryInfo:
      typeof compactPayload.form.primaryInfo === "string" ? compactPayload.form.primaryInfo : "",
    referenceTexts: collectReferenceTexts(compactPayload.form, compactPayload.fetchedReferences),
    competitorTexts: collectCompetitorTexts(
      compactPayload.form,
      compactPayload.fetchedCompetitors,
      compactPayload.competitorResearch,
    ),
  });
  const metaDescriptionEvaluation = evaluateMetaDescriptionQuality({
    metaDescription: result.meta_description,
    themeText: typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : "",
    primaryInfo:
      typeof compactPayload.form.primaryInfo === "string" ? compactPayload.form.primaryInfo : "",
  });
  const normalizedImagePrompts = normalizeImagePrompts(result, compactPayload.form);
  const imageAltEvaluation = evaluateImageAltQuality({
    imagePrompts: normalizedImagePrompts,
    imageCount:
      typeof compactPayload.form.imageCount === "number" ? compactPayload.form.imageCount : 2,
    themeText: typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : "",
    primaryInfo:
      typeof compactPayload.form.primaryInfo === "string" ? compactPayload.form.primaryInfo : "",
  });

  const normalizedSelfEvaluationScore = normalizeSelfEvaluationScore(
    result.aio_score_self_evaluation.score,
  );
  const deterministicScore = Math.min(
    qualityEvaluation.score,
    titleEvaluation.score,
    faqEvaluation.score,
    metaDescriptionEvaluation.score,
    imageAltEvaluation.score,
  );

  return {
    ...result,
    body_html: sanitizedBodyHtml,
    image_prompts: normalizedImagePrompts,
    aio_score_self_evaluation: {
      score: Math.min(normalizedSelfEvaluationScore, deterministicScore),
      strengths: uniqueItems([
        ...result.aio_score_self_evaluation.strengths,
        ...qualityEvaluation.strengths.map((item) => `編集品質チェック: ${item}`),
        ...titleEvaluation.strengths.map((item) => `タイトル品質チェック: ${item}`),
        ...faqEvaluation.strengths.map((item) => `FAQ品質チェック: ${item}`),
        ...metaDescriptionEvaluation.strengths.map((item) => `メタ品質チェック: ${item}`),
        ...imageAltEvaluation.strengths.map((item) => `画像alt品質チェック: ${item}`),
      ]).slice(0, 8),
      improvements: uniqueItems([
        ...titleEvaluation.improvements,
        ...metaDescriptionEvaluation.improvements,
        ...imageAltEvaluation.improvements,
        ...qualityEvaluation.improvements,
        ...faqEvaluation.improvements,
        ...result.aio_score_self_evaluation.improvements,
      ]).slice(0, 8),
    },
  } satisfies ArticleGenerationResult;
}

export function normalizeSelfEvaluationScore(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  if (boundedScore > 0 && boundedScore <= 10) {
    return Math.round(boundedScore * 10);
  }

  return boundedScore;
}

function ensureGeneratedBodyStructure(html: string, result: ArticleGenerationResult) {
  let nextHtml = html.trim();

  if (!/<(?:ul|ol)[\s>]/i.test(nextHtml) && result.key_takeaways.length > 0) {
    const items = result.key_takeaways
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    if (items) {
      nextHtml = `${nextHtml}\n<section class="aio-key-takeaways"><h2>要点</h2><ul>${items}</ul></section>`;
    }
  }

  if (!/(FAQ|よくある質問|<h2[^>]*>[^<]*質問|<h3[^>]*>[^<]*質問)/i.test(nextHtml)) {
    const faqItems = result.faq_items
      .map((item) => ({
        question: item.question.trim(),
        answer: item.answer.trim(),
      }))
      .filter((item) => item.question || item.answer)
      .slice(0, 5);

    if (faqItems.length > 0) {
      const faqHtml = faqItems
        .map(
          (item) =>
            `<div class="aio-faq-item"><h3>${escapeHtml(item.question || "FAQ")}</h3><p>${escapeHtml(
              item.answer,
            )}</p></div>`,
        )
        .join("");
      nextHtml = `${nextHtml}\n<section class="aio-faq-block" aria-label="FAQ"><h2>FAQ</h2>${faqHtml}</section>`;
    }
  }

  return nextHtml;
}

function ensureGeneratedSourceUrls(html: string, sourceUrls: string[]) {
  const missingUrls = sourceUrls
    .map((url) => url.trim())
    .filter(Boolean)
    .filter(isSafeHttpUrl)
    .slice(0, 8)
    .filter((url) => !html.includes(url));

  if (missingUrls.length === 0) {
    return html;
  }

  const items = missingUrls
    .map(
      (url) =>
        `<li><a href="${escapeHtmlAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          url,
        )}</a></li>`,
    )
    .join("");

  return `${html}\n<section class="aio-source-block" aria-label="参照元"><h2>参照元</h2><ul>${items}</ul></section>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isSafeHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
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
        ? compactOptionalText(form.primaryInfo, 2400)
        : form.primaryInfo,
    closingText:
      typeof form.closingText === "string"
        ? compactOptionalText(form.closingText, 1000)
        : form.closingText,
    regenerationInstruction:
      typeof form.regenerationInstruction === "string"
        ? compactOptionalText(form.regenerationInstruction, 1200)
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
        articleSummary: result.article_summary,
        headings: result.headings.map((heading) => heading.text),
        keyTakeaways: result.key_takeaways,
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
  articleSummary,
  headings,
  keyTakeaways,
  purpose,
  selectedTitle,
  slot,
  visualTone,
}: {
  basePrompt: string;
  articleSummary: string;
  headings: string[];
  keyTakeaways: string[];
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
    `Article summary anchor: ${truncatePromptLine(articleSummary, 220)}`,
    `Key takeaways to visualize: ${keyTakeaways.slice(0, 3).map((item) => truncatePromptLine(item, 80)).join(" / ")}`,
    `Relevant headings: ${headings.slice(0, 4).map((item) => truncatePromptLine(item, 80)).join(" / ")}`,
    slotBrief,
    "Style direction: premium Japanese B2B SaaS / consulting / financial whitepaper, clean editorial art direction, refined composition, crisp geometry, subtle depth, high-end corporate polish.",
    "Composition: 3:2 landscape, generous whitespace, one clear focal idea, balanced margins, light background, restrained accent colors, scalable at thumbnail size.",
    "Content: turn the article-specific anchors above into an original diagram-like editorial visual, not a generic AI/business background.",
    "Use abstract dashboards, process cards, geometric diagrams, data-flow shapes, source/checklist cards, or symbolic business/AI elements as appropriate.",
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

function collectSourceUrls(
  form: Record<string, unknown>,
  fetchedReferences: Array<Record<string, unknown>>,
  fetchedCompetitors: Array<Record<string, unknown>>,
  competitorResearch: unknown,
  sources: Array<{ url?: string }>,
) {
  return uniqueItems([
    ...fetchedReferences.map(readUrlField),
    ...readUrlFieldList(form.references),
    ...fetchedCompetitors.map(readUrlField),
    ...readUrlFieldList(form.competitors),
    ...readCompetitorResearchUrls(competitorResearch),
    ...sources.map((source) => source.url ?? ""),
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

function readCompetitorResearchUrls(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const insights = Array.isArray(value.insights) ? value.insights : [];
  return insights.map((insight) => (isRecord(insight) && typeof insight.url === "string" ? insight.url : ""));
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

function readUrlFieldList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(readUrlField);
}

function readTextField(value: unknown) {
  return isRecord(value) && typeof value.text === "string" ? value.text : "";
}

function readUrlField(value: unknown) {
  return isRecord(value) && typeof value.url === "string" ? value.url : "";
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}
