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
      return Response.json({ ok: false, error: "Generation job not found." }, { status: 404 });
    }

    return okJson({ job });
  } catch (error) {
    return errorJson(error);
  }
}
