import { describe, expect, test } from "vitest";
import { safeReturnPath } from "@/lib/login-redirect";

describe("login return path", () => {
  test("keeps a path on this site with its query and hash", () => {
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/?tab=preview")).toBe("/?tab=preview");
    expect(safeReturnPath("/drafts/1?x=1#top")).toBe("/drafts/1?x=1#top");
    expect(safeReturnPath("/%2F%2Fexample.com")).toBe("/%2F%2Fexample.com");
  });

  test("a path that a second check would turn into another site is rejected the first time", () => {
    // The login page checks `next` once, and the form checks it again before navigating.
    for (const value of [
      "/.//return-path.invalid//evil.example",
      "/.//evil.example",
      "/..//evil.example",
      "/a/..//evil.example",
      "/%2e//evil.example",
      "/./\\evil.example",
    ]) {
      const pageSide = safeReturnPath(value);
      const formSide = safeReturnPath(pageSide);

      expect(pageSide, value).toBe("/");
      expect(formSide, value).toBe("/");
    }
  });

  test("whatever comes in, the result is a path on this site and checking it again changes nothing", () => {
    for (const value of [
      "/?tab=preview",
      "/drafts/1?x=1#top",
      "/.//return-path.invalid//evil.example",
      "/./x//y",
      "/x/.//y",
      "//evil.example",
      "/\\evil.example",
      "/%2F%2Fevil.example",
      "/\t/evil.example",
    ]) {
      const once = safeReturnPath(value);

      expect(safeReturnPath(once), value).toBe(once);
      expect(once.startsWith("//"), value).toBe(false);
      expect(new URL(once, "https://app.example/login").origin, value).toBe("https://app.example");
    }
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
