import path from "node:path";
import { ApiError } from "@/lib/server/http";

type SupportedImage = {
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  extension: "png" | "jpg" | "webp" | "gif";
};

const MIME_ALIASES: Record<string, SupportedImage["contentType"]> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

export function inspectImageFile(
  buffer: Buffer,
  declaredContentType?: string,
): SupportedImage {
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new ApiError(
      "画像ファイルの内容を確認できませんでした。",
      400,
      "PNG/JPEG/WebP/GIF形式の画像を選択してください。SVGや拡張子だけを変更したファイルは使用できません。",
    );
  }

  const normalizedDeclaredType = normalizeImageContentType(declaredContentType);
  if (normalizedDeclaredType && normalizedDeclaredType !== detected.contentType) {
    throw new ApiError(
      "画像ファイルの形式と内容が一致しません。",
      400,
      `ファイル内容は${detected.contentType}ですが、送信形式は${normalizedDeclaredType}です。`,
    );
  }

  return detected;
}

export function canonicalImageFilename(filename: string, extension: SupportedImage["extension"]) {
  const parsed = path.parse(filename);
  return `${parsed.name || "image"}.${extension}`;
}

function normalizeImageContentType(value?: string) {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return MIME_ALIASES[normalized] ?? normalized;
}

function detectImageType(buffer: Buffer): SupportedImage | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  if (
    buffer.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))
  ) {
    return { contentType: "image/gif", extension: "gif" };
  }
  return null;
}
