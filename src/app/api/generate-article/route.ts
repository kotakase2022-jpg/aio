import { z } from "zod";
import { assertRequiredArticleGenerationInputs } from "@/lib/server/article-form-validation";
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
    assertRequiredArticleGenerationInputs(payload.form);
    const result = await generateAioArticle(payload);
    return okJson({ result });
  } catch (error) {
    return errorJson(error);
  }
}
