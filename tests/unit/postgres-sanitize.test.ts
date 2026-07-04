import { describe, expect, test } from "vitest";
import { sanitizeForPostgres } from "@/lib/server/postgres-sanitize";

describe("sanitizeForPostgres", () => {
  test("removes disallowed control characters without changing valid unicode", () => {
    const sanitized = sanitizeForPostgres("AIO\u0000記事\u0008生成😀");
    expect(sanitized).toBe("AIO記事生成😀");
  });

  test("replaces invalid surrogate pairs in nested objects", () => {
    const value = {
      title: "broken high \ud800",
      rows: ["broken low \udc00", { ok: "valid" }],
    };

    expect(sanitizeForPostgres(value)).toEqual({
      title: "broken high �",
      rows: ["broken low �", { ok: "valid" }],
    });
  });

  test("preserves Date instances and primitive boundary values", () => {
    const date = new Date("2026-07-02T00:00:00.000Z");
    const sanitized = sanitizeForPostgres({ date, zero: 0, empty: "", flag: false });

    expect(sanitized.date).toBe(date);
    expect(sanitized.zero).toBe(0);
    expect(sanitized.empty).toBe("");
    expect(sanitized.flag).toBe(false);
  });
});
