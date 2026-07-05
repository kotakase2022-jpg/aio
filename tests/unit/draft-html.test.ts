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
});
