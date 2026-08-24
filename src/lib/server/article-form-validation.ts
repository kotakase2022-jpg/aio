import {
  isPrimaryInformationType,
  type PrimaryInformationType,
} from "@/lib/primary-information";
import { ApiError } from "@/lib/server/http";

export function assertRequiredArticleGenerationInputs(form: Record<string, unknown>) {
  const missing: string[] = [];

  if (!hasReferenceInput(form.references, form.referenceFiles)) {
    missing.push("参照情報");
  }

  const primaryInfoTypes = readPrimaryInformationTypes(form.primaryInfoTypes);
  const primaryInfo = typeof form.primaryInfo === "string" ? form.primaryInfo.trim() : "";
  if (primaryInfoTypes.length === 0 || !primaryInfo) {
    missing.push("一次情報（種類の選択と具体的な内容）");
  }

  if (!hasVisualTone(form.visualTone)) {
    missing.push("画像トーン");
  }

  if (missing.length > 0) {
    throw new ApiError(`${missing.join("、")}を入力してください。`, 400);
  }
}

function hasReferenceInput(references: unknown, referenceFiles: unknown) {
  const hasReference =
    Array.isArray(references) &&
    references.some(
      (item) =>
        isRecord(item) &&
        (hasText(item.url) || hasText(item.text)),
    );
  const hasFile =
    Array.isArray(referenceFiles) &&
    referenceFiles.some(
      (file) => isRecord(file) && file.ok === true && hasText(file.text),
    );

  return hasReference || hasFile;
}

function readPrimaryInformationTypes(value: unknown): PrimaryInformationType[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PrimaryInformationType =>
      typeof item === "string" && isPrimaryInformationType(item),
  );
}

function hasVisualTone(value: unknown) {
  if (!isRecord(value)) return false;

  if (value.mode === "preset") return hasText(value.preset);
  if (value.mode === "custom") return hasText(value.custom);
  if (value.mode === "upload") return hasText(value.uploadedImageUrl);
  return false;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
