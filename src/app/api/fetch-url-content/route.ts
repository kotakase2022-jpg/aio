import { z } from "zod";
import { fetchUrlContent } from "@/lib/server/content";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().url() });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await fetchUrlContent(body.url);
    return okJson({ result });
  } catch (error) {
    return errorJson(error);
  }
}
