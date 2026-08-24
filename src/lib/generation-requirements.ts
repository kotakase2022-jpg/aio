import type { PrimaryInformationType } from "@/lib/primary-information";
import type { AttachedFileInput, KeyValueInput, VisualToneInput } from "@/types/aio";

export type GenerationRequirementLabel = "参照情報" | "一次情報" | "画像トーン";

export function hasUsableReferenceInput(
  references: KeyValueInput[],
  referenceFiles: AttachedFileInput[],
) {
  return (
    references.some((item) => item.url?.trim() || item.text?.trim()) ||
    referenceFiles.some((file) => file.ok && file.text?.trim())
  );
}

export function hasUsableVisualTone(visualTone: VisualToneInput) {
  return Boolean(
    (visualTone.mode === "preset" && visualTone.preset) ||
      (visualTone.mode === "custom" && visualTone.custom?.trim()) ||
      (visualTone.mode === "upload" && visualTone.uploadedImageUrl),
  );
}

export function hasUsablePrimaryInformation(
  primaryInfoTypes: readonly PrimaryInformationType[],
  primaryInfo: string,
) {
  return primaryInfoTypes.length > 0 && primaryInfo.trim().length > 0;
}

export function getMissingGenerationRequirements({
  references,
  referenceFiles,
  primaryInfoTypes,
  primaryInfo,
  visualTone,
}: {
  references: KeyValueInput[];
  referenceFiles: AttachedFileInput[];
  primaryInfoTypes: readonly PrimaryInformationType[];
  primaryInfo: string;
  visualTone: VisualToneInput;
}) {
  const missing: GenerationRequirementLabel[] = [];
  if (!hasUsableReferenceInput(references, referenceFiles)) {
    missing.push("参照情報");
  }
  if (!hasUsablePrimaryInformation(primaryInfoTypes, primaryInfo)) {
    missing.push("一次情報");
  }
  if (!hasUsableVisualTone(visualTone)) {
    missing.push("画像トーン");
  }

  return missing;
}

export function formatGenerationRequirementMessage(
  missingRequirements: readonly GenerationRequirementLabel[],
) {
  return missingRequirements.length === 0
    ? ""
    : `${missingRequirements.join("と")}を入力すると記事作成を開始できます。`;
}
