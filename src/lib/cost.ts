export type AioRunCostInput = {
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
  textInputUsdPerMillion?: number;
  textOutputUsdPerMillion?: number;
  imageUsdEach?: number;
};

export function estimateAioRunCostUsd({
  inputTokens,
  outputTokens,
  imageCount,
  textInputUsdPerMillion = 1.25,
  textOutputUsdPerMillion = 10,
  imageUsdEach = 0.08,
}: AioRunCostInput) {
  const normalizedInputTokens = nonNegative(inputTokens);
  const normalizedOutputTokens = nonNegative(outputTokens);
  const normalizedImageCount = Math.min(Math.floor(nonNegative(imageCount)), 3);

  return roundUsd(
    (normalizedInputTokens / 1_000_000) * textInputUsdPerMillion +
      (normalizedOutputTokens / 1_000_000) * textOutputUsdPerMillion +
      normalizedImageCount * imageUsdEach,
  );
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function roundUsd(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
