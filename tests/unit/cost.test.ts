import { describe, expect, test } from "vitest";
import { estimateAioRunCostUsd } from "@/lib/cost";

describe("estimateAioRunCostUsd", () => {
  test("calculates text and image generation costs with rounding", () => {
    expect(
      estimateAioRunCostUsd({
        inputTokens: 20_000,
        outputTokens: 8_000,
        imageCount: 2,
        textInputUsdPerMillion: 1,
        textOutputUsdPerMillion: 5,
        imageUsdEach: 0.06,
      }),
    ).toBe(0.18);
  });

  test("normalizes invalid and boundary values safely", () => {
    expect(estimateAioRunCostUsd({ inputTokens: -1, outputTokens: Number.NaN, imageCount: 99 })).toBe(
      0.24,
    );
  });
});
