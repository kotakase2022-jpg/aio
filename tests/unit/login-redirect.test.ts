import { describe, expect, test } from "vitest";
import { safeReturnPath } from "@/lib/login-redirect";

describe("login return path", () => {
  test("keeps a path on this site with its query and hash", () => {
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/?tab=preview")).toBe("/?tab=preview");
    expect(safeReturnPath("/drafts/1?x=1#top")).toBe("/drafts/1?x=1#top");
    expect(safeReturnPath("/%2F%2Fexample.com")).toBe("/%2F%2Fexample.com");
  });

  test("anything a browser could read as another site falls back to the start page", () => {
    for (const value of [
      undefined,
      ["/?tab=preview"],
      "",
      "https://example.com/",
      "example.com",
      "//example.com",
      "/\\example.com",
      "/\t/example.com",
      "/\n/example.com",
      "\\\\example.com",
      "javascript:alert(1)",
    ]) {
      expect(safeReturnPath(value), String(value)).toBe("/");
    }
  });
});
