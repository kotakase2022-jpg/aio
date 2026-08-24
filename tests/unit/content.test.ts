import { describe, expect, test, vi } from "vitest";
import { fetchUrlContent } from "@/lib/server/content";

describe("fetchUrlContent", () => {
  test("extracts article text from HTML responses", async () => {
    const fetcher = vi.fn(async () =>
        new Response(
          "<html><head><title>AIO title</title></head><body><article><h1>Heading</h1><p>This is a long enough article paragraph for extraction and summarization testing.</p></article></body></html>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
      );

    const result = await fetchUrlContent("https://example.com/article", fetcher);

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

  test("rejects loopback and private-network targets before making a request", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("<html><body><p>private content</p></body></html>"),
    );

    await expect(fetchUrlContent("http://127.0.0.1/admin", fetchMock)).rejects.toMatchObject({
      message: "安全上の理由により、このURLは取得できません。",
      status: 400,
    });
    await expect(fetchUrlContent("http://169.254.169.254/latest/meta-data", fetchMock)).rejects.toMatchObject({
      message: "安全上の理由により、このURLは取得できません。",
      status: 400,
    });
    await expect(fetchUrlContent("http://localhost:3000/internal", fetchMock)).rejects.toMatchObject({
      message: "安全上の理由により、このURLは取得できません。",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns understandable failure results for HTTP and content-type errors", async () => {
    const missingFetcher = vi.fn(async () =>
      new Response("not found", { status: 404, statusText: "Not Found" }),
    );

    await expect(fetchUrlContent("https://example.com/missing", missingFetcher)).resolves.toMatchObject({
      ok: false,
      reason: "URL取得に失敗しました（HTTP 404 Not Found）。",
    });

    const jsonFetcher = vi.fn(async () =>
        new Response("{}", { headers: { "content-type": "application/json" } }),
      );

    await expect(fetchUrlContent("https://example.com/json", jsonFetcher)).resolves.toMatchObject({
      ok: false,
      reason: "HTMLページではないため取得できませんでした（content-type: application/json）。",
    });
  });

  test("returns Japanese extraction notes for limited or insufficient page text", async () => {
    const limitedFetcher = vi.fn(async () =>
        new Response(
          "<html><head><title>短いページ</title><meta name=\"description\" content=\"サービス概要、料金、導入条件を説明するページです。\" /></head><body><h1>概要</h1><p>本文は短いですが、見出しと説明文を使えば補足できます。</p></body></html>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
      );

    await expect(fetchUrlContent("https://example.com/limited", limitedFetcher)).resolves.toMatchObject({
      ok: true,
      reason: "本文量が少ないため、メタ情報・見出しを利用しました。",
    });

    const emptyFetcher = vi.fn(async () =>
        new Response("<html><head><title>x</title></head><body></body></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

    await expect(fetchUrlContent("https://example.com/empty", emptyFetcher)).resolves.toMatchObject({
      ok: false,
      reason: "十分な本文を抽出できませんでした。",
    });
  });

  test("returns fallback error result on network failure", async () => {
    const failingFetcher = vi.fn(async () => {
        throw new Error("network down");
      });

    await expect(fetchUrlContent("https://example.com/error", failingFetcher)).resolves.toMatchObject({
      ok: false,
      reason: "URL取得に失敗しました。network down",
    });
  });
});
