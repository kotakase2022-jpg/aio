import { describe, expect, test } from "vitest";
import { formatJaDateTime } from "@/lib/date";

describe("formatJaDateTime", () => {
  test("formats valid ISO date strings for Japanese UI", () => {
    expect(formatJaDateTime("2026-07-02T00:31:00.000Z")).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/);
  });

  test("returns invalid date input unchanged", () => {
    expect(formatJaDateTime("not-a-date")).toBe("not-a-date");
  });
});
