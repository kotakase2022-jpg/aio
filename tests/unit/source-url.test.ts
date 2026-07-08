import { describe, expect, test } from "vitest";

import {
  articleContainsCanonicalSourceUrl,
  normalizeSourceUrl,
  normalizeSourceUrls,
  sourceUrlCandidates,
} from "@/lib/source-url";

describe("source URL helpers", () => {
  test("normalizes source URLs and rejects non-http inputs", () => {
    expect(normalizeSourceUrl(" https://example.com/reference/。） ")).toBe(
      "https://example.com/reference",
    );
    expect(normalizeSourceUrl("https://example.com/reference?id=primary&amp;page=1")).toBe(
      "https://example.com/reference?id=primary&page=1",
    );
    expect(normalizeSourceUrl("https://example.com/reference?id=primary&AMP;page=1")).toBe(
      "https://example.com/reference?id=primary&page=1",
    );
    expect(normalizeSourceUrl("https://example.com/reference?id=primary&#038;page=1")).toBe(
      "https://example.com/reference?id=primary&page=1",
    );
    expect(normalizeSourceUrl("&quot;https://example.com/reference?id=primary&amp;page=1&quot;")).toBe(
      "https://example.com/reference?id=primary&page=1",
    );
    expect(normalizeSourceUrl("https://example.com/reference?id=primary&#34;")).toBe(
      "https://example.com/reference?id=primary",
    );
    expect(normalizeSourceUrl("mailto:editor@example.com")).toBe("");
  });

  test("deduplicates tracking, protocol, and www variants while keeping meaningful queries", () => {
    expect(
      normalizeSourceUrls([
        "https://www.example.com/reference?id=primary&amp;utm_source=newsletter",
        "http://example.com/reference?id=primary",
        "https://example.com/reference?id=secondary&Amp;page=1",
        "&quot;https://example.com/reference?id=secondary&#038;page=1&quot;",
      ]),
    ).toEqual([
      "https://www.example.com/reference?id=primary&utm_source=newsletter",
      "https://example.com/reference?id=secondary&page=1",
    ]);
  });

  test("recognizes visible source URLs with reordered meaningful query parameters", () => {
    expect(
      articleContainsCanonicalSourceUrl(
        "https://example.com/reference?id=primary&page=1&utm_medium=email",
        '<a href="https://example.com/reference?page=1&id=primary">Primary source</a>',
      ),
    ).toBe(true);
  });

  test("recognizes escaped visible source URLs in article HTML", () => {
    expect(
      articleContainsCanonicalSourceUrl(
        "https://example.com/reference?id=primary&page=1&utm_medium=email",
        '<a href="https://example.com/reference?page=1&#x26;id=primary">Primary source</a>',
      ),
    ).toBe(true);
  });

  test("recognizes source URLs from fully escaped anchor attributes", () => {
    expect(
      articleContainsCanonicalSourceUrl(
        "https://example.com/reference?id=primary&page=1&utm_medium=email",
        "Source: &lt;a href=&quot;https://example.com/reference?page=1&amp;id=primary&quot;&gt;Primary source&lt;/a&gt;",
      ),
    ).toBe(true);
  });

  test("keeps path-only candidates separate from meaningful query URLs", () => {
    expect(sourceUrlCandidates("https://www.example.com/reference?id=primary&Amp;page=1")).toEqual(
      expect.arrayContaining([
        "https://www.example.com/reference?id=primary&page=1",
        "https://example.com/reference?id=primary&page=1",
        "example.com/reference?id=primary&page=1",
      ]),
    );
    expect(sourceUrlCandidates("https://www.example.com/reference?id=primary&page=1")).not.toContain(
      "https://example.com/reference",
    );
  });
});
