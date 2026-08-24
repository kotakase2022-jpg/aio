import { z } from "zod";
import { ApiError, errorJson, okJson } from "@/lib/server/http";
import { getDraft } from "@/lib/server/drafts";
import { publishDraftToWordpress } from "@/lib/server/wordpress";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  draft: z.object({ id: z.string().min(1) }).passthrough(),
  connectionId: z.string().min(1),
  connection: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "publish"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const draft = await getDraft(body.draft.id);
    if (!draft) {
      throw new ApiError(
        "WordPress投稿するドラフトが見つかりません。",
        404,
        "下書きを保存・承認してからWordPress投稿してください。",
      );
    }

    if (draft.status !== "approved") {
      throw new ApiError(
        "承認済みドラフトのみWordPress投稿できます。",
        409,
        "先に「承認済みに変更」を押してから投稿してください。",
      );
    }

    const origin = new URL(request.url).origin;
    const result = await publishDraftToWordpress({
      draft,
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
