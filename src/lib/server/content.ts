import * as cheerio from "cheerio";
import { ApiError } from "@/lib/server/http";
import { truncateText } from "@/lib/utils";
import type { FetchResult } from "@/types/aio";

export async function fetchUrlContent(url: string): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError("URL形式が正しくありません。", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ApiError("httpまたはhttpsのURLを入力してください。", 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIOArticleGenerator/1.0; +https://vercel.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
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

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      cleanText($("meta[property='og:title']").attr("content") ?? "") ||
      cleanText($("title").first().text());
    const description = cleanText(
      $("meta[name='description']").attr("content") ??
        $("meta[property='og:description']").attr("content") ??
        "",
    );
    const headings = cleanText($("h1, h2, h3").text());
    const paragraphs = cleanText($("p, li").text());
    const linkText = cleanText(
      $("a")
        .map((_, element) => $(element).text())
        .get()
        .filter((text) => cleanText(text).length >= 6)
        .slice(0, 40)
        .join(" "),
    );

    $("script, style, noscript, svg, nav, footer, header, form, aside").remove();

    const articleText =
      cleanText($("article").text()) ||
      cleanText($("main").text()) ||
      cleanText($("body").text());

    const fallbackText = cleanText(
      [title, description, headings, paragraphs, linkText, articleText]
        .filter(Boolean)
        .join("\n\n"),
    );
    const extractedText = articleText.length >= 120 ? articleText : fallbackText;

    if (!extractedText || extractedText.length < 40) {
      return {
        url,
        title,
        ok: false,
        reason: "十分な本文を抽出できませんでした。",
        sourceType: "url",
      };
    }

    return {
      url,
      title,
      text: truncateText(extractedText),
      ok: true,
      sourceType: "url",
      reason:
        articleText.length >= 120
          ? undefined
          : "本文量が少ないため、メタ情報・見出しを利用しました。",
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "通信がタイムアウトしました。"
        : error instanceof Error
          ? `URL取得に失敗しました。${error.message}`
          : "URL取得中に不明なエラーが発生しました。";

    return { url, ok: false, reason, sourceType: "url" };
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
