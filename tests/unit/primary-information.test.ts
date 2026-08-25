import { describe, expect, it } from "vitest";
import {
  primaryInformationLabels,
  primaryInformationTypesForRestore,
} from "@/lib/primary-information";

describe("primaryInformationTypesForRestore", () => {
  it("preserves valid saved categories", () => {
    expect(
      primaryInformationTypesForRestore(
        ["original-data", "frequent-consultations"],
        "独自調査の結果です。",
      ),
    ).toEqual(["original-data", "frequent-consultations"]);
  });

  it("classifies legacy text without categories as other", () => {
    expect(primaryInformationTypesForRestore(undefined, "以前に保存した一次情報")).toEqual([
      "other",
    ]);
    expect(primaryInformationLabels(["other"])).toEqual(["その他の一次情報"]);
  });

  it("does not invent a category when primary information is empty", () => {
    expect(primaryInformationTypesForRestore(undefined, "  ")).toEqual([]);
  });
});
