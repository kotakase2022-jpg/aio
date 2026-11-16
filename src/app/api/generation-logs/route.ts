import {
  decodeGenerationLogCursor,
  GENERATION_LOG_MAX_PAGE_SIZE,
  GENERATION_LOG_PAGE_SIZE,
  listGenerationLogsPage,
} from "@/lib/server/generation-jobs";
import { ApiError, errorJson, okJson } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const page = await listGenerationLogsPage({
      limit: parseLimit(searchParams.get("limit")),
      cursor: cursor ? decodeGenerationLogCursor(cursor) : null,
    });
    return okJson(page);
  } catch (error) {
    return errorJson(error);
  }
}

function parseLimit(value: string | null) {
  if (value === null) return GENERATION_LOG_PAGE_SIZE;
  const limit = /^\d{1,3}$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > GENERATION_LOG_MAX_PAGE_SIZE) {
    throw new ApiError(
      "生成ログの取得件数が正しくありません。",
      400,
      `1〜${GENERATION_LOG_MAX_PAGE_SIZE}件の範囲で指定してください。`,
    );
  }
  return limit;
}
