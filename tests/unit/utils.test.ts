import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import {
  compactOptionalText,
  joinCsv,
  parseCsvObjects,
  parseCsvRows,
  splitCsv,
  truncateText,
} from "@/lib/utils";

describe("utils CSV and text helpers", () => {
  test("splitCsv trims empty items and joinCsv preserves order", () => {
    expect(splitCsv(" AIO, , WordPress ,BtoB")).toEqual(["AIO", "WordPress", "BtoB"]);
    expect(joinCsv(["AIO", "WordPress"])).toBe("AIO, WordPress");
    expect(joinCsv(undefined)).toBe("");
  });

  test("truncateText keeps short text and marks boundary overflow", () => {
    expect(truncateText("short", 10)).toBe("short");
    expect(truncateText("12345678901", 10)).toBe("1234567890\n\n[truncated]");
  });

  test("compactOptionalText trims optional text and treats blank values as missing", () => {
    expect(compactOptionalText(undefined, 10)).toBe("");
    expect(compactOptionalText(" \n\t ", 10)).toBe("");
    expect(compactOptionalText("  abc  ", 10)).toBe("abc");
    expect(compactOptionalText("  12345678901  ", 10)).toBe("1234567890\n\n[truncated]");
  });

  test("parseCsvRows handles quoted commas and multiline values", async () => {
    const csv = await readFile("tests/fixtures/csv/valid.csv", "utf8");
    expect(parseCsvRows(csv)).toEqual([
      ["name", "keyword", "count"],
      ["AIO guide", "AI search, BtoB", "3"],
      ["WordPress draft", "application password", "1"],
    ]);

    const boundary = await readFile("tests/fixtures/csv/boundary.csv", "utf8");
    expect(parseCsvObjects(boundary)).toContainEqual({
      id: "quoted",
      value: "line 1\nline 2",
    });
  });

  test("parseCsvRows returns empty data for empty fixtures and rejects malformed quotes", async () => {
    const empty = await readFile("tests/fixtures/csv/empty.csv", "utf8");
    const invalid = await readFile("tests/fixtures/csv/invalid.csv", "utf8");

    expect(parseCsvRows(empty)).toEqual([]);
    expect(() => parseCsvRows(invalid)).toThrow("unterminated quoted field");
  });
});
