import { describe, expect, it } from "vitest";
import { primaryInformationTypesForRestore } from "@/lib/primary-information";

describe("primaryInformationTypesForRestore", () => {
  it("preserves valid saved categories", () => {
    expect(
      primaryInformationTypesForRestore(
        ["original-data", "frequent-consultations"],
        "独自調査の結果です。",
      ),
    ).toEqual(["original-data", "frequent-consultations"]);
  });

  it("infers a concrete category for legacy text without categories", () => {
    expect(
      primaryInformationTypesForRestore(undefined, "スマホで簡単なDXを希望する企業80％"),
    ).toEqual(["original-data"]);
    expect(primaryInformationTypesForRestore(undefined, "以前に保存した自社独自の考え")).toEqual([
      "expert-opinion",
    ]);
  });

  it("does not invent a category when primary information is empty", () => {
    expect(primaryInformationTypesForRestore(undefined, "  ")).toEqual([]);
  });
});
