import { describe, expect, test } from "vitest";
import { buildDraftArticleHtml } from "@/lib/draft-html";
import { evaluateArticleQuality } from "@/lib/article-quality";
import { evaluatePublicationReadiness } from "@/lib/publication-quality";
import { articleFormSchema } from "@/lib/server/article-form-schema";
import { buildPresentationInstruction, resolveArticleStructure } from "@/lib/article-presentation";
import { evaluateFaqQuality } from "@/lib/faq-quality";
import { createSampleDraft, sampleFormPayload } from "../fixtures/article";

const scopedEvidence = "デルタのファクタリング相談では希望日の5営業日前に相談してください。融資全般の所要期間ではありません。";

describe("November 11 article presentation requirements", () => {
  test.each(["auto", "on", "none"] as const)("FAQ absence follows %s rather than a forced count", (mode) => {
    const result = evaluateFaqQuality({ faqItems: [], supplementalFaqMode: mode });
    expect(result.score === 100).toBe(mode !== "on");
    expect(buildPresentationInstruction({ supplementalFaqMode: mode })).toContain("Supplemental FAQ:");
  });

  test("automatic structure uses the dedicated brief before the theme and feeds evaluation", () => {
    expect(resolveArticleStructure({ theme: "ケース型", structureInstruction: "比較型" })).toBe("comparison");
    expect(resolveArticleStructure({ articleStructure: "faq", theme: "比較型" })).toBe("faq");
    const quality = evaluateArticleQuality("<h2>費用を比較する</h2><p>条件により選びます。</p><h2>必要書類を比較する</h2><p>場合によって選択します。</p>", { articleStructure: "auto", themeText: "比較型でお願いします。" });
    expect(quality.checks.find((check) => check.id === "article-structure-comparison")?.passed).toBe(true);
  });

  test("automatic structure ignores explicitly negated formats", () => {
    expect(resolveArticleStructure({ structureInstruction: "比較型ではなくFAQ型にしてください" })).toBe("faq");
    expect(resolveArticleStructure({ theme: "課題解決型を避け、ケース型で" })).toBe("case");
    expect(resolveArticleStructure({ structureInstruction: "FAQ型にしない" })).toBe("auto");
  });

  test("supplemental questions cannot establish new FAQ or comparison structure", () => {
    const html = buildDraftArticleHtml(createSampleDraft({
      editedBodyHtml: "<h2>概要</h2><p>条件で判断します。</p>",
      faqItems: [{ question: "費用は？", answer: "個別条件次第です。" }, { question: "必要書類は？", answer: "契約前に確認します。" }, { question: "返済負担は？", answer: "比較して選びます。" }],
    }));
    for (const articleStructure of ["faq", "comparison"] as const) {
      const check = evaluateArticleQuality(html, { articleStructure, supplementalFaqMode: "on" }).checks.find((item) => item.id === `article-structure-${articleStructure}`);
      expect(check?.passed).toBe(false);
    }
    expect(evaluateArticleQuality(html, { articleStructure: "faq" }).checks.find((item) => item.id === "article-structure-faq")?.passed).toBe(true);
  });

  test("a table alone is not a comparison article and a closing FAQ is not a Q&A article", () => {
    expect(evaluateArticleQuality("<h2>概要</h2><table><tr><td>比較</td></tr></table>", { articleStructure: "comparison" }).checks.find((check) => check.id === "article-structure-comparison")?.passed).toBe(false);
    const body = "<h2>説明</h2><p>解説。</p><h2>概要</h2><p>解説。</p><h2>詳細</h2>";
    const html = buildDraftArticleHtml(createSampleDraft({ editedBodyHtml: body }));
    expect(evaluateArticleQuality(html, { articleStructure: "faq" }).checks.find((check) => check.id === "article-structure-faq")?.passed).toBe(false);
  });

  test("problem-solution checks the order of the five stages", () => {
    const stages = ["資金不足の問題", "入金遅れの原因", "選べる対処方法", "返済原資の判断基準", "相談前に取る行動"];
    const render = (headings: string[]) => headings.map((text) => `<h2>${text}</h2><p>個別条件を確認します。</p>`).join("");
    const check = (html: string) => evaluateArticleQuality(html, { articleStructure: "problem_solution" }).checks.find((item) => item.id === "article-structure-problem-solution")?.passed;
    expect(check(render(stages))).toBe(true);
    expect(check(render([...stages].reverse()))).toBe(false);
  });

  test("case planning follows one scenario throughout rather than appending an example", () => {
    const plan = buildPresentationInstruction({ articleStructure: "case" });
    expect(plan).toContain("ONE concrete scenario throughout");
    expect(plan).toContain("not a generic comparison article with one example added");
    expect(plan).toContain("hypothetical");
  });

  test("checks standalone summaries and takeaways even when the body is correctly scoped", () => {
    const readiness = evaluateArticleQuality(`<p>${scopedEvidence}</p>`, {
      primaryInfo: scopedEvidence,
      additionalPublicationTexts: ["資金調達は5営業日前に相談する。"],
    }).publicationReadiness;
    expect(readiness?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: "condition-generalization" })]));
  });
  test.each(["comparison", "problem_solution"])("accepts %s without dropping options", (articleStructure) => {
    const input = { ...sampleFormPayload, articleStructure, tableMode: "none", supplementalFaqMode: "auto", structureInstruction: "比較軸は必要書類と返済負担" };
    expect(articleFormSchema.parse(input)).toMatchObject(input);
  });

  test("none removes tables and supplemental FAQ, but keeps Q&A body and source links across restore", () => {
    const draft = createSampleDraft({
      inputPayload: { ...sampleFormPayload, articleStructure: "faq", tableMode: "none", supplementalFaqMode: "none" },
      editedBodyHtml: '<h2>融資はどの条件で選びますか？</h2><p>返済原資を確認します。</p><table><tr><th>方法</th><th>条件</th></tr><tr><td>融資</td><td><a href="https://example.com/terms">返済原資</a></td></tr></table><section class="aio-faq-block"><h2>FAQ</h2><h3>旧補足ですか？</h3><p>旧回答</p></section>',
      faqItems: [{ question: "補足の相談先は？", answer: "担当窓口へ確認してください。" }],
    });
    const html = buildDraftArticleHtml(draft);
    expect(html).not.toMatch(/<table|aio-faq-block|補足の相談先|旧補足/);
    expect(html).toContain("融資はどの条件で選びますか？");
    expect(html).toContain('href="https://example.com/terms"');
    expect(buildDraftArticleHtml(JSON.parse(JSON.stringify({ ...draft, editedBodyHtml: html })))).toBe(html);
  });

  test("body Q&A wins over a supplemental duplicate without losing edited answers", () => {
    const html = buildDraftArticleHtml(createSampleDraft({
      inputPayload: { ...sampleFormPayload, articleStructure: "faq", supplementalFaqMode: "on" },
      editedBodyHtml: "<h2>必要書類は？</h2><p>編集者が確定した本文回答。</p>",
      faqItems: [{ question: "必要書類は?", answer: "別の古い補足回答。" }, { question: "相談方法は？", answer: "問い合わせ窓口へ。" }],
    }));
    expect(html.match(/必要書類は/g)).toHaveLength(1);
    expect(html).toContain("編集者が確定した本文回答。");
    expect(html).not.toContain("別の古い補足回答");
    expect(html).toContain("相談方法は？");
  });

  test("a replaced generic FAQ section does not suppress the canonical supplemental answer", () => {
    const draft = createSampleDraft({
      inputPayload: { ...sampleFormPayload, supplementalFaqMode: "on" },
      editedBodyHtml: "<h2>概要</h2><p>必要書類を確認します。</p><h2>FAQ</h2><h3>相談方法は？</h3><p>古い回答。</p>",
      faqItems: [{ question: "相談方法は？", answer: "編集者が確定した補足回答。" }],
    });
    const html = buildDraftArticleHtml(draft);
    expect(html.match(/相談方法は/g)).toHaveLength(1);
    expect(html).toContain("編集者が確定した補足回答。");
    expect(html).not.toContain("古い回答。");
    expect(buildDraftArticleHtml({ ...draft, editedBodyHtml: html })).toBe(html);
  });

  test("preserves editor-added questions that have no supplemental counterpart", () => {
    const draft = createSampleDraft({
      inputPayload: { ...sampleFormPayload, supplementalFaqMode: "auto" },
      editedBodyHtml: "<h2>FAQ</h2><h3>編集者だけが追加した質問ですか？</h3><p>編集済みの固有回答。</p>",
      faqItems: [],
    });
    expect(buildDraftArticleHtml(draft)).toContain("編集済みの固有回答。");
  });

  test("FAQ-type main body remains when the editor groups questions under Q&A", () => {
    const draft = createSampleDraft({
      inputPayload: { ...sampleFormPayload, articleStructure: "faq", supplementalFaqMode: "none" },
      editedBodyHtml: "<h2>Q&A</h2><h3>編集した本文質問ですか？</h3><p>主本文の回答は残します。</p>",
      faqItems: [],
    });
    expect(buildDraftArticleHtml(draft)).toContain("主本文の回答は残します。");
    expect(buildDraftArticleHtml(draft)).not.toContain("aio-faq-block");
  });

  test("non-FAQ articles preserve unmatched editor Q&A even with supplemental FAQ disabled", () => {
    const draft = createSampleDraft({
      inputPayload: { ...sampleFormPayload, articleStructure: "comparison", supplementalFaqMode: "none" },
      editedBodyHtml: "<h2>質問と回答</h2><h3>必要書類は？</h3><p>編集者が確定した本文回答。</p><section class=\"aio-faq-block\"><h2>FAQ</h2><p>旧補足回答。</p></section>",
      faqItems: [],
    });
    const html = buildDraftArticleHtml(draft);
    expect(html).toContain("編集者が確定した本文回答。");
    expect(html).not.toMatch(/aio-faq-block|旧補足回答/);
    expect(buildDraftArticleHtml({ ...draft, editedBodyHtml: html })).toBe(html);
  });

  test("table-to-prose keeps a valid row context with cell blocks and inline links", () => {
    const draft = createSampleDraft({
      inputPayload: { ...sampleFormPayload, tableMode: "none", supplementalFaqMode: "none" },
      editedBodyHtml: '<table><tr><td><p>デルタの<a href="https://example.com/terms">ファクタリング相談</a></p></td><td><div><p>希望日の5営業日前に相談</p></div></td></tr></table>',
      faqItems: [],
    });
    const html = buildDraftArticleHtml(draft);
    expect(html).not.toContain("<table");
    expect(html).toContain('href="https://example.com/terms"');
    expect(evaluatePublicationReadiness(html, { evidenceTexts: [scopedEvidence] }).issues).toEqual([]);
    expect(buildDraftArticleHtml({ ...draft, editedBodyHtml: html })).toBe(html);
  });

  test.each(["auto", "none"] as const)("%s does not penalize missing tables or supplemental FAQ", (mode) => {
    const quality = evaluateArticleQuality("<h2>必要時期を確認する</h2><p>返済原資を整理します。</p><ul><li>書類を確認する</li></ul>", { tableMode: mode, supplementalFaqMode: mode });
    expect(quality.checks.filter((check) => ["comparison-table", "structured-elements"].includes(check.id)).every((check) => check.passed)).toBe(true);
  });

  test.each([
    "入力元には省略区間があるため、詳細は要確認です。",
    "入力情報には具体的な料率の根拠がないため、要確認です。",
    "競合記事では相談先の種類を広く挙げていますが、条件を比べてください。",
  ])("flags internal production wording: %s", (text) => {
    expect(evaluatePublicationReadiness(`<p>${text}</p>`).issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: "internal-process-note" })]));
  });

  test.each([
    "<p>資金調達は希望日の5営業日前に相談します。</p>",
    "<ul><li>デルタでは資金調達全般を希望日の約5営業日前に相談します。</li></ul>",
    "<table><tr><th>相談時期</th></tr><tr><td>希望日の5営業日前</td></tr></table>",
    "<h3>いつ相談しますか？</h3><p>希望日の5営業日前です。</p>",
  ])("detects lost scope in every published surface: %s", (html) => {
    expect(evaluatePublicationReadiness(html, { evidenceTexts: [scopedEvidence] }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ id: "condition-generalization" })]));
  });

  test("does not borrow scope from a different block", () => {
    const html = "<p>デルタのファクタリング相談について</p><h2>資金調達全般の目安</h2><p>希望日の5営業日前</p>";
    expect(evaluatePublicationReadiness(html, { evidenceTexts: [scopedEvidence] }).publishReady).toBe(false);
  });

  test("keeps one row context when table cells contain block markup", () => {
    const html = "<table><tr><td><p>デルタのファクタリング相談</p></td><td><p>希望日の5営業日前に相談</p></td></tr></table>";
    expect(evaluatePublicationReadiness(html, { evidenceTexts: [scopedEvidence] }).issues).toEqual([]);
    const differentRows = "<table><tr><td><p>デルタのファクタリング相談</p></td></tr><tr><td><p>資金調達全般は5営業日前</p></td></tr></table>";
    expect(evaluatePublicationReadiness(differentRows, { evidenceTexts: [scopedEvidence] }).publishReady).toBe(false);
  });

  test("table-to-prose retains caption conditions and source links", () => {
    const draft = createSampleDraft({
      inputPayload: { ...sampleFormPayload, tableMode: "none", supplementalFaqMode: "none" },
      editedBodyHtml: '<table><caption>デルタのファクタリング相談に限る。<a href="https://example.com/conditions">適用条件</a></caption><tr><td>希望日の5営業日前</td></tr></table>',
    });
    const html = buildDraftArticleHtml(draft);
    expect(html).not.toContain("<table");
    expect(html).toContain("デルタのファクタリング相談に限る。");
    expect(html).toContain('href="https://example.com/conditions"');
    expect(html).toContain("希望日の5営業日前");
    expect(buildDraftArticleHtml({ ...draft, editedBodyHtml: html })).toBe(html);
  });

  test("accepts the original scoped claim and preserves legitimate source commentary", () => {
    const html = `<p>${scopedEvidence}</p><p>公表記事では相談先の種類を説明しています。</p>`;
    expect(evaluatePublicationReadiness(html, { evidenceTexts: [scopedEvidence] }).issues).toEqual([]);
    expect(buildDraftArticleHtml(createSampleDraft({ editedBodyHtml: html }))).toContain("公表記事では相談先の種類を説明しています。");
  });
});
