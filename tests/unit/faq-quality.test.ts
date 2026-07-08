import { describe, expect, test } from "vitest";
import { evaluateFaqQuality } from "@/lib/faq-quality";

describe("evaluateFaqQuality", () => {
  test("rewards FAQ items that answer concrete editorial and operational questions", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "一人親方の労災保険記事では、加入条件をどこまで断定できますか？",
          answer:
            "参照元で確認できる加入条件、給付基礎日額、補償開始日の3点に分けます。未確認の費用や対象範囲は断定せず、相談時に確認する条件として書きます。",
        },
        {
          question: "LINEで進む事務作業の一次情報はどう入れるべきですか？",
          answer:
            "当社の支援現場で多い相談傾向として扱います。LINEで承認が残り帳票が不足する例を、一般論ではなく確認漏れのリスクとして説明します。",
        },
        {
          question: "競合記事との差分はFAQでどう補えますか？",
          answer:
            "競合が料金表や加入手順に寄る場合、FAQでは担当者、期間、帳票確認、失敗例を補います。読者が次に確認する判断基準に変えるのが有効です。",
        },
      ],
      themeText: "一人親方 労災保険 加入条件 給付基礎日額 費用",
      primaryInfo: "支援現場ではLINEで承認が残り帳票が不足する相談が多い。",
      competitorTexts: ["競合は料金表と加入手順を強調している。"],
    });

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  test("flags generic FAQ questions and thin answers", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        { question: "メリットは何ですか？", answer: "重要です。" },
        { question: "注意点は何ですか？", answer: "状況に応じて確認することが重要です。" },
        { question: "What are the benefits?", answer: "It depends." },
      ],
      themeText: "一人親方 労災保険 加入条件 給付基礎日額 費用",
      primaryInfo: "支援現場ではLINEで承認が残り帳票が不足する相談が多い。",
    });

    expect(result.score).toBeLessThan(80);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-question-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-answer-specificity", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("汎用的な質問");
    expect(result.improvements.join(" ")).toContain("一般論寄り");
  });

  test("recognizes SaaS onboarding operational terms as practical FAQ specificity", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "初期設定が終わっていればオンボーディングは成功ですか？",
          answer:
            "成功判定には早いです。判断基準は、顧客管理者が権限変更や社内説明を自力で進められるかです。CSが設定を代行した場合ほど、管理者教育の確認を別日に置きます。",
        },
        {
          question: "3週目の利用定着は何を見ればよいですか？",
          answer:
            "3週目は当社支援で相談が増えやすい目安です。ログイン数だけでなく、顧客の業務成果物がSaaS内で作られたかを見ます。月次業務の商材では、初回の月次処理後にずらします。",
        },
        {
          question: "社内承認フローが曖昧な場合、CSはどこまで介入しますか？",
          answer:
            "CSが承認を代行するのではなく、申請先、承認者、想定期間、止まりやすい操作を顧客と可視化します。決裁者と管理者の認識が違う場合は、継続判断前に同席の場を作ります。",
        },
      ],
      themeText: "BtoB SaaS オンボーディング 管理者教育 利用定着 承認フロー",
      primaryInfo: "当社支援では初期設定後の3週目に利用が止まる相談が目立つ。",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-answer-specificity", passed: true }),
    );
  });

  test("flags short English FAQ questions that sound like commodity AI copy", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "What is AIO?",
          answer:
            "AIO article operations should separate source evidence, field observations, and unsupported claims before approval.",
        },
        {
          question: "What are the benefits of AIO?",
          answer:
            "Teams need a review timeline, approval owner, source checklist, and risk notes so the draft can be checked before publication.",
        },
        {
          question: "How does it work?",
          answer:
            "The practical workflow is to collect reference inputs, compare competitor gaps, add primary field notes, then verify the final FAQ and CTA.",
        },
      ],
      themeText: "AIO workflow for editorial review and AI search optimization",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-question-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-answer-specificity", passed: true }),
    );
    expect(result.score).toBeLessThan(90);
  });

  test("flags short Japanese FAQ questions that sound like commodity AI copy", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "AIOとは何ですか？",
          answer:
            "AIO記事では、参照元、一次情報、競合差分、承認担当を分けて整理し、公開前に未確認情報を断定しないよう確認します。",
        },
        {
          question: "AIOはなぜ重要ですか？",
          answer:
            "検索意図、出典URL、判断基準、FAQ、CTAを記事内で結び、読者が次に確認する条件を見落とさないようにするためです。",
        },
        {
          question: "AIOはどのように活用できますか？",
          answer:
            "テーマ候補、参照情報、一次情報、競合比較、WordPress下書き投稿までの流れを、担当者と期限つきで確認できます。",
        },
      ],
      themeText: "AIO workflow for editorial review and AI search optimization",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-question-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-answer-specificity", passed: true }),
    );
    expect(result.score).toBeLessThan(90);
  });

  test("flags long English FAQ answers that still rely on generic business filler", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "Which approval evidence should the editor keep before publishing?",
          answer:
            "AIO can help teams improve efficiency by organizing source evidence, review timelines, and team notes before publication.",
        },
        {
          question: "How should the team decide whether a claim is safe to publish?",
          answer:
            "Teams should consider source notes and client context because this recommended approach helps improve the overall workflow.",
        },
        {
          question: "Where should field observations appear in the final draft?",
          answer:
            "Primary field notes can help teams follow best practices, streamline reviews, enhance productivity, and leverage useful examples, but the answer still needs a condition, caveat, and source boundary.",
        },
      ],
      themeText: "AIO workflow for editorial review and AI search optimization",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-question-specificity", passed: true }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-answer-specificity", passed: false }),
    );
    expect(result.score).toBeLessThan(90);
  });

  test("flags FAQ items that ignore the provided input signals", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "公開前に何を確認しますか？",
          answer:
            "担当者、期間、費用、失敗例を確認し、未確認の内容は断定しないように整理します。",
        },
        {
          question: "読者の不安にはどう答えますか？",
          answer:
            "比較表と注意点を使い、次に確認する条件を明確にします。例外がある場合は本文で補足します。",
        },
        {
          question: "問い合わせ導線はどこに置きますか？",
          answer:
            "記事末尾に自然に置きます。本文で説明した判断基準とつなげ、相談前に準備する情報も示します。",
        },
      ],
      themeText: "一人親方 労災保険 加入条件 給付基礎日額 費用",
      primaryInfo: "支援現場ではLINEで承認が残り帳票が不足する相談が多い。",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-input-reflection", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("入力情報の固有語彙");
  });

  test("counts English input terms across natural FAQ separators", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "Which evidence should editors keep before publication?",
          answer:
            "Editors should keep form-based alpha evidence beside the source note so reviewers can trace the original field signal.",
        },
        {
          question: "How should approval teams compare the draft?",
          answer:
            "The team should compare beta timing, source status, and approval owner before publishing the FAQ.",
        },
        {
          question: "Where should the first-party observation appear?",
          answer:
            "Place the field example near the answer condition, then cite Source: https://example.com/reference for the supporting reference.",
        },
      ],
      primaryInfo: "form alpha beta",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-input-reflection", passed: true }),
    );
  });

  test("does not count English input terms inside underscore-joined FAQ tokens", () => {
    const result = evaluateFaqQuality({
      faqItems: [
        {
          question: "Which evidence should editors keep before publication?",
          answer:
            "Editors should keep platform_form alpha evidence beside the source note so reviewers can trace the technical label.",
        },
        {
          question: "How should approval teams compare the draft?",
          answer:
            "The team should compare beta timing, source status, and approval owner before publishing the FAQ.",
        },
        {
          question: "Where should the field observation appear?",
          answer:
            "Place the field example near the answer condition, then cite Source: https://example.com/reference for the supporting reference.",
        },
      ],
      primaryInfo: "form alpha beta",
    });

    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "faq-input-reflection", passed: false }),
    );
  });
});
