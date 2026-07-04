import { randomUUID } from "node:crypto";
import { extractAttachmentText } from "@/lib/server/file-extraction";
import { ApiError, errorJson, okJson } from "@/lib/server/http";
import type { AttachedFileInput } from "@/types/aio";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("File is required.", 400, "添付ファイルを選択してください。");
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new ApiError(
        "File is too large.",
        400,
        "添付ファイルは1件12MB以内にしてください。",
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
