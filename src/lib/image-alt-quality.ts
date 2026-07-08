import type { ArticleQualityEvaluation } from "@/lib/article-quality";

type ImageAltEntry = {
  altText?: string;
  alt_text?: string;
  prompt?: string;
  slot?: string;
};

export type ImageAltQualityInput = {
  images?: ImageAltEntry[];
  imagePrompts?: ImageAltEntry[];
  imageCount?: number;
  themeText?: string;
  primaryInfo?: string;
};

const genericAltTexts = new Set([
  "image",
  "photo",
  "picture",
  "illustration",
  "hero image",
  "featured image",
  "inline image",
  "generated image",
  "business image",
  "workflow image",
  "diagram",
]);

export function evaluateImageAltQuality({
  images = [],
  imagePrompts = [],
  imageCount = 0,
  themeText = "",
  primaryInfo = "",
}: ImageAltQualityInput): ArticleQualityEvaluation {
  const entries = collectImageAltEntries(images, imagePrompts);
  const shouldEvaluate = imageCount > 0 || entries.length > 0;
  const missingAltCount = entries.filter((entry) => !entry.alt).length;
  const lengthIssueCount = entries.filter((entry) => {
    const length = Array.from(entry.alt).length;
    return entry.alt && (length < 8 || length > 120);
  }).length;
  const genericAltCount = entries.filter((entry) => isGenericAlt(entry.alt)).length;
  const signalTerms = uniqueItems([
    ...extractImageSignalTerms(themeText).slice(0, 5),
    ...extractImageSignalTerms(primaryInfo).slice(0, 3),
  ]);
  const hasSpecificAltEntry = entries.some((entry) => {
    const length = Array.from(entry.alt).length;
    return length >= 8 && !isGenericAlt(entry.alt);
  });
  const hasArticleSignal =
    !shouldEvaluate ||
    signalTerms.length === 0 ||
    hasSpecificAltEntry ||
    entries.some((entry) =>
      signalTerms.some((term) => imageEntryContainsTerm(`${entry.alt} ${entry.prompt}`, term)),
    );

  const checks = [
    {
      id: "image-alt-presence",
      label: "画像altの入力",
      passed: !shouldEvaluate || (entries.length > 0 && missingAltCount === 0),
      detail:
        !shouldEvaluate || (entries.length > 0 && missingAltCount === 0)
          ? "記事画像のaltが入力されています。"
          : `altが空の画像が${missingAltCount || imageCount}件あります。WordPress投稿前に画像の意味が伝わる説明を入れてください。`,
    },
    {
      id: "image-alt-length",
      label: "画像altの実用的な長さ",
      passed: !shouldEvaluate || lengthIssueCount === 0,
      detail:
        !shouldEvaluate || lengthIssueCount === 0
          ? "画像altは読み上げやWordPress利用に扱いやすい長さです。"
          : `画像altが短すぎる、または長すぎる画像が${lengthIssueCount}件あります。8〜120文字程度で、画像が伝える要点を書いてください。`,
    },
    {
      id: "image-alt-specificity",
      label: "画像altの具体性",
      passed: !shouldEvaluate || genericAltCount === 0,
      detail:
        !shouldEvaluate || genericAltCount === 0
          ? "画像altは「画像」だけの汎用説明に寄っていません。"
          : `画像altが汎用的な画像説明に寄っているものが${genericAltCount}件あります。記事テーマ、図解内容、読者が見るべき判断軸を入れてください。`,
    },
    {
      id: "image-alt-article-signal",
      label: "画像altへの記事文脈反映",
      passed: hasArticleSignal,
      detail: hasArticleSignal
        ? "画像altまたは画像プロンプトに、テーマ・一次情報の固有語彙が反映されています。"
        : `画像altにテーマ・一次情報の固有語彙（${signalTerms.slice(0, 5).join("、")}）を自然に戻してください。`,
    },
  ];
  const failed = checks.filter((check) => !check.passed);

  return {
    score: Math.max(0, 100 - failed.length * 10 - genericAltCount * 3),
    checks,
    strengths: checks.filter((check) => check.passed).map((check) => check.detail),
    improvements: failed.map((check) => check.detail),
  };
}

function collectImageAltEntries(images: ImageAltEntry[], imagePrompts: ImageAltEntry[]) {
  const bySlot = new Map<string, { alt: string; prompt: string }>();

  for (const entry of [...imagePrompts, ...images]) {
    const slot = entry.slot || `entry-${bySlot.size}`;
    bySlot.set(slot, {
      alt: (entry.altText ?? entry.alt_text ?? "").trim(),
      prompt: (entry.prompt ?? "").trim(),
    });
  }

  return Array.from(bySlot.values());
}

function isGenericAlt(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");

  return Boolean(normalized) && genericAltTexts.has(normalized);
}

function extractImageSignalTerms(value: string) {
  if (!value.trim()) {
    return [];
  }

  const stopWords = new Set([
    "テーマ",
    "キーワード",
    "想定読者",
    "検索意図",
    "記事",
    "画像",
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
    "image",
    "visual",
  ]);

  return uniqueItems(
    value
      .replace(/[、。,.!?()[\]{}「」『』"'`]/g, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2 && !stopWords.has(term.toLowerCase())),
  ).slice(0, 12);
}

function imageEntryContainsTerm(value: string, term: string) {
  const normalizedValue = value.toLowerCase();
  const normalizedTerm = term.toLowerCase();

  if (/^[a-z0-9-]+$/i.test(normalizedTerm)) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i").test(normalizedValue);
  }

  return normalizedValue.includes(normalizedTerm);
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
