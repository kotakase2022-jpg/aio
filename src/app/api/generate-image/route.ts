import { z } from "zod";
import { parseArticleDraft } from "@/lib/article-draft-schema";
import { regenerateDraftImages } from "@/lib/server/draft-image-regeneration";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 180;

const requestSchema = z.object({
  prompt: z.string().min(10),
  slot: z.enum(["featured", "inline-1", "inline-2"]),
  altText: z.string().optional(),
  replaceImageId: z.string().min(1).max(120).optional(),
});

const schema = z.object({
  draft: z.record(z.string(), z.unknown()),
  requests: z.array(requestSchema).min(1).max(3),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await regenerateDraftImages({
      draft: parseArticleDraft(body.draft),
      requests: body.requests,
      signal: request.signal,
    });

    return okJson(result);
  } catch (error) {
    return errorJson(error);
  }
}
