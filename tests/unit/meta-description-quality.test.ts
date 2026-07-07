import { describe, expect, test } from "vitest";
import { evaluateMetaDescriptionQuality } from "@/lib/meta-description-quality";

describe("evaluateMetaDescriptionQuality", () => {
  test("passes practical meta descriptions that reflect input signals", () => {
    const result = evaluateMetaDescriptionQuality({
      metaDescription:
        "AIO記事生成でAI風の一般論を減らし、B2Bチームが一次情報と承認フローを反映して公開前に判断する方法を整理します。",
      themeText: "AIO article generation for B2B marketing teams",
      primaryInfo:
        "In our support work, teams struggle most when AI drafts lack field observations and approval context.",
    });

    expect(result.score).toBe(100);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  test("flags empty, short, and generic meta descriptions", () => {
    const result = evaluateMetaDescriptionQuality({
      metaDescription: "この記事ではAIOについてわかりやすく解説します。",
      themeText: "Labor insurance workflow for one-person contractors and LINE approvals",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.score).toBeLessThan(80);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "meta-description-length", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "meta-description-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "meta-description-input-signal", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("汎用句");
  });
});
