import { z } from "zod";
import type { ArticleDraft } from "@/types/aio";

const stringList = z.array(z.string().max(500)).max(100);

export const articleDraftSchema = z
  .object({
    id: z.string().min(1).max(120),
    inputPayload: z.object({}).passthrough(),
    fetchedReferences: z.array(z.object({}).passthrough()).max(100),
    fetchedCompetitors: z.array(z.object({}).passthrough()).max(100),
    competitorResearch: z.object({}).passthrough().optional(),
    aiResult: z.object({}).passthrough(),
    editedTitle: z.string().max(1000),
    editedSlug: z.string().max(500),
    editedMetaDescription: z.string().max(5000),
    editedBodyHtml: z.string().max(2_000_000),
    faqItems: z
      .array(
        z.object({
          question: z.string().max(5000),
          answer: z.string().max(20_000),
        }),
      )
      .max(100),
    tags: stringList,
    categories: stringList,
    images: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            slot: z.enum(["featured", "inline-1", "inline-2"]),
            url: z.string().max(6_000_000),
            path: z.string().max(2000).optional(),
            prompt: z.string().max(20_000),
            altText: z.string().max(5000),
            source: z.enum(["generated", "uploaded"]),
          })
          .strict(),
      )
      .max(3),
    author: z
      .object({
        name: z.string().max(500).optional(),
        title: z.string().max(1000).optional(),
        bio: z.string().max(20_000).optional(),
        imageUrl: z.string().max(6_000_000).optional(),
        imagePath: z.string().max(2000).optional(),
      })
      .passthrough(),
    status: z.enum(["draft", "approved", "posted", "failed"]),
    wordpressPostUrl: z.string().max(5000).optional(),
    createdAt: z.string().min(1).max(100),
    updatedAt: z.string().min(1).max(100),
  })
  .passthrough();

export function parseArticleDraft(value: unknown) {
  return articleDraftSchema.parse(value) as ArticleDraft;
}
