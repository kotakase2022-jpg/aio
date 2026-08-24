import { describe, expect, test } from "vitest";
import { assertRequiredArticleGenerationInputs } from "@/lib/server/article-form-validation";

const validForm: Record<string, unknown> = {
  references: [{ id: "ref-1", url: "", text: "公開前の編集基準をまとめた参照情報" }],
  referenceFiles: [],
  primaryInfoTypes: ["criteria-knowhow"],
  primaryInfo: "当社では、公開前に根拠、条件、反証可能性を分けて確認しています。",
  visualTone: {
    mode: "preset",
    preset: "シンプルなBtoBホワイトペーパー風",
  },
};

describe("article generation form validation", () => {
  test("accepts reference, categorized primary information, and a visual tone", () => {
    expect(() => assertRequiredArticleGenerationInputs(validForm)).not.toThrow();
  });

  test("reports every missing required input in Japanese", () => {
    expect(() =>
      assertRequiredArticleGenerationInputs({
        references: [],
        referenceFiles: [],
        primaryInfoTypes: [],
        primaryInfo: "",
        visualTone: { mode: "custom", custom: "" },
      }),
    ).toThrow(
      "参照情報、一次情報（種類の選択と具体的な内容）、画像トーンを入力してください。",
    );
  });

  test("does not accept free text without a recognized primary-information type", () => {
    expect(() =>
      assertRequiredArticleGenerationInputs({
        ...validForm,
        primaryInfoTypes: ["unknown-category"],
      }),
    ).toThrow("一次情報（種類の選択と具体的な内容）を入力してください。");
  });

  test("accepts an extracted reference file and uploaded visual image", () => {
    expect(() =>
      assertRequiredArticleGenerationInputs({
        ...validForm,
        references: [],
        referenceFiles: [{ ok: true, text: "添付資料から抽出した参照情報" }],
        visualTone: {
          mode: "upload",
          uploadedImageUrl: "https://storage.example.com/tone.png",
        },
      }),
    ).not.toThrow();
  });
});
