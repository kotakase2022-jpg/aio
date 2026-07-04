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

export function evaluateArticleQuality(html: string): ArticleQualityEvaluation {
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
  const repeatedEndingRate = sentenceEndings.length
    ? Math.max(...Object.values(countItems(sentenceEndings))) / sentenceEndings.length
    : 0;

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
