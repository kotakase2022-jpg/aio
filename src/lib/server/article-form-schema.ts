import { z } from "zod";

const input = z.object({ id: z.string(), url: z.string().optional(), text: z.string().optional() });
const file = z.object({
  id: z.string(), name: z.string(), type: z.string(), size: z.number().nonnegative(),
  ok: z.boolean(), text: z.string().optional(), textLength: z.number().nonnegative(),
  error: z.string().optional(), extractedAt: z.string(),
});

export const articleFormSchema = z.object({
  references: z.array(input).max(100),
  competitors: z.array(input).max(100),
  referenceFiles: z.array(file).max(100).optional(),
  competitorFiles: z.array(file).max(100).optional(),
  theme: z.string(),
  primaryInfo: z.string().optional(),
  primaryInfoTypes: z.array(z.string()).optional(),
  closingText: z.string(),
  author: z.object({
    name: z.string().optional(), title: z.string().optional(), bio: z.string().optional(),
    imageUrl: z.string().optional(), imagePath: z.string().optional(),
  }),
  visualTone: z.object({
    mode: z.enum(["preset", "custom", "upload"]),
    preset: z.string().optional(), custom: z.string().optional(),
    uploadedImageUrl: z.string().optional(), uploadedImagePath: z.string().optional(),
    uploadedImageName: z.string().optional(),
  }),
  imageCount: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  wordCount: z.union([z.literal(1000), z.literal(2000), z.literal(3000), z.literal(4000), z.literal(5000), z.literal(6000)]).optional(),
  audienceType: z.enum(["auto", "btob", "btoc"]).optional(),
  articleStructure: z.enum(["auto", "textbook", "faq", "case"]).optional(),
  regenerationInstruction: z.string().optional(),
});
