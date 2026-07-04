import type {
  ArticleDraft,
  ArticleFormPayload,
  ArticleGenerationResult,
  GenerationJob,
} from "@/types/aio";

export const sampleFormPayload: ArticleFormPayload = {
  references: [
    {
      id: "ref-1",
      url: "https://example.com/reference",
      text: "AIO means making content clear for AI answer engines.",
    },
  ],
  competitors: [],
  referenceFiles: [],
  competitorFiles: [],
  theme: "AIO article generation for B2B marketing teams",
  primaryInfo:
    "In our support work, teams struggle most when AI drafts lack field observations and approval context.",
  closingText: "Contact us for an AIO content workflow consultation.",
  author: {
    name: "Test Author",
    title: "Content Strategist",
    bio: "Writes practical B2B content operations guides.",
    imageUrl: "https://example.com/author.png",
  },
  visualTone: {
    mode: "preset",
    preset: "Simple B2B whitepaper style",
  },
  imageCount: 1,
  wordCount: 3000,
};

export const sampleArticleResult: ArticleGenerationResult = {
  title_candidates: [
    "AIO Content Operations Guide",
    "How B2B Teams Can Prepare for AI Search",
    "AIO Workflow Basics",
  ],
  selected_title: "AIO Content Operations Guide",
  meta_description: "A practical guide to AIO article generation and publishing workflows.",
  target_reader: "B2B marketers and content operations teams",
  search_intent: "Understand how to create AIO-ready drafts and publish them safely.",
  article_summary: "AIO articles should be clear, structured, source-aware, and easy to edit.",
  headings: [
    { level: "h2", text: "What AIO means" },
    { level: "h2", text: "Workflow checklist" },
  ],
  body_html:
    "<h2>What AIO means</h2><p>AIO content answers the main question first.</p><h2>Workflow checklist</h2><ul><li>Collect references</li><li>Review the draft</li></ul>",
  faq_items: [
    { question: "What is AIO?", answer: "AIO means AI search optimization." },
    { question: "Do humans still edit?", answer: "Yes. Approval remains required." },
    { question: "Can it publish drafts?", answer: "Yes, after approval." },
  ],
  key_takeaways: ["Answer first", "Use clear headings", "Keep sources visible"],
  image_prompts: [
    {
      slot: "featured",
      purpose: "Hero image",
      prompt: "Clean B2B editorial visual about AI search workflows",
      alt_text: "AIO workflow hero image",
    },
  ],
  suggested_slug: "aio-content-operations-guide",
  tags: ["AIO", "AI search", "B2B"],
  categories: ["Content Marketing"],
  sources: [
    {
      url: "https://example.com/reference",
      title: "Reference page",
      usage_notes: "Used for workflow framing.",
    },
  ],
  competitor_insights: [],
  aio_score_self_evaluation: {
    score: 86,
    strengths: ["Clear structure", "FAQ included"],
    improvements: ["Add more source detail"],
  },
};

export function createSampleDraft(overrides: Partial<ArticleDraft> = {}): ArticleDraft {
  const now = "2026-07-02T00:00:00.000Z";
  return {
    id: "draft-test-1",
    inputPayload: sampleFormPayload,
    fetchedReferences: [
      {
        url: "https://example.com/reference",
        title: "Reference page",
        text: "AIO reference text",
        ok: true,
        sourceType: "url",
      },
    ],
    fetchedCompetitors: [],
    competitorResearch: undefined,
    aiResult: sampleArticleResult,
    editedTitle: sampleArticleResult.selected_title,
    editedSlug: sampleArticleResult.suggested_slug,
    editedMetaDescription: sampleArticleResult.meta_description,
    editedBodyHtml: sampleArticleResult.body_html,
    faqItems: sampleArticleResult.faq_items,
    tags: sampleArticleResult.tags,
    categories: sampleArticleResult.categories,
    images: [
      {
        id: "img-1",
        slot: "featured",
        url: "https://example.com/featured.png",
        path: "generated/featured.png",
        prompt: "Clean B2B editorial visual",
        altText: "AIO workflow hero image",
        source: "generated",
      },
    ],
    author: sampleFormPayload.author,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createCompletedGenerationJob(): GenerationJob {
  const draft = createSampleDraft();
  return {
    kind: "article_generation_job",
    id: "job-completed-1",
    status: "completed",
    steps: [
      { id: "fetch_refs", label: "Reference fetch", status: "done", detail: "1 fetched" },
      { id: "save", label: "Save draft", status: "done", detail: "Saved" },
    ],
    inputPayload: sampleFormPayload,
    competitorResearch: null,
    fetchedReferences: draft.fetchedReferences,
    fetchedCompetitors: [],
    draft,
    draftId: draft.id,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    startedAt: draft.createdAt,
    completedAt: draft.updatedAt,
  };
}
