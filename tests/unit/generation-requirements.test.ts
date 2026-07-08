import { describe, expect, test } from "vitest";
import {
  formatGenerationRequirementMessage,
  getMissingGenerationRequirements,
} from "@/lib/generation-requirements";
import type { AttachedFileInput, KeyValueInput, VisualToneInput } from "@/types/aio";

const emptyReference: KeyValueInput = { id: "reference-1", url: "", text: "" };
const presetTone: VisualToneInput = {
  mode: "preset",
  preset: "シンプルなBtoBホワイトペーパー風",
  custom: "",
  uploadedImageUrl: "",
};
const emptyCustomTone: VisualToneInput = {
  mode: "custom",
  preset: "",
  custom: "",
  uploadedImageUrl: "",
};

function missingRequirements({
  references = [emptyReference],
  referenceFiles = [],
  visualTone = presetTone,
}: {
  references?: KeyValueInput[];
  referenceFiles?: AttachedFileInput[];
  visualTone?: VisualToneInput;
} = {}) {
  return getMissingGenerationRequirements({ references, referenceFiles, visualTone });
}

describe("generation requirements", () => {
  test("requires both reference input and visual tone from one source of truth", () => {
    const missing = missingRequirements({ visualTone: emptyCustomTone });

    expect(missing).toEqual(["参照情報", "画像トーン"]);
    expect(formatGenerationRequirementMessage(missing)).toBe(
      "参照情報と画像トーンを入力すると記事作成を開始できます。",
    );
  });

  test("accepts manual reference text with a preset tone", () => {
    expect(
      missingRequirements({
        references: [{ id: "reference-1", url: "", text: "現場で確認した一次情報" }],
        visualTone: presetTone,
      }),
    ).toEqual([]);
  });

  test("accepts extracted reference files as usable references", () => {
    expect(
      missingRequirements({
        referenceFiles: [
          {
            id: "file-1",
            name: "reference.txt",
            size: 128,
            type: "text/plain",
            text: "添付ファイルから抽出した参照情報",
            textLength: 15,
            ok: true,
            extractedAt: "2026-07-07T00:00:00.000Z",
          },
        ],
      }),
    ).toEqual([]);
  });

  test("ignores failed reference files and reports only the missing reference", () => {
    const missing = missingRequirements({
      referenceFiles: [
        {
          id: "file-1",
          name: "broken.pdf",
          size: 128,
          type: "application/pdf",
          text: "抽出できなかった参照情報",
          textLength: 0,
          ok: false,
          extractedAt: "2026-07-07T00:00:00.000Z",
        },
      ],
      visualTone: presetTone,
    });

    expect(missing).toEqual(["参照情報"]);
    expect(formatGenerationRequirementMessage(missing)).toBe(
      "参照情報を入力すると記事作成を開始できます。",
    );
  });

  test("reports only visual tone when reference input exists", () => {
    const missing = missingRequirements({
      references: [{ id: "reference-1", url: "https://example.com/reference", text: "" }],
      visualTone: emptyCustomTone,
    });

    expect(missing).toEqual(["画像トーン"]);
    expect(formatGenerationRequirementMessage(missing)).toBe(
      "画像トーンを入力すると記事作成を開始できます。",
    );
  });
});
