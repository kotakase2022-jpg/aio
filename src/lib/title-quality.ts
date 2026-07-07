import type { ArticleQualityEvaluation } from "@/lib/article-quality";

export type TitleQualityInput = {
  selectedTitle: string;
  titleCandidates?: string[];
  themeText?: string;
  primaryInfo?: string;
};

export function evaluateTitleQuality({
  selectedTitle,
  titleCandidates = [],
  themeText = "",
  primaryInfo = "",
}: TitleQualityInput): ArticleQualityEvaluation {
  const trimmedTitle = selectedTitle.trim();
  const candidates = uniqueItems(titleCandidates.map((title) => title.trim()));
  const titleText = uniqueItems([trimmedTitle, ...candidates]).join(" ");
  const themeTerms = extractTitleSignalTerms(themeText);
  const primaryTerms = extractTitleSignalTerms(primaryInfo);
  const requiredTerms = uniqueItems([...themeTerms.slice(0, 5), ...primaryTerms.slice(0, 3)]);
  const hasInputSignal =
    requiredTerms.length === 0 || requiredTerms.some((term) => titleContainsTerm(titleText, term));
  const hasEnoughCandidates = candidates.length >= 3;
  const titleLength = Array.from(trimmedTitle).length;
  const hasPracticalLength = titleLength >= 12 && titleLength <= 70;
  const hasEditorialSpecificity = Boolean(trimmedTitle) && !isGenericTitle(trimmedTitle);

  const checks = [
    {
      id: "title-specificity",
      label: "タイトルの具体性",
      passed: hasEditorialSpecificity,
      detail: hasEditorialSpecificity
        ? "選択タイトルは機械的な汎用ラベルではありません。"
        : "タイトルが汎用的です。テーマ、一次情報、比較軸、読者の判断ポイントが一目で分かる具体的なタイトルにしてください。",
    },
    {
      id: "title-length",
      label: "タイトルの実用的な長さ",
      passed: hasPracticalLength,
      detail: hasPracticalLength
        ? "選択タイトルの長さが業務利用しやすい範囲です。"
        : "タイトルは短すぎず長すぎない、12〜70文字程度の実用的な長さにしてください。",
    },
    {
      id: "title-candidate-count",
      label: "タイトル候補数",
      passed: hasEnoughCandidates,
      detail: hasEnoughCandidates
        ? "タイトル候補が3案以上あります。"
        : "比較検討できるよう、タイトル候補を3案以上用意してください。",
    },
    {
      id: "title-input-signal",
      label: "タイトルへの入力反映",
      passed: hasInputSignal,
      detail: hasInputSignal
        ? "タイトル候補に入力テーマまたは一次情報の固有語彙が反映されています。"
        : `タイトル候補に入力テーマ/一次情報の固有語彙（${requiredTerms.slice(0, 5).join("、")}）を自然に含めてください。`,
    },
  ];
  const failed = checks.filter((check) => !check.passed);
  const score = Math.max(0, 100 - failed.length * 10 - (hasEditorialSpecificity ? 0 : 8));

  return {
    score,
    checks,
    strengths: checks.filter((check) => check.passed).map((check) => check.detail),
    improvements: failed.map((check) => check.detail),
  };
}

function isGenericTitle(title: string) {
  const normalized = title.replace(/\s+/g, "").toLowerCase();
  const genericTitles = [
    "重要なポイント",
    "メリット",
    "デメリット",
    "まとめ",
    "概要",
    "基本",
    "活用方法",
    "注意点",
    "完全ガイド",
    "徹底解説",
    "わかりやすく解説",
    "導入方法",
    "選び方",
    "初心者向け",
    "入門",
    "importantpoints",
    "benefits",
    "summary",
    "overview",
    "basics",
    "completeguide",
    "ultimateguide",
    "bestpractices",
    "strategy",
    "checklist",
    "tips",
  ];

  if (genericTitles.includes(normalized)) {
    return true;
  }

  const genericSuffixTitles = [
    "完全ガイド",
    "徹底解説",
    "わかりやすく解説",
    "導入方法",
    "選び方",
    "活用方法",
    "注意点",
    "メリット",
    "デメリット",
    "まとめ",
    "概要",
    "基本",
    "初心者向け",
    "入門",
    "completeguide",
    "ultimateguide",
    "benefits",
    "basics",
    "overview",
    "summary",
    "bestpractices",
    "strategy",
    "checklist",
    "tips",
  ];
  if (
    genericSuffixTitles.some((suffix) => {
      if (!normalized.endsWith(suffix)) {
        return false;
      }

      const prefix = normalized.slice(0, -suffix.length);
      return prefix.length > 0 && prefix.length <= 12;
    })
  ) {
    return true;
  }

  return genericTitles.some((generic) => normalized === `${generic}について`);
}

function extractTitleSignalTerms(value: string) {
  if (!value.trim()) {
    return [];
  }

  const stopWords = new Set([
    "テーマ",
    "キーワード",
    "想定読者",
    "検索意図",
    "記事",
    "作成",
    "生成",
    "活用",
    "導入",
    "方法",
    "重要",
    "ポイント",
    "について",
    "ため",
    "こと",
    "もの",
    "the",
    "and",
    "for",
    "with",
    "from",
    "article",
    "content",
    "generation",
    "guide",
    "team",
    "teams",
  ]);

  return uniqueItems(
    value
      .split(/[、。・\s,.;:()[\]「」『』/]+|について|とは|から|まで|より|として|には|では|を|に|で|と|の|へ/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
      .filter((term) => !stopWords.has(term.toLowerCase()))
      .filter((term) => !/^[0-9]+$/.test(term)),
  ).slice(0, 10);
}

function titleContainsTerm(titleText: string, term: string) {
  const normalizedTitle = titleText.toLowerCase();
  const normalizedTerm = term.toLowerCase();
  if (/^[a-z0-9_-]+$/i.test(term)) {
    return titleEnglishTokenAppearsInText(normalizedTerm, normalizedTitle);
  }

  if (titleText.includes(term)) {
    return true;
  }

  if (term.length < 5) {
    return false;
  }

  return Array.from({ length: Math.max(0, term.length - 3) }, (_, index) =>
    term.slice(index, index + 4),
  ).some((part) => titleText.includes(part));
}

function titleEnglishTokenAppearsInText(term: string, titleText: string) {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9_])${escapedTerm}(?![a-z0-9_])`, "i").test(titleText);
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}
