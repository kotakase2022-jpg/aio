import { listGenerationLogs } from "@/lib/server/generation-jobs";
import { errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const logs = await listGenerationLogs(20);
    return okJson({ logs });
  } catch (error) {
    return errorJson(error);
  }
}
