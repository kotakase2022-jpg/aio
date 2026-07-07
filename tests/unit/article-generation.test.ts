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
    expect(result.image_prompts[0].prompt).toContain("Article summary anchor");
    expect(result.image_prompts[0].prompt).toContain(sampleArticleResult.article_summary);
    expect(result.image_prompts[0].prompt).toContain("Key takeaways to visualize");
    expect(result.image_prompts[0].prompt).toContain("Relevant headings");
  });

  test("passes first-party primary information as a high-priority generation input", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    await generateAioArticle({
      form: {
        ...sampleFormPayload,
        primaryInfo:
          "  Our support team often sees one-person contractors manage back-office work through LINE, leaving forms missing.  ",
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
    expect(call?.instructions).toContain("重要になります");
    expect(call?.instructions).toContain("求められます");
    expect(call?.instructions).toContain("欠かせません");
    expect(call?.instructions).toContain("わかりやすく解説");
    expect(call?.instructions).toContain("詳しく解説");
    expect(call?.instructions).toContain("を紹介します");
    expect(call?.instructions).toContain("in this article");
    expect(call?.instructions).toContain("this article explains");
    expect(call?.instructions).toContain("it is important to");
    expect(call?.instructions).toContain("various");
    expect(call?.instructions).toContain("many companies");
    expect(call?.instructions).toContain("can help");
    expect(call?.instructions).toContain("improve efficiency");
    expect(call?.instructions).toContain("should consider");
    expect(call?.instructions).toContain("best practices");
    expect(call?.instructions).toContain("streamline");
    expect(call?.instructions).toContain("enhance productivity");
    expect(call?.instructions).toContain("leverage");
    expect(call?.instructions).toContain("today's fast-paced digital landscape");
    expect(call?.instructions).toContain("ever-evolving landscape");
    expect(call?.instructions).toContain("unlock the potential");
    expect(call?.instructions).toContain("empower businesses");
    expect(call?.instructions).toContain("run one silent editorial self-review");
    expect(call?.instructions).toContain("selected_title, body_html, headings, faq_items");
    expect(call?.instructions).toContain("lacks first-party/source evidence");
    expect(call?.instructions).toContain("revise that part before final output");
    expect(call?.instructions).toContain("human editor who has interviewed the business");
    expect(call?.instructions).toContain("Do not paste long reference or competitor passages");
    expect(call?.instructions).toContain("Do not paste primaryInfo verbatim");
    expect(call?.instructions).toContain("absence of AI-like generic phrasing");
    expect(input.payload.form.primaryInfo?.startsWith(" ")).toBe(false);
    expect(input.payload.form.primaryInfo).toContain("one-person contractors");
    expect(input.payload.form.primaryInfo).toContain("LINE");
  });

  test("treats whitespace-only primary information as missing before article generation", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    await generateAioArticle({
      form: {
        ...sampleFormPayload,
        primaryInfo: " \n\t ",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: { form: { primaryInfo?: string } };
    };

    expect(input.payload.form.primaryInfo).toBe("");
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
        closingText: `  ${"closing ".repeat(300)}  `,
        regenerationInstruction: `  ${"regenerate ".repeat(300)}  `,
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
    expect(input.payload.form.closingText.startsWith(" ")).toBe(false);
    expect(input.payload.form.closingText.length).toBeLessThanOrEqual(1013);
    expect(input.payload.form.regenerationInstruction.startsWith(" ")).toBe(false);
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

  test("treats whitespace-only optional guidance as missing before article generation", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    await generateAioArticle({
      form: {
        ...sampleFormPayload,
        closingText: " \n\t ",
        regenerationInstruction: " \n\t ",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: { form: { closingText?: string; regenerationInstruction?: string } };
    };

    expect(input.payload.form.closingText).toBe("");
    expect(input.payload.form.regenerationInstruction).toBe("");
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
    expect(call?.instructions).toContain("make them useful decision tables");
    expect(call?.instructions).toContain("Avoid thin tables with only 項目/内容");
    expect(call?.instructions).toContain("Avoid generic H2/H3 labels");
    expect(call?.instructions).toContain("Make title candidates specific and editorial");
    expect(call?.instructions).toContain("Best Practices");
    expect(call?.instructions).toContain("Strategy");
    expect(call?.instructions).toContain("Checklist");
    expect(call?.instructions).toContain("Make faq_items specific enough for publication");
    expect(call?.instructions).toContain("AIOとは何ですか");
    expect(call?.instructions).toContain("AIOはなぜ重要ですか");
    expect(call?.instructions).toContain("AIOはどのように活用できますか");
    expect(call?.instructions).toContain("What is AIO?");
    expect(call?.instructions).toContain("Why is AIO important?");
    expect(call?.instructions).toContain("How does it work?");
    expect(call?.instructions).toContain("What are the benefits of AIO?");
    expect(call?.instructions).toContain("generic FAQ answer filler");
    expect(call?.instructions).toContain("can help");
    expect(call?.instructions).toContain("improve efficiency");
    expect(call?.instructions).toContain("best practices");
    expect(call?.instructions).toContain("streamline");
    expect(call?.instructions).toContain("enhance productivity");
    expect(call?.instructions).toContain("leverage");
    expect(call?.instructions).toContain("Each answer should include a condition");
    expect(call?.instructions).toContain("Do not use vague heading patterns");
    expect(call?.instructions).toContain("Avoid thin H2/H3 sections");
    expect(call?.instructions).toContain("at least two concrete signals");
    expect(call?.instructions).toContain("concrete reader decision");
    expect(call?.instructions).toContain("Treat payload.form.theme as the editorial brief");
    expect(call?.instructions).toContain("comparison axes");
    expect(call?.instructions).toContain("Do not merely summarize competitors");
    expect(call?.instructions).toContain("Do not state uncertain facts as facts");
    expect(call?.instructions).toContain("When using numbers, percentages, costs");
    expect(call?.instructions).toContain("keep the actual URLs visible in body_html");
    expect(call?.instructions).toContain("Respect payload.form.wordCount");
    expect(call?.instructions).toContain("Respect payload.form.imageCount");
    expect(call?.instructions).toContain("Return zero image_prompts when imageCount is 0");
    expect(call?.instructions).toContain("Do not start many consecutive sentences");
    expect(call?.instructions).toContain("Avoid verbose AI-like predicates");
    expect(call?.instructions).toContain("in order to");
    expect(call?.instructions).toContain("utilize");
    expect(call?.instructions).toContain("Do not open with boilerplate framing");
    expect(call?.instructions).toContain("Avoid mechanical heading sequences");
    expect(call?.instructions).toContain("Avoid single Japanese sentences over roughly 130");
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

  test("caps self-evaluation when the generated meta description is generic", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      meta_description: "この記事ではAIOについてわかりやすく解説します。",
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
      "メタディスクリプション",
    );
  });

  test("caps self-evaluation when generated image alt text is generic", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      image_prompts: [
        {
          slot: "featured",
          prompt: "generic business image",
          alt_text: "image",
        },
      ],
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: { ...sampleFormPayload, imageCount: 1 },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("画像alt");
  });

  test("caps self-evaluation when FAQ items are generic and thin", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>一人親方の労災保険とは、加入条件と給付基礎日額を確認して判断する制度です</h2>
        <p>結論として、読者は加入条件、給付基礎日額、補償開始日の3点を先に確認します。当社の支援現場では、LINEで承認が残り帳票が不足する相談が多く、公開前に参照元と未確認情報を分ける必要があります。</p>
        <table><tr><th>判断基準</th><td>加入条件、費用、担当者、補償開始日を比較します。</td></tr></table>
        <ul><li>失敗例は、費用だけ見て帳票確認を後回しにすることです。</li><li>注意点は、未確認の対象範囲を断定しないことです。</li></ul>
        <h2>LINE承認と帳票不足を公開前に確認する理由</h2>
        <p>参照元で確認できる条件と、支援現場で観察した相談傾向を分けます。競合が料金表中心の場合は、担当者、期間、帳票確認の差分を本文で補います。</p>
        <h2>FAQ</h2>
        <p>公開前に確認する条件を整理します。</p>
        <p>出典: https://example.com/reference</p>
      `,
      faq_items: [
        { question: "メリットは何ですか？", answer: "重要です。" },
        { question: "注意点は何ですか？", answer: "状況に応じて確認することが重要です。" },
        { question: "What are the benefits?", answer: "It depends." },
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
        theme: "一人親方 労災保険 加入条件 給付基礎日額 費用",
        primaryInfo: "支援現場ではLINEで承認が残り帳票が不足する相談が多い。",
      },
      fetchedReferences: [
        {
          url: "https://example.com/reference",
          text: "一人親方の労災保険では加入条件、給付基礎日額、補償開始日を確認する。",
        },
      ],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(90);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("FAQに汎用的な質問");
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

  test("caps self-evaluation when competitor source URLs disappear from generated body", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、競合差分と参照元をAI検索で引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、料金表、導入期間、補助金申請を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、競合の料金訴求と自社の運用定着を混同しないことです。</li></ul>
        <h2>公開前に料金表と承認フローを分けて確認する理由</h2>
        <p>FAQとして、未確認情報は断定せず、参照元と条件を本文に残します。出典: https://example.com/reference</p>
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
          "当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。",
        closingText: "",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: {
        summary: "競合記事は料金表、導入期間、補助金申請を前面に出している。",
        queries: ["aio competitor"],
        insights: [
          {
            url: "https://example.com/competitor-source",
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
      "https://example.com/competitor-source",
    );
  });

  test("caps self-evaluation when generated body ignores target reader and search intent", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      target_reader:
        "BtoBマーケティング担当者とコンテンツ運用チーム、WordPress公開を担当する編集者",
      search_intent: "AI検索に強い記事テーマを決め、比較軸と次の公開作業を知りたい",
      body_html: `
        <h2>AIO記事とは、参照情報をAI検索で引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない情報を条件なしで書かないことです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、本文HTMLに貼る前に、判断基準、注意点、比較軸へ言い換えたかを確認します。出典: https://example.com/reference</p>
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
          "当社の支援現場では12件の相談で、承認担当と出典確認の手順が曖昧でした。",
        closingText: "",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("想定読者");
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("検索意図");
  });

  test("caps self-evaluation when the generated body is far shorter than the selected word count", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない情報を条件なしで書かないことです。</li></ul>
        <h2>承認担当と出典確認を分ける編集判断</h2>
        <p>FAQとして、本文HTMLに貼る前に、判断基準、注意点、比較軸へ言い換えたかを確認します。出典: https://example.com/reference</p>
      `,
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: { ...sampleFormPayload, wordCount: 6000 },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("指定された6,000字");
  });

  test("caps self-evaluation when the generated body is far longer than the selected word count", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `
        <h2>AIO記事とは、参照情報と一次情報をAI検索で引用しやすく整理する記事を指します</h2>
        <p>結論として、公開前には参照元、一次情報、競合差分を分けて確認します。${"現場の判断基準、失敗例、担当者、費用、期間、注意点、比較軸を確認し、読者が公開前に迷わないよう整理します。".repeat(38)}</p>
        <table><tr><th>判断基準</th><td>担当者、費用、期間、出典確認を比較します。</td></tr></table>
        <ul><li>失敗例として、出典と自社経験を混ぜて断定するケースがあります。</li><li>注意点は、参照元にない情報を条件なしで書かないことです。</li></ul>
        <h2>公開前に担当者と出典確認を分ける理由</h2>
        <p>FAQとして、本文HTMLに貼る前に、判断基準、注意点、比較軸へ言い換えたかを確認します。出典: https://example.com/reference</p>
      `,
      aio_score_self_evaluation: {
        score: 99,
        strengths: ["High claimed score"],
        improvements: [],
      },
    });

    const result = await generateAioArticle({
      form: { ...sampleFormPayload, wordCount: 1000 },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.aio_score_self_evaluation.score).toBeLessThan(99);
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("指定された1,000字");
  });
});
