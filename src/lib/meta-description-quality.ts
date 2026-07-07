import type { ArticleQualityEvaluation } from "@/lib/article-quality";

export type MetaDescriptionQualityInput = {
  metaDescription: string;
  themeText?: string;
  primaryInfo?: string;
};

const genericMetaPhrases = [
  "この記事では",
  "本記事では",
  "わかりやすく解説",
  "詳しく解説",
  "紹介します",
  "まとめました",
  "in this article",
  "this article explains",
  "it is important to",
  "can help",
  "improve efficiency",
  "best practices",
  "today's digital landscape",
  "fast-paced digital landscape",
  "ever-evolving",
  "unlock the potential",
];

export function evaluateMetaDescriptionQuality({
  metaDescription,
  themeText = "",
  primaryInfo = "",
}: MetaDescriptionQualityInput): ArticleQualityEvaluation {
  const trimmed = metaDescription.trim();
  const normalized = trimmed.toLowerCase();
  const length = Array.from(trimmed).length;
  const inputTerms = uniqueItems([
    ...extractMetaSignalTerms(themeText).slice(0, 5),
    ...extractMetaSignalTerms(primaryInfo).slice(0, 3),
  ]);
  const genericHits = genericMetaPhrases.filter((phrase) =>
    normalized.includes(phrase.toLowerCase()),
  );
  const hasValue = trimmed.length > 0;
  const hasPracticalLength = length >= 50 && length <= 160;
  const hasInputSignal =
    inputTerms.length === 0 || inputTerms.some((term) => metaContainsTerm(normalized, term));
  const hasSpecificPromise = hasValue && genericHits.length === 0;

  const checks = [
    {
      id: "meta-description-presence",
      label: "メタディスクリプション入力",
      passed: hasValue,
      detail: hasValue
        ? "メタディスクリプションが入力されています。"
        : "メタディスクリプションを入力してください。検索結果や共有時に記事の価値が伝わりにくくなります。",
    },
    {
      id: "meta-description-length",
      label: "メタディスクリプションの長さ",
      passed: hasPracticalLength,
      detail: hasPracticalLength
        ? "メタディスクリプションは業務利用しやすい長さです。"
        : "メタディスクリプションは50〜160文字程度に整え、要点、対象読者、読む理由を短く伝えてください。",
    },
    {
      id: "meta-description-specificity",
      label: "メタディスクリプションの具体性",
      passed: hasSpecificPromise,
      detail: hasSpecificPromise
        ? "メタディスクリプションは汎用的なAI風説明に寄っていません。"
        : `メタディスクリプションから汎用句（${genericHits.slice(0, 3).join("、") || "この記事では"}）を減らし、記事固有の判断軸や一次情報を入れてください。`,
    },
    {
      id: "meta-description-input-signal",
      label: "メタディスクリプションへの入力反映",
      passed: hasInputSignal,
      detail: hasInputSignal
        ? "テーマまたは一次情報の固有語彙がメタディスクリプションに反映されています。"
        : `テーマ・一次情報の固有語彙（${inputTerms.slice(0, 5).join("、")}）をメタディスクリプションにも自然に戻してください。`,
    },
  ];
  const failed = checks.filter((check) => !check.passed);

  return {
    score: Math.max(0, 100 - failed.length * 12 - genericHits.length * 4),
    checks,
    strengths: checks.filter((check) => check.passed).map((check) => check.detail),
    improvements: failed.map((check) => check.detail),
  };
}

function extractMetaSignalTerms(value: string) {
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
  ]);

  return uniqueItems(
    value
      .replace(/[、。,.!?()[\]{}「」『』"'`]/g, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => {
        if (term.length < 2) {
          return false;
        }

        return !stopWords.has(term.toLowerCase());
      }),
  ).slice(0, 12);
}

function metaContainsTerm(normalizedMeta: string, term: string) {
  const normalizedTerm = term.toLowerCase();

  if (/^[a-z0-9-]+$/i.test(normalizedTerm)) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i").test(normalizedMeta);
  }

  return normalizedMeta.includes(normalizedTerm);
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
