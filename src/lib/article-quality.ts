import {
  articleContainsCanonicalSourceUrl,
  decodeHtmlAmpersands,
  normalizeSourceUrls,
  sourceUrlCandidates,
} from "@/lib/source-url";
import { englishTokenAppearsInText } from "@/lib/english-token";

export type ArticleQualityCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type ArticleQualityEvaluation = {
  score: number;
  checks: ArticleQualityCheck[];
  strengths: string[];
  improvements: string[];
};

export type ArticleQualityContext = {
  themeText?: string;
  targetReaderText?: string;
  searchIntentText?: string;
  primaryInfo?: string;
  closingText?: string;
  referenceTexts?: string[];
  sourceUrls?: string[];
  competitorTexts?: string[];
  targetWordCount?: number;
};

const genericPhrases = [
  "近年",
  "重要です",
  "一般的に",
  "多くの場合",
  "注目されています",
  "と言えるでしょう",
  "と言えます",
  "といえるでしょう",
  "いかがでしょうか",
  "本記事では",
  "まとめると",
  "多くの企業",
  "さまざまな",
  "必要不可欠",
  "大切です",
  "ポイントです",
  "効果的です",
  "重要になります",
  "求められます",
  "求められています",
  "欠かせません",
  "欠かせない",
  "理解しておきましょう",
  "わかりやすく解説",
  "詳しく解説",
  "を紹介します",
  "効率化につながります",
  "品質向上につながります",
  "in this article",
  "this article explains",
  "it is important to",
  "various",
  "many companies",
  "can help",
  "helps improve",
  "improve efficiency",
  "should consider",
  "recommended to",
  "best practices",
  "streamline",
  "enhance productivity",
  "leverage",
  "today's digital landscape",
  "today's rapidly evolving landscape",
  "fast-paced digital landscape",
  "ever-evolving",
  "comprehensive guide",
  "delve into",
  "navigate the complexities",
  "game-changer",
  "unlock the potential",
  "empower businesses",
  "in conclusion",
  "it is worth noting that",
  "at the end of the day",
];

const genericOpeningPatterns = [
  { label: "本記事では", pattern: /本記事では/ },
  { label: "この記事では", pattern: /この記事では/ },
  { label: "近年", pattern: /近年/ },
  { label: "一般的に", pattern: /一般的に/ },
  { label: "多くの場合", pattern: /多くの場合/ },
  { label: "について解説します", pattern: /について(?:わかりやすく|詳しく)?解説します/ },
  { label: "を解説します", pattern: /を(?:わかりやすく|詳しく)?解説します/ },
  { label: "を紹介します", pattern: /を(?:わかりやすく|詳しく)?紹介します/ },
  { label: "重要です", pattern: /重要です/ },
  { label: "重要になります", pattern: /重要になります/ },
  { label: "注目されています", pattern: /注目されています/ },
  { label: "求められます", pattern: /求められます/ },
  { label: "求められています", pattern: /求められています/ },
  { label: "欠かせません", pattern: /欠かせません/ },
  { label: "欠かせない", pattern: /欠かせない/ },
  { label: "in this article", pattern: /\bin this article\b/i },
  { label: "this article explains", pattern: /\bthis article explains\b/i },
  {
    label: "today's digital landscape",
    pattern: /\bin today['’]?s (?:fast-paced )?digital landscape\b/i,
  },
  {
    label: "today's rapidly evolving landscape",
    pattern: /\bin today'?s rapidly evolving (?:digital )?landscape\b/i,
  },
  { label: "ever-evolving landscape", pattern: /\bever-evolving (?:digital )?landscape\b/i },
];

const genericEndingPatterns = [
  { label: "in conclusion", pattern: /\bin conclusion\b/i },
  { label: "it is worth noting that", pattern: /\bit is worth noting that\b/i },
  { label: "at the end of the day", pattern: /\bat the end of the day\b/i },
  { label: "いかがでしたでしょうか", pattern: /いかがでしたでしょうか/ },
  { label: "ぜひ参考にしてください", pattern: /ぜひ参考にしてください/ },
  { label: "最後までお読みいただき", pattern: /最後までお読みいただき/ },
  { label: "本記事を参考に", pattern: /本記事を参考に/ },
  { label: "参考になれば幸いです", pattern: /参考になれば幸いです/ },
];

const verboseAiPhrases = [
  "することができます",
  "することが可能です",
  "することが重要です",
  "することが大切です",
  "可能となります",
  "有効です",
  "役立ちます",
  "it is important to",
  "in order to",
  "utilize",
];

const repetitiveNecessityPhrases = [
  "必要があります",
  "必要です",
  "必要となります",
  "必要になる",
];

const unsupportedStrongClaims = [
  "必ず",
  "絶対に",
  "完全に",
  "誰でも",
  "唯一",
  "すべて解決",
  "確実に",
];

const numericClaimPattern =
  /[0-9０-９][0-9０-９,，.．]*(?:\s*(?:%|％|割|倍|件|社|人|名|円|万円|時間|日|週間|か月|ヶ月|年|ページ|本|個|回|文字)|(?:以上|以下|未満|以内|超|前後|程度|ほど))/g;

const numericClaimSupportPattern =
  /(出典|参照|参考|source|sources|調査|公表|資料|データ|統計|アンケート|ヒアリング|当社|弊社|自社|支援現場|現場|相談|観察|経験|推定|目安|約|およそ|条件|場合|時点|未確認|断定しない|可能性|傾向|根拠|照合)/i;

const adjacentNumericSupportPattern =
  /^(出典|参照|参考|source|sources|調査|公表|資料|データ|統計|アンケート|ヒアリング|推定|目安|約|およそ|条件|場合|時点|根拠)[:：、\s]|^(未確認|断定しない|可能性|傾向|照合)/i;

const previousNumericSupportPattern =
  /(当社支援|弊社支援|支援現場|現場観察|相談|ヒアリング|推定|目安|約|およそ|条件|場合|時点|未確認|断定しない|可能性|傾向|照合)/i;

const longSentenceCharacterLimit = 130;
const sentenceBoundaryPattern = /[。．.!！？?]+/;

const repetitiveConnectors = [
  "また",
  "さらに",
  "加えて",
  "一方で",
  "そのため",
  "したがって",
  "まず",
  "次に",
  "最後に",
  "このように",
];

const formulaicSentenceFrames = [
  "結論として",
  "具体的には",
  "たとえば",
  "例えば",
  "重要なのは",
  "押さえるべき",
  "ポイントは",
  "注意点は",
  "このため",
  "その結果",
];

const mechanicalHeadingLabels = [
  "重要なポイント",
  "メリット",
  "デメリット",
  "まとめ",
  "概要",
  "基本",
  "ポイント",
  "活用方法",
  "導入方法",
  "注意点",
];

const vagueHeadingRoots = [
  "導入",
  "活用",
  "運用",
  "作成",
  "生成",
  "改善",
  "比較",
  "選び方",
  "注意点",
  "ポイント",
  "メリット",
  "デメリット",
  "方法",
  "流れ",
  "手順",
];

const mechanicalSequenceHeadingPatterns = [
  /^(?:まず|次に|最後に|はじめに|STEP\s*[0-9０-９]+|Step\s*[0-9０-９]+|ステップ\s*[0-9０-９]+|手順\s*[0-9０-９]+)/i,
  /^[0-9０-９]+(?:つ目|番目)[、:\s　]/,
  /[0-9０-９一二三四五六七八九十]+つの(?:ポイント|メリット|デメリット|方法|コツ|手順|注意点|理由)$/,
  /(?:ポイント|メリット|デメリット|方法|コツ|手順|注意点)を(?:解説|紹介|確認)$/,
];

const editorialAnchorPatterns = [
  /(事例|現場|相談|支援現場|問い合わせ|ヒアリング)/,
  /(判断基準|チェック|手順|比較|選定|優先順位)/,
  /(失敗|注意点|リスク|落とし穴|手戻り|例外)/,
  /(費用|期間|担当|体制|工数|人数|頻度|期限)/,
  /(参照|出典|参考|未確認|断定しない|照合)/,
];

const sectionEvidencePatterns = [
  /[0-9０-９]/,
  /(当社|弊社|自社|支援現場|現場|相談|ヒアリング|経験|観察|実務|お客様|クライアント)/,
  /(判断基準|チェック|手順|比較|選定|優先順位|条件|例外|確認軸)/,
  /(失敗|注意点|リスク|落とし穴|手戻り|未確認|断定しない| caveat|risk)/i,
  /(費用|期間|担当|体制|工数|人数|頻度|期限|料金|給付基礎日額|補償開始日)/,
  /(参照|出典|参考|source|sources|照合|根拠)/i,
];

const usefulTableSignalPatterns = [
  /(判断基準|比較軸|比較|選定|優先順位|条件|例外|確認|チェック|注意点|失敗|リスク)/,
  /(費用|料金|期間|時期|担当|体制|工数|頻度|導入|運用|承認|手続き)/,
  /(出典|参照|参考|根拠|未確認|断定しない|照合|現場|相談|経験|観察)/,
  /[0-9０-９]/,
];

const weakTableOnlyPattern =
  /^(?:項目|内容|説明|詳細|概要|ポイント|メリット|デメリット|チェック|備考|例)+$/;

const primaryInfoStopWords = new Set([
  "当社",
  "弊社",
  "自社",
  "多い",
  "多く",
  "ため",
  "こと",
  "もの",
  "よう",
  "など",
  "です",
  "ます",
  "する",
  "ある",
  "いる",
  "れる",
  "られる",
  "our",
  "we",
  "us",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "through",
  "often",
  "see",
  "sees",
  "manage",
  "work",
  "leaving",
]);

const firstPartyAttributionPattern =
  /(当社|弊社|自社|支援現場|現場|相談|ヒアリング|経験|観察|実務|お客様|クライアント|\bour\b|\bwe\b|field support|support team|client|customer|observed|observation|experience)/i;

const ctaStopWords = new Set([
  ...primaryInfoStopWords,
  "contact",
  "please",
  "get",
  "let",
  "相談",
  "ください",
  "お問い合わせ",
  "問い合わせ",
  "資料",
  "請求",
]);

const referenceInfoStopWords = new Set([
  ...primaryInfoStopWords,
  "aio",
  "seo",
  "ai",
  "記事",
  "情報",
  "参照",
  "参考",
  "本文",
  "資料",
  "ページ",
  "サイト",
  "公式",
  "詳細",
  "一覧",
  "企業",
  "会社",
  "場合",
  "必要",
  "確認",
  "利用",
  "提供",
  "可能",
  "方法",
  "内容",
  "対応",
  "機能",
  "導入",
  "作成",
  "生成",
  "解説",
  "サービス",
  "support",
  "content",
  "article",
  "information",
  "reference",
  "references",
  "page",
  "site",
  "service",
]);

const themeStopWords = new Set([
  ...referenceInfoStopWords,
  "テーマ",
  "キーワード",
  "想定読者",
  "検索意図",
  "狙い",
  "読者",
  "自然",
  "言語",
  "複数",
  "自由",
  "記述",
  "target",
  "reader",
  "keyword",
  "keywords",
  "theme",
  "intent",
  "purpose",
  "marketing",
]);

const audienceIntentStopWords = new Set([
  ...themeStopWords,
  "想定",
  "対象",
  "読者",
  "検索",
  "意図",
  "知りたい",
  "理解",
  "向け",
  "担当者",
  "ユーザー",
  "target",
  "reader",
  "audience",
  "search",
  "intent",
  "understand",
  "learn",
  "know",
  "want",
  "needs",
  "teams",
]);

const competitorStopWords = new Set([
  ...referenceInfoStopWords,
  "競合",
  "他社",
  "調査",
  "論点",
  "主要",
  "差別化",
  "ポイント",
  "示唆",
  "記事",
  "lp",
  "url",
  "title",
  "major",
  "points",
  "competitor",
  "competitors",
  "differentiation",
  "recommendation",
  "recommendations",
  "insight",
  "insights",
]);

const competitivePositioningPattern =
  /(競合|他社|比較|差別化|上位記事|競合記事|競合LP|\bLP\b|不足|一方|対して|対比|独自|比較軸|勝ち筋|訴求|competitor|competition|differentiation|compared|whereas|positioning)/i;

export function evaluateArticleQuality(
  html: string,
  context: ArticleQualityContext = {},
): ArticleQualityEvaluation {
  const text = normalizeText(stripHtml(html));
  const proseText = normalizeText(stripHtml(removeAuxiliaryQualityHtml(html)));
  const sentences = extractSentences(proseText);
  const sentenceEndings = extractSentenceEndings(proseText);
  const leadingConnectors = extractLeadingConnectors(proseText);
  const formulaicFrames = extractFormulaicSentenceFrames(proseText);
  const genericPhraseHits = countPhraseHits(text, genericPhrases);
  const verboseAiPhraseHits = countPhraseHits(text, verboseAiPhrases);
  const repetitiveNecessityPhraseHits = countPhraseHits(text, repetitiveNecessityPhrases);
  const unsupportedClaimHits = countUnsupportedStrongClaimHits(text);
  const numericClaims = extractNumericClaims(text);
  const unsupportedNumericClaims = numericClaims.filter(
    (claim) => !hasNearbyNumericClaimSupport(text, claim.index),
  );
  const hasNumericClaimSupport = unsupportedNumericClaims.length === 0;
  const hasNumbers = /[0-9０-９]/.test(text);
  const hasConcreteAnchors =
    /(事例|現場|相談|失敗|注意点|判断基準|チェック|手順|比較|費用|期間|担当|運用|導入)/.test(text);
  const hasDefinition = /(とは、|とは |定義|意味します|指します)/.test(text);
  const openingText = text.slice(0, 420);
  const hasAnswerFirst =
    /(結論|先に結論|要するに|つまり|最初に押さえるべき|とは、|とは )/.test(openingText);
  const genericOpeningHits = findGenericOpeningHits(openingText);
  const hasSpecificOpeningFrame = genericOpeningHits.length === 0;
  const genericOpeningPhraseHits = countPhraseHits(openingText, genericPhrases);
  const hasLowGenericOpeningDensity = genericOpeningPhraseHits <= 1;
  const openingBeforeFirstHeading = extractTextBeforeFirstHeading(html);
  const openingBeforeFirstHeadingHasDefinition = hasDefinitionStyleText(openingBeforeFirstHeading);
  const endingText = text.slice(-520);
  const genericEndingHits = findGenericEndingHits(endingText);
  const hasSpecificEndingFrame = genericEndingHits.length === 0;
  const editorialAnchorCount = editorialAnchorPatterns.filter((pattern) => pattern.test(text)).length;
  const hasConcreteDetail = hasConcreteAnchors && (hasNumbers || editorialAnchorCount >= 3);
  const tableTexts = extractTableTexts(html);
  const hasTable = tableTexts.length > 0;
  const hasUsefulTable = tableTexts.some(isUsefulDecisionTable);
  const hasList = /<(ul|ol)[\s>]/i.test(html);
  const hasFaq = /(FAQ|よくある質問|<h2[^>]*>[^<]*質問|<h3[^>]*>[^<]*質問)/i.test(html);
  const hasSourceNote = /(出典|参照|参考|source|sources)/i.test(text);
  const sourceUrls = normalizeSourceUrls(context.sourceUrls);
  const requiredSourceUrls = sourceUrls.slice(0, 3);
  const missingSourceUrls = requiredSourceUrls.filter(
    (url) => !sourceUrlAppearsInArticle(url, html, text),
  );
  const shouldCheckSourceUrls = requiredSourceUrls.length > 0;
  const hasSourceUrlPresence =
    !shouldCheckSourceUrls || missingSourceUrls.length === 0;
  const targetWordCount = normalizeTargetWordCount(context.targetWordCount);
  const visibleCharacterCount = countVisibleCharacters(proseText || text);
  const lengthRange = targetWordCount ? targetLengthRange(targetWordCount) : null;
  const hasTargetLengthAlignment =
    !lengthRange ||
    (visibleCharacterCount >= lengthRange.min && visibleCharacterCount <= lengthRange.max);
  const headings = extractHeadings(html);
  const firstHeading = headings[0] ?? "";
  const hasDistinctFirstHeadingAngle =
    !openingBeforeFirstHeadingHasDefinition ||
    !firstHeading ||
    !isDefinitionStyleHeading(firstHeading);
  const mechanicalHeadingHits = headings.filter(isMechanicalHeading).length;
  const mechanicalSequenceHeadingHits = headings.filter(isMechanicalSequenceHeading).length;
  const hasEditorialHeadings = headings.length >= 2 && mechanicalHeadingHits === 0;
  const hasHeadingStoryline = headings.length < 3 || mechanicalSequenceHeadingHits <= 1;
  const headingSections = extractHeadingSections(removeAuxiliaryQualityHtml(html)).filter(
    (section) => !isAuxiliaryHeading(section.heading),
  );
  const thinSections = headingSections.filter(isThinHeadingSection);
  const allowedThinSections = headingSections.length >= 2 ? 1 : 0;
  const hasSectionSpecificity =
    headingSections.length < 2 || thinSections.length <= allowedThinSections;
  const repeatedEndingRate = sentenceEndings.length
    ? Math.max(...Object.values(countItems(sentenceEndings))) / sentenceEndings.length
    : 0;
  const repeatedConnectorCount = leadingConnectors.length
    ? Math.max(...Object.values(countItems(leadingConnectors)))
    : 0;
  const repeatedConnectorRate = leadingConnectors.length
    ? repeatedConnectorCount / leadingConnectors.length
    : 0;
  const hasNaturalConnectorVariety =
    leadingConnectors.length < 4 || (repeatedConnectorCount <= 2 && repeatedConnectorRate <= 0.5);
  const formulaicFrameCount = formulaicFrames.length;
  const repeatedFormulaicFrameCount = formulaicFrames.length
    ? Math.max(...Object.values(countItems(formulaicFrames)))
    : 0;
  const formulaicFrameRate = sentenceEndings.length
    ? formulaicFrameCount / sentenceEndings.length
    : 0;
  const hasNaturalSentenceFrames =
    formulaicFrameCount <= 2 || (repeatedFormulaicFrameCount <= 2 && formulaicFrameRate <= 0.22);
  const longSentences = sentences.filter(
    (sentence) => countVisibleCharacters(sentence) > longSentenceCharacterLimit,
  );
  const hasConciseSentenceLength = longSentences.length === 0;
  const themeTerms = extractSignalTerms(context.themeText, themeStopWords);
  const themeHitCount = themeTerms.filter((term) => termAppearsInText(term, text)).length;
  const themeTargetHits = Math.min(4, Math.max(2, themeTerms.length));
  const shouldCheckTheme = themeTerms.length >= 2;
  const hasThemeReflection = !shouldCheckTheme || themeHitCount >= themeTargetHits;
  const targetReaderTerms = extractSignalTerms(context.targetReaderText, audienceIntentStopWords);
  const targetReaderHitCount = targetReaderTerms.filter((term) =>
    termAppearsInText(term, text),
  ).length;
  const targetReaderTargetHits = Math.min(3, Math.max(1, targetReaderTerms.length));
  const shouldCheckTargetReader = targetReaderTerms.length > 0;
  const hasTargetReaderReflection =
    !shouldCheckTargetReader || targetReaderHitCount >= targetReaderTargetHits;
  const searchIntentTerms = extractSignalTerms(context.searchIntentText, audienceIntentStopWords);
  const searchIntentHitCount = searchIntentTerms.filter((term) =>
    termAppearsInText(term, text),
  ).length;
  const searchIntentTargetHits = Math.min(3, Math.max(1, searchIntentTerms.length));
  const shouldCheckSearchIntent = searchIntentTerms.length > 0;
  const hasSearchIntentReflection =
    !shouldCheckSearchIntent || searchIntentHitCount >= searchIntentTargetHits;
  const primaryInfoTerms = extractPrimaryInfoTerms(context.primaryInfo);
  const primaryInfoHitCount = primaryInfoTerms.filter((term) =>
    termAppearsInText(term, text),
  ).length;
  const primaryInfoOpeningHitCount = primaryInfoTerms.filter((term) =>
    termAppearsInText(term, openingText),
  ).length;
  const primaryInfoTargetHits = Math.min(3, Math.max(1, primaryInfoTerms.length));
  const shouldCheckPrimaryInfo = primaryInfoTerms.length > 0;
  const hasPrimaryInfoReflection =
    !shouldCheckPrimaryInfo ||
    (primaryInfoHitCount >= primaryInfoTargetHits && firstPartyAttributionPattern.test(text));
  const hasPrimaryInfoOpeningPlacement =
    !shouldCheckPrimaryInfo ||
    (primaryInfoOpeningHitCount >= 1 && firstPartyAttributionPattern.test(openingText));
  const hasPrimaryInfoVerbatimCopy =
    shouldCheckPrimaryInfo && includesLongVerbatimClause(context.primaryInfo, text);
  const ctaTerms = extractSignalTerms(context.closingText, ctaStopWords);
  const closingTextWindow = text.slice(-1400);
  const ctaHitCount = ctaTerms.filter((term) =>
    termAppearsInText(term, closingTextWindow),
  ).length;
  const ctaTargetHits = Math.min(3, Math.max(1, ctaTerms.length));
  const shouldCheckCta = ctaTerms.length > 0;
  const hasCtaReflection = !shouldCheckCta || ctaHitCount >= ctaTargetHits;
  const referenceTerms = extractReferenceTerms(context.referenceTexts);
  const referenceHitCount = referenceTerms.filter((term) =>
    termAppearsInText(term, text),
  ).length;
  const referenceTargetHits = Math.min(4, Math.max(2, referenceTerms.length));
  const shouldCheckReferences = referenceTerms.length >= 2;
  const hasReferenceReflection =
    !shouldCheckReferences || referenceHitCount >= referenceTargetHits;
  const hasReferenceVerbatimCopy =
    shouldCheckReferences && includesAnyLongVerbatimClause(context.referenceTexts, text);
  const competitorTerms = extractCompetitorTerms(context.competitorTexts);
  const competitorHitCount = competitorTerms.filter((term) =>
    termAppearsInText(term, text),
  ).length;
  const competitorTargetHits = Math.min(4, Math.max(2, competitorTerms.length));
  const shouldCheckCompetitors = competitorTerms.length >= 2;
  const hasCompetitorReflection =
    !shouldCheckCompetitors ||
    (competitorHitCount >= competitorTargetHits && competitivePositioningPattern.test(text));
  const hasCompetitorVerbatimCopy =
    shouldCheckCompetitors && includesAnyLongVerbatimClause(context.competitorTexts, text);

  const checks: ArticleQualityCheck[] = [
    {
      id: "answer-first",
      label: "冒頭の結論明示",
      passed: hasAnswerFirst,
      detail: hasAnswerFirst
        ? "冒頭で結論または定義が分かる構成です。"
        : "冒頭420文字以内に結論、定義、最初に押さえるべき判断を明示すると強くなります。",
    },
    {
      id: "generic-phrases",
      label: "AI風の汎用表現",
      passed: genericPhraseHits <= 2,
      detail:
        genericPhraseHits === 0
          ? "凡庸なAI風表現は目立ちません。"
          : `${genericPhraseHits}件の凡庸表現候補があります。`,
    },
    {
      id: "generic-opening-frame",
      label: "冒頭のAI風フレーム",
      passed: hasSpecificOpeningFrame,
      detail: hasSpecificOpeningFrame
        ? "冒頭がテンプレ導入ではなく、具体的な結論・判断から始まっています。"
        : `冒頭に「${genericOpeningHits
            .slice(0, 3)
            .join("」「")}」型のテンプレ表現があります。背景説明から入らず、読者が最初に判断できる結論、定義、現場観察、条件から書き出すと自然になります。`,
    },
    {
      id: "generic-opening-density",
      label: "冒頭の汎用表現密度",
      passed: hasLowGenericOpeningDensity,
      detail: hasLowGenericOpeningDensity
        ? "冒頭に汎用句が集中しておらず、固有の判断材料から入れています。"
        : `冒頭420文字以内に${genericOpeningPhraseHits}件の汎用表現があります。冒頭は「近年」「重要です」「本記事では」型を減らし、参照情報・一次情報・現場で見た条件や判断を先に示してください。`,
    },
    {
      id: "generic-ending-frame",
      label: "締めのAI風フレーム",
      passed: hasSpecificEndingFrame,
      detail: hasSpecificEndingFrame
        ? "締め文は汎用的な定型句ではなく、記事内容に沿った次の行動へ自然につながっています。"
        : `末尾に「${genericEndingHits
            .slice(0, 3)
            .join("」「")}」型の定型表現があります。記事固有の判断基準、確認手順、問い合わせ前に準備する情報などへ置き換えると、AI記事らしさが薄まります。`,
    },
    {
      id: "verbose-ai-phrasing",
      label: "AI風の冗長表現",
      passed: verboseAiPhraseHits <= 1,
      detail:
        verboseAiPhraseHits <= 1
          ? "「することができます」型の冗長表現は目立ちません。"
          : `${verboseAiPhraseHits}件の冗長なAI風表現候補があります。「できる」「確認します」「分けます」など短く具体的な述語に置き換えると自然になります。`,
    },
    {
      id: "repetitive-necessity-phrasing",
      label: "必要性表現の反復",
      passed: repetitiveNecessityPhraseHits <= 2,
      detail:
        repetitiveNecessityPhraseHits <= 2
          ? "「必要があります」型の言い回しは過度に反復していません。"
          : `${repetitiveNecessityPhraseHits}件の「必要があります」型の反復があります。必要性だけでつなぐのではなく、現場で起きた事実、判断条件、例外、次の行動に言い換えると一般論から抜け出せます。`,
    },
    {
      id: "concrete-detail",
      label: "具体性",
      passed: hasConcreteDetail,
      detail: hasConcreteDetail
        ? hasNumbers
          ? "数字や現場文脈を含む具体的な説明があります。"
          : "現場例、判断基準、注意点などを含む具体的な説明があります。"
        : "数字、現場例、判断基準、失敗例などを増やす余地があります。",
    },
    {
      id: "editorial-evidence",
      label: "編集的な具体性の幅",
      passed: editorialAnchorCount >= 3,
      detail:
        editorialAnchorCount >= 3
          ? "現場例、判断基準、失敗/注意点、体制・費用感、参照意識などが複数含まれます。"
          : "現場例、判断基準、失敗/注意点、体制・費用感、参照意識のうち複数を本文に入れると、一般論から抜け出せます。",
    },
    {
      id: "section-specificity",
      label: "各セクションの濃さ",
      passed: hasSectionSpecificity,
      detail: hasSectionSpecificity
        ? "H2/H3ごとの本文に、判断材料や現場文脈が一定量含まれています。"
        : `薄いセクションが多くあります（例: ${thinSections
            .slice(0, 3)
            .map((section) => section.heading)
            .join("、")}）。各H2/H3に数字、現場例、判断基準、失敗/注意点、体制・費用・期間、参照元のいずれかを2つ以上入れると、人間の編集記事らしくなります。`,
    },
    ...(lengthRange
      ? [
          {
            id: "target-length-alignment",
            label: "指定文字数との整合",
            passed: hasTargetLengthAlignment,
            detail: hasTargetLengthAlignment
              ? `本文量は指定された${lengthRange.target.toLocaleString("ja-JP")}字に対して自然な範囲です。`
              : `本文量が約${visibleCharacterCount.toLocaleString(
                  "ja-JP",
                )}字で、指定された${lengthRange.target.toLocaleString(
                  "ja-JP",
                )}字から外れています。目安は${lengthRange.min.toLocaleString(
                  "ja-JP",
                )}〜${lengthRange.max.toLocaleString(
                  "ja-JP",
                )}字です。薄い一般論を足すのではなく、参照情報、一次情報、競合差分にもとづく具体例、判断基準、注意点を増減して調整してください。`,
          },
        ]
      : []),
    ...(shouldCheckTheme
      ? [
          {
            id: "theme-keyword-reflection",
            label: "テーマ/キーワードの反映",
            passed: hasThemeReflection,
            detail: hasThemeReflection
              ? "入力されたテーマ・キーワードの主要語彙が本文に反映されています。"
              : `テーマ・キーワードの固有語彙（${themeTerms.slice(0, 5).join("、")}）を、タイトル、冒頭、見出し、FAQに自然に戻すと、入力意図から外れにくくなります。`,
          },
        ]
      : []),
    ...(shouldCheckTargetReader
      ? [
          {
            id: "target-reader-reflection",
            label: "想定読者の反映",
            passed: hasTargetReaderReflection,
            detail: hasTargetReaderReflection
              ? "想定読者の文脈が本文内の課題、判断基準、具体例に反映されています。"
              : `想定読者の固有語彙（${targetReaderTerms
                  .slice(0, 5)
                  .join("、")}）を、冒頭、見出し、具体例、FAQに戻すと、誰向けの記事か明確になります。`,
          },
        ]
      : []),
    ...(shouldCheckSearchIntent
      ? [
          {
            id: "search-intent-reflection",
            label: "検索意図の反映",
            passed: hasSearchIntentReflection,
            detail: hasSearchIntentReflection
              ? "検索意図に含まれる目的や判断軸が本文に反映されています。"
              : `検索意図の固有語彙（${searchIntentTerms
                  .slice(0, 5)
                  .join("、")}）を、結論、比較軸、注意点、FAQに戻すと、読者の疑問に答える記事になります。`,
          },
        ]
      : []),
    ...(shouldCheckPrimaryInfo
      ? [
          {
            id: "primary-info-reflection",
            label: "一次情報の反映",
            passed: hasPrimaryInfoReflection,
            detail: hasPrimaryInfoReflection
              ? "入力された一次情報の固有語彙が、本文内で自社経験として自然に反映されています。"
              : `一次情報の固有語彙（${primaryInfoTerms.slice(0, 5).join("、")}）を、当社の経験・相談傾向・現場観察として本文に戻すと独自性が上がります。`,
          },
          {
            id: "primary-info-opening-placement",
            label: "一次情報の冒頭反映",
            passed: hasPrimaryInfoOpeningPlacement,
            detail: hasPrimaryInfoOpeningPlacement
              ? "一次情報が冒頭の結論・判断材料にも入り、記事の独自性が早い段階で伝わります。"
              : `一次情報の固有語彙（${primaryInfoTerms.slice(0, 5).join("、")}）を、冒頭の結論や読者の判断材料にも戻してください。本文後半だけで触れると、AIが作った一般論に見えやすくなります。`,
          },
          {
            id: "primary-info-digestion",
            label: "一次情報の編集消化",
            passed: !hasPrimaryInfoVerbatimCopy,
            detail: hasPrimaryInfoVerbatimCopy
              ? "一次情報の入力文が長くそのまま使われています。固有語彙は残しつつ、読者向けの判断材料、例外、注意点に編集して言い換えると取材記事らしくなります。"
              : "一次情報は丸写しではなく、記事文脈に合わせて編集されています。",
          },
        ]
      : []),
    ...(shouldCheckCta
      ? [
          {
            id: "cta-reflection",
            label: "結び文章/CTAの反映",
            passed: hasCtaReflection,
            detail: hasCtaReflection
              ? "入力された結び文章やCTAの意図が本文末尾に反映されています。"
              : `結び文章/CTAの固有語彙（${ctaTerms.slice(0, 5).join("、")}）を、記事末尾の自然な誘導文として戻すと業務利用しやすくなります。`,
          },
        ]
      : []),
    ...(shouldCheckReferences
      ? [
          {
            id: "reference-info-reflection",
            label: "参照情報の具体反映",
            passed: hasReferenceReflection,
            detail: hasReferenceReflection
              ? "参照情報の固有語彙が本文の定義・判断基準・具体例に反映されています。"
              : `参照情報の固有語彙（${referenceTerms.slice(0, 5).join("、")}）を、定義・判断基準・具体例・注意点として本文に戻すと、一般論から抜け出せます。`,
          },
          {
            id: "reference-info-digestion",
            label: "参照情報の編集消化",
            passed: !hasReferenceVerbatimCopy,
            detail: hasReferenceVerbatimCopy
              ? "参照情報の長い文がそのまま本文に使われています。事実関係は保ちつつ、読者の判断基準、条件、注意点、出典注記として編集して言い換えてください。"
              : "参照情報は丸写しではなく、記事文脈に合わせて編集されています。",
          },
        ]
      : []),
    ...(shouldCheckCompetitors
      ? [
          {
            id: "competitor-insight-reflection",
            label: "競合論点/差別化の反映",
            passed: hasCompetitorReflection,
            detail: hasCompetitorReflection
              ? "競合情報の論点が、比較軸や差別化ポイントとして本文に反映されています。"
              : `競合情報の固有語彙（${competitorTerms.slice(0, 5).join("、")}）を、比較軸・不足論点・差別化ポイントとして本文に戻すと、企画記事としての独自性が上がります。`,
          },
          {
            id: "competitor-insight-digestion",
            label: "競合情報の編集消化",
            passed: !hasCompetitorVerbatimCopy,
            detail: hasCompetitorVerbatimCopy
              ? "競合情報の長い文がそのまま本文に使われています。競合の主張を写すのではなく、比較軸、不足論点、差別化ポイントとして再構成してください。"
              : "競合情報は丸写しではなく、比較・差別化の文脈に合わせて編集されています。",
          },
        ]
      : []),
    {
      id: "definition",
      label: "引用しやすい定義",
      passed: hasDefinition,
      detail: hasDefinition
        ? "AIが要約・引用しやすい定義文があります。"
        : "冒頭付近に「Xとは...」形式の定義文を追加すると強くなります。",
    },
    {
      id: "structured-elements",
      label: "構造要素",
      passed: hasList && hasFaq,
      detail: hasList && hasFaq
        ? "箇条書きとFAQが含まれています。"
        : "箇条書きとFAQの両方を入れると業務利用しやすくなります。",
    },
    {
      id: "editorial-headings",
      label: "編集意図のある見出し",
      passed: hasEditorialHeadings,
      detail: hasEditorialHeadings
        ? "見出しが機械的なラベルではなく、読者の判断に役立つ表現です。"
        : mechanicalHeadingHits > 0
          ? "「重要なポイント」「メリット」「まとめ」などの機械的な見出しを、具体的な判断・失敗・比較が伝わる見出しに変えると自然になります。"
          : "H2/H3を2つ以上置き、各見出しで読者が何を判断できるか分かる表現にすると強くなります。",
    },
    {
      id: "heading-storyline",
      label: "見出しの企画性",
      passed: hasHeadingStoryline,
      detail: hasHeadingStoryline
        ? "見出しが単なる手順列ではなく、読者の判断や記事の企画意図を示しています。"
        : `「${headings
            .filter(isMechanicalSequenceHeading)
            .slice(0, 3)
            .join("」「")}」のような連番・手順型の見出しが続いています。まず/次に/最後に型ではなく、判断、失敗、比較、現場差分が伝わる見出しへ変えると編集記事らしくなります。`,
    },
    {
      id: "opening-heading-angle",
      label: "冒頭定義後の見出し角度",
      passed: hasDistinctFirstHeadingAngle,
      detail: hasDistinctFirstHeadingAngle
        ? "冒頭の定義文を、最初の見出しが別の判断・失敗・比較・運用角度へ展開しています。"
        : "冒頭で定義を書いた直後に、最初のH2/H3も定義型になっています。最初の見出しは、読者が最初に判断すること、失敗パターン、比較軸、運用チェックポイントへ変えると編集記事らしくなります。",
    },
    {
      id: "comparison-table",
      label: "比較・整理のしやすさ",
      passed: hasUsefulTable,
      detail: hasUsefulTable
        ? "判断基準や比較軸が入った表が含まれており、要点整理がしやすい構成です。"
        : hasTable
          ? "表はありますが、項目/内容だけの薄い整理に見えます。判断基準、比較軸、条件、費用、期間、担当、注意点を入れると実務で使いやすくなります。"
          : "比較表または整理表を追加すると、読み手とAI検索の双方に伝わりやすくなります。",
    },
    {
      id: "sentence-variety",
      label: "語尾の単調さ",
      passed: repeatedEndingRate <= 0.42,
      detail: repeatedEndingRate <= 0.42
        ? "語尾の偏りは強くありません。"
        : "同じ語尾が続いているため、文体に抑揚を出す余地があります。",
    },
    {
      id: "sentence-length",
      label: "一文の読みやすさ",
      passed: hasConciseSentenceLength,
      detail: hasConciseSentenceLength
        ? "一文が長くなりすぎず、読み手が追いやすい文量です。"
        : `130字を超える長い一文があります（例: ${longSentences[0]
            .slice(0, 46)
            .trim()}...）。条件、例外、具体例、結論を短い文に分けると、人間が編集した記事らしくなります。`,
    },
    {
      id: "connector-variety",
      label: "接続表現の単調さ",
      passed: hasNaturalConnectorVariety,
      detail: hasNaturalConnectorVariety
        ? "接続表現の連続や偏りは目立ちません。"
        : `「${mostFrequentItem(leadingConnectors)}」など同じ接続表現が続いています。文ごとの役割を見直し、接続語なしの短文、具体例、条件、例外を混ぜると人間の編集記事らしくなります。`,
    },
    {
      id: "sentence-frame-variety",
      label: "定型的な文の入り方",
      passed: hasNaturalSentenceFrames,
      detail: hasNaturalSentenceFrames
        ? "「結論として」「具体的には」型の定型的な入り方は目立ちません。"
        : `「${mostFrequentItem(formulaicFrames)}」などの定型的な文頭が多く、編集記事よりテンプレート文に見えます。段落ごとに、短い断定、現場例、条件、例外、比較から自然に入り直してください。`,
    },
    {
      id: "unsupported-claims",
      label: "根拠の薄い強い断定",
      passed: unsupportedClaimHits <= 1,
      detail:
        unsupportedClaimHits <= 1
          ? "強い断定表現は抑えられています。"
          : `${unsupportedClaimHits}件の強い断定候補があります。根拠、条件、例外を添えると信頼性が上がります。`,
    },
    {
      id: "numeric-claim-support",
      label: "数字・実績の根拠づけ",
      passed: hasNumericClaimSupport,
      detail: hasNumericClaimSupport
        ? "数字や実績らしい表現には、出典、条件、目安、現場観察などの補足があります。"
        : `数字や実績らしい表現（例: ${unsupportedNumericClaims
            .slice(0, 3)
            .map((claim) => claim.value)
            .join("、")}）の近くに、出典、条件、時点、目安、現場観察の補足が不足しています。`,
    },
    {
      id: "source-awareness",
      label: "参照元への意識",
      passed: hasSourceNote,
      detail: hasSourceNote
        ? "参照・出典に触れる記述があります。"
        : "参照元や未確認情報への扱いを明示すると信頼性が上がります。",
    },
    ...(shouldCheckSourceUrls
      ? [
          {
            id: "source-url-presence",
            label: "出典URLの明示",
            passed: hasSourceUrlPresence,
            detail: hasSourceUrlPresence
              ? "主要な参照元URLが本文内の出典注記またはリンクとして確認できます。"
              : `主要な参照元URL（例: ${missingSourceUrls
                  .slice(0, 3)
                  .join("、")}）が本文内に見当たりません。WordPress投稿後にも読者が確認できるよう、本文末尾や該当箇所に出典URLを残してください。`,
          },
        ]
      : []),
  ];

  const failed = checks.filter((check) => !check.passed);
  const score = Math.max(
    0,
    100 -
      failed.length * 8 -
      Math.min(genericPhraseHits, 6) * 2 -
      Math.min(Math.max(0, genericOpeningPhraseHits - 1), 4) * 2 -
      Math.min(genericOpeningHits.length, 4) * 3 -
      Math.min(genericEndingHits.length, 4) * 3 -
      Math.min(verboseAiPhraseHits, 6) * 2 -
      Math.min(Math.max(0, repetitiveNecessityPhraseHits - 2), 4) * 2 -
      Math.min(unsupportedClaimHits, 4) * 2 -
      Math.min(unsupportedNumericClaims.length, 4) * 2 -
      Math.min(mechanicalHeadingHits, 4) * 2 -
      Math.min(mechanicalSequenceHeadingHits, 4) * 2 -
      Math.min(longSentences.length, 4) * 2,
  );

  return {
    score,
    checks,
    strengths: checks.filter((check) => check.passed).map((check) => check.label),
    improvements: failed.map((check) => check.detail),
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "。 ")
    .replace(/<\/(?:p|li|td|th|tr|h[1-6]|div|section)>/gi, "。 ")
    .replace(/<[^>]+>/g, " ");
}

function removeAuxiliaryQualityHtml(html: string) {
  return html
    .replace(
      /<section\b[^>]*class=(["'])[^"']*\baio-(?:faq|author|source)-block\b[^"']*\1[^>]*>[\s\S]*?<\/section>/gi,
      " ",
    )
    .replace(/<h[23][^>]*>\s*(?:FAQ(?:[:：][\s\S]*?)?|よくある質問|この記事の執筆者|参照元)\s*<\/h[23]>[\s\S]*?(?=<h[12]\b|$)/gi, " ");
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function countVisibleCharacters(text: string) {
  return Array.from(text.replace(/\s+/g, "")).length;
}

function stripUrlText(text: string) {
  return text.replace(/https?:\/\/[^\s<>"'）)]+/gi, "");
}

function normalizeTargetWordCount(value: number | undefined) {
  return [1000, 2000, 3000, 4000, 5000, 6000].includes(value ?? 0) ? value : undefined;
}

function targetLengthRange(targetWordCount: number) {
  return {
    target: targetWordCount,
    min: Math.round(targetWordCount * 0.7),
    max: Math.round(targetWordCount * 1.35),
  };
}

function sourceUrlAppearsInArticle(url: string, html: string, text: string) {
  const candidates = sourceUrlCandidates(url);
  const rawArticle = decodeHtmlAmpersands(html);
  if (candidates.some((candidate) => rawArticle.includes(candidate) || text.includes(candidate))) {
    return true;
  }

  return articleContainsCanonicalSourceUrl(url, `${rawArticle} ${text}`);
}

function extractPrimaryInfoTerms(primaryInfo?: string) {
  return extractSignalTerms(primaryInfo, primaryInfoStopWords);
}

function extractReferenceTerms(referenceTexts?: string[]) {
  const combined = referenceTexts
    ?.map((text) => text.trim())
    .filter((text) => text.length >= 20)
    .join(" ")
    .slice(0, 9000);

  return extractSignalTerms(combined, referenceInfoStopWords).filter(
    (term) => term.length >= 3 || /[A-Za-z0-9]/.test(term),
  );
}

function extractCompetitorTerms(competitorTexts?: string[]) {
  const combined = competitorTexts
    ?.map((text) => text.trim())
    .filter((text) => text.length >= 20)
    .join(" ")
    .slice(0, 9000);

  return extractSignalTerms(combined, competitorStopWords).filter(
    (term) => term.length >= 3 || /[A-Za-z0-9]/.test(term),
  );
}

function extractSignalTerms(value: string | undefined, stopWords: Set<string>) {
  if (!value?.trim()) {
    return [];
  }

  return uniqueItems(
    value
      .split(
        /[、。,.・\s（）()「」『』【】\[\]\/]+|では|には|から|まで|より|として|について|は|が|を|に|で|と|の|も|へ/g,
      )
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
      .filter((term) => !stopWords.has(term.toLowerCase()))
      .filter((term) => !/^[0-9０-９]+$/.test(term)),
  ).slice(0, 12);
}

function termAppearsInText(term: string, text: string) {
  if (/^[A-Za-z0-9_-]+$/.test(term)) {
    return englishTokenAppearsInText(term, text);
  }

  if (text.includes(term)) {
    return true;
  }

  if (term.length < 5) {
    return false;
  }

  return slidingWindows(term, 4).some((part) => text.includes(part));
}

function includesLongVerbatimClause(source: string | undefined, targetText: string) {
  if (!source?.trim()) {
    return false;
  }

  const normalizedTarget = normalizeComparableText(targetText);
  return source
    .split(/[。！？!?;；\n\r]+/)
    .map(normalizeComparableText)
    .filter((clause) => Array.from(clause).length >= 28)
    .some((clause) => normalizedTarget.includes(clause));
}

function includesAnyLongVerbatimClause(sources: string[] | undefined, targetText: string) {
  return sources?.some((source) => includesLongVerbatimClause(source, targetText)) ?? false;
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function slidingWindows(value: string, size: number) {
  return Array.from({ length: Math.max(0, value.length - size + 1) }, (_, index) =>
    value.slice(index, index + size),
  );
}

function countPhraseHits(text: string, phrases: string[]) {
  return phrases.reduce((total, phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return total + (text.match(new RegExp(escaped, "gi"))?.length ?? 0);
  }, 0);
}

function countUnsupportedStrongClaimHits(text: string) {
  return unsupportedStrongClaims.reduce((total, phrase) => {
    let count = 0;
    let fromIndex = 0;

    while (fromIndex < text.length) {
      const index = text.indexOf(phrase, fromIndex);
      if (index < 0) {
        break;
      }

      if (!isQualifiedStrongClaimUsage(text, phrase, index)) {
        count += 1;
      }

      fromIndex = index + phrase.length;
    }

    return total + count;
  }, 0);
}

function isQualifiedStrongClaimUsage(text: string, phrase: string, index: number) {
  const sentence = extractSentenceAround(text, index);
  const before = text.slice(Math.max(0, index - 18), index);
  const after = text.slice(index + phrase.length, index + phrase.length + 32);

  if (isInsideJapaneseOrAsciiQuote(text, index)) {
    return true;
  }

  if (/(?:です|ます|できます|でしょう|よい|良い|可能)か[。．！？?]?/.test(sentence)) {
    return true;
  }

  if (/(とは)?(?:言えません|いえません|言えない|いえない|限りません|限らない|ではありません|断定できません|断定しません)/.test(after)) {
    return true;
  }

  if (phrase === "必ず" && /しも/.test(after) && /(ない|ありません|限りません|限らない)/.test(sentence)) {
    return true;
  }

  return /[「『“"]\s*$/.test(before) && /^[」』”"]/.test(after.trimStart());
}

function isInsideJapaneseOrAsciiQuote(text: string, index: number) {
  const before = text.slice(0, index);
  const after = text.slice(index);
  const quotePairs: Array<[string, string]> = [
    ["「", "」"],
    ["『", "』"],
    ["“", "”"],
    ['"', '"'],
  ];

  return quotePairs.some(([open, close]) => {
    const lastOpen = before.lastIndexOf(open);
    const lastClose = before.lastIndexOf(close);
    if (lastOpen <= lastClose) {
      return false;
    }

    return after.indexOf(close) >= 0;
  });
}

function extractSentenceAround(text: string, index: number) {
  const beforeStops = ["。", "．", ".", "!", "！", "?", "？"].map((mark) =>
    text.lastIndexOf(mark, index - 1),
  );
  const sentenceStart = Math.max(0, Math.max(...beforeStops) + 1);
  const afterStops = ["。", "．", ".", "!", "！", "?", "？"]
    .map((mark) => text.indexOf(mark, index))
    .filter((position) => position >= 0);
  const sentenceEnd = afterStops.length ? Math.min(...afterStops) + 1 : text.length;

  return text.slice(sentenceStart, sentenceEnd).trim();
}

function findGenericOpeningHits(openingText: string) {
  return genericOpeningPatterns
    .filter((item) => item.pattern.test(openingText))
    .map((item) => item.label);
}

function findGenericEndingHits(endingText: string) {
  return genericEndingPatterns
    .filter((item) => item.pattern.test(endingText))
    .map((item) => item.label);
}

function extractNumericClaims(text: string) {
  return Array.from(text.matchAll(numericClaimPattern)).map((match) => ({
    value: match[0],
    index: match.index ?? 0,
  }));
}

function hasNearbyNumericClaimSupport(text: string, index: number) {
  const sentenceStart = Math.max(
    0,
    Math.max(
      text.lastIndexOf("。", index - 1),
      text.lastIndexOf("！", index - 1),
      text.lastIndexOf("？", index - 1),
      text.lastIndexOf(".", index - 1),
      text.lastIndexOf("!", index - 1),
      text.lastIndexOf("?", index - 1),
    ) + 1,
  );
  const nextStops = ["。", "！", "？", ".", "!", "?"]
    .map((mark) => text.indexOf(mark, index))
    .filter((position) => position >= 0);
  const sentenceEnd = nextStops.length ? Math.min(...nextStops) : text.length;
  const sentence = text.slice(sentenceStart, sentenceEnd);

  if (numericClaimSupportPattern.test(sentence)) {
    return true;
  }

  const previousSentence = extractPreviousSentence(text, sentenceStart);
  if (
    previousSentence &&
    countVisibleCharacters(previousSentence) <= 90 &&
    previousNumericSupportPattern.test(previousSentence)
  ) {
    return true;
  }

  const adjacentSentence = extractNextSentence(text, sentenceEnd);
  return Boolean(
    adjacentSentence &&
      countVisibleCharacters(adjacentSentence) <= 90 &&
      adjacentNumericSupportPattern.test(adjacentSentence),
  );
}

function extractPreviousSentence(text: string, sentenceStart: number) {
  const beforeCurrentSentence = text.slice(0, Math.max(0, sentenceStart - 1)).trimEnd();
  if (!beforeCurrentSentence) {
    return "";
  }

  const previousStart =
    Math.max(
      beforeCurrentSentence.lastIndexOf("。"),
      beforeCurrentSentence.lastIndexOf("！"),
      beforeCurrentSentence.lastIndexOf("？"),
      beforeCurrentSentence.lastIndexOf("."),
      beforeCurrentSentence.lastIndexOf("!"),
      beforeCurrentSentence.lastIndexOf("?"),
    ) + 1;

  return beforeCurrentSentence.slice(previousStart).trim();
}

function extractNextSentence(text: string, sentenceEnd: number) {
  const afterCurrentSentence = text.slice(sentenceEnd + 1).trimStart();
  if (!afterCurrentSentence) {
    return "";
  }

  const nextEnd = ["。", "！", "？", ".", "!", "?"]
    .map((mark) => afterCurrentSentence.indexOf(mark))
    .filter((position) => position >= 0);
  const end = nextEnd.length ? Math.min(...nextEnd) : afterCurrentSentence.length;
  return afterCurrentSentence.slice(0, end).trim();
}

function extractSentenceEndings(text: string) {
  return stripUrlText(text)
    .split(sentenceBoundaryPattern)
    .map((sentence) => sentence.trim().slice(-3))
    .filter((ending) => ending.length >= 2);
}

function extractSentences(text: string) {
  return stripUrlText(text)
    .split(sentenceBoundaryPattern)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 2);
}

function extractLeadingConnectors(text: string) {
  return stripUrlText(text)
    .split(sentenceBoundaryPattern)
    .map((sentence) => sentence.trim().replace(/^[「『（(【\s]+/, ""))
    .map((sentence) =>
      repetitiveConnectors.find((connector) =>
        new RegExp(`^${connector}(?:、|,|\\s|　)`).test(sentence),
      ),
    )
    .filter((connector): connector is string => Boolean(connector));
}

function extractFormulaicSentenceFrames(text: string) {
  return stripUrlText(text)
    .split(sentenceBoundaryPattern)
    .map((sentence) => sentence.trim().replace(/^[「『（(【\s]+/, ""))
    .map((sentence) => formulaicSentenceFrames.find((frame) => sentence.startsWith(frame)))
    .filter((frame): frame is string => Boolean(frame));
}

function mostFrequentItem(items: string[]) {
  const counts = countItems(items);
  return Object.entries(counts).sort((first, second) => second[1] - first[1])[0]?.[0] ?? "";
}

function extractHeadings(html: string) {
  const headings: string[] = [];
  const pattern = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    headings.push(normalizeText(stripHtml(match[1])));
  }

  return headings.filter(Boolean);
}

function extractTextBeforeFirstHeading(html: string) {
  const firstHeading = /<h[23][^>]*>/i.exec(html);
  const openingHtml = firstHeading?.index ? html.slice(0, firstHeading.index) : "";
  return normalizeText(stripHtml(openingHtml));
}

function hasDefinitionStyleText(value: string) {
  return /(とは|を指します|を意味します|\bmeans\b|\brefers to\b)/i.test(value);
}

function isDefinitionStyleHeading(heading: string) {
  return hasDefinitionStyleText(heading);
}

function extractTableTexts(html: string) {
  return Array.from(html.matchAll(/<table[\s\S]*?<\/table>/gi))
    .map((match) => normalizeText(stripHtml(match[0])))
    .filter(Boolean);
}

function isUsefulDecisionTable(tableText: string) {
  const compact = tableText.replace(/\s+/g, "");
  const textLength = countVisibleCharacters(tableText);
  const signalCount = usefulTableSignalPatterns.filter((pattern) => pattern.test(tableText)).length;
  const hasEnoughSubstance = textLength >= 18;
  const isWeakPlaceholder = weakTableOnlyPattern.test(compact);

  return hasEnoughSubstance && signalCount >= 1 && !isWeakPlaceholder;
}

function extractHeadingSections(html: string) {
  const matches = Array.from(html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi));

  return matches
    .map((match, index) => {
      const next = matches[index + 1];
      const heading = normalizeText(stripHtml(match[1] ?? ""));
      const bodyStart = (match.index ?? 0) + match[0].length;
      const bodyEnd = next?.index ?? html.length;
      const bodyText = normalizeText(stripHtml(html.slice(bodyStart, bodyEnd)));

      return {
        heading,
        bodyText,
      };
    })
    .filter((section) => section.heading);
}

function isAuxiliaryHeading(heading: string) {
  const normalized = heading.replace(/\s+/g, "").toLowerCase();
  return (
    normalized === "faq" ||
    normalized.startsWith("faq:") ||
    normalized.startsWith("faq：") ||
    normalized === "よくある質問" ||
    normalized === "この記事の執筆者" ||
    normalized === "参照元" ||
    normalized === "source" ||
    normalized === "sources" ||
    normalized === "author" ||
    normalized === "abouttheauthor"
  );
}

function isThinHeadingSection(section: { heading: string; bodyText: string }) {
  const evidenceCount = sectionEvidencePatterns.filter((pattern) =>
    pattern.test(section.bodyText),
  ).length;
  const bodyLength = Array.from(section.bodyText).length;

  return bodyLength < 70 || evidenceCount < 2;
}

function isMechanicalHeading(heading: string) {
  const normalized = heading.replace(/\s+/g, "");
  if (mechanicalHeadingLabels.some((label) => normalized === label)) {
    return true;
  }

  return vagueHeadingRoots.some(
    (root) =>
      normalized === `${root}について` ||
      normalized === `${root}とは` ||
      normalized === `${root}のポイント` ||
      normalized === `${root}の流れ` ||
      normalized === `${root}の方法`,
  );
}

function isMechanicalSequenceHeading(heading: string) {
  const normalized = heading.replace(/\s+/g, " ").trim();
  const compact = heading.replace(/\s+/g, "");
  return mechanicalSequenceHeadingPatterns.some(
    (pattern) => pattern.test(normalized) || pattern.test(compact),
  );
}

function countItems(items: string[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items));
}
