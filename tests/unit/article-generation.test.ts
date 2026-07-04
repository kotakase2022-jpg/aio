import { describe, expect, test, vi } from "vitest";
import { sampleArticleResult, sampleFormPayload } from "../fixtures/article";

vi.mock("@/lib/server/openai", () => ({
  createStructuredResponse: vi.fn(),
}));

describe("generateAioArticle", () => {
  test("sanitizes unsafe HTML and returns zero image prompts when imageCount is 0", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `${sampleArticleResult.body_html}<script>alert("x")</script>`,
      image_prompts: sampleArticleResult.image_prompts,
    });

    const result = await generateAioArticle({
      form: { ...sampleFormPayload, imageCount: 0 },
      fetchedReferences: [{ url: "https://example.com", text: "reference".repeat(500) }],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.body_html).not.toContain("<script>");
    expect(result.image_prompts).toEqual([]);
  });

  test("normalizes missing image prompts up to requested boundary count", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      image_prompts: [],
    });

    const result = await generateAioArticle({
      form: { ...sampleFormPayload, imageCount: 3 },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.image_prompts.map((prompt) => prompt.slot)).toEqual([
      "featured",
      "inline-1",
      "inline-2",
    ]);
    expect(result.image_prompts[0].prompt).toContain("premium Japanese B2B");
  });

  test("passes first-party primary information as a high-priority generation input", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    await generateAioArticle({
      form: {
        ...sampleFormPayload,
        primaryInfo:
          "Our support team often sees one-person contractors manage back-office work through LINE, leaving forms missing.",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: { form: { primaryInfo?: string } };
    };

    expect(call?.instructions).toContain("high-priority first-party information");
    expect(call?.instructions).toContain("Avoid commodity content");
    expect(call?.instructions).toContain("generic AI-like filler");
    expect(call?.instructions).toContain("human editor who has interviewed the business");
    expect(call?.instructions).toContain("absence of AI-like generic phrasing");
    expect(input.payload.form.primaryInfo).toContain("one-person contractors");
    expect(input.payload.form.primaryInfo).toContain("LINE");
  });

  test("caps self-evaluation when the generated body looks generic", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html:
        "<h2>重要なポイント</h2><p>近年、多くの企業で注目されています。さまざまな取り組みが重要です。重要です。</p>",
      aio_score_self_evaluation: {
        score: 98,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: sampleFormPayload,
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(90);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("凡庸表現");
  });
});
