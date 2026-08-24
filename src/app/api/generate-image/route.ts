import { z } from "zod";
import { createGeneratedArticleImage } from "@/lib/server/article-images";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 180;

const schema = z.object({
  prompt: z.string().min(10),
  slot: z.enum(["featured", "inline-1", "inline-2"]),
  altText: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const image = await createGeneratedArticleImage({
      prompt: body.prompt,
      slot: body.slot,
      altText: body.altText,
      signal: request.signal,
    });

    return okJson({ image });
  } catch (error) {
    return errorJson(error);
  }
}
