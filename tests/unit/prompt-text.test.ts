import { describe, expect, test } from "vitest";
import { truncatePromptLine } from "@/lib/prompt-text";

describe("truncatePromptLine", () => {
  test("normalizes whitespace without truncating short lines", () => {
    expect(truncatePromptLine("  現場で\n確認した\t一次情報  ", 20)).toBe(
      "現場で 確認した 一次情報",
    );
  });

  test("truncates long prompt anchors with an ellipsis inside the limit", () => {
    const result = truncatePromptLine("1234567890", 6);

    expect(result).toBe("12345…");
    expect(result).toHaveLength(6);
  });

  test("handles narrow and invalid limits predictably", () => {
    expect(truncatePromptLine("参照情報", 1)).toBe("…");
    expect(truncatePromptLine("参照情報", 0)).toBe("");
    expect(truncatePromptLine("参照情報", -1)).toBe("");
  });
});
