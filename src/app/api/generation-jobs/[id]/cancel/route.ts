import { cancelGenerationJob } from "@/lib/server/generation-jobs";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const job = await cancelGenerationJob(id);
    return okJson({ job });
  } catch (error) {
    return errorJson(error);
  }
}
