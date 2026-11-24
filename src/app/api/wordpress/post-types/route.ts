import { z } from "zod";
import { errorJson, okJson } from "@/lib/server/http";
import { listWordpressPostTypes } from "@/lib/server/wordpress";

export const runtime = "nodejs";

const schema = z.object({
  connectionId: z.string().min(1),
  connection: z.record(z.string(), z.unknown()).optional(),
});

// The 投稿先 choices: the post types the connected WordPress user can create.
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const postTypes = await listWordpressPostTypes({
      connectionId: body.connectionId,
      connection: body.connection as Parameters<typeof listWordpressPostTypes>[0]["connection"],
    });
    return okJson({ postTypes });
  } catch (error) {
    return errorJson(error);
  }
}
