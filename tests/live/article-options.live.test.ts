import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { deltaNov11Form } from "../fixtures/delta-nov11";
import { createSampleDraft } from "../fixtures/article";
import { cleanEnvValue, expectLiveContractEnabled, expectRequiredEnv, loadLiveEnv } from "./live-test-helpers";
import type { ArticleElementMode, ArticleStructure } from "@/types/aio";

const cases: Array<{ name: string; structure: ArticleStructure; table: ArticleElementMode; faq: ArticleElementMode; btoc?: boolean }> = [
  { name: "delta-comparison-on-on", structure: "comparison", table: "on", faq: "on" },
  { name: "delta-comparison-none-none", structure: "comparison", table: "none", faq: "none" },
  { name: "delta-comparison-auto-auto", structure: "comparison", table: "auto", faq: "auto" },
  { name: "delta-faq-none-none", structure: "faq", table: "none", faq: "none" },
  { name: "delta-problem-solution-auto-auto", structure: "problem_solution", table: "auto", faq: "auto" },
  { name: "delta-case-on-auto", structure: "case", table: "on", faq: "auto" },
  { name: "delta-textbook-auto-on", structure: "textbook", table: "auto", faq: "on" },
  { name: "btoc-faq-none-none", structure: "faq", table: "none", faq: "none", btoc: true },
];

describe("November 11 real model acceptance (no DB or WordPress writes)", () => {
  test.each(cases)("$name", async (sample) => {
    loadLiveEnv();
    expectLiveContractEnabled();
    expectRequiredEnv(["OPENAI_API_KEY"]);
    if (cleanEnvValue(process.env.OPENAI_LIVE_TEXT_MODEL)) process.env.OPENAI_TEXT_MODEL = cleanEnvValue(process.env.OPENAI_LIVE_TEXT_MODEL);
    vi.resetModules();
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const { getTextModel } = await import("@/lib/server/openai");
    const { buildDraftArticleHtml } = await import("@/lib/draft-html");
    const { evaluateArticleQuality } = await import("@/lib/article-quality");
    const form = { ...deltaNov11Form, articleStructure: sample.structure, tableMode: sample.table, supplementalFaqMode: sample.faq };
    if (sample.btoc) {
      form.audienceType = "btoc";
      form.theme = "犬猫の口のケアについて一般の飼い主の疑問に答える。歯磨きを嫌がる場合、口臭や食べ方の変化、動物病院への相談。";
      form.primaryInfo = "当院では歯磨きを嫌がる、口臭が気になるという相談があります。無理に続けず、食べ方と口を触られる反応を記録し獣医師に相談してもらいます。診断や治療効果を保証しません。";
      form.references = [{ id: "consumer-reference", text: form.primaryInfo }];
      form.competitors = [];
      form.closingText = "気になる変化が続く場合は獣医師へ相談してください。";
      form.structureInstruction = "専門用語を説明し、飼い主が無理なく判断できる質問順。";
    }
    const started = Date.now();
    const result = await generateAioArticle({ form, fetchedReferences: [], fetchedCompetitors: [] });
    const draft = createSampleDraft({ inputPayload: form, aiResult: result, editedTitle: result.selected_title, editedBodyHtml: result.body_html, editedMetaDescription: result.meta_description, faqItems: result.faq_items, images: [], author: {}, fetchedReferences: [], fetchedCompetitors: [] });
    const html = buildDraftArticleHtml(draft);
    const evaluation = evaluateArticleQuality(html, { ...form, themeText: form.theme, referenceTexts: form.references.map((item) => item.text ?? ""), competitorTexts: form.competitors.map((item) => item.text ?? ""), additionalPublicationTexts: [result.selected_title, result.meta_description, result.article_summary, ...result.key_takeaways] });
    const artifactDir = path.resolve(".verification-files/nov11-live");
    await mkdir(artifactDir, { recursive: true });
    const artifact = { sample: sample.name, generatedAt: new Date().toISOString(), elapsedMs: Date.now() - started, model: getTextModel(), form, result, evaluation, html };
    await writeFile(path.join(artifactDir, `${sample.name}.json`), JSON.stringify(artifact, null, 2));
    await writeFile(path.join(artifactDir, `${sample.name}.html`), html);
    expect(result.selected_title).toBeTruthy();
    expect(result.image_prompts).toEqual([]);
    if (sample.table === "none") expect(html).not.toMatch(/<table\b/);
    if (sample.table === "on") expect(html).toMatch(/<table\b/);
    if (sample.faq === "none") {
      expect(result.faq_items).toEqual([]);
      expect(html).not.toContain("aio-faq-block");
    }
    if (sample.faq === "on") expect(result.faq_items.length).toBeGreaterThan(0);
    const structureChecks = evaluation.checks.filter((check) => check.id.startsWith("article-structure-"));
    expect(structureChecks).toHaveLength(1);
    expect(structureChecks[0].passed, structureChecks[0].detail).toBe(true);
    expect(evaluation.publicationReadiness?.issues, sample.name).toEqual([]);
    expect(buildDraftArticleHtml({ ...draft, editedBodyHtml: html })).toBe(html);
    console.log(JSON.stringify({ sample: sample.name, model: artifact.model, elapsedMs: artifact.elapsedMs, structure: "PASS", publication: "PASS" }));
  }, 180_000);
});
