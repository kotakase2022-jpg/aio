import { z } from "zod";
import { approveDraft, saveDraft } from "@/lib/server/drafts";
import { errorJson, okJson } from "@/lib/server/http";
import type { ArticleDraft } from "@/types/aio";

export const runtime = "nodejs";

const schema = z
  .object({
    draftId: z.string().min(1).optional(),
    draft: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => value.draftId || value.draft, {
    message: "draftId or draft is required.",
  });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (body.draft) {
      const draft = body.draft as ArticleDraft;
      const result = await saveDraft({
        ...draft,
        status: "approved",
        updatedAt: new Date().toISOString(),
      });
      return okJson(result);
    }

    if (!body.draftId) {
      throw new Error("draftId is required.");
    }
    const result = await approveDraft(body.draftId);
    return okJson(result);
  } catch (error) {
    return errorJson(error);
  }
}
