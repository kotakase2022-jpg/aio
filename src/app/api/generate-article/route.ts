import { z } from "zod";
import { generateAioArticle } from "@/lib/server/article-generation";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 180;

const schema = z.object({
  form: z.record(z.string(), z.unknown()),
  fetchedReferences: z.array(z.record(z.string(), z.unknown())),
  fetchedCompetitors: z.array(z.record(z.string(), z.unknown())),
  competitorResearch: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const result = await generateAioArticle(payload);
    return okJson({ result });
  } catch (error) {
    return errorJson(error);
  }
}
