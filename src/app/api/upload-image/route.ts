import { ApiError, errorJson, okJson } from "@/lib/server/http";
import {
  canonicalImageFilename,
  inspectImageFile,
} from "@/lib/server/image-file";
import { storeAsset } from "@/lib/server/storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-policy";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_UPLOAD_FOLDERS = new Set(["uploads", "authors", "article-inserts"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || "uploads");

    if (!(file instanceof File)) {
      throw new ApiError("画像ファイルを選択してください。", 400);
    }

    if (file.type && !file.type.startsWith("image/")) {
      throw new ApiError("画像ファイルのみアップロードできます。", 400);
    }

    if (!ALLOWED_UPLOAD_FOLDERS.has(folder)) {
      throw new ApiError("画像の保存先が正しくありません。", 400);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(`画像は${MAX_UPLOAD_LABEL}以下にしてください。`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const image = inspectImageFile(buffer, file.type);
    const filename = canonicalImageFilename(file.name, image.extension);

    const stored = await storeAsset({
      buffer,
      contentType: image.contentType,
      filename,
      folder,
    });

    return okJson({
      url: stored.url,
      path: stored.path,
      filename,
      storageMode: stored.mode,
    });
  } catch (error) {
    return errorJson(error);
  }
}
