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
      message: "httpまたはhttpsのURLを入力してください。",
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
      reason: "URL取得に失敗しました（HTTP 404 Not Found）。",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("{}", { headers: { "content-type": "application/json" } }),
      ),
    );

    await expect(fetchUrlContent("https://example.com/json")).resolves.toMatchObject({
      ok: false,
      reason: "HTMLページではないため取得できませんでした（content-type: application/json）。",
    });
  });

  test("returns Japanese extraction notes for limited or insufficient page text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          "<html><head><title>短いページ</title><meta name=\"description\" content=\"サービス概要、料金、導入条件を説明するページです。\" /></head><body><h1>概要</h1><p>本文は短いですが、見出しと説明文を使えば補足できます。</p></body></html>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
      ),
    );

    await expect(fetchUrlContent("https://example.com/limited")).resolves.toMatchObject({
      ok: true,
      reason: "本文量が少ないため、メタ情報・見出しを利用しました。",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html><head><title>x</title></head><body></body></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );

    await expect(fetchUrlContent("https://example.com/empty")).resolves.toMatchObject({
      ok: false,
      reason: "十分な本文を抽出できませんでした。",
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
      reason: "URL取得に失敗しました。network down",
    });
  });
});
