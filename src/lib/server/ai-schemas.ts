export const competitorResearchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "queries", "insights"],
  properties: {
    summary: { type: "string", maxLength: 700 },
    queries: { type: "array", maxItems: 3, items: { type: "string", maxLength: 100 } },
    insights: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "url",
          "title",
          "majorPoints",
          "differentiationPoints",
          "recommendations",
        ],
        properties: {
          url: { type: "string", maxLength: 400 },
          title: { type: "string", maxLength: 160 },
          majorPoints: {
            type: "array",
            maxItems: 2,
            items: { type: "string", maxLength: 160 },
          },
          differentiationPoints: {
            type: "array",
            maxItems: 2,
            items: { type: "string", maxLength: 160 },
          },
          recommendations: {
            type: "array",
            maxItems: 2,
            items: { type: "string", maxLength: 160 },
          },
        },
      },
    },
  },
} as const;

export const articleGenerationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title_candidates",
    "selected_title",
    "meta_description",
    "target_reader",
    "search_intent",
    "article_summary",
    "headings",
    "body_html",
    "faq_items",
    "key_takeaways",
    "image_prompts",
    "suggested_slug",
    "tags",
    "categories",
    "sources",
    "competitor_insights",
    "aio_score_self_evaluation",
  ],
  properties: {
    title_candidates: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", maxLength: 120 },
    },
    selected_title: { type: "string", maxLength: 120 },
    meta_description: { type: "string", maxLength: 180 },
    target_reader: { type: "string", maxLength: 280 },
    search_intent: { type: "string", maxLength: 360 },
    article_summary: { type: "string", maxLength: 650 },
    headings: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["level", "text"],
        properties: {
          level: { type: "string", enum: ["h2", "h3"] },
          text: { type: "string", maxLength: 120 },
        },
      },
    },
    body_html: { type: "string", maxLength: 9000 },
    faq_items: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string", maxLength: 140 },
          answer: { type: "string", maxLength: 420 },
        },
      },
    },
    key_takeaways: { type: "array", maxItems: 6, items: { type: "string", maxLength: 180 } },
    image_prompts: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "purpose", "prompt", "alt_text"],
        properties: {
          slot: { type: "string", enum: ["featured", "inline-1", "inline-2"] },
          purpose: { type: "string", maxLength: 180 },
          prompt: { type: "string", maxLength: 700 },
          alt_text: { type: "string", maxLength: 120 },
        },
      },
    },
    suggested_slug: { type: "string", maxLength: 120 },
    tags: { type: "array", maxItems: 8, items: { type: "string", maxLength: 40 } },
    categories: { type: "array", maxItems: 5, items: { type: "string", maxLength: 60 } },
    sources: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "title", "usage_notes"],
        properties: {
          url: { type: "string", maxLength: 500 },
          title: { type: "string", maxLength: 180 },
          usage_notes: { type: "string", maxLength: 250 },
        },
      },
    },
    competitor_insights: competitorResearchSchema.properties.insights,
    aio_score_self_evaluation: {
      type: "object",
      additionalProperties: false,
      required: ["score", "strengths", "improvements"],
      properties: {
        score: { type: "number" },
        strengths: { type: "array", maxItems: 4, items: { type: "string", maxLength: 160 } },
        improvements: { type: "array", maxItems: 4, items: { type: "string", maxLength: 160 } },
      },
    },
  },
} as const;

export const themeCandidateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "candidates"],
  properties: {
    summary: { type: "string", maxLength: 700 },
    candidates: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "keywords", "targetReader", "searchIntent", "angle"],
        properties: {
          title: { type: "string", maxLength: 120 },
          keywords: {
            type: "array",
            minItems: 2,
            maxItems: 8,
            items: { type: "string", maxLength: 40 },
          },
          targetReader: { type: "string", maxLength: 180 },
          searchIntent: { type: "string", maxLength: 260 },
          angle: { type: "string", maxLength: 260 },
        },
      },
    },
  },
} as const;
