import { describe, expect, test } from "vitest";
import { englishTokenAppearsInText } from "@/lib/english-token";

describe("englishTokenAppearsInText", () => {
  test("matches English terms separated by natural editorial punctuation", () => {
    expect(englishTokenAppearsInText("form", "Form-based approval workflow")).toBe(true);
    expect(englishTokenAppearsInText("search", "AI/Search title review")).toBe(true);
    expect(englishTokenAppearsInText("approval", "Form: approval workflow")).toBe(true);
  });

  test("does not match English terms inside words or underscore joined tokens", () => {
    expect(englishTokenAppearsInText("form", "platform workflow")).toBe(false);
    expect(englishTokenAppearsInText("form", "platform_form workflow")).toBe(false);
  });
});
