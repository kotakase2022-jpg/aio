import { z } from "zod";
import { parseArticleDraft } from "@/lib/article-draft-schema";
import { sanitizeArticleHtml } from "@/lib/article-html";
import { saveDraft } from "@/lib/server/drafts";
import { syncGenerationJobDraft } from "@/lib/server/generation-jobs";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";

const schema = z.object({ draft: z.record(z.string(), z.unknown()) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const draft = parseArticleDraft(body.draft);
    const cleanDraft = {
      ...draft,
      editedBodyHtml: sanitizeArticleHtml(draft.editedBodyHtml),
      updatedAt: new Date().toISOString(),
    };
    const result = await saveDraft(cleanDraft);
    const warnings: string[] = [];
    await syncGenerationJobDraft(result.draft).catch((error: unknown) => {
      warnings.push(`生成ログの同期に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`);
    });
    return okJson({ ...result, warnings });
  } catch (error) {
    return errorJson(error);
  }
}
