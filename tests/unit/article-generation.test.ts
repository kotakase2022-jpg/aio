import { beforeEach, describe, expect, test, vi } from "vitest";
import { sampleArticleResult, sampleFormPayload } from "../fixtures/article";

vi.mock("@/lib/server/openai", () => ({
  createStructuredResponse: vi.fn(),
}));

describe("generateAioArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  test("compacts uploaded files, fetched text, and invalid count inputs before model calls", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    await generateAioArticle({
      form: {
        ...sampleFormPayload,
        theme: "theme ".repeat(600),
        primaryInfo: "primary ".repeat(700),
        closingText: "closing ".repeat(300),
        regenerationInstruction: "regenerate ".repeat(300),
        visualTone: {
          mode: "upload",
          uploadedImageUrl: "https://example.com/tone.png",
        },
        author: {
          ...sampleFormPayload.author,
          bio: "bio ".repeat(400),
          imageUrl: "https://example.com/author.png",
        },
        referenceFiles: Array.from({ length: 10 }, (_, index) => ({
          name: `reference-${index}.pdf`,
          type: "application/pdf",
          ok: true,
          text: `reference file ${index} `.repeat(400),
        })),
        competitorFiles: Array.from({ length: 10 }, (_, index) => ({
          name: `competitor-${index}.docx`,
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ok: false,
          error: `competitor file error ${index} `.repeat(40),
        })),
        imageCount: 99,
        wordCount: 9999,
      },
      fetchedReferences: Array.from({ length: 10 }, (_, index) => ({
        url: `https://example.com/reference-${index}`,
        text: `fetched reference ${index} `.repeat(500),
        reason: `long reason ${index} `.repeat(50),
      })),
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: {
        form: {
          theme: string;
          primaryInfo: string;
          closingText: string;
          regenerationInstruction: string;
          visualTone: { uploadedImageUrl?: string };
          author: { bio: string; imageUrl?: string };
          referenceFiles: Array<{ text?: string }>;
          competitorFiles: Array<{ error?: string }>;
          imageCount: number;
          wordCount: number;
        };
        fetchedReferences: Array<{ text?: string; reason?: string }>;
      };
    };

    expect(input.payload.form.theme.length).toBeLessThanOrEqual(1813);
    expect(input.payload.form.theme).toContain("[truncated]");
    expect(input.payload.form.primaryInfo.length).toBeLessThanOrEqual(2413);
    expect(input.payload.form.closingText.length).toBeLessThanOrEqual(1013);
    expect(input.payload.form.regenerationInstruction.length).toBeLessThanOrEqual(1213);
    expect(input.payload.form.visualTone.uploadedImageUrl).toBe("[uploaded image]");
    expect(input.payload.form.author.bio.length).toBeLessThanOrEqual(813);
    expect(input.payload.form.author.imageUrl).toBe("[uploaded author image]");
    expect(input.payload.form.referenceFiles).toHaveLength(8);
    expect(input.payload.form.referenceFiles[0].text?.length).toBeLessThanOrEqual(2213);
    expect(input.payload.form.competitorFiles).toHaveLength(8);
    expect(input.payload.form.competitorFiles[0].error?.length).toBeLessThanOrEqual(233);
    expect(input.payload.fetchedReferences).toHaveLength(8);
    expect(input.payload.fetchedReferences[0].text?.length).toBeLessThanOrEqual(3013);
    expect(input.payload.fetchedReferences[0].reason?.length).toBeLessThanOrEqual(313);
    expect(input.payload.form.imageCount).toBe(2);
    expect(input.payload.form.wordCount).toBe(3000);
  });

  test("keeps word count, image count, and anti-commodity requirements explicit", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    await generateAioArticle({
      form: { ...sampleFormPayload, imageCount: 3, wordCount: 5000 },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: { form: { imageCount: number; wordCount: number } };
    };

    expect(call?.instructions).toContain("first 400 Japanese characters answer-first");
    expect(call?.instructions).toContain("at least three different types of editorial evidence");
    expect(call?.instructions).toContain("Avoid generic H2/H3 labels");
    expect(call?.instructions).toContain("Make title candidates specific and editorial");
    expect(call?.instructions).toContain("Do not use vague heading patterns");
    expect(call?.instructions).toContain("Avoid thin H2/H3 sections");
    expect(call?.instructions).toContain("at least two concrete signals");
    expect(call?.instructions).toContain("concrete reader decision");
    expect(call?.instructions).toContain("Treat payload.form.theme as the editorial brief");
    expect(call?.instructions).toContain("comparison axes");
    expect(call?.instructions).toContain("Do not merely summarize competitors");
    expect(call?.instructions).toContain("Do not state uncertain facts as facts");
    expect(call?.instructions).toContain("Respect payload.form.wordCount");
    expect(call?.instructions).toContain("Respect payload.form.imageCount");
    expect(call?.instructions).toContain("Return zero image_prompts when imageCount is 0");
    expect(call?.instructions).toContain("Do not start many consecutive sentences");
    expect(call?.instructions).toContain("Avoid verbose AI-like predicates");
    expect(input.payload.form.imageCount).toBe(3);
    expect(input.payload.form.wordCount).toBe(5000);
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

  test("caps self-evaluation when generated titles are generic", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      selected_title: "重要なポイント",
      title_candidates: ["重要なポイント", "概要", "まとめ"],
      aio_score_self_evaluation: {
        score: 99,
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

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "タイトルが汎用的です",
    );
  });

  test("caps self-evaluation when title candidates ignore the input theme signals", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      selected_title: "AIO workflow design checklist",
      title_candidates: [
        "AIO workflow design checklist",
        "Editorial review checklist",
        "AI search article operations",
      ],
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        theme: "一人親方の労災保険。キーワード: 加入条件、給付基礎日額、費用",
        primaryInfo:
          "当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く、帳票不在も多い。",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "タイトル候補に入力テーマ/一次情報の固有語彙",
    );
  });

  test("caps self-evaluation when the generated body ignores provided primary information", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。当社の支援現場では、3名体制で公開前の確認手順を決める相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        primaryInfo:
          "当社の支援現場では、一人親方の事務作業はLINEでのやり取りが多く帳票不在も多い。",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "一次情報の固有語彙",
    );
  });

  test("caps self-evaluation when the generated body ignores provided closing CTA", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。当社の支援現場では、3名体制で公開前の確認手順を決める相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        closingText:
          "AIO記事の運用設計について無料相談をご希望の方は、問い合わせフォームからご相談ください。",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "結び文章/CTAの固有語彙",
    );
  });

  test("caps self-evaluation when the generated body ignores provided theme and keywords", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。当社の支援現場では、3名体制で公開前の確認手順を決める相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        theme:
          "一人親方の労災保険。キーワード: 加入条件、給付基礎日額、費用。想定読者: 建設業の一人親方。",
        primaryInfo: "",
        closingText: "",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "テーマ・キーワードの固有語彙",
    );
  });

  test("caps self-evaluation when the generated body ignores fetched reference information", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。当社の支援現場では、3名体制で公開前の確認手順を決める相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        primaryInfo: "",
        closingText: "",
      },
      fetchedReferences: [
        {
          url: "https://example.com/reference",
          text: "厚生労働省の一人親方労災保険では、特別加入、給付基礎日額、労働保険事務組合、補償開始日を確認する必要がある。",
        },
      ],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "参照情報の固有語彙",
    );
  });

  test("caps self-evaluation when the generated body ignores competitor research", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、AI検索で引用されやすい構造を持つ記事を指します</h2>
        <p>結論として、記事には定義と判断基準を入れる必要があります。当社の支援現場では、3名体制で公開前の確認手順を決める相談があります。</p>
        <table><tr><th>判断基準</th><td>担当、期間、費用を比較します。</td></tr></table>
        <ul><li>失敗例を確認します。</li><li>注意点を整理します。</li></ul>
        <h2>公開前に確認すべき情報の分け方</h2>
        <p>FAQとして、参照元と照合し、未確認情報は断定しません。</p>
        <p>出典: https://example.com/reference</p>
      `,
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        primaryInfo: "",
        closingText: "",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: {
        summary: "競合記事は料金表、導入期間、補助金申請を前面に出している。",
        insights: [
          {
            url: "https://example.com/competitor",
            title: "競合LP",
            majorPoints: ["料金表", "導入期間", "補助金申請"],
            differentiationPoints: ["運用定着", "承認フロー"],
            recommendations: ["比較軸として運用定着と承認フローの失敗例を入れる"],
          },
        ],
      },
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "競合情報の固有語彙",
    );
  });
});
