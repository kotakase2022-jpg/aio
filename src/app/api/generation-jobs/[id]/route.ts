import { getGenerationJob, recoverStaleGenerationJob } from "@/lib/server/generation-jobs";
import { getDraft } from "@/lib/server/drafts";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const storedJob = await getGenerationJob(id);
    if (!storedJob) {
      return Response.json(
        {
          ok: false,
          error:
            "生成ジョブが見つかりません。古い生成状態をクリアし、もう一度「AIによる記事作成」を実行してください。",
        },
        { status: 404 },
      );
    }

    const job = await recoverStaleGenerationJob(storedJob);
    const draftId = job.draftId ?? job.draft?.id;
    // A failed canonical read must not silently restore older embedded edits.
    const draft = draftId ? await getDraft(draftId) : null;
    return okJson({ job: draft ? { ...job, draft } : job });
  } catch (error) {
    return errorJson(error);
  }
}
