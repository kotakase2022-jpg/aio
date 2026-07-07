import { describe, expect, test } from "vitest";
import { buildDraftArticleHtml } from "@/lib/draft-html";
import { createSampleDraft } from "../fixtures/article";

describe("draft HTML rendering", () => {
  test("appends edited FAQ items when the body does not already contain them", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<h2>Edited section</h2><p>Body only.</p>",
        faqItems: [
          {
            question: "What changes after editorial review?",
            answer: "The approved FAQ is carried into the final article body.",
          },
        ],
      }),
    );

    expect(html).toContain('class="aio-faq-block"');
    expect(html).toContain("What changes after editorial review?");
    expect(html).toContain("The approved FAQ is carried into the final article body.");
  });

  test("does not append a duplicate FAQ block when questions are already in the body", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<h2>FAQ</h2><h3>What is AIO?</h3><p>AIO means AI search optimization.</p>",
        faqItems: [{ question: "What is AIO?", answer: "AIO means AI search optimization." }],
      }),
    );

    expect(html.match(/aio-faq-block/g)).toBeNull();
    expect(html.match(/What is AIO\?/g)).toHaveLength(1);
  });

  test("keeps edited FAQ answers when the question already exists in the body", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<h2>FAQ</h2><h3>What is AIO?</h3><p>Old generated answer.</p>",
        faqItems: [
          {
            question: "What is AIO?",
            answer: "Edited answer approved by the reviewer.",
          },
        ],
      }),
    );

    expect(html).toContain('class="aio-faq-block"');
    expect(html.match(/What is AIO\?/g)).toHaveLength(2);
    expect(html).toContain("Old generated answer.");
    expect(html).toContain("Edited answer approved by the reviewer.");
  });

  test("replaces a stale managed FAQ block with the current edited FAQ items", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<h2>Main body</h2><p>Editorially approved body.</p>",
          '<section class="aio-faq-block" aria-label="FAQ"><h2>FAQ</h2>',
          '<div class="aio-faq-item"><h3>Old managed question?</h3><p>Old managed answer.</p></div>',
          "</section>",
        ].join("\n"),
        faqItems: [
          {
            question: "Which FAQ answer should be published?",
            answer: "The current edited answer should replace the stale managed block.",
          },
        ],
      }),
    );

    expect(html.match(/class="aio-faq-block"/g)).toHaveLength(1);
    expect(html).toContain("Editorially approved body.");
    expect(html).not.toContain("Old managed question?");
    expect(html).not.toContain("Old managed answer.");
    expect(html).toContain("Which FAQ answer should be published?");
    expect(html).toContain("The current edited answer should replace the stale managed block.");
  });

  test("replaces a stale managed FAQ block that contains nested sections", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<h2>Main body</h2><p>Editorially approved body.</p>",
          '<section class="aio-faq-block" aria-label="FAQ"><h2>FAQ</h2>',
          '<section class="legacy-faq-layout"><p>Old nested FAQ answer.</p></section>',
          "</section>",
          "<h2>Next body section</h2><p>Body continues after FAQ.</p>",
        ].join("\n"),
        faqItems: [
          {
            question: "Which nested FAQ answer should be published?",
            answer: "The current edited nested answer should replace the stale managed block.",
          },
        ],
      }),
    );

    expect(html.match(/class="aio-faq-block"/g)).toHaveLength(1);
    expect(html).toContain("Editorially approved body.");
    expect(html).toContain("Body continues after FAQ.");
    expect(html).not.toContain("Old nested FAQ answer.");
    expect(html).toContain("Which nested FAQ answer should be published?");
    expect(html).toContain("The current edited nested answer should replace the stale managed block.");
  });

  test("replaces an unclosed stale managed FAQ block without removing the next body heading", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<h2>Main body</h2><p>Editorially approved body.</p>",
          '<section class="aio-faq-block" aria-label="FAQ"><h2>FAQ</h2>',
          "<p>Old unclosed FAQ answer.</p>",
          "<h2>Next body section</h2><p>Body continues after FAQ.</p>",
        ].join("\n"),
        faqItems: [
          {
            question: "Which recovered FAQ answer should be published?",
            answer: "The current edited answer should replace the unclosed stale block.",
          },
        ],
      }),
    );

    expect(html.match(/class="aio-faq-block"/g)).toHaveLength(1);
    expect(html).toContain("Editorially approved body.");
    expect(html).toContain("<h2>Next body section</h2>");
    expect(html).toContain("Body continues after FAQ.");
    expect(html).not.toContain("Old unclosed FAQ answer.");
    expect(html).toContain("Which recovered FAQ answer should be published?");
  });

  test("resolves placeholder and relative image URLs through the supplied resolver", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          '<p><img src="aio-image:inline-1" alt="Inline"></p><p><img src="/uploads/inline.png" alt="Relative"></p>',
        images: [
          {
            id: "inline-1",
            slot: "inline-1",
            url: "/uploads/inline.png",
            path: "uploads/inline.png",
            prompt: "Inline image",
            altText: "Inline image",
            source: "generated",
          },
        ],
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html).toContain('src="https://app.example.com/uploads/inline.png"');
    expect(html).not.toContain("aio-image:inline-1");
  });

  test("escapes FAQ text before appending it to the article", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        faqItems: [
          {
            question: 'Can "unsafe" HTML appear?',
            answer: "<script>alert('x')</script>",
          },
        ],
      }),
    );

    expect(html).toContain("Can &quot;unsafe&quot; HTML appear?");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  test("keeps answer-only FAQ edits visible in the rendered article", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        faqItems: [{ question: "", answer: "Answer-only editorial note." }],
      }),
    );

    expect(html).toContain("Answer-only editorial note.");
  });

  test("appends author information when the edited body no longer contains an author block", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        author: {
          name: "山田 太郎",
          title: "AIO編集責任者",
          bio: "BtoB記事の編集とAI検索最適化を担当しています。",
          imageUrl: "/uploads/authors/yamada.png",
        },
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html).toContain('class="aio-author-block"');
    expect(html).toContain('aria-label="この記事の執筆者"');
    expect(html).toContain("山田 太郎");
    expect(html).toContain("AIO編集責任者");
    expect(html).toContain("BtoB記事の編集とAI検索最適化を担当しています。");
    expect(html).toContain('src="https://app.example.com/uploads/authors/yamada.png"');
  });

  test("does not duplicate author information already present in the edited body", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<h2>この記事の執筆者</h2><p>Test Author</p>",
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "",
        },
      }),
    );

    expect(html.match(/この記事の執筆者/g)).toHaveLength(1);
    expect(html).not.toContain('class="aio-author-block"');
  });

  test("replaces an AI-written author section when an uploaded portrait must be preserved", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<h2>この記事の執筆者</h2><p>Test Author</p><p>Content Strategist</p><p>[uploaded author image]</p><h2>Next section</h2><p>Body continues.</p>",
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "/uploads/authors/test-author.png",
        },
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html).toContain('class="aio-author-block"');
    expect(html).toContain('src="https://app.example.com/uploads/authors/test-author.png"');
    expect(html).not.toContain("[uploaded author image]");
    expect(html).toContain("<h2>Next section</h2>");
    expect(html.match(/この記事の執筆者/g)).toHaveLength(2);
  });

  test("preserves h3 article sections after replacing an AI-written author section", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<h2>この記事の執筆者</h2><p>Test Author</p><p>Content Strategist</p><p>[uploaded author image]</p><h3>Next detail</h3><p>Body continues under an h3 heading.</p>",
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "/uploads/authors/test-author.png",
        },
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html).toContain('class="aio-author-block"');
    expect(html).toContain('src="https://app.example.com/uploads/authors/test-author.png"');
    expect(html).not.toContain("[uploaded author image]");
    expect(html).toContain("<h3>Next detail</h3>");
    expect(html).toContain("Body continues under an h3 heading.");
  });

  test("replaces a manual author profile section without removing nearby article sections", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<section><h2>Author profile</h2><p>Test Author</p>",
          "<p>Content Strategist</p><p>Old profile copy.</p></section>",
          "<section><h2>Next section</h2><p>Body continues.</p></section>",
        ].join(""),
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "/uploads/authors/test-author.png",
        },
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html).toContain('class="aio-author-block"');
    expect(html).toContain('src="https://app.example.com/uploads/authors/test-author.png"');
    expect(html).not.toContain("Old profile copy.");
    expect(html).toContain("<h2>Next section</h2>");
    expect(html).toContain("Body continues.");
  });

  test("preserves article sections when the author name is only mentioned incidentally", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<section><h2>Interview evidence</h2>",
          "<p>Test Author explained the approval pattern during a field interview, ",
          "so this article evidence must stay.</p></section>",
          "<section><h2>Team role</h2>",
          "<p>A Content Strategist reviews the article operations workflow before publication.</p>",
          "</section>",
        ].join(""),
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "/uploads/authors/test-author.png",
        },
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html).toContain("Test Author explained the approval pattern");
    expect(html).toContain("A Content Strategist reviews the article operations workflow");
    expect(html).toContain('class="aio-author-block"');
    expect(html).toContain('src="https://app.example.com/uploads/authors/test-author.png"');
  });

  test("supplements a bare author heading that has no author identity with the managed block", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<h2>本題</h2><p>Real content here.</p><h2>この記事の執筆者</h2>",
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "",
        },
      }),
    );

    expect(html).toContain('class="aio-author-block"');
    expect(html).toContain("Test Author");
    expect(html).toContain("Content Strategist");
    expect(html).toContain("Writes practical B2B content operations guides.");
    expect(html).toContain("<h2>本題</h2>");
    expect(html).toContain("Real content here.");
    // The orphan heading is replaced by the managed block (aria-label + h2), not duplicated.
    expect(html.match(/この記事の執筆者/g)).toHaveLength(2);
  });

  test("preserves body text after a bare author heading when adding the managed block", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<h2>本文セクション</h2><p>First paragraph.</p><h2>この記事の執筆者</h2><p>Unrelated closing note that must stay.</p>",
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "",
        },
      }),
    );

    expect(html).toContain("<p>Unrelated closing note that must stay.</p>");
    expect(html).toContain('class="aio-author-block"');
    expect(html).toContain("Test Author");
    expect(html.match(/この記事の執筆者/g)).toHaveLength(2);
  });

  test("appends the author block when the author name appears only incidentally", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<p>Test Author explained this approval pattern in an interview, but the article has no author profile yet.</p>",
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "",
        },
      }),
    );

    expect(html).toContain('class="aio-author-block"');
    expect(html.match(/Test Author/g)).toHaveLength(2);
  });

  test("does not duplicate a manually written author profile without the managed heading", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<section><p>Test Author</p><p>Content Strategist</p><p>Writes practical B2B content operations guides.</p></section>",
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "",
        },
      }),
    );

    expect(html).not.toContain('class="aio-author-block"');
    expect(html.match(/Test Author/g)).toHaveLength(1);
  });

  test("escapes author information before appending it", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        author: {
          name: 'Editor "quoted" <unsafe>',
          title: "Lead <Strategist>",
          bio: "<script>alert('author')</script>",
          imageUrl: "https://example.com/author.png?x=1&y=2",
        },
      }),
    );

    expect(html).toContain("Editor &quot;quoted&quot; &lt;unsafe&gt;");
    expect(html).toContain("Lead &lt;Strategist&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#39;author&#39;)&lt;/script&gt;");
    expect(html).toContain("https://example.com/author.png?x=1&amp;y=2");
    expect(html).not.toContain("<script>alert");
  });

  test("replaces a managed author block that contains nested sections", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<h2>Main body</h2><p>Editorially approved body.</p>",
          '<section class="aio-author-block" aria-label="Author"><h2>Author</h2>',
          '<section class="legacy-author-layout"><p>Old nested author copy.</p></section>',
          "</section>",
          "<h2>Next body section</h2><p>Body continues after author.</p>",
        ].join("\n"),
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "/uploads/authors/test-author.png",
        },
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html.match(/class="aio-author-block"/g)).toHaveLength(1);
    expect(html).toContain("Editorially approved body.");
    expect(html).toContain("Body continues after author.");
    expect(html).not.toContain("Old nested author copy.");
    expect(html).toContain("Test Author");
    expect(html).toContain('src="https://app.example.com/uploads/authors/test-author.png"');
  });

  test("replaces an unclosed managed author block without removing the next body heading", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<h2>Main body</h2><p>Editorially approved body.</p>",
          '<section class="aio-author-block" aria-label="Author"><h2>Author</h2>',
          "<p>Old unclosed author copy.</p>",
          "<h2>Next body section</h2><p>Body continues after author.</p>",
        ].join("\n"),
        author: {
          name: "Test Author",
          title: "Content Strategist",
          bio: "Writes practical B2B content operations guides.",
          imageUrl: "/uploads/authors/test-author.png",
        },
      }),
      {
        imageUrlResolver: (url) => `https://app.example.com${url}`,
      },
    );

    expect(html.match(/class="aio-author-block"/g)).toHaveLength(1);
    expect(html).toContain("Editorially approved body.");
    expect(html).toContain("<h2>Next body section</h2>");
    expect(html).toContain("Body continues after author.");
    expect(html).not.toContain("Old unclosed author copy.");
    expect(html).toContain('src="https://app.example.com/uploads/authors/test-author.png"');
  });

  test("appends source URLs from the AI result to publishable article HTML", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
      }),
    );

    expect(html).toContain('class="aio-source-block"');
    expect(html).toContain('aria-label="参照元"');
    expect(html).toContain('href="https://example.com/reference"');
    expect(html).toContain("Reference page");
    expect(html).toContain("Used for workflow framing.");
  });

  test("does not duplicate source URLs that are already visible in the body", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: '<p>出典: <a href="https://example.com/reference">Reference page</a></p>',
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference/g)).toHaveLength(1);
    expect(html).not.toContain('class="aio-source-block"');
  });

  test("does not duplicate source URLs when the saved source keeps a leading www prefix", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: '<p>Source: <a href="https://example.com/reference">Reference page</a></p>',
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://www.example.com/reference/",
              title: "Reference page",
              usage_notes: "Used for workflow framing.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference/g)).toHaveLength(1);
    expect(html).not.toContain("https://www.example.com/reference");
    expect(html).not.toContain('class="aio-source-block"');
  });

  test("escapes source titles and notes before appending them", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://example.com/unsafe?x=1&y=2",
              title: 'Reference "quoted" <unsafe>',
              usage_notes: "<script>alert('x')</script>",
            },
          ],
        },
      }),
    );

    expect(html).toContain("https://example.com/unsafe?x=1&amp;y=2");
    expect(html).toContain("Reference &quot;quoted&quot; &lt;unsafe&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  test("replaces a managed source block that contains nested sections", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<h2>Main body</h2><p>Editorially approved body.</p>",
          '<section class="aio-source-block" aria-label="Sources"><h2>Sources</h2>',
          '<section class="legacy-source-layout"><p>Old nested source note.</p></section>',
          "</section>",
          "<h2>Next body section</h2><p>Body continues after sources.</p>",
        ].join("\n"),
      }),
    );

    expect(html.match(/class="aio-source-block"/g)).toHaveLength(1);
    expect(html).toContain("Editorially approved body.");
    expect(html).toContain("Body continues after sources.");
    expect(html).not.toContain("Old nested source note.");
    expect(html).toContain('href="https://example.com/reference"');
  });

  test("replaces an unclosed managed source block without removing the next body heading", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: [
          "<h2>Main body</h2><p>Editorially approved body.</p>",
          '<section class="aio-source-block" aria-label="Sources"><h2>Sources</h2>',
          "<p>Old unclosed source note.</p>",
          "<h2>Next body section</h2><p>Body continues after sources.</p>",
        ].join("\n"),
      }),
    );

    expect(html.match(/class="aio-source-block"/g)).toHaveLength(1);
    expect(html).toContain("Editorially approved body.");
    expect(html).toContain("<h2>Next body section</h2>");
    expect(html).toContain("Body continues after sources.");
    expect(html).not.toContain("Old unclosed source note.");
    expect(html).toContain('href="https://example.com/reference"');
  });

  test("falls back to fetched and input reference URLs when AI sources are empty", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [],
        },
        fetchedReferences: [
          {
            url: "https://example.com/fetched/",
            title: "Fetched reference",
            text: "Fetched reference text",
            ok: true,
            sourceType: "url",
          },
        ],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [
            {
              id: "input-ref",
              url: "https://example.com/input",
              text: "Manual reference note",
            },
          ],
        },
      }),
    );

    expect(html).toContain('class="aio-source-block"');
    expect(html).toContain('href="https://example.com/fetched"');
    expect(html).toContain("Fetched reference");
    expect(html).toContain("参照URLから本文を取得しました。");
    expect(html).toContain('href="https://example.com/input"');
    expect(html).toContain("入力フォームの参照情報です。");
  });

  test("falls back to competitor URLs when AI sources are empty", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [],
        },
        fetchedReferences: [],
        fetchedCompetitors: [
          {
            url: "https://competitor.example.com/fetched/",
            title: "Fetched competitor",
            text: "Fetched competitor text",
            ok: true,
            sourceType: "url",
          },
        ],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
          competitors: [
            {
              id: "input-competitor",
              url: "https://competitor.example.com/input",
              text: "Manual competitor note",
            },
          ],
        },
        competitorResearch: {
          summary: "Competitor research summary",
          queries: ["aio competitor"],
          insights: [
            {
              url: "https://competitor.example.com/researched",
              title: "Researched competitor",
              majorPoints: ["Point"],
              differentiationPoints: ["Difference"],
              recommendations: ["Recommendation"],
            },
          ],
        },
      }),
    );

    expect(html).toContain('class="aio-source-block"');
    expect(html).toContain('href="https://competitor.example.com/fetched"');
    expect(html).toContain("Fetched competitor");
    expect(html).toContain("競合URLから本文を取得しました。");
    expect(html).toContain('href="https://competitor.example.com/input"');
    expect(html).toContain("入力フォームの競合情報です。");
    expect(html).toContain('href="https://competitor.example.com/researched"');
    expect(html).toContain("Researched competitor");
    expect(html).toContain("AI競合調査で参照した競合情報です。");
  });

  test("deduplicates AI, fetched, input, and competitor source URLs after normalization", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        fetchedReferences: [
          {
            url: "https://www.example.com/reference/?utm_source=newsletter&utm_campaign=aio",
            title: "Fetched www duplicate",
            text: "Fetched reference text",
            ok: true,
            sourceType: "url",
          },
        ],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [
            {
              id: "input-ref",
              url: "http://example.com/reference",
              text: "Manual reference note",
            },
          ],
          competitors: [
            {
              id: "input-competitor",
              url: "https://www.example.com/reference/?gclid=tracking-value",
              text: "Manual competitor note",
            },
          ],
        },
        fetchedCompetitors: [
          {
            url: "https://www.example.com/reference/?fbclid=tracking-value",
            title: "Fetched competitor www duplicate",
            text: "Fetched competitor text",
            ok: true,
            sourceType: "url",
          },
        ],
        competitorResearch: {
          summary: "Competitor research summary",
          queries: ["aio competitor"],
          insights: [
            {
              url: "https://www.example.com/reference/?msclkid=tracking-value",
              title: "Researched www duplicate",
              majorPoints: ["Point"],
              differentiationPoints: ["Difference"],
              recommendations: ["Recommendation"],
            },
          ],
        },
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference/g)).toHaveLength(1);
    expect(html).toContain("Reference page");
    expect(html).not.toContain("http://example.com/reference");
    expect(html).not.toContain("https://www.example.com/reference");
    expect(html).not.toContain("utm_source");
    expect(html).not.toContain("gclid");
    expect(html).not.toContain("fbclid");
    expect(html).not.toContain("msclkid");
    expect(html).not.toContain("Fetched www duplicate");
    expect(html).not.toContain("Fetched competitor www duplicate");
    expect(html).not.toContain("Researched www duplicate");
  });

  test("keeps source URLs with meaningful query parameters separate", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml: "<p>Body only.</p>",
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://example.com/reference?id=primary&utm_source=newsletter",
              title: "Primary reference",
              usage_notes: "Used for the primary source.",
            },
            {
              url: "https://example.com/reference?id=secondary&utm_source=newsletter",
              title: "Secondary reference",
              usage_notes: "Used for the secondary source.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html).toContain('href="https://example.com/reference?id=primary&amp;utm_source=newsletter"');
    expect(html).toContain(
      'href="https://example.com/reference?id=secondary&amp;utm_source=newsletter"',
    );
    expect(html).toContain("Primary reference");
    expect(html).toContain("Secondary reference");
  });

  test("does not duplicate a visible meaningful source URL when only tracking parameters differ", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          '<p>Source: <a href="https://example.com/reference?id=primary">Primary reference</a></p>',
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://example.com/reference?id=primary&utm_source=newsletter",
              title: "Primary reference",
              usage_notes: "Used for the primary source.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference\?id=primary/g)).toHaveLength(1);
    expect(html).not.toContain("utm_source");
    expect(html).not.toContain('class="aio-source-block"');
  });

  test("does not duplicate a visible source URL when meaningful query parameters are reordered", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          '<p>Source: <a href="https://example.com/reference?page=1&id=primary">Primary reference</a></p>',
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://example.com/reference?id=primary&page=1&utm_source=newsletter",
              title: "Primary reference",
              usage_notes: "Used for the primary source.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference\?page=1&id=primary/g)).toHaveLength(1);
    expect(html).not.toContain("utm_source");
    expect(html).not.toContain('class="aio-source-block"');
  });

  test("does not duplicate an escaped visible source URL when meaningful query parameters are reordered", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          '<p>Source: <a href="https://example.com/reference?page=1&amp;id=primary">Primary reference</a></p>',
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://example.com/reference?id=primary&page=1&utm_source=newsletter",
              title: "Primary reference",
              usage_notes: "Used for the primary source.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference\?page=1&amp;id=primary/g)).toHaveLength(1);
    expect(html).not.toContain("utm_source");
    expect(html).not.toContain('class="aio-source-block"');
  });

  test("does not duplicate a numeric-escaped visible source URL when meaningful query parameters are reordered", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          '<p>Source: <a href="https://example.com/reference?page=1&#038;id=primary">Primary reference</a></p>',
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://example.com/reference?id=primary&page=1&utm_source=newsletter",
              title: "Primary reference",
              usage_notes: "Used for the primary source.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference\?page=1&#038;id=primary/g)).toHaveLength(1);
    expect(html).not.toContain("utm_source");
    expect(html).not.toContain('class="aio-source-block"');
  });

  test("does not duplicate a fully escaped visible source URL when meaningful query parameters are reordered", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          "<p>Source: &lt;a href=&quot;https://example.com/reference?page=1&amp;id=primary&quot;&gt;Primary reference&lt;/a&gt;</p>",
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "https://example.com/reference?id=primary&page=1&utm_source=newsletter",
              title: "Primary reference",
              usage_notes: "Used for the primary source.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html).toContain(
      "&lt;a href=&quot;https://example.com/reference?page=1&amp;id=primary&quot;&gt;",
    );
    expect(html).not.toContain("utm_source");
    expect(html).not.toContain('class="aio-source-block"');
  });

  test("normalizes escaped quote decorations in source URL values before source block dedupe", () => {
    const html = buildDraftArticleHtml(
      createSampleDraft({
        editedBodyHtml:
          '<p>Source: <a href="https://example.com/reference?page=1&id=primary">Primary reference</a></p>',
        aiResult: {
          ...createSampleDraft().aiResult,
          sources: [
            {
              url: "&quot;https://example.com/reference?id=primary&amp;page=1&utm_source=newsletter&quot;",
              title: "Primary reference",
              usage_notes: "Used for the primary source.",
            },
          ],
        },
        fetchedReferences: [],
        inputPayload: {
          ...createSampleDraft().inputPayload,
          references: [],
        },
      }),
    );

    expect(html.match(/https:\/\/example\.com\/reference\?page=1&id=primary/g)).toHaveLength(1);
    expect(html).not.toContain("utm_source");
    expect(html).not.toContain("&quot;");
    expect(html).not.toContain('class="aio-source-block"');
  });
});
