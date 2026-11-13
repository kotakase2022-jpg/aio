import { beforeEach, describe, expect, test, vi } from "vitest";
import { sampleArticleResult, sampleFormPayload } from "../fixtures/article";
import { deltaNov11Form } from "../fixtures/delta-nov11";

vi.mock("@/lib/server/openai", () => ({
  createStructuredResponse: vi.fn(),
}));

describe("generateAioArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("keeps non-URL source metadata private but preserves potentially substantive note text", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const note = "出典メモ：手動入力テキスト（manual-text）は、融資とファクタリングの比較軸を整理するために参照しました。";
    const source = { title: "手動入力テキスト", url: "manual-text", usage_notes: "比較軸の整理" };
    vi.mocked(createStructuredResponse).mockResolvedValue({ ...sampleArticleResult, sources: [...sampleArticleResult.sources, source], body_html: `${sampleArticleResult.body_html}<p>${note}</p><p>顧客の手動入力テキストを分析する業務です。</p>` });
    const result = await generateAioArticle({ form: sampleFormPayload, fetchedReferences: [], fetchedCompetitors: [] });
    expect(result.sources).toEqual(sampleArticleResult.sources);
    // A descriptive provenance sentence may contain facts; retain it and flag for human editing.
    expect(result.body_html).toContain(note);
    expect(result.body_html).toContain("顧客の手動入力テキストを分析する業務です。");
    expect(result.editor_warnings).toEqual(expect.arrayContaining([expect.stringContaining(note), expect.stringContaining("manual-text")]));
    expect(result.body_html).toContain(sampleArticleResult.sources[0].url);
  });

  test.each([
    { note: "出典メモ：手動入力テキスト（manual-text）を参照しました。", retained: false },
    { note: "出典メモ：手動入力テキスト（manual-text）は、対象が既存会員のみと明記しているため参照しました。", retained: true },
  ])("removes only content-free acquisition notes: $retained", async ({ note, retained }) => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValue({ ...sampleArticleResult, body_html: `<p>${note}</p>` });
    const result = await generateAioArticle({ form: sampleFormPayload, fetchedReferences: [], fetchedCompetitors: [] });
    expect(result.body_html.includes(note)).toBe(retained);
    expect(result.editor_warnings).toContain(note);
    if (retained) expect(result.editor_warnings).toEqual(expect.arrayContaining([expect.stringContaining("読者向けではない内部メモ")]));
  });

  test.each(["対象は既存会員のみです。", "対象は既存会員のみです。出典：https://example.com/terms"])("retains substantive text appended to a manual source note: %s", async (suffix) => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const paragraph = `出典メモ：手動入力テキスト（manual-text）。${suffix}`;
    vi.mocked(createStructuredResponse).mockResolvedValue({ ...sampleArticleResult, body_html: `<p>${paragraph}</p>` });
    const result = await generateAioArticle({ form: sampleFormPayload, fetchedReferences: [], fetchedCompetitors: [] });
    expect(result.body_html).toContain(suffix);
    expect(result.editor_warnings).toEqual(expect.arrayContaining([expect.stringContaining("manual-text")]));
  });

  test("retains model-only evidence cautions for editors before quality-list truncation", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const caution = "入力情報には具体的な料率の根拠がないため、編集者が確認してください。";
    vi.mocked(createStructuredResponse).mockResolvedValue({ ...sampleArticleResult, aio_score_self_evaluation: { ...sampleArticleResult.aio_score_self_evaluation, improvements: [caution] } });
    const result = await generateAioArticle({ form: sampleFormPayload, fetchedReferences: [], fetchedCompetitors: [] });
    expect(result.editor_warnings).toContain(caution);
    expect(result.body_html).not.toContain(caution);
  });

  test("resolves a structure instruction before shortening a long theme", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValue(sampleArticleResult);
    const result = await generateAioArticle({
      form: { ...sampleFormPayload, articleStructure: "auto", theme: `${"背景情報。".repeat(500)}課題解決型で説明してください。` },
      fetchedReferences: [], fetchedCompetitors: [],
    });
    expect(result.resolved_article_structure).toBe("problem_solution");
    expect(vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0].instructions).toContain("Structure plan: problem_solution");
  });

  test.each(["auto", "on", "none"] as const)("propagates %s options on new generation and regeneration", async (mode) => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValue({ ...sampleArticleResult, body_html: '<h2>何を確認しますか？</h2><p>対象条件を確認します。</p><table><tr><td>返済負担</td></tr></table>', article_summary: "資金調達では希望日の5営業日前に相談します。" });
    for (const regenerationInstruction of ["", "比較型で全文再作成。更新した一次情報を反映する"]) {
      const form = { ...deltaNov11Form, articleStructure: "auto", tableMode: mode, supplementalFaqMode: mode, regenerationInstruction };
      const result = await generateAioArticle({ form, fetchedReferences: [], fetchedCompetitors: [] });
      const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
      expect(JSON.parse(call!.input).payload.form).toMatchObject({ tableMode: mode, supplementalFaqMode: mode, primaryInfo: deltaNov11Form.primaryInfo });
      expect(result.content_policy_version).toBe(2);
      expect(result.editor_warnings).toEqual(expect.arrayContaining([expect.stringContaining("5営業日")]));
      if (regenerationInstruction) expect(result.resolved_article_structure).toBe("comparison");
      if (mode === "none") {
        expect(result.faq_items).toEqual([]);
        expect(result.body_html).not.toContain("<table");
      } else {
        expect(result.faq_items).toEqual(sampleArticleResult.faq_items);
      }
    }
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
    expect(result.image_prompts[0].prompt).toContain("premium Japanese editorial");
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
      payload: { form: { primaryInfo?: string; primaryInfoTypes?: string[] } };
    };

    expect(call?.instructions).toContain("high-priority first-party information");
    expect(call?.instructions).toContain("primaryInfoTypes");
    expect(call?.instructions).toContain("Avoid commodity content");
    expect(call?.instructions).toContain("generic AI-like filler");
    expect(call?.instructions).toContain("重要になります");
    expect(call?.instructions).toContain("一般的に");
    expect(call?.instructions).toContain("多くの場合");
    expect(call?.instructions).toContain("求められます");
    expect(call?.instructions).toContain("欠かせません");
    expect(call?.instructions).toContain("わかりやすく解説");
    expect(call?.instructions).toContain("詳しく解説");
    expect(call?.instructions).toContain("を紹介します");
    expect(call?.instructions).toContain("効率化につながります");
    expect(call?.instructions).toContain("品質向上につながります");
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
    expect(call?.instructions).toContain("today's rapidly evolving landscape");
    expect(call?.instructions).toContain("ever-evolving landscape");
    expect(call?.instructions).toContain("comprehensive guide");
    expect(call?.instructions).toContain("delve into");
    expect(call?.instructions).toContain("navigate the complexities");
    expect(call?.instructions).toContain("unlock the potential");
    expect(call?.instructions).toContain("empower businesses");
    expect(call?.instructions).toContain("in conclusion");
    expect(call?.instructions).toContain("it is worth noting that");
    expect(call?.instructions).toContain("at the end of the day");
    expect(call?.instructions).toContain("run one silent editorial self-review");
    expect(call?.instructions).toContain("selected_title, body_html, headings, faq_items");
    expect(call?.instructions).toContain("lacks first-party/source evidence");
    expect(call?.instructions).toContain("revise that part before final output");
    expect(call?.instructions).toContain("human editor who has interviewed the business");
    expect(call?.instructions).toContain("Do not paste long reference or competitor passages");
    expect(call?.instructions).toContain("Do not paste primaryInfo verbatim");
    expect(call?.instructions).toContain("Break it into observed problem");
    expect(call?.instructions).toContain("absence of AI-like generic phrasing");
    expect(call?.instructions).toContain("0-100 scale");
    expect(call?.instructions).toContain("not 8.6");
    expect(call?.instructions).toContain("single canonical FAQ source");
    // November 11: main-body Q&A is allowed; only supplemental FAQ is separate.
    expect(call?.instructions).toContain("The main Q&A body for FAQ-type articles belongs in body_html");
    expect(input.payload.form.primaryInfo?.startsWith(" ")).toBe(false);
    expect(input.payload.form.primaryInfo).toContain("one-person contractors");
    expect(input.payload.form.primaryInfo).toContain("LINE");
    expect(input.payload.form.primaryInfoTypes).toEqual([
      "自社の判断基準・ノウハウ",
      "顧客・現場から多い相談",
    ]);
  });

  test("normalizes model self-evaluation scores that use a 0-10 scale", async () => {
    const { normalizeSelfEvaluationScore } = await import("@/lib/server/article-generation");

    expect(normalizeSelfEvaluationScore(8.6)).toBe(86);
    expect(normalizeSelfEvaluationScore(86)).toBe(86);
    expect(normalizeSelfEvaluationScore(Number.NaN)).toBe(0);
  });

  test("keeps FAQ canonical in faq_items while adding the managed takeaway block", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html:
        "<h2>一人親方労災とは加入判断を先に整理する制度です</h2><p>結論として、加入条件、給付基礎日額、補償開始日を先に確認します。</p>",
      key_takeaways: ["加入条件を先に確認する", "給付基礎日額は収入と費用で判断する"],
      faq_items: [
        {
          question: "一人親方はいつ加入条件を確認すべきですか",
          answer: "業務開始日と補償開始日の前に、業務実態と費用負担者を確認します。",
        },
        ...sampleArticleResult.faq_items.slice(1),
      ],
    });

    const result = await generateAioArticle({
      form: sampleFormPayload,
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.body_html).toContain("aio-key-takeaways");
    expect(result.body_html).toContain("<ul>");
    expect(result.body_html).not.toContain("aio-faq-block");
    expect(result.body_html).toContain("aio-source-block");
    expect(result.body_html).toContain("https://example.com/reference");
    expect(result.body_html).not.toContain("一人親方はいつ加入条件を確認すべきですか");
    expect(result.faq_items[0]).toEqual({
      question: "一人親方はいつ加入条件を確認すべきですか",
      answer: "業務開始日と補償開始日の前に、業務実態と費用負担者を確認します。",
    });
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
    expect(input.payload.form.primaryInfo.length).toBeLessThanOrEqual(3610);
    expect(input.payload.form.primaryInfo).toContain("[入力短縮:");
    expect(input.payload.form.closingText.startsWith(" ")).toBe(false);
    expect(input.payload.form.closingText.length).toBeLessThanOrEqual(1013);
    expect(input.payload.form.regenerationInstruction.startsWith(" ")).toBe(false);
    expect(input.payload.form.regenerationInstruction.length).toBeLessThanOrEqual(1213);
    expect(input.payload.form.visualTone.uploadedImageUrl).toBe("[uploaded image]");
    expect(input.payload.form.author.bio.length).toBeLessThanOrEqual(813);
    expect(input.payload.form.author.imageUrl).toBe("[uploaded author image]");
    expect(input.payload.form.referenceFiles).toHaveLength(8);
    expect(input.payload.form.referenceFiles[0].text?.length).toBeLessThanOrEqual(2610);
    expect(input.payload.form.referenceFiles[0].text).toContain("[入力短縮:");
    expect(input.payload.form.competitorFiles).toHaveLength(8);
    expect(input.payload.form.competitorFiles[0].error?.length).toBeLessThanOrEqual(233);
    expect(input.payload.fetchedReferences).toHaveLength(8);
    expect(input.payload.fetchedReferences[0].text?.length).toBeLessThanOrEqual(3013);
    expect(input.payload.fetchedReferences[0].text).toContain("[入力短縮:");
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
      task: string;
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
    // Supplemental FAQ is optional, so no unconditional minimum or keyword quota.
    expect(call?.instructions).toContain("An empty faq_items array is correct");
    expect(call?.instructions).toContain("answer remaining reader questions with evidence and conditions");
    expect(call?.instructions).toContain("Do not use vague heading patterns");
    expect(call?.instructions).toContain("Avoid thin H2/H3 sections");
    expect(call?.instructions).toContain("at least two concrete signals");
    expect(call?.instructions).toContain("at least three different types of editorial evidence");
    expect(call?.instructions).toContain("concrete reader decision");
    expect(call?.instructions).toContain("Treat payload.form.theme as the editorial brief");
    expect(call?.instructions).toContain("preserve at least one role phrase");
    expect(call?.instructions).toContain("same audience signal");
    expect(call?.instructions).toContain("multiple roles separated by commas");
    expect(call?.instructions).toContain("do not collapse them into one broad team label");
    expect(call?.instructions).toContain("Reuse each explicit role phrase");
    expect(call?.instructions).toContain("comparison axes");
    expect(call?.instructions).toContain("Do not merely summarize competitors");
    expect(call?.instructions).toContain("Do not state uncertain facts as facts");
    expect(call?.instructions).toContain("When using numbers, percentages, costs");
    expect(call?.instructions).toContain("keyword numerals");
    expect(call?.instructions).toContain("keep the actual URLs visible in body_html");
    expect(call?.instructions).toContain("Respect payload.form.wordCount");
    expect(call?.instructions).toContain("target visible Japanese body text length");
    expect(call?.instructions).toContain("90-110%");
    expect(call?.instructions).toContain("hard maximum");
    expect(call?.instructions).toContain("2,600 characters");
    expect(call?.instructions).toContain("main article body before FAQ");
    expect(call?.instructions).toContain("above about 1,500 visible Japanese characters");
    expect(call?.instructions).toContain("Do not reuse the opening definition as the first H2/H3");
    expect(call?.instructions).toContain("reader's first decision");
    expect(call?.instructions).toContain("operational checkpoint");
    expect(input.task).toContain("目標の90〜110%");
    expect(input.task).toContain("想定読者に役割名や職種名");
    expect(call?.instructions).toContain("Respect payload.form.imageCount");
    expect(call?.instructions).toContain("Return zero image_prompts when imageCount is 0");
    expect(call?.instructions).toContain("Do not start many consecutive sentences");
    expect(call?.instructions).toContain("Avoid verbose AI-like predicates");
    expect(call?.instructions).toContain("in order to");
    expect(call?.instructions).toContain("utilize");
    expect(call?.instructions).toContain("Do not open with boilerplate framing");
    expect(call?.instructions).toContain("Avoid mechanical heading sequences");
    expect(call?.instructions).toContain("Avoid single Japanese sentences over roughly 130");
    expect(call?.timeoutMs).toBe(150_000);
    expect(call?.maxOutputTokens).toBe(16_000);
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
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain("一次情報の論点");
    expect(result.aio_score_self_evaluation.improvements.join(" ")).toContain(
      "入力で確認できる経験",
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
      "参照情報の主要な論点",
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
      "競合情報から得た読者の疑問",
    );
  });

  test("keeps a declared competitor source URL visible when the generated body omits it", async () => {
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
      sources: [
        ...sampleArticleResult.sources,
        {
          url: "https://example.com/competitor-source",
          title: "競合LP",
          usage_notes: "料金表と導入期間の比較軸を確認した出典。",
        },
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

    expect(result.body_html).toContain("aio-source-block");
    expect(result.body_html).toContain("https://example.com/competitor-source");
  });

  test("does not append unsafe source URLs to generated body HTML", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html:
        "<h2>AIO content means source-aware article operations.</h2><p>Answer first: editors keep source evidence and field observations separate before approval.</p>",
      sources: [{ url: "javascript:alert(1)", title: "Unsafe source", usage_notes: "ignored" }],
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        references: [
          {
            id: "unsafe-ref",
            url: "javascript:alert(1)",
            text: "Unsafe URL should not become a link.",
          },
        ],
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.body_html).not.toContain("javascript:alert");
  });

  test("does not append a declared source URL when the matching fetch is unusable", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html:
        "<h2>犬猫のオーラルケアとは日々の口内変化を確認することです</h2><p>飼い主は口臭や食べ方の変化を記録し、必要に応じて動物病院へ相談します。</p>",
      sources: [
        {
          url: "https://example.com/mojibake",
          title: "文字化けした取得元",
          usage_notes: "モデルが誤って宣言した出典。",
        },
      ],
    });

    const result = await generateAioArticle({
      form: sampleFormPayload,
      fetchedReferences: [
        {
          url: "https://example.com/mojibake",
          ok: true,
          evidenceUsable: false,
          reason: "文字化けのため記事根拠には使用しません。",
        },
      ],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    expect(result.body_html).not.toContain("https://example.com/mojibake");
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

  test("passes audience, structure, and regeneration direction while keeping FAQ canonical", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce({
      ...sampleArticleResult,
      body_html: `${sampleArticleResult.body_html}<h2>FAQ</h2><h3>重複質問ですか？</h3><p>古い回答です。</p>`,
      headings: [
        ...sampleArticleResult.headings,
        { level: "h2" as const, text: "FAQ" },
      ],
    });

    const result = await generateAioArticle({
      form: {
        ...sampleFormPayload,
        audienceType: "btoc",
        articleStructure: "faq",
        regenerationInstruction: "一般の飼い主が選べる質問順に全文を再構成する",
      },
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: {
        form: {
          audienceType?: string;
          articleStructure?: string;
          regenerationInstruction?: string;
        };
      };
    };
    expect(call?.instructions).toContain("Audience plan: BtoC");
    expect(call?.instructions).toContain("Structure plan: FAQ");
    expect(input.payload.form).toMatchObject({
      audienceType: "btoc",
      articleStructure: "faq",
      regenerationInstruction: "一般の飼い主が選べる質問順に全文を再構成する",
    });
    expect(result.body_html).not.toContain("重複質問ですか");
    expect(result.headings.map((heading) => heading.text)).not.toContain("FAQ");
    expect(result.faq_items).toEqual(sampleArticleResult.faq_items);
  });

  test("does not send mojibake or otherwise unusable fetched text to the model", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    await generateAioArticle({
      form: sampleFormPayload,
      fetchedReferences: [
        {
          url: "https://example.com/mojibake",
          ok: true,
          evidenceUsable: false,
          text: "譁�蟄励�壊れた文章",
          reason: "文字化けのため記事根拠には使用しません。",
        },
        {
          url: "https://example.com/usable",
          ok: true,
          evidenceUsable: true,
          text: "犬猫のオーラルケアでは、飼い主が口内の変化を確認します。",
        },
      ],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: { fetchedReferences: Array<Record<string, unknown>> };
    };
    expect(input.payload.fetchedReferences[0]).toMatchObject({
      evidenceUsable: false,
      reason: "文字化けのため記事根拠には使用しません。",
    });
    expect(input.payload.fetchedReferences[0]).not.toHaveProperty("text");
    expect(input.payload.fetchedReferences[1].text).toContain("犬猫のオーラルケア");
  });

  test("marks shortened evidence and retains scoped facts from the omitted middle", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);
    const longReference = [
      "背景情報です。".repeat(260),
      "当社が支援した特定のケースでは、必要書類が揃った場合に30日以内で確認できました。",
      "補足情報です。".repeat(420),
      "末尾の例外として、対象外の申請では期間を断定できません。",
    ].join("");

    await generateAioArticle({
      form: {
        ...sampleFormPayload,
        references: [{ id: "long-reference", text: longReference }],
      },
      fetchedReferences: [
        {
          url: "manual-text",
          ok: true,
          evidenceUsable: true,
          text: longReference,
        },
      ],
      fetchedCompetitors: [],
      competitorResearch: null,
    });

    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: {
        form: { references: Array<{ text: string }> };
        fetchedReferences: Array<{ text: string }>;
      };
    };
    for (const compacted of [
      input.payload.form.references[0].text,
      input.payload.fetchedReferences[0].text,
    ]) {
      expect(compacted).toContain("[入力短縮:");
      expect(compacted).toContain("必要書類が揃った場合に30日以内");
      expect(compacted).toContain("末尾の例外");
    }
    expect(call?.instructions).toContain("入力短縮 marker");
    expect(call?.instructions).toContain("never infer the omitted passage");
  });

  describe("prioritized evidence excerpts", () => {
    const background = "担当者は日々の相談を記録し、社内で名前や連絡日時を確認してから案内を回覧します。";
    const numericFact = "必要書類が揃った会員のみ、手数料は1.5%となり、非会員には適用されません。";
    const condition = "例外として、対象外の申請については受付窓口への確認が必要です。";
    const evidenceBudget = Math.floor((3000 - 180) * 0.35);
    const headBudget = Math.floor((3000 - 180) * 0.4);
    const tailBudget = 3000 - 180 - headBudget - evidenceBudget;

    async function compactReference(text: string) {
      const { createStructuredResponse } = await import("@/lib/server/openai");
      const { generateAioArticle } = await import("@/lib/server/article-generation");
      vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);
      await generateAioArticle({
        form: sampleFormPayload,
        fetchedReferences: [{ url: "manual-text", ok: true, text }],
        fetchedCompetitors: [],
      });
      const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
      const input = JSON.parse(String(call?.input)) as {
        payload: { fetchedReferences: Array<{ text: string }> };
      };
      const compacted = input.payload.fetchedReferences[0].text;
      const excerpt = compacted.split("[省略区間から保持した数値・条件・例外]\n")[1].split("\n[末尾]")[0];
      return { compacted, excerpt };
    }

    test("retains late numeric and conditional evidence after ordinary Japanese prose", async () => {
      const original = background.repeat(90) + numericFact + condition + background.repeat(80);
      const { compacted, excerpt } = await compactReference(original);

      expect(excerpt).toBe(`${numericFact}\n${condition}`);
      expect(compacted.length).toBeLessThanOrEqual(3000);
      expect(excerpt.length).toBeLessThanOrEqual(evidenceBudget);
      const retainedLength = headBudget + tailBudget + numericFact.length + condition.length;
      expect(compacted).toContain(`原文${original.length}文字のうち約${original.length - retainedLength}文字を省略`);
    });

    test("reserves room for later numbers before earlier explicit conditions", async () => {
      const { excerpt } = await compactReference(
        background.repeat(50) + condition.repeat(60) + numericFact + background.repeat(50),
      );

      expect(excerpt).toContain(numericFact);
      expect(excerpt).toContain(condition);
      expect(excerpt.length).toBeLessThanOrEqual(evidenceBudget);
      expect(excerpt.split("\n").every((sentence) => [numericFact, condition].includes(sentence))).toBe(true);
    });

    test("skips an over-budget sentence without stripping its trailing restriction", async () => {
      const oversized = `特別契約の費用は9.5万円で、${"契約内容や必要な書類を窓口で確認したうえで、".repeat(80)}会員のみ対象です。`;
      expect(oversized.length).toBeGreaterThan(evidenceBudget);
      const { excerpt } = await compactReference(
        background.repeat(50) + oversized + numericFact + background.repeat(50),
      );

      expect(excerpt).toBe(numericFact);
      expect(excerpt).not.toContain("9.5万円");
    });

    test("does not manufacture a partial excerpt when no evidence sentence fits", async () => {
      const oversized = `対象の契約では７日以内を目安とし、${"書類の確認結果を担当窓口へ連絡したうえで、".repeat(80)}例外は別途協議します。`;
      const original = background.repeat(50) + oversized + background.repeat(50);
      const { compacted, excerpt } = await compactReference(original);

      expect(excerpt).toBe("");
      expect(compacted).toContain(`原文${original.length}文字のうち約${original.length - headBudget - tailBudget}文字を省略`);
    });
  });

  test("does not publish an undeclared competitor URL as if it supported the article", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(sampleArticleResult);

    const result = await generateAioArticle({
      form: sampleFormPayload,
      fetchedReferences: [],
      fetchedCompetitors: [],
      competitorResearch: {
        summary: "比較候補として確認したが、最終記事の根拠には使わなかった。",
        insights: [
          {
            url: "https://example.com/unused-competitor",
            title: "未使用の競合記事",
            majorPoints: [],
            differentiationPoints: [],
            recommendations: [],
          },
        ],
      },
    });

    expect(result.body_html).not.toContain("https://example.com/unused-competitor");
    expect(result.body_html).toContain("https://example.com/reference");
  });
});
