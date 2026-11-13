import * as cheerio from "cheerio";
import { normalizeFaqQuestion } from "@/lib/draft-html";
import { canonicalSourceUrlKey, normalizeSourceUrl } from "@/lib/source-url";

export type PublicationIssueSeverity = "blocker" | "warning";

export type PublicationIssue = {
  id:
    | "duplicate-faq"
    | "mojibake"
    | "unsupported-numeric-claim"
    | "condition-generalization"
    | "broken-link"
    | "missing-source-link"
    | "duplicate-source-link"
    | "internal-process-note";
  severity: PublicationIssueSeverity;
  label: string;
  detail: string;
};

export type PublicationReadiness = {
  publishReady: boolean;
  issues: PublicationIssue[];
};

export type PublicationQualityContext = {
  evidenceTexts?: string[];
  requiredSourceUrls?: string[];
  additionalTexts?: string[];
};

const internalProcessNotes = [
  "競合URLから本文を取得しました",
  "参照URLから本文を取得しました",
  "入力フォームの参照情報です",
  "入力フォームの競合情報です",
  "AI競合調査で参照した競合情報です",
];

const numericClaimPattern =
  /[0-9０-９][0-9０-９,，.．]*(?:\s*(?:%|％|割|倍|件|社|人|名|万円|円|営業時間|営業日|時間|週間|か月|ヶ月|日|年|ページ|本|個|回|文字)|(?:以上|以下|未満|以内|超|前後|程度|ほど))/g;

const scopedEvidencePattern =
  /(当社|弊社|自社|同社|特定|一部|支援(?:した|事例|記録|現場)|相談|ケース|事例|条件|場合|対象|のみ|に限|時点)/;
const sourceAttributionPattern =
  /(当社|弊社|自社|同社|特定|一部|支援(?:した|事例|記録|現場)|相談|ケース|事例|時点)/;
const articleAttributionPattern =
  /(当社|弊社|自社|同社|特定|一部|支援(?:した|事例|記録|現場)|相談|ケース|事例|時点)/;
const scopeQualifierStopWords = new Set([
  "当社",
  "弊社",
  "自社",
  "同社",
  "特定",
  "一部",
  "支援",
  "支援した",
  "支援記録",
  "支援現場",
  "相談",
  "ケース",
  "事例",
  "条件",
  "場合",
  "対象",
  "のみ",
  "時点",
  "目安",
  "確認",
  "できました",
  "あります",
  "ありました",
]);

export function evaluatePublicationReadiness(
  html: string,
  context: PublicationQualityContext = {},
): PublicationReadiness {
  const issues = [
    ...detectMojibake(html),
    ...detectInternalProcessNotes(html),
    ...detectDuplicateFaq(html),
    ...detectLinkIssues(html, context.requiredSourceUrls ?? []),
    ...detectNumericIssues(html, context.evidenceTexts ?? []),
    ...(context.additionalTexts ?? []).flatMap((text) => {
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return [...detectNumericIssues(`<p>${escaped}</p>`, context.evidenceTexts ?? []), ...detectInternalProcessNotes(`<p>${escaped}</p>`)];
    }),
  ];

  const uniqueIssues = Array.from(
    new Map(issues.map((issue) => [`${issue.id}:${issue.detail}`, issue])).values(),
  );

  return {
    publishReady: uniqueIssues.length === 0,
    issues: uniqueIssues,
  };
}

function detectMojibake(html: string): PublicationIssue[] {
  const text = visibleText(html);
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  const commonMojibake = /(?:譁�|蜿門|縺[\u0080-\uFFFF]|繧[\u0080-\uFFFF]|鬥[\u0080-\uFFFF])/.test(text);
  if (replacementCount === 0 && !commonMojibake) {
    return [];
  }

  return [
    {
      id: "mojibake",
      severity: "blocker",
      label: "文字化け",
      detail: "公開本文に文字化けの疑いがある文字列が残っています。取得元と原文を確認してください。",
    },
  ];
}

function detectInternalProcessNotes(html: string): PublicationIssue[] {
  const text = visibleText(html);
  const hits = internalProcessNotes.filter((note) => text.includes(note));
  const processPatterns = [
    /出典メモ[：:]\s*手動入力テキスト[（(]manual-text[）)]/g,
    /入力(?:元|情報|資料|データ|内容)[^。！？\n]{0,60}(?:省略|根拠がな|根拠はな|記載がな|記載されていな)/g,
    /競合記事では[^。！？\n]{0,100}(?:挙げていますが|紹介していますが|説明していますが|不足して|触れていな)/g,
    /\[入力短縮[^\]]*\]/g,
  ];
  for (const pattern of processPatterns) hits.push(...(text.match(pattern) ?? []));
  if (hits.length === 0) {
    return [];
  }

  return [
    {
      id: "internal-process-note",
      severity: "blocker",
      label: "制作過程の文言",
      detail: `読者向けではない内部メモが公開本文に残っています（${hits.join(" / ")}）。`,
    },
  ];
}

function detectDuplicateFaq(html: string): PublicationIssue[] {
  const $ = cheerio.load(html, null, false);
  const seen = new Set<string>();
  const duplicateQuestions: string[] = [];

  $("h2, h3, h4").each((_, element) => {
    const question = cleanText($(element).text());
    if (!looksLikeQuestion(question)) {
      return;
    }

    const key = normalizeFaqQuestion(question);
    if (!key) {
      return;
    }
    if (seen.has(key)) {
      duplicateQuestions.push(question);
    } else {
      seen.add(key);
    }
  });

  return duplicateQuestions.length > 0
    ? [
        {
          id: "duplicate-faq",
          severity: "blocker",
          label: "FAQ重複",
          detail: `同じ質問が複数回表示されています（${duplicateQuestions.slice(0, 3).join(" / ")}）。`,
        },
      ]
    : [];
}

function detectLinkIssues(html: string, requiredSourceUrls: string[]): PublicationIssue[] {
  const $ = cheerio.load(html, null, false);
  const issues: PublicationIssue[] = [];

  $("a").each((_, element) => {
    const href = ($(element).attr("href") ?? "").trim();
    if (!isPublishableHref(href)) {
      issues.push({
        id: "broken-link",
        severity: "blocker",
        label: "壊れたリンク",
        detail: `有効なリンク先がないリンクがあります（${cleanText($(element).text()) || "リンク文字列なし"}）。`,
      });
    }
  });

  const sourceKeys = new Set<string>();
  $(".aio-source-block a").each((_, element) => {
    const href = ($(element).attr("href") ?? "").trim();
    const key = canonicalSourceUrlKey(href);
    if (!key) {
      return;
    }
    if (sourceKeys.has(key)) {
      issues.push({
        id: "duplicate-source-link",
        severity: "warning",
        label: "出典リンク重複",
        detail: `参照元一覧に同じURLが重複しています（${href}）。`,
      });
    }
    sourceKeys.add(key);
  });

  const linkedSourceKeys = new Set(
    $("a[href]")
      .map((_, element) => canonicalSourceUrlKey(($(element).attr("href") ?? "").trim()))
      .get()
      .filter(Boolean),
  );
  // Manual/file provenance is evidence, but cannot require a public HTTP link.
  for (const sourceUrl of requiredSourceUrls.map(normalizeSourceUrl).filter(Boolean)) {
    const key = canonicalSourceUrlKey(sourceUrl);
    if (key && !linkedSourceKeys.has(key)) {
      issues.push({
        id: "missing-source-link",
        severity: "blocker",
        label: "出典リンク不足",
        detail: `記事で利用した出典URLが有効なリンク要素として残っていません（${sourceUrl}）。`,
      });
    }
  }

  return issues;
}

function detectNumericIssues(html: string, evidenceTexts: string[]): PublicationIssue[] {
  const $ = cheerio.load(html, null, false);
  $(".aio-source-block, .aio-author-block, script, style, noscript").remove();
  // Keep row context together, but never borrow a qualifier from a different
  // paragraph, FAQ answer or table row merely because markup has no whitespace.
  $("br").replaceWith("\n");
  $("tr").toArray().reverse().forEach((row) => {
    const rowText = $(row).children("th, td").map((_, cell) => cleanText($(cell).text())).get().join(" ");
    $(row).empty().append($("<td>").text(rowText));
  });
  $("p, li, tr, h1, h2, h3, h4, h5, h6, section, div").append("\n");
  $("th, td").append(" ");
  const articleText = $.root().text().replace(/https?:\/\/\S+/g, " ");
  const evidenceSentences = evidenceTexts.flatMap(extractSentences);
  const issues: PublicationIssue[] = [];

  for (const sentence of extractSentences(articleText)) {
    const claims = sentence.match(numericClaimPattern) ?? [];
    for (const claim of claims) {
      const normalizedClaim = normalizeNumericClaim(claim);
      const supportingSentences = evidenceSentences.filter((evidence) =>
        evidence.match(numericClaimPattern)?.some(
          (candidate) => normalizeNumericClaim(candidate) === normalizedClaim,
        ),
      );

      if (supportingSentences.length === 0) {
        issues.push({
          id: "unsupported-numeric-claim",
          severity: "blocker",
          label: "未裏付けの数値",
          detail: `「${claim}」は入力された根拠内で確認できません。「約」「目安」だけでは裏付けにならないため、出典確認または要確認表記が必要です。`,
        });
        continue;
      }

      const hasScopeCompatibleEvidence = supportingSentences.some(
        (evidence) =>
          !scopedEvidencePattern.test(evidence) || preservesEvidenceScope(sentence, evidence, claim),
      );
      if (!hasScopeCompatibleEvidence) {
        issues.push({
          id: "condition-generalization",
          severity: "blocker",
          label: "条件の一般化",
          detail: `「${claim}」の根拠には会社・事例・条件の限定がありますが、本文では一般的な基準として読めます。`,
        });
      }
    }
  }

  return issues;
}

function preservesEvidenceScope(articleSentence: string, evidenceSentence: string, claim: string) {
  const scopedSubject = evidenceSentence.match(/^(.{2,100}?)(?:では|に限(?:り|る|って|定))/)?.[1];
  if (scopedSubject) {
    const anchors = scopedSubject.split(/の|で|は|に|、|\s/)
      .map((term) => term.replace(/(?:への)?相談$|支援$|事例$/g, ""))
      .filter((term) => term.length >= 2 && !scopeQualifierStopWords.has(term) && !/\p{Script=Hiragana}/u.test(term));
    if (anchors.length && !anchors.every((term) => articleSentence.normalize("NFKC").includes(term.normalize("NFKC")))) return false;
  }
  const exclusiveSubjects = exclusiveScopeSubjects(evidenceSentence);
  const articleExclusiveSubjects = new Set(exclusiveScopeSubjects(articleSentence));
  if (exclusiveSubjects.some((subject) => !articleExclusiveSubjects.has(subject))) {
    return false;
  }
  if (
    sourceAttributionPattern.test(evidenceSentence) &&
    !articleAttributionPattern.test(articleSentence)
  ) {
    return false;
  }

  const qualifiers = extractScopeQualifiers(evidenceSentence, claim);
  if (qualifiers.length === 0) {
    return true;
  }

  const normalizedArticle = articleSentence.normalize("NFKC").replace(/\s+/g, "");
  return qualifiers.some((qualifier) => normalizedArticle.includes(qualifier));
}

function exclusiveScopeSubjects(value: string) {
  // Match explicit noun restrictions, not arbitrary paraphrases or sentence meaning.
  return Array.from(
    value.normalize("NFKC").matchAll(/([\p{Script=Han}\p{Script=Katakana}A-Za-z0-9_-]+)\s*(?:のみ|に限(?:り|る|って|定))/gu),
    (match) => match[1],
  );
}

function extractScopeQualifiers(value: string, claim: string) {
  const withoutClaim = value
    .normalize("NFKC")
    .replace(claim.normalize("NFKC"), " ");
  return Array.from(
    new Set(
      withoutClaim
        .split(
          /[、。,.・\s（）()「」『』【】\[\]\/]+|では|には|から|まで|より|として|について|は|が|を|に|で|と|の|も|へ/g,
        )
        .map((term) => term.trim())
        .filter((term) => term.length >= 3)
        .filter((term) => !scopeQualifierStopWords.has(term))
        .filter((term) => !(term.match(numericClaimPattern)?.length)),
    ),
  ).slice(0, 8);
}

function visibleText(html: string) {
  const $ = cheerio.load(html, null, false);
  $("script, style, noscript").remove();
  return cleanText($.root().text());
}

function extractSentences(value: string) {
  return value
    .split(/[。!！？?\n]+|(?<![0-9０-９])[.．]|[.．](?![0-9０-９])/)
    .map(cleanText)
    .filter(Boolean);
}

function normalizeNumericClaim(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s,，]/g, "")
    .toLowerCase();
}

function looksLikeQuestion(value: string) {
  return /[?？]$/.test(value) || /(?:ですか|ますか|でしょうか|できますか|なりますか)[?？。]?$/.test(value);
}

function isPublishableHref(value: string) {
  if (/^(?:mailto:|tel:)/i.test(value)) {
    return true;
  }
  if (value.startsWith("/") && !/[\/\\]/.test(value.charAt(1))) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
