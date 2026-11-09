import { describe, expect, test, vi } from "vitest";
import { fetchUrlContent } from "@/lib/server/content";
import { encodedHtmlFixtures } from "../fixtures/encoded-html";

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
    expect(result.evidenceUsable).toBe(true);
    expect(result.pageKind).toBe("article");
    expect(result.title).toBe("AIO title");
    expect(result.text).toContain("long enough article paragraph");
  });

  test.each([
    {
      label: "Shift_JIS from the HTTP header",
      bytes: encodedHtmlFixtures.shiftJis,
      contentType: "text/html; charset=Windows-31J",
      expectedEncoding: "shift_jis",
      expectedTitle: "犬猫の口腔ケア",
      expectedText: "犬と猫の口腔ケア",
    },
    {
      label: "EUC-JP from an HTML meta declaration",
      bytes: encodedHtmlFixtures.eucJp,
      contentType: "text/html",
      expectedEncoding: "euc-jp",
      expectedTitle: "中小企業の資金調達",
      expectedText: "中小企業の資金調達",
    },
  ])("decodes $label without replacement characters", async (fixture) => {
    const fetcher = vi.fn(async () =>
      new Response(fixture.bytes, { headers: { "content-type": fixture.contentType } }),
    );

    const result = await fetchUrlContent("https://example.com/encoded", fetcher);

    expect(result).toMatchObject({
      ok: true,
      evidenceUsable: true,
      encoding: fixture.expectedEncoding,
    });
    expect(result.title).toContain(fixture.expectedTitle);
    expect(result.text).toContain(fixture.expectedText);
    expect(result.text).not.toContain("�");
  });

  test("gives a BOM precedence over conflicting transport and meta declarations", async () => {
    const utf8Html = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(
        '<html><head><meta charset="Shift_JIS"><title>BOM優先</title></head><body><article><p>UTF-8のBOMを優先して安全に復号するための十分な本文です。文字化けした文章を根拠にしません。</p></article></body></html>',
        "utf8",
      ),
    ]);
    const fetcher = vi.fn(async () =>
      new Response(utf8Html, {
        headers: { "content-type": "text/html; charset=EUC-JP" },
      }),
    );

    const result = await fetchUrlContent("https://example.com/bom", fetcher);

    expect(result.encoding).toBe("utf-8");
    expect(result.title).toBe("BOM優先");
    expect(result.warnings?.join(" ")).toContain("BOM");
  });

  test("does not reject readable article evidence because script data contains replacement characters", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        [
          "<html><head><title>正常な記事</title>",
          '<script type="application/json">{"tracking":"��"}</script></head>',
          "<body><article><h1>犬猫の口腔ケア</h1>",
          "<p>犬猫の口腔ケアは、毎日の観察と無理のない習慣化から始めます。食べ方や口臭などの変化を記録し、異変が続く場合は自己判断せず獣医師に相談してください。</p>",
          "</article></body></html>",
        ].join(""),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      ),
    );

    const result = await fetchUrlContent("https://example.com/readable", fetcher);

    expect(result).toMatchObject({ ok: true, evidenceUsable: true, pageKind: "article" });
    expect(result.text).not.toContain("�");
  });

  test("does not reintroduce navigation, footer, or sidebar text through fallback extraction", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        [
          "<html><head><title>短い本文</title></head><body>",
          '<nav><a>料金プラン一覧</a><a>採用情報はこちら</a></nav>',
          '<aside><p>人気記事ランキングと関連サービス</p></aside>',
          '<main><h1>お知らせ</h1><p>提供条件を更新しました。詳細は担当者へ確認してください。</p></main>',
          '<footer><p>会社概要 プライバシーポリシー サイトマップ</p></footer>',
          "</body></html>",
        ].join(""),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      ),
    );

    const result = await fetchUrlContent("https://example.com/notice", fetcher);

    expect(result.ok).toBe(true);
    expect(result.evidenceUsable).toBe(false);
    expect(result.text).toContain("提供条件を更新しました");
    expect(result.text).not.toMatch(/料金プラン一覧|採用情報|人気記事ランキング|会社概要/);
  });

  test("distinguishes a listing page from usable article evidence", async () => {
    const links = Array.from(
      { length: 18 },
      (_, index) => `<li><a href="/news/${index}">資金調達ニュース ${index + 1}</a></li>`,
    ).join("");
    const fetcher = vi.fn(async () =>
      new Response(
        `<html><head><title>ニュース一覧</title></head><body><main><h1>お知らせ一覧</h1><ul>${links}</ul></main></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      ),
    );

    const result = await fetchUrlContent("https://example.com/news", fetcher);

    expect(result).toMatchObject({
      ok: true,
      evidenceUsable: false,
      pageKind: "listing",
    });
    expect(result.reason).toContain("一覧ページ");
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
      evidenceUsable: false,
      pageKind: "insufficient",
    });

    const emptyFetcher = vi.fn(async () =>
        new Response("<html><head><title>x</title></head><body></body></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );

    await expect(fetchUrlContent("https://example.com/empty", emptyFetcher)).resolves.toMatchObject({
      ok: true,
      evidenceUsable: false,
      pageKind: "insufficient",
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
