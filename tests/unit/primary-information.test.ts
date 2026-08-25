import { describe, expect, it } from "vitest";
import { primaryInformationTypesForRestore } from "@/lib/primary-information";

describe("primaryInformationTypesForRestore", () => {
  it("preserves valid saved categories", () => {
    expect(
      primaryInformationTypesForRestore(["original-data", "frequent-consultations"]),
    ).toEqual(["original-data", "frequent-consultations"]);
  });

  it("does not invent a category for legacy metadata without categories", () => {
    expect(primaryInformationTypesForRestore(undefined)).toEqual([]);
  });

  it("drops unknown saved category values", () => {
    expect(primaryInformationTypesForRestore(["unknown-category"])).toEqual([]);
  });
});
