import { sanitizeArticleHtml } from "@/lib/article-html";
import * as cheerio from "cheerio";
import { appendFaqBlockWhenNeeded, buildPresentedArticleBody } from "@/lib/draft-html";
import { buildPresentationInstruction, convertTablesToProse, readArticleStructure, readElementMode, resolveArticleStructure } from "@/lib/article-presentation";
import { evaluatePublicationReadiness } from "@/lib/publication-quality";
import { articleGenerationSchema } from "@/lib/server/ai-schemas";
import { createStructuredResponse } from "@/lib/server/openai";
import { evaluateArticleQuality } from "@/lib/article-quality";
import { evaluateFaqQuality } from "@/lib/faq-quality";
import { evaluateImageAltQuality } from "@/lib/image-alt-quality";
import { evaluateMetaDescriptionQuality } from "@/lib/meta-description-quality";
import { primaryInformationLabels } from "@/lib/primary-information";
import { truncatePromptLine } from "@/lib/prompt-text";
import {
  articleContainsCanonicalSourceLink,
  isUnusableFetchedSourceUrl,
  unusableFetchedSourceUrlKeys,
} from "@/lib/source-url";
import { evaluateTitleQuality } from "@/lib/title-quality";
import { compactOptionalText, truncateText } from "@/lib/utils";
import type {
  ArticleGenerationResult,
  AudienceType,
} from "@/types/aio";

export type ArticleGenerationPayload = {
  form: Record<string, unknown>;
  fetchedReferences: Array<Record<string, unknown>>;
  fetchedCompetitors: Array<Record<string, unknown>>;
  competitorResearch?: Record<string, unknown> | null;
};

const ARTICLE_GENERATION_TIMEOUT_MS = 150_000;

export async function generateAioArticle(payload: ArticleGenerationPayload): Promise<ArticleGenerationResult> {
  const compactPayload = {
    form: compactForm(payload.form),
    fetchedReferences: payload.fetchedReferences.slice(0, 8).map(compactFetchResult),
    fetchedCompetitors: payload.fetchedCompetitors.slice(0, 8).map(compactFetchResult),
    competitorResearch: payload.competitorResearch,
  };
  const audienceInstruction = buildAudienceInstruction(compactPayload.form.audienceType);
  const structureInstruction = buildPresentationInstruction(compactPayload.form);

  const rawResult = await createStructuredResponse<ArticleGenerationResult>({
    schemaName: "aio_article_generation",
    schema: articleGenerationSchema,
    instructions: [
      "You are an expert Japanese AIO/SEO editor. Match the explicitly requested audience instead of assuming BtoB.",
      audienceInstruction,
      structureInstruction,
      "Create original article drafts from the provided reference and competitor material.",
      "Do not copy source phrasing. Do not state uncertain facts as facts.",
      "The article must be useful for AI answer engines: clear definitions, concise sentences, structure appropriate to the selected article type, lists or tables when useful, a separately managed FAQ, and source notes.",
      "When using tables, make them useful decision tables. Avoid thin tables with only 項目/内容 or 概要/説明; include comparison axes, conditions, costs, timing, owner/team, caveats, source notes, or field observations.",
      "Treat payload.form.theme as the editorial brief. Reflect its topic, keywords, target reader, search intent, and article goal in the title, opening answer, headings, examples, FAQ, tags, and categories.",
      "When target reader or audience text includes explicit roles or job titles, preserve at least one role phrase in the opening answer and return the same audience signal in at least one heading, example, or FAQ item.",
      "If the target reader lists multiple roles separated by commas, do not collapse them into one broad team label. Reuse each explicit role phrase, or a very close natural equivalent, at least once across body_html, headings, examples, or FAQ.",
      "When competitor material or competitorResearch is provided, use it to identify comparison axes, missing perspectives, objections, and differentiation points. Do not merely summarize competitors.",
      "Do not paste long reference or competitor passages verbatim. Keep source meaning and facts, then rewrite them as definitions, decision criteria, caveats, comparison axes, or source notes.",
      "Treat payload.form.primaryInfo as high-priority first-party information. Use it to add original field observations, concrete examples, company-specific viewpoints, caveats, and practical nuance so the article does not become commodity content.",
      "Treat payload.form.primaryInfoTypes as the declared evidence categories for primaryInfo. Use those categories to frame attribution and article structure, but rely on the concrete primaryInfo text for factual details.",
      "When primaryInfo is provided, weave it naturally into the introduction, examples, body sections, and key takeaways. Do not overstate it as universal fact; attribute it as company experience or observed tendency when appropriate.",
      "Do not paste primaryInfo verbatim as article copy. Preserve its concrete nouns and meaning, then rewrite it into reader-facing editorial observations, decision criteria, caveats, or examples.",
      "If primaryInfo is long, do not reuse a full clause as-is. Break it into observed problem, affected reader, operational cause, decision criterion, and caveat, then write those pieces in new sentences.",
      "Make the first 400 Japanese characters answer-first: state the conclusion, definition, or most important editorial judgment before background explanation.",
      "Do not open with boilerplate framing such as 本記事では, この記事では, 近年, について解説します, を紹介します, in this article, or this article explains. Start with a concrete conclusion, definition, reader decision, field observation, condition, or caveat.",
      "Avoid commodity content and generic AI-like filler. Do not lean on vague phrases such as 近年, 重要です, 一般的に, 多くの場合, 重要になります, 注目されています, 求められます, 欠かせません, と言えるでしょう, いかがでしょうか, 本記事では, わかりやすく解説, 詳しく解説, を紹介します, 効率化につながります, 品質向上につながります, in this article, this article explains, it is important to, various, many companies, can help, improve efficiency, should consider, recommended to, best practices, streamline, enhance productivity, leverage, today's fast-paced digital landscape, today's digital landscape, today's rapidly evolving landscape, ever-evolving landscape, comprehensive guide, delve into, navigate the complexities, game-changer, unlock the potential, empower businesses, in conclusion, it is worth noting that, or at the end of the day unless they are genuinely necessary and supported by the material.",
      "Avoid verbose AI-like predicates such as することができます, することが可能です, 可能となります, することが重要です, it is important to, in order to, or utilize. Prefer shorter, more concrete verbs such as 確認します, 分けます, 判断します, 減らせます, or できます when accurate.",
      "Avoid unsupported strong claims such as 必ず, 絶対に, 完全に, 誰でも, 唯一, すべて解決, or 確実に unless the source material proves them and the sentence includes conditions or caveats.",
      "When using numbers, percentages, costs, timing, counts, or performance-like claims, use only figures present in payload evidence. Preserve the figure's unit, target, conditions, date, exceptions, and source boundary. If evidence is missing, write 要確認 instead of inventing or generalizing the figure. Adding 約, 目安, or a generic caveat does not create evidence.",
      "When an input contains an 入力短縮 marker, treat it as incomplete evidence. Use the retained numeric/condition excerpts only with their stated scope, never infer the omitted passage, and mark any unresolved detail as 要確認.",
      "If a number appears because it is part of a keyword or category label, such as a reader segment or service name, make that role explicit near the phrase or attach the source/context that provided it. Do not let keyword numerals read like unsupported research findings.",
      "When reference URLs or source URLs are available, keep the actual URLs visible in body_html as source notes or links so the WordPress draft remains independently checkable after publishing.",
      "Return in sources only the URLs actually used to support a definition, claim, condition, or comparison in the article. Keep title, URL, and a reader-facing note about what the source supports; never put acquisition status or internal workflow notes in usage_notes.",
      "sources.url must be a real absolute HTTP(S) URL. For manual input without a URL, do not invent placeholders such as manual-text, and do not write acquisition notes such as 出典メモ：手動入力テキスト in public fields. Attribute meaningful first-party facts to the business in natural prose; preserve private provenance concerns in improvements.",
      "Use faq_items as the single canonical FAQ source for supplemental questions. The main Q&A body for FAQ-type articles belongs in body_html; it is distinct from the optional supplemental FAQ. Never duplicate questions across these two locations.",
      "Do not expose the production process: 入力元には省略区間があるため, 入力情報には具体的な料率の根拠がないため, 競合記事では相談先の種類を広く挙げていますが and similar acquisition, missing-input or competitor-analysis commentary must NOT occur in public fields. Keep unresolved evidence and truncation cautions in aio_score_self_evaluation.improvements for the editor. Reader-facing cautions may say 個別の契約条件を確認してください without referring to the input or drafting process. Keep legitimate source attribution and links.",
      "Preserve scope independently in selected_title, meta_description, article_summary, key_takeaways, every table row, body paragraph and FAQ answer. A qualifier in another section does NOT cover a standalone summary or answer. Example: デルタのファクタリング相談では希望日の5営業日前 must never become a general financing deadline. Repeat デルタ and ファクタリング相談 near that figure, or omit the figure. Do not invent fees, success rates or durations. Clearly distinguish hypothetical examples from results.",
      "The first paragraph of body_html must be answer-first and include a definition or decision sentence using a natural Japanese form such as '...とは...を指します' when the topic allows it.",
      "Do not reuse the opening definition as the first H2/H3. After a definition-style opening, make the first heading a different editorial angle such as the reader's first decision, a failure pattern, a comparison axis, or an operational checkpoint.",
      "Write as a human editor who has interviewed the business: each major section should include at least one concrete decision criterion, field example, operational caveat, failure pattern, or source-backed detail.",
      "Avoid thin H2/H3 sections. Every H2/H3 body should include at least two concrete signals such as a number, field observation, decision criterion, failure/risk note, team/cost/timing detail, or source/caveat note.",
      "Across the full article, include at least three different types of editorial evidence: field observations, decision criteria, failure/risk notes, team/cost/timing details, and source/caveat notes.",
      "Across body_html, explain concrete decisions, conditions, caveats, examples, costs, timing, responsible parties, and sources when the material supports them. Do not insert phrases such as 現場観察 or 競合記事では merely to satisfy an evaluator; use natural reader-facing attribution.",
      "Before returning JSON, run one silent editorial self-review of selected_title, body_html, headings, faq_items, and meta_description. If any part sounds like commodity AI copy, lacks first-party/source evidence, uses unsupported claims, or opens with generic framing, revise that part before final output.",
      "Make headings editorial and useful, not mechanical keyword strings. Vary sentence rhythm and endings so the body does not read like a template.",
      "Make title candidates specific and editorial. Avoid generic titles such as 重要なポイント, メリット, デメリット, まとめ, 概要, 基本, 活用方法, 注意点, 完全ガイド, 徹底解説, Best Practices, Strategy, Checklist, or Tips unless paired with a concrete reader decision, first-party insight, or comparison axis from the inputs.",
      "Make faq_items specific enough for publication. Avoid generic questions such as よくある質問, メリットは何ですか, 注意点は何ですか, AIOとは何ですか, AIOはなぜ重要ですか, AIOはどのように活用できますか, What is AIO?, Why is AIO important?, How does it work?, What are the benefits?, or What are the benefits of AIO? Avoid generic FAQ answer filler such as can help, helps improve, improve efficiency, should consider, recommended to, best practices, streamline, enhance productivity, or leverage unless the sentence includes a concrete condition, source boundary, field example, or decision criterion. Each answer should include a condition, decision criterion, field example, caveat, source note, cost/timing/team detail, or competitor comparison when available.",
      "When supplemental FAQ is needed, answer remaining reader questions with evidence and conditions, not keyword repetition. An empty faq_items array is correct when supplemental FAQ is none or unnecessary in automatic mode.",
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
        "AIO記事を日本語で生成してください。現在のフォーム入力、structureInstruction、regenerationInstructionから全文生成します。想定読者に役割名や職種名がある場合は自然な言い換えで読者の立場を反映してください。読者・構成・tableMode・supplementalFaqModeを優先してください。FAQ型は本文そのものを質問H2と回答中心にし、faq_itemsは末尾の補足FAQだけに使用します。表・補足FAQは自動/あり/なしの指定に従い、なしなら生成しません。入力の条件・対象・例外は要約・要点・表・FAQでも保持し、制作過程の説明は編集者用improvementsにだけ記載してください。本文はHTML込み9000文字以内、表示文字数はwordCountを目標の90〜110%、上限130%とします。結び文章は自然に反映し、image_promptsはimageCount枚（0なら空配列）返してください。",
      payload: compactPayload,
    }),
    timeoutMs: ARTICLE_GENERATION_TIMEOUT_MS,
    maxOutputTokens: 16_000,
  });
  const { result, sourceWarnings } = normalizeGeneratedSources(rawResult);
  const normalizedHeadings = result.headings.filter(
    (heading) => !isManagedFaqHeading(heading.text),
  );

  const sourceUrls = collectSourceUrls(
    result.sources,
    [...compactPayload.fetchedReferences, ...compactPayload.fetchedCompetitors],
  );
  const normalizedBody = compactPayload.form.tableMode === "none"
    ? convertTablesToProse(result.body_html) : result.body_html;
  const supplementalFaqItems = compactPayload.form.supplementalFaqMode === "none" ? [] : result.faq_items;
  const sanitizedBodyHtml = ensureGeneratedSourceUrls(
    ensureGeneratedBodyStructure(
      appendFaqBlockWhenNeeded(sanitizeArticleHtml(normalizedBody), []),
      result,
    ),
    sourceUrls,
  );
  const finalHtmlForEvaluation = buildPresentedArticleBody(sanitizedBodyHtml, supplementalFaqItems, compactPayload.form, true);
  const additionalPublicationTexts = [result.selected_title, result.meta_description, result.article_summary, ...result.key_takeaways];
  const qualityEvaluation = evaluateArticleQuality(finalHtmlForEvaluation, {
    primaryInfo:
      typeof payload.form.primaryInfo === "string"
        ? payload.form.primaryInfo
        : undefined,
    closingText:
      typeof compactPayload.form.closingText === "string"
        ? compactPayload.form.closingText
        : undefined,
    themeText:
      typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : undefined,
    targetReaderText: result.target_reader,
    searchIntentText: result.search_intent,
    referenceTexts: collectReferenceTexts(payload.form, payload.fetchedReferences),
    sourceUrls,
    competitorTexts: collectCompetitorTexts(
      payload.form,
      payload.fetchedCompetitors,
      payload.competitorResearch,
    ),
    targetWordCount:
      typeof compactPayload.form.wordCount === "number" ? compactPayload.form.wordCount : undefined,
    audienceType: readAudienceType(compactPayload.form.audienceType),
    articleStructure: readArticleStructure(compactPayload.form.articleStructure),
    structureInstruction: compactPayload.form.structureInstruction,
    regenerationInstruction: typeof compactPayload.form.regenerationInstruction === "string" ? compactPayload.form.regenerationInstruction : undefined,
    tableMode: compactPayload.form.tableMode,
    supplementalFaqMode: compactPayload.form.supplementalFaqMode,
    additionalPublicationTexts,
  });
  const titleEvaluation = evaluateTitleQuality({
    selectedTitle: result.selected_title,
    titleCandidates: result.title_candidates,
    themeText: typeof compactPayload.form.theme === "string" ? compactPayload.form.theme : "",
    primaryInfo:
      typeof compactPayload.form.primaryInfo === "string" ? compactPayload.form.primaryInfo : "",
  });
  const faqEvaluation = evaluateFaqQuality({
    faqItems: supplementalFaqItems,
    supplementalFaqMode: compactPayload.form.supplementalFaqMode,
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
    content_policy_version: 2,
    resolved_article_structure: resolveArticleStructure(compactPayload.form),
    editor_warnings: uniqueItems([
      ...sourceWarnings,
      ...result.aio_score_self_evaluation.improvements,
      ...evaluatePublicationReadiness(finalHtmlForEvaluation, {
        evidenceTexts: [typeof payload.form.primaryInfo === "string" ? payload.form.primaryInfo : "", ...collectReferenceTexts(payload.form, payload.fetchedReferences), ...collectCompetitorTexts(payload.form, payload.fetchedCompetitors, payload.competitorResearch)],
        additionalTexts: additionalPublicationTexts,
      }).issues.map((issue) => issue.detail),
      ...(JSON.stringify(compactPayload).includes("[入力短縮:") ? ["入力の一部を短縮しました。省略部分を根拠にせず、数値・期間・対象・例外は原文と照合してください。"] : []),
    ]),
    faq_items: supplementalFaqItems,
    headings: normalizedHeadings,
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
        ...faqEvaluation.improvements,
        ...metaDescriptionEvaluation.improvements,
        ...imageAltEvaluation.improvements,
        ...qualityEvaluation.improvements,
        ...result.aio_score_self_evaluation.improvements,
      ]).slice(0, 12),
    },
  } satisfies ArticleGenerationResult;
}

function normalizeGeneratedSources(raw: ArticleGenerationResult) {
  const sourceWarnings: string[] = [];
  const sources = raw.sources.filter((source) => {
    try {
      const url = new URL(source.url);
      if (url.protocol === "http:" || url.protocol === "https:") return true;
    } catch { /* Non-URL provenance belongs in editor warnings, not public links. */ }
    sourceWarnings.push(`出典URLとして使用できない生成情報（原文確認が必要）: ${source.title} / ${source.url} / ${source.usage_notes}`);
    return false;
  });
  const $ = cheerio.load(raw.body_html, null, false);
  $("p").each((_, element) => {
    const text = $(element).text().trim();
    // Only a known acquisition-only placeholder note; never remove real citations.
    if (/^出典メモ[：:]\s*手動入力テキスト[（(]manual-text[）)]/.test(text)) {
      sourceWarnings.push(text);
      if (!$(element).find("a").length && /^出典メモ[：:]\s*手動入力テキスト[（(]manual-text[）)](?:を参照しました|を参照しています)?[。.]?$/.test(text)) $(element).remove();
    }
  });
  return { result: { ...raw, sources, body_html: $.root().html() ?? "" }, sourceWarnings };
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

  return nextHtml;
}

function isManagedFaqHeading(value: string) {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  return /^(?:faq|q\s*&\s*a|よくある質問|よくあるご質問|質問と回答)(?:\s|$|[：:・_-])/.test(
    normalized,
  );
}

function ensureGeneratedSourceUrls(html: string, sourceUrls: string[]) {
  const missingUrls = sourceUrls
    .map((url) => url.trim())
    .filter(Boolean)
    .filter(isSafeHttpUrl)
    .slice(0, 8)
    .filter((url) => !articleContainsCanonicalSourceLink(url, html));

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
  const evidenceUsable = value.evidenceUsable !== false;
  return {
    ...value,
    text:
      evidenceUsable && typeof value.text === "string"
        ? compactEvidenceText(value.text, 3000)
        : undefined,
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
    references: compactTextInputs(form.references),
    competitors: compactTextInputs(form.competitors),
    theme: typeof form.theme === "string" ? truncateText(form.theme, 1800) : "",
    audienceType: readAudienceType(form.audienceType),
    articleStructure: resolveArticleStructure({
      articleStructure: readArticleStructure(form.articleStructure),
      theme: typeof form.theme === "string" ? form.theme : "",
      structureInstruction: typeof form.structureInstruction === "string" ? form.structureInstruction : "",
      regenerationInstruction: typeof form.regenerationInstruction === "string" ? form.regenerationInstruction : "",
    }),
    structureInstruction: typeof form.structureInstruction === "string" ? form.structureInstruction : "",
    tableMode: readElementMode(form.tableMode),
    supplementalFaqMode: readElementMode(form.supplementalFaqMode),
    primaryInfo:
      typeof form.primaryInfo === "string"
        ? compactEvidenceText(form.primaryInfo, 3600)
        : form.primaryInfo,
    primaryInfoTypes: primaryInformationLabels(readStringList(form.primaryInfoTypes)).slice(0, 8),
    closingText:
      typeof form.closingText === "string"
        ? compactOptionalText(form.closingText, 1000)
        : form.closingText,
    regenerationInstruction:
      typeof form.regenerationInstruction === "string"
        ? compactOptionalText(form.regenerationInstruction, 1200)
        : undefined,
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
    text: typeof value.text === "string" ? compactEvidenceText(value.text, 2600) : undefined,
    error: typeof value.error === "string" ? truncateText(value.error, 220) : undefined,
  };
}

function compactTextInputs(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.slice(0, 12).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    return {
      ...item,
      text: typeof item.text === "string" ? compactEvidenceText(item.text, 3000) : item.text,
    };
  });
}

function compactEvidenceText(value: string, maxLength: number) {
  const text = value.trim();
  if (text.length <= maxLength) {
    return text;
  }

  const labelBudget = 180;
  const contentBudget = Math.max(600, maxLength - labelBudget);
  const headLength = Math.floor(contentBudget * 0.4);
  const evidenceLength = Math.floor(contentBudget * 0.35);
  const tailLength = contentBudget - headLength - evidenceLength;
  let offset = 0;
  // Split before taking the middle so a boundary fragment cannot become evidence.
  const middleSentences = text.split(/(?<=[。！？!?\n])/).flatMap((sentence) => {
    const start = offset;
    offset += sentence.length;
    const trimmed = sentence.trim();
    return start >= headLength && offset <= text.length - tailLength && trimmed
      ? [trimmed]
      : [];
  });
  const selectedIndices = new Set<number>();
  let excerptLength = 0;
  for (const pattern of [/[0-9０-９]/, /条件|場合|対象|例外|のみ|に限|時点|期間|単位/]) {
    for (const [index, sentence] of middleSentences.entries()) {
      if (selectedIndices.has(index) || !pattern.test(sentence)) continue;
      const addedLength = sentence.length + (selectedIndices.size > 0 ? 1 : 0);
      if (excerptLength + addedLength > evidenceLength) continue;
      selectedIndices.add(index);
      excerptLength += addedLength;
    }
  }
  const evidenceSentences = middleSentences.filter((_, index) => selectedIndices.has(index));
  const evidenceExcerpt = evidenceSentences.join("\n");
  const retainedEvidenceLength = evidenceSentences.reduce((sum, sentence) => sum + sentence.length, 0);
  const omittedLength = Math.max(
    0,
    text.length - headLength - tailLength - retainedEvidenceLength,
  );

  return [
    "[冒頭]",
    text.slice(0, headLength),
    "[省略区間から保持した数値・条件・例外]",
    evidenceExcerpt,
    "[末尾]",
    text.slice(-tailLength),
    `[入力短縮: 原文${text.length}文字のうち約${omittedLength}文字を省略。省略部分は推測せず、必要なら要確認とすること。]`,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
      `Japanese editorial article illustration about ${result.selected_title}, clean professional style`;

    return {
      slot,
      purpose,
      prompt: buildPremiumImagePrompt({
        basePrompt,
        articleSummary: result.article_summary,
        headings: result.headings
          .map((heading) => heading.text)
          .filter((heading) => !isManagedFaqHeading(heading)),
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

  return "clean Japanese editorial style appropriate for the selected audience";
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
    "Style direction: premium Japanese editorial art direction appropriate for the requested audience and visual tone, with refined composition, crisp geometry, subtle depth, and polished production quality.",
    "Composition: 3:2 landscape, generous whitespace, one clear focal idea, balanced margins, light background, restrained accent colors, scalable at thumbnail size.",
    "Content: turn the article-specific anchors above into an original diagram-like editorial visual, not a generic AI/business background.",
    "Use article-appropriate diagrams, process cards, comparison shapes, care or decision flows, source/checklist cards, or concrete symbolic elements as appropriate.",
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
    ...fetchedReferences.filter(isUsableFetchedEvidence).map(readTextField),
    ...readTextFieldList(form.references),
    ...readTextFieldList(form.referenceFiles),
  ]);
}

function collectSourceUrls(
  sources: Array<{ url?: string }>,
  fetchedSources: Array<Record<string, unknown>>,
) {
  const unusableSourceKeys = unusableFetchedSourceUrlKeys(
    fetchedSources.flatMap((source) =>
      typeof source.url === "string" && typeof source.ok === "boolean"
        ? [
            {
              url: source.url,
              ok: source.ok,
              evidenceUsable:
                typeof source.evidenceUsable === "boolean"
                  ? source.evidenceUsable
                  : undefined,
            },
          ]
        : [],
    ),
  );
  return uniqueItems(
    sources
      .map((source) => source.url ?? "")
      .filter((url) => !isUnusableFetchedSourceUrl(url, unusableSourceKeys)),
  );
}

function collectCompetitorTexts(
  form: Record<string, unknown>,
  fetchedCompetitors: Array<Record<string, unknown>>,
  competitorResearch: unknown,
) {
  return uniqueItems([
    ...fetchedCompetitors.filter(isUsableFetchedEvidence).map(readTextField),
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

function isUsableFetchedEvidence(value: Record<string, unknown>) {
  return value.ok !== false && value.evidenceUsable !== false;
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}

function readAudienceType(value: unknown): AudienceType {
  return value === "btoc" || value === "btob" ? value : "auto";
}

function buildAudienceInstruction(value: unknown) {
  const audienceType = readAudienceType(value);
  if (audienceType === "btoc") {
    return "Audience plan: BtoC. Write for a general consumer in plain Japanese, explain necessary terminology, and give practical choices, warning signs, and next actions without assuming business expertise.";
  }
  if (audienceType === "btob") {
    return "Audience plan: BtoB. Write for business owners or responsible staff and present decision conditions, alternatives, costs/timing when evidenced, risks, and operational cautions.";
  }
  return "Audience plan: infer BtoC or BtoB from the supplied target reader and topic. Do not default to BtoB; use vocabulary and decision support appropriate to the inferred reader.";
}
