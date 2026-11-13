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

  test("accepts the original scoped claim and preserves legitimate source commentary", () => {
    const html = `<p>${scopedEvidence}</p><p>公表記事では相談先の種類を説明しています。</p>`;
    expect(evaluatePublicationReadiness(html, { evidenceTexts: [scopedEvidence] }).issues).toEqual([]);
    expect(buildDraftArticleHtml(createSampleDraft({ editedBodyHtml: html }))).toContain("公表記事では相談先の種類を説明しています。");
  });
});
