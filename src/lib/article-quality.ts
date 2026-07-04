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
];

export function evaluateArticleQuality(html: string): ArticleQualityEvaluation {
  const text = normalizeText(stripHtml(html));
  const sentenceEndings = extractSentenceEndings(text);
  const genericPhraseHits = countPhraseHits(text, genericPhrases);
  const hasNumbers = /[0-9０-９]/.test(text);
  const hasConcreteAnchors =
    /(事例|現場|相談|失敗|注意点|判断基準|チェック|手順|比較|費用|期間|担当|運用|導入)/.test(text);
  const hasDefinition = /(とは、|とは |定義|意味します|指します)/.test(text);
  const hasTable = /<table[\s>]/i.test(html);
  const hasList = /<(ul|ol)[\s>]/i.test(html);
  const hasFaq = /(FAQ|よくある質問|<h2[^>]*>[^<]*質問|<h3[^>]*>[^<]*質問)/i.test(html);
  const hasSourceNote = /(出典|参照|参考|source|sources)/i.test(text);
  const repeatedEndingRate = sentenceEndings.length
    ? Math.max(...Object.values(countItems(sentenceEndings))) / sentenceEndings.length
    : 0;

  const checks: ArticleQualityCheck[] = [
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
      id: "source-awareness",
      label: "参照元への意識",
      passed: hasSourceNote,
      detail: hasSourceNote
        ? "参照・出典に触れる記述があります。"
        : "参照元や未確認情報への扱いを明示すると信頼性が上がります。",
    },
  ];

  const failed = checks.filter((check) => !check.passed);
  const score = Math.max(0, 100 - failed.length * 9 - Math.min(genericPhraseHits, 6) * 2);

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

function countItems(items: string[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});
}
