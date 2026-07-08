import type { ArticleQualityEvaluation } from "@/lib/article-quality";
import { englishTokenAppearsInText } from "@/lib/english-token";
import type { FaqItem } from "@/types/aio";

export type FaqQualityInput = {
  faqItems: FaqItem[];
  themeText?: string;
  primaryInfo?: string;
  referenceTexts?: string[];
  competitorTexts?: string[];
};

const genericQuestionPatterns = [
  /^faq$/i,
  /^よくある質問$/,
  /^これは何ですか[？?]?$/,
  /^何が重要ですか[？?]?$/,
  /^メリットは何ですか[？?]?$/,
  /^デメリットは何ですか[？?]?$/,
  /^注意点は何ですか[？?]?$/,
  /^どう始めればよいですか[？?]?$/,
  /^.{2,24}とは何ですか[？?]?$/,
  /^.{2,24}はなぜ重要ですか[？?]?$/,
  /^.{2,24}はどのように活用できますか[？?]?$/,
  /^.{2,24}のメリットは何ですか[？?]?$/,
  /^.{2,24}の注意点は何ですか[？?]?$/,
  /^what is (it|this)\??$/i,
  /^what is [a-z0-9_-]{2,12}\??$/i,
  /^what are the benefits\??$/i,
  /^what are the benefits of [a-z0-9 _-]{2,40}\??$/i,
  /^what are the disadvantages\??$/i,
  /^what are the disadvantages of [a-z0-9 _-]{2,40}\??$/i,
  /^why is [a-z0-9_-]{2,12} important\??$/i,
  /^how do i start\??$/i,
  /^how does (it|this|that) work\??$/i,
  /^how does [a-z0-9_-]{2,12} work\??$/i,
  /^is it important\??$/i,
];

const genericAnswerPhrases = [
  "重要です",
  "大切です",
  "効果的です",
  "さまざま",
  "理解しておきましょう",
  "状況に応じて",
  "確認することが重要です",
  "it is important",
  "it depends",
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
];

const stopWords = new Set([
  "aio",
  "seo",
  "ai",
  "article",
  "content",
  "theme",
  "keyword",
  "keywords",
  "reader",
  "intent",
  "reference",
  "competitor",
  "company",
  "support",
  "質問",
  "回答",
  "記事",
  "情報",
  "参照",
  "競合",
  "重要",
  "確認",
  "活用",
  "方法",
  "場合",
]);

export function evaluateFaqQuality({
  faqItems,
  themeText = "",
  primaryInfo = "",
  referenceTexts = [],
  competitorTexts = [],
}: FaqQualityInput): ArticleQualityEvaluation {
  const normalizedItems = faqItems
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question || item.answer);
  const faqText = normalizedItems
    .map((item) => `${item.question} ${item.answer}`)
    .join(" ");
  const genericQuestionCount = normalizedItems.filter((item) =>
    isGenericQuestion(item.question),
  ).length;
  const weakAnswerCount = normalizedItems.filter((item) => !hasSpecificAnswer(item.answer)).length;
  const genericAnswerCount = countGenericAnswerPhrases(faqText);
  const inputTerms = extractSignalTerms([
    themeText,
    primaryInfo,
    ...referenceTexts,
    ...competitorTexts,
  ]);
  const inputHitCount = inputTerms.filter((term) => termAppearsInText(term, faqText)).length;
  const shouldCheckInputReflection = inputTerms.length >= 2;
  const requiredInputHits = Math.min(3, Math.max(1, inputTerms.length));
  const hasInputReflection = !shouldCheckInputReflection || inputHitCount >= requiredInputHits;

  const checks = [
    {
      id: "faq-count",
      label: "FAQ件数",
      passed: normalizedItems.length >= 3,
      detail:
        normalizedItems.length >= 3
          ? "FAQが3件以上あり、読後の疑問に答える量があります。"
          : "FAQは3件以上あると、読者の不安・比較・次の行動に答えやすくなります。",
    },
    {
      id: "faq-question-specificity",
      label: "FAQ質問の具体性",
      passed: genericQuestionCount === 0,
      detail:
        genericQuestionCount === 0
          ? "FAQの質問は汎用的なラベルではなく、読者の実務判断に近い問いになっています。"
          : "FAQに汎用的な質問があります。入力テーマ、一次情報、競合差分に基づく具体的な問いへ直してください。",
    },
    {
      id: "faq-answer-specificity",
      label: "FAQ回答の実務具体性",
      passed: weakAnswerCount === 0 && genericAnswerCount <= 1,
      detail:
        weakAnswerCount === 0 && genericAnswerCount <= 1
          ? "FAQ回答に判断基準、条件、例、注意点などの実務情報があります。"
          : "FAQ回答が一般論寄りです。判断基準、条件、失敗例、費用・期間・体制、参照元への注意を1つ以上入れてください。",
    },
    ...(shouldCheckInputReflection
      ? [
          {
            id: "faq-input-reflection",
            label: "FAQへの入力情報反映",
            passed: hasInputReflection,
            detail: hasInputReflection
              ? "FAQにもテーマ・一次情報・参照/競合情報の固有語彙が反映されています。"
              : `FAQに入力情報の固有語彙（${inputTerms.slice(0, 5).join("、")}）を戻すと、どの記事にもあるQ&Aから抜け出せます。`,
          },
        ]
      : []),
  ];
  const failed = checks.filter((check) => !check.passed);
  const score = Math.max(
    0,
    100 - failed.length * 12 - genericQuestionCount * 5 - weakAnswerCount * 4,
  );

  return {
    score,
    checks,
    strengths: checks.filter((check) => check.passed).map((check) => check.label),
    improvements: failed.map((check) => check.detail),
  };
}

function isGenericQuestion(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return true;
  }

  return genericQuestionPatterns.some((pattern) => pattern.test(normalized));
}

const operationalAnswerSpecificityPattern =
  /(管理者教育|利用ログ|業務成果物|承認フロー|申請先|承認者|決裁者|理解度|継続判断|同席|月次処理|初回利用|権限変更|社内説明|問い合わせ件数)/;

function hasSpecificAnswer(answer: string) {
  const normalized = answer.replace(/\s+/g, " ").trim();
  if (Array.from(normalized).length < 35) {
    return false;
  }

  return (
    /[0-9０-９]/.test(normalized) ||
    operationalAnswerSpecificityPattern.test(normalized) ||
    /(例|現場|相談|判断|条件|注意|失敗|費用|期間|担当|体制|参照|出典|未確認|比較|差分|リスク|line|forms?|cost|team|timeline|source|risk|example|condition|case|field|client)/i.test(
      normalized,
    )
  );
}

function countGenericAnswerPhrases(text: string) {
  const normalized = text.toLowerCase();
  return genericAnswerPhrases.filter((phrase) => normalized.includes(phrase.toLowerCase())).length;
}

function extractSignalTerms(values: string[]) {
  return uniqueItems(
    values
      .join(" ")
      .slice(0, 9000)
      .split(/[、。・\s,.;:()[\]「」『』【】/]+|について|とは|から|まで|より|として|には|では|を|に|で|と|の|へ/g)
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

  return Array.from({ length: Math.max(0, term.length - 3) }, (_, index) =>
    text.includes(term.slice(index, index + 4)),
  ).some(Boolean);
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}
