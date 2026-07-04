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
  primaryInfo?: string;
  closingText?: string;
  referenceTexts?: string[];
  competitorTexts?: string[];
};

const genericPhrases = [
  "近年",
  "重要です",
  "注目されています",
  "と言えるでしょう",
  "いかがでしょうか",
  "本記事では",
  "まとめると",
  "多くの企業",
  "さまざまな",
  "必要不可欠",
  "大切です",
  "ポイントです",
  "効果的です",
  "理解しておきましょう",
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
  /(当社|弊社|自社|支援現場|現場|相談|ヒアリング|経験|観察|実務|お客様|クライアント|our|we|field support|support team|client|customer|observed|observation|experience)/i;

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
  /(競合|他社|比較|差別化|上位記事|競合記事|競合LP|LP|不足|一方|対して|対比|独自|比較軸|勝ち筋|訴求|competitor|competition|differentiation|compared|whereas|positioning)/i;

export function evaluateArticleQuality(
  html: string,
  context: ArticleQualityContext = {},
): ArticleQualityEvaluation {
  const text = normalizeText(stripHtml(html));
  const sentenceEndings = extractSentenceEndings(text);
  const genericPhraseHits = countPhraseHits(text, genericPhrases);
  const unsupportedClaimHits = countPhraseHits(text, unsupportedStrongClaims);
  const hasNumbers = /[0-9０-９]/.test(text);
  const hasConcreteAnchors =
    /(事例|現場|相談|失敗|注意点|判断基準|チェック|手順|比較|費用|期間|担当|運用|導入)/.test(text);
  const hasDefinition = /(とは、|とは |定義|意味します|指します)/.test(text);
  const openingText = text.slice(0, 420);
  const hasAnswerFirst =
    /(結論|先に結論|要するに|つまり|最初に押さえるべき|とは、|とは )/.test(openingText);
  const editorialAnchorCount = editorialAnchorPatterns.filter((pattern) => pattern.test(text)).length;
  const hasTable = /<table[\s>]/i.test(html);
  const hasList = /<(ul|ol)[\s>]/i.test(html);
  const hasFaq = /(FAQ|よくある質問|<h2[^>]*>[^<]*質問|<h3[^>]*>[^<]*質問)/i.test(html);
  const hasSourceNote = /(出典|参照|参考|source|sources)/i.test(text);
  const headings = extractHeadings(html);
  const mechanicalHeadingHits = headings.filter(isMechanicalHeading).length;
  const hasEditorialHeadings = headings.length >= 2 && mechanicalHeadingHits === 0;
  const headingSections = extractHeadingSections(html);
  const thinSections = headingSections.filter(isThinHeadingSection);
  const allowedThinSections = headingSections.length >= 2 ? 1 : 0;
  const hasSectionSpecificity =
    headingSections.length < 2 || thinSections.length <= allowedThinSections;
  const repeatedEndingRate = sentenceEndings.length
    ? Math.max(...Object.values(countItems(sentenceEndings))) / sentenceEndings.length
    : 0;
  const themeTerms = extractSignalTerms(context.themeText, themeStopWords);
  const themeHitCount = themeTerms.filter((term) => termAppearsInText(term, text)).length;
  const themeTargetHits = Math.min(4, Math.max(2, themeTerms.length));
  const shouldCheckTheme = themeTerms.length >= 2;
  const hasThemeReflection = !shouldCheckTheme || themeHitCount >= themeTargetHits;
  const primaryInfoTerms = extractPrimaryInfoTerms(context.primaryInfo);
  const primaryInfoHitCount = primaryInfoTerms.filter((term) =>
    termAppearsInText(term, text),
  ).length;
  const primaryInfoTargetHits = Math.min(3, Math.max(1, primaryInfoTerms.length));
  const shouldCheckPrimaryInfo = primaryInfoTerms.length > 0;
  const hasPrimaryInfoReflection =
    !shouldCheckPrimaryInfo ||
    (primaryInfoHitCount >= primaryInfoTargetHits && firstPartyAttributionPattern.test(text));
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
  const competitorTerms = extractCompetitorTerms(context.competitorTexts);
  const competitorHitCount = competitorTerms.filter((term) =>
    termAppearsInText(term, text),
  ).length;
  const competitorTargetHits = Math.min(4, Math.max(2, competitorTerms.length));
  const shouldCheckCompetitors = competitorTerms.length >= 2;
  const hasCompetitorReflection =
    !shouldCheckCompetitors ||
    (competitorHitCount >= competitorTargetHits && competitivePositioningPattern.test(text));

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
      id: "concrete-detail",
      label: "具体性",
      passed: hasNumbers && hasConcreteAnchors,
      detail: hasNumbers && hasConcreteAnchors
        ? "数字や現場文脈を含む具体的な説明があります。"
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
      id: "comparison-table",
      label: "比較・整理のしやすさ",
      passed: hasTable,
      detail: hasTable
        ? "表が含まれており、比較・要点整理がしやすい構成です。"
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
      id: "unsupported-claims",
      label: "根拠の薄い強い断定",
      passed: unsupportedClaimHits <= 1,
      detail:
        unsupportedClaimHits <= 1
          ? "強い断定表現は抑えられています。"
          : `${unsupportedClaimHits}件の強い断定候補があります。根拠、条件、例外を添えると信頼性が上がります。`,
    },
    {
      id: "source-awareness",
      label: "参照元への意識",
      passed: hasSourceNote,
      detail: hasSourceNote
        ? "参照・出典に触れる記述があります。"
        : "参照元や未確認情報への扱いを明示すると信頼性が上がります。",
    },
  ];

  const failed = checks.filter((check) => !check.passed);
  const score = Math.max(
    0,
    100 -
      failed.length * 8 -
      Math.min(genericPhraseHits, 6) * 2 -
      Math.min(unsupportedClaimHits, 4) * 2,
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
    .replace(/<[^>]+>/g, " ");
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
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
  if (text.includes(term)) {
    return true;
  }

  if (/^[A-Za-z0-9_-]+$/.test(term)) {
    return text.toLowerCase().includes(term.toLowerCase());
  }

  if (term.length < 5) {
    return false;
  }

  return slidingWindows(term, 4).some((part) => text.includes(part));
}

function slidingWindows(value: string, size: number) {
  return Array.from({ length: Math.max(0, value.length - size + 1) }, (_, index) =>
    value.slice(index, index + size),
  );
}

function countPhraseHits(text: string, phrases: string[]) {
  return phrases.reduce((total, phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return total + (text.match(new RegExp(escaped, "g"))?.length ?? 0);
  }, 0);
}

function extractSentenceEndings(text: string) {
  return text
    .split(/[。！？!?]/)
    .map((sentence) => sentence.trim().slice(-3))
    .filter((ending) => ending.length >= 2);
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

function isThinHeadingSection(section: { heading: string; bodyText: string }) {
  const evidenceCount = sectionEvidencePatterns.filter((pattern) =>
    pattern.test(section.bodyText),
  ).length;
  const bodyLength = Array.from(section.bodyText).length;

  return bodyLength < 70 || evidenceCount < 2;
}

function isMechanicalHeading(heading: string) {
  const normalized = heading.replace(/\s+/g, "");
  return mechanicalHeadingLabels.some((label) => normalized === label);
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
