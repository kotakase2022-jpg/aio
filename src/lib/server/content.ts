import * as cheerio from "cheerio";
import { ApiError } from "@/lib/server/http";
import { truncateText } from "@/lib/utils";
import {
  assertSafeOutboundUrl,
  OutboundResponseTooLargeError,
  safeFetch,
  type SafeFetch,
  UnsafeOutboundUrlError,
} from "@/lib/server/safe-http";
import type { FetchResult } from "@/types/aio";

export async function fetchUrlContent(
  url: string,
  fetcher: SafeFetch = safeFetch,
): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError("URL形式が正しくありません。", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ApiError("httpまたはhttpsのURLを入力してください。", 400);
  }

  try {
    assertSafeOutboundUrl(parsed);
  } catch (error) {
    if (error instanceof UnsafeOutboundUrlError) {
      throw new ApiError(error.message, 400);
    }
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetcher(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIOArticleGenerator/1.0; +https://vercel.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }, {
      allowRedirects: true,
      maxRedirects: 4,
      maxResponseBytes: 5 * 1024 * 1024,
      timeoutMs: 15_000,
    });

    if (!response.ok) {
      return {
        url,
        ok: false,
        reason: `URL取得に失敗しました（HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}）。`,
        sourceType: "url",
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        url,
        ok: false,
        reason: `HTMLページではないため取得できませんでした（content-type: ${
          contentType || "unknown"
        }）。`,
        sourceType: "url",
      };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const decoded = decodeHtmlBytes(bytes, contentType);
    const html = decoded.html;
    const $ = cheerio.load(html);

    const title =
      cleanText($("meta[property='og:title']").attr("content") ?? "") ||
      cleanText($("title").first().text());
    const description = cleanText(
      $("meta[name='description']").attr("content") ??
        $("meta[property='og:description']").attr("content") ??
        "",
    );
    removeBoilerplate($);
    // Keep adjacent blocks from joining into a different word or numeric claim.
    $("h1,h2,h3,h4,h5,h6,p,div,li,tr,td,th,section,article,br").before("\n").after("\n");
    const root = findContentRoot($);
    const headings = cleanText(root.find("h1, h2, h3").text());
    const paragraphs = root
      .find("p")
      .map((_, element) => cleanText($(element).text()))
      .get()
      .filter(Boolean);
    const paragraphText = cleanText(paragraphs.join(" "));
    const articleText = cleanText(root.text());
    const fallbackText = cleanText(
      [title, description, headings, paragraphText, articleText].filter(Boolean).join("\n\n"),
    );
    const extractedText = articleText.length >= 40 ? articleText : fallbackText;
    const pageKind = classifyPage({ $, root, title, headings, paragraphText, articleText });
    const evidenceUsable =
      !decoded.mojibakeSuspected &&
      (pageKind === "article" || pageKind === "notice") &&
      paragraphText.length >= 50;
    const reason = evidenceUsable
      ? decoded.warnings.length > 0
        ? decoded.warnings.join(" ")
        : undefined
      : extractionWarning(pageKind, decoded.mojibakeSuspected);

    return {
      url,
      title,
      text: extractedText ? truncateText(extractedText) : undefined,
      ok: true,
      evidenceUsable,
      pageKind,
      encoding: decoded.encoding,
      warnings: decoded.warnings,
      httpStatus: response.status,
      sourceType: "url",
      reason,
    };
  } catch (error) {
    const reason =
      error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)
        ? "通信がタイムアウトしました。"
        : error instanceof UnsafeOutboundUrlError
          ? error.message
          : error instanceof OutboundResponseTooLargeError
            ? `ページ容量が大きすぎるため取得できませんでした。${error.message}`
        : error instanceof Error
          ? `URL取得に失敗しました。${error.message}`
          : "URL取得中に不明なエラーが発生しました。";

    return { url, ok: false, reason, sourceType: "url" };
  } finally {
    clearTimeout(timer);
  }
}

type PageClassificationInput = {
  $: cheerio.CheerioAPI;
  root: ReturnType<cheerio.CheerioAPI>;
  title: string;
  headings: string;
  paragraphText: string;
  articleText: string;
};

export function decodeHtmlBytes(bytes: Buffer, contentType: string) {
  const bomEncoding = detectBomEncoding(bytes);
  const headerEncoding = normalizeEncodingLabel(extractCharset(contentType));
  const metaEncoding = normalizeEncodingLabel(extractMetaCharset(bytes));
  const encoding = bomEncoding || headerEncoding || metaEncoding || "utf-8";
  const warnings: string[] = [];

  if (bomEncoding && [headerEncoding, metaEncoding].some((value) => value && value !== bomEncoding)) {
    warnings.push(
      `文字コード指定が矛盾しているため、BOMの${bomEncoding}を優先しました。`,
    );
  } else if (headerEncoding && metaEncoding && headerEncoding !== metaEncoding) {
    warnings.push(
      `HTTPヘッダーとHTML内の文字コード指定が矛盾しているため、HTTPヘッダーの${headerEncoding}を優先しました。`,
    );
  }

  let html = "";
  try {
    html = new TextDecoder(encoding).decode(bytes);
  } catch {
    html = new TextDecoder("utf-8").decode(bytes);
    warnings.push(`宣言された文字コード${encoding}を利用できず、UTF-8で復号しました。`);
  }

  const mojibakeSuspected = hasSuspectedMojibake(html);
  if (mojibakeSuspected) {
    warnings.push(
      "復号結果に文字化けの可能性があります。AIの根拠には使わず、原文を確認して手動テキストで補ってください。",
    );
  }

  return { html, encoding, warnings, mojibakeSuspected };
}

function detectBomEncoding(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return "utf-16le";
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return "utf-16be";
  }
  return undefined;
}

function extractCharset(value: string) {
  return value.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] ?? "";
}

function extractMetaCharset(bytes: Buffer) {
  const head = bytes.subarray(0, 8192).toString("latin1");
  return (
    head.match(/<meta\b[^>]*charset\s*=\s*["']?([^\s"'/>;]+)/i)?.[1] ??
    head.match(/<meta\b[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^\s"';>]+)/i)?.[1] ??
    ""
  );
}

function normalizeEncodingLabel(value: string) {
  const label = value.trim().toLowerCase().replace(/_/g, "-");
  if (!label) return undefined;
  if (["utf8", "utf-8"].includes(label)) return "utf-8";
  if (["shift-jis", "shiftjis", "sjis", "x-sjis", "windows-31j", "cp932", "ms932"].includes(label)) {
    return "shift_jis";
  }
  if (["euc-jp", "eucjp", "x-euc-jp"].includes(label)) return "euc-jp";
  if (["iso-2022-jp", "jis"].includes(label)) return "iso-2022-jp";
  if (["utf-16", "utf-16le", "utf-16be"].includes(label)) return label;
  return label;
}

function hasSuspectedMojibake(value: string) {
  const visibleValue = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const replacementCount = (visibleValue.match(/\uFFFD/g) ?? []).length;
  return (
    replacementCount > 0 ||
    /(?:譁�|蜿門|縺[\u0080-\uFFFF]|繧[\u0080-\uFFFF])/.test(visibleValue)
  );
}

function removeBoilerplate($: cheerio.CheerioAPI) {
  $(
    [
      "script",
      "style",
      "noscript",
      "svg",
      "nav",
      "footer",
      "aside",
      '[role="navigation"]',
      '[role="banner"]',
      '[role="complementary"]',
      ".breadcrumb",
      ".breadcrumbs",
      ".global-nav",
      ".site-nav",
      ".sidebar",
      ".side-bar",
      ".related-posts",
      ".recommend",
      ".recommendation",
      ".ranking",
      ".social-share",
      ".cookie-banner",
    ].join(","),
  ).remove();

  const contentContainerSelector = [
    "article",
    "main",
    '[role="main"]',
    ".article-body",
    ".entry-content",
    ".post-content",
    ".article-content",
    "#main-content",
  ].join(",");
  $("header").each((_, element) => {
    if ($(element).closest(contentContainerSelector).length === 0) {
      $(element).remove();
    }
  });
}

function findContentRoot($: cheerio.CheerioAPI) {
  const selectors = [
    "article",
    "main",
    '[role="main"]',
    ".article-body",
    ".entry-content",
    ".post-content",
    ".article-content",
    "#main-content",
    "body",
  ];
  for (const selector of selectors) {
    const candidate = $(selector).first();
    if (candidate.length > 0) {
      return candidate;
    }
  }
  return $.root();
}

function classifyPage({ $, root, title, headings, paragraphText, articleText }: PageClassificationInput) {
  const linkCount = root.find("a[href]").length;
  const pageLinkCount = $("body a[href]").length;
  const paragraphCount = root.find("p").filter((_, element) => cleanText($(element).text()).length >= 20).length;
  const listLabel = `${title} ${headings}`;
  const looksLikeListing =
    (/(一覧|検索結果|記事一覧|ニュース一覧|お知らせ一覧)/.test(listLabel) && pageLinkCount >= 6) ||
    (linkCount >= 12 && paragraphText.length < Math.max(160, articleText.length * 0.35));

  if (looksLikeListing) return "listing" as const;
  if (paragraphText.length < 50 || paragraphCount === 0) return "insufficient" as const;
  if (/(お知らせ|ニュースリリース|更新情報)/.test(listLabel)) return "notice" as const;
  return "article" as const;
}

function extractionWarning(
  pageKind: FetchResult["pageKind"],
  mojibakeSuspected: boolean,
) {
  if (mojibakeSuspected) {
    return "URL取得には成功しましたが、文字化けの可能性があるため記事の根拠には使用しません。原文を確認し、手動テキストで補ってください。";
  }
  if (pageKind === "listing") {
    return "URL取得には成功しましたが、一覧ページと判定したため記事の根拠には使用しません。個別記事URLまたは本文の手動貼り付けを利用してください。";
  }
  return "URL取得には成功しましたが、テーマの根拠として使える本文を十分に抽出できませんでした。本文を手動テキストで補ってください。";
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
