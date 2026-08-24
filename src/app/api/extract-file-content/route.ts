import { randomUUID } from "node:crypto";
import { extractAttachmentText } from "@/lib/server/file-extraction";
import { ApiError, errorJson, okJson } from "@/lib/server/http";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-policy";
import type { AttachedFileInput } from "@/types/aio";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("添付ファイルを選択してください。", 400);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(
        `添付ファイルは1件${MAX_UPLOAD_LABEL}以内にしてください。`,
        400,
      );
    }

    const result = await extractAttachmentText({
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      contentType: file.type,
    });
    const attachment: AttachedFileInput = {
      id: randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      ok: true,
      text: result,
      textLength: result.length,
      extractedAt: new Date().toISOString(),
    };

    return okJson({ attachment });
  } catch (error) {
    return errorJson(error);
  }
}
