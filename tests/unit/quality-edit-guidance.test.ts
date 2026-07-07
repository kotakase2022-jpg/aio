import { describe, expect, it } from "vitest";

import { qualityCheckEditGuidance } from "@/lib/quality-edit-guidance";
import { extractQualityCheckIds } from "../helpers/quality-check-ids";

describe("qualityCheckEditGuidance", () => {
  it("does not fall back to generic guidance for current quality check IDs", () => {
    const fallback = qualityCheckEditGuidance("future-quality-check");
    const currentIds = [
      ...extractQualityCheckIds("src/lib/article-quality.ts"),
      ...extractQualityCheckIds("src/lib/title-quality.ts"),
      ...extractQualityCheckIds("src/lib/faq-quality.ts"),
      ...extractQualityCheckIds("src/lib/meta-description-quality.ts"),
      ...extractQualityCheckIds("src/lib/image-alt-quality.ts"),
    ];

    expect(currentIds).not.toHaveLength(0);
    expect(currentIds.filter((id) => qualityCheckEditGuidance(id) === fallback)).toEqual([]);
  });

  it("gives specific guidance for article quality checks that need human editing", () => {
    const expectations = [
      ["concrete-detail", "数字、現場例、判断基準、失敗例"],
      ["editorial-evidence", "編集者が確認した記事"],
      ["structured-elements", "箇条書きとFAQ"],
      ["unsupported-claims", "強い断定"],
      ["source-awareness", "未確認の解釈"],
      ["theme-keyword-reflection", "入力テーマ・キーワード"],
      ["primary-info-reflection", "当社の経験"],
      ["cta-reflection", "記事末尾の自然な次アクション"],
      ["generic-opening-density", "冒頭400字以内の汎用句"],
    ] as const;

    for (const [checkId, expectedText] of expectations) {
      const guidance = qualityCheckEditGuidance(checkId);

      expect(guidance).toContain("修正先: 本文HTML");
      expect(guidance).toContain(expectedText);
      expect(guidance).not.toContain("一般論を減らし");
    }
  });

  it("gives specific guidance for meta description checks", () => {
    const guidance = qualityCheckEditGuidance("meta-description-specificity");

    expect(guidance).toContain("修正先: メタディスクリプション");
    expect(guidance).toContain("記事固有の判断軸");
    expect(guidance).not.toContain("本文HTML");
  });

  it("gives specific guidance for image alt checks", () => {
    const guidance = qualityCheckEditGuidance("image-alt-specificity");

    expect(guidance).toContain("修正先: 生成画像");
    expect(guidance).toContain("記事テーマ");
    expect(guidance).not.toContain("本文HTML");
  });
});
