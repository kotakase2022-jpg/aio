import { ApiError, errorJson, okJson } from "@/lib/server/http";
import { storeAsset } from "@/lib/server/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || "uploads");

    if (!(file instanceof File)) {
      throw new ApiError("画像ファイルを選択してください。", 400);
    }

    if (!file.type.startsWith("image/")) {
      throw new ApiError("画像ファイルのみアップロードできます。", 400);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError("画像は8MB以下にしてください。", 400);
    }

    const stored = await storeAsset({
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      filename: file.name,
      folder,
    });

    return okJson({
      url: stored.url,
      path: stored.path,
      filename: file.name,
      storageMode: stored.mode,
    });
  } catch (error) {
    return errorJson(error);
  }
}
