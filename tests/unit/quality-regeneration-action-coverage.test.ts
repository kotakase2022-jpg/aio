import { readFileSync } from "node:fs";
import {
  qualityRegenerationAction,
  UNKNOWN_QUALITY_REGENERATION_ACTION,
} from "@/lib/quality-regeneration-action";
import { describe, expect, test } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(path, "utf8");
}

function extractQualityCheckIds(path: string) {
  const source = readProjectFile(path);
  return Array.from(source.matchAll(/id:\s*"([^"]+)"/g), (match) => match[1]);
}

function duplicateIds(ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }

  return Array.from(duplicates);
}

function idsWithoutActions(ids: string[]) {
  return ids.filter((id) => !qualityRegenerationAction(id).trim());
}

function idsUsingFallback(ids: string[]) {
  return ids.filter((id) => qualityRegenerationAction(id) === UNKNOWN_QUALITY_REGENERATION_ACTION);
}

function currentQualityCheckIds() {
  return [
    ...extractQualityCheckIds("src/lib/article-quality.ts"),
    ...extractQualityCheckIds("src/lib/title-quality.ts"),
    ...extractQualityCheckIds("src/lib/faq-quality.ts"),
  ];
}

describe("quality regeneration action coverage", () => {
  test("extracts non-empty unique quality check IDs from every quality evaluator", () => {
    const idsByFile = {
      "src/lib/article-quality.ts": extractQualityCheckIds("src/lib/article-quality.ts"),
      "src/lib/title-quality.ts": extractQualityCheckIds("src/lib/title-quality.ts"),
      "src/lib/faq-quality.ts": extractQualityCheckIds("src/lib/faq-quality.ts"),
    };

    for (const [path, ids] of Object.entries(idsByFile)) {
      expect(ids, `${path} should expose quality check IDs`).not.toHaveLength(0);
      expect(duplicateIds(ids), `${path} should not contain duplicate quality check IDs`).toEqual(
        [],
      );
    }
  });

  test("covers every article quality check with a concrete regeneration action", () => {
    const articleQualityIds = extractQualityCheckIds("src/lib/article-quality.ts");

    expect(idsWithoutActions(articleQualityIds)).toEqual([]);
  });

  test("covers title and FAQ quality checks through their regeneration action prefixes", () => {
    const titleQualityIds = extractQualityCheckIds("src/lib/title-quality.ts");
    const faqQualityIds = extractQualityCheckIds("src/lib/faq-quality.ts");

    expect(idsWithoutActions(titleQualityIds)).toEqual([]);
    expect(idsWithoutActions(faqQualityIds)).toEqual([]);
  });

  test("uses specialized regeneration actions for all current quality check IDs", () => {
    expect(idsUsingFallback(currentQualityCheckIds())).toEqual([]);
  });

  test("keeps generic phrase regeneration tied to concrete replacement material", () => {
    const action = qualityRegenerationAction("generic-phrases");

    expect(action).toContain("わかりやすく解説");
    expect(action).toContain("参照元の事実");
    expect(action).toContain("一次情報");
    expect(action).toContain("判断基準");
  });

  test("keeps generic opening density regeneration focused on first-party context", () => {
    const action = qualityRegenerationAction("generic-opening-density");

    expect(action).toContain("冒頭400字以内");
    expect(action).toContain("一次情報");
    expect(action).toContain("現場で見た条件");
  });

  test("keeps an explicit non-empty fallback action for future quality checks", () => {
    const fallback = qualityRegenerationAction("future-quality-check");

    expect(fallback).toBe(UNKNOWN_QUALITY_REGENERATION_ACTION);
    expect(fallback).not.toBe("");
  });
});
