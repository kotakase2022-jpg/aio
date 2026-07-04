import { describe, expect, test, vi } from "vitest";
import { fetchUrlContent } from "@/lib/server/content";

describe("fetchUrlContent", () => {
  test("extracts article text from HTML responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          "<html><head><title>AIO title</title></head><body><article><h1>Heading</h1><p>This is a long enough article paragraph for extraction and summarization testing.</p></article></body></html>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
      ),
    );

    const result = await fetchUrlContent("https://example.com/article");

    expect(result.ok).toBe(true);
    expect(result.title).toBe("AIO title");
    expect(result.text).toContain("long enough article paragraph");
  });

  test("rejects invalid URL protocols before fetch", async () => {
    await expect(fetchUrlContent("ftp://example.com/file")).rejects.toMatchObject({
      status: 400,
    });
  });

  test("returns understandable failure results for HTTP and content-type errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404, statusText: "Not Found" })),
    );

    await expect(fetchUrlContent("https://example.com/missing")).resolves.toMatchObject({
      ok: false,
      reason: "HTTP 404 Not Found",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("{}", { headers: { "content-type": "application/json" } }),
      ),
    );

    await expect(fetchUrlContent("https://example.com/json")).resolves.toMatchObject({
      ok: false,
      reason: "Unsupported content type: application/json",
    });
  });

  test("returns fallback error result on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(fetchUrlContent("https://example.com/error")).resolves.toMatchObject({
      ok: false,
      reason: "network down",
    });
  });
});
