import { getGenerationJob } from "@/lib/server/generation-jobs";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const job = await getGenerationJob(id);
    if (!job) {
      return Response.json(
        {
          ok: false,
          error:
            "生成ジョブが見つかりません。古い生成状態をクリアし、もう一度「AIによる記事作成」を実行してください。",
        },
        { status: 404 },
      );
    }

    return okJson({ job });
  } catch (error) {
    return errorJson(error);
  }
}
