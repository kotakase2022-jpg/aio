import { z } from "zod";
import { errorJson, okJson } from "@/lib/server/http";
import { publishDraftToWordpress } from "@/lib/server/wordpress";
import type { ArticleDraft } from "@/types/aio";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  draft: z.record(z.string(), z.unknown()),
  connectionId: z.string().min(1),
  connection: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "publish"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const origin =
      request.headers.get("origin") ||
      `${new URL(request.url).protocol}//${new URL(request.url).host}`;
    const result = await publishDraftToWordpress({
      draft: body.draft as ArticleDraft,
      connectionId: body.connectionId,
      connection: body.connection as Parameters<typeof publishDraftToWordpress>[0]["connection"],
      status: body.status,
      origin,
    });
    return okJson(result);
  } catch (error) {
    return errorJson(error);
  }
}
