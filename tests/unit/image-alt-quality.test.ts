import { describe, expect, test } from "vitest";
import { evaluateImageAltQuality } from "@/lib/image-alt-quality";

describe("evaluateImageAltQuality", () => {
  test("passes specific image alt text that reflects article context", () => {
    const result = evaluateImageAltQuality({
      images: [
        {
          slot: "featured",
          altText: "AIO承認フローで一次情報と公開前レビューを確認するB2B編集チーム",
          prompt: "B2B editorial workflow diagram for AIO approval context",
        },
      ],
      imageCount: 1,
      themeText: "AIO article generation for B2B marketing teams",
      primaryInfo:
        "In our support work, teams struggle most when AI drafts lack field observations and approval context.",
    });

    expect(result.score).toBe(100);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  test("flags missing or generic image alt text", () => {
    const result = evaluateImageAltQuality({
      images: [{ slot: "featured", altText: "image", prompt: "generic business visual" }],
      imageCount: 1,
      themeText: "Labor insurance workflow for one-person contractors and LINE approvals",
      primaryInfo:
        "Our support team sees one-person contractors using LINE for approvals while forms are often missing.",
    });

    expect(result.score).toBeLessThan(90);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "image-alt-length", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "image-alt-specificity", passed: false }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ id: "image-alt-article-signal", passed: false }),
    );
    expect(result.improvements.join(" ")).toContain("画像alt");
  });

  test("passes cleanly for text-only drafts with zero requested images", () => {
    const result = evaluateImageAltQuality({ images: [], imagePrompts: [], imageCount: 0 });

    expect(result.score).toBe(100);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });
});
