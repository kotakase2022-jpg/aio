import path from "node:path";
import { inflateSync } from "node:zlib";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import { ApiError } from "@/lib/server/http";
import { truncateText } from "@/lib/utils";

export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".pptx",
  ".xlsx",
  ".docx",
  ".html",
  ".htm",
] as const;

const MAX_EXTRACTED_CHARS = 24_000;
const MIN_USEFUL_TEXT_CHARS = 20;
const PDF_PARSE_TIMEOUT_MS = 30_000;
const MAX_PDF_PAGES = 300;
const MAX_PDF_FALLBACK_BYTES = 8 * 1024 * 1024;
const MAX_OFFICE_XML_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_OFFICE_XML_TOTAL_BYTES = 16 * 1024 * 1024;

export async function extractAttachmentText({
  buffer,
  filename,
  contentType,
}: {
  buffer: Buffer;
  filename: string;
  contentType?: string;
}) {
  const extension = path.extname(filename).toLowerCase();

  if (!(SUPPORTED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ApiError(
      "対応していないファイル形式です。",
      400,
      "PDF/TXT/PPTX/XLSX/DOCX/HTMLのみ添付できます。",
    );
  }

  if (buffer.length === 0) {
    throw new ApiError("空のファイルです。", 400);
  }

  let text = "";
  try {
    if (extension === ".pdf") {
      text = await extractPdfText(buffer);
    } else if (extension === ".txt") {
      text = decodeText(buffer);
    } else if (extension === ".html" || extension === ".htm") {
      text = extractHtmlText(decodeText(buffer));
    } else if (extension === ".docx") {
      text = await extractDocxText(buffer);
    } else if (extension === ".pptx") {
      text = await extractPptxText(buffer);
    } else if (extension === ".xlsx") {
      text = await extractXlsxText(buffer);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      "ファイルを解析できませんでした。",
      422,
      "ファイルが破損していないか、拡張子と実際の形式が一致しているか確認してください。",
    );
  }

  const cleaned = cleanText(text);
  if (cleaned.length < MIN_USEFUL_TEXT_CHARS) {
    throw new ApiError(
      "十分な本文を抽出できませんでした。",
      422,
      `${contentType || extension}から十分な本文を抽出できませんでした。`,
    );
  }

  return truncateText(cleaned, MAX_EXTRACTED_CHARS);
}

async function extractPdfText(buffer: Buffer) {
  try {
    return await withTimeout(extractPdfTextWithPdfJs(buffer), PDF_PARSE_TIMEOUT_MS);
  } catch (error) {
    const fallbackText = extractPdfTextFallback(buffer);
    if (isHumanReadableText(fallbackText)) {
      return fallbackText;
    }

    throw error;
  }
}

async function extractPdfTextWithPdfJs(buffer: Buffer) {
  ensurePdfJsDomMatrix();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    disableFontFace: true,
    enableScripting: false,
    isEvalSupported: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  } as Parameters<typeof pdfjs.getDocument>[0] & { disableWorker: boolean });
  const document = await loadingTask.promise;
  const parts: string[] = [];

  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new ApiError(
        "PDFのページ数が上限を超えています。",
        413,
        `${MAX_PDF_PAGES}ページ以内のPDFを添付してください。`,
      );
    }
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean)
        .join(" ");

      if (pageText) {
        parts.push(pageText);
        if (parts.reduce((total, part) => total + part.length, 0) >= MAX_EXTRACTED_CHARS) {
          break;
        }
      }
    }
  } finally {
    await document.cleanup();
  }

  return parts.join("\n\n");
}

function ensurePdfJsDomMatrix() {
  const runtime = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
  };

  if (typeof runtime.DOMMatrix !== "undefined") {
    return;
  }

  class ServerDomMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    constructor(init?: number[] | Float32Array | Float64Array | ServerDomMatrix) {
      if (!init) {
        return;
      }

      const values = init instanceof ServerDomMatrix ? init.toFloat64Array() : Array.from(init);
      if (values.length >= 16) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = [
          values[0] ?? 1,
          values[1] ?? 0,
          values[4] ?? 0,
          values[5] ?? 1,
          values[12] ?? 0,
          values[13] ?? 0,
        ];
      } else if (values.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = [
          values[0] ?? 1,
          values[1] ?? 0,
          values[2] ?? 0,
          values[3] ?? 1,
          values[4] ?? 0,
          values[5] ?? 0,
        ];
      }
    }

    multiplySelf(other: ServerDomMatrix | DOMMatrix) {
      const matrix = new ServerDomMatrix(other as unknown as ServerDomMatrix);
      return this.applyMultiply(matrix);
    }

    preMultiplySelf(other: ServerDomMatrix | DOMMatrix) {
      const matrix = new ServerDomMatrix(other as unknown as ServerDomMatrix);
      const current = new ServerDomMatrix(this);
      this.copyFrom(matrix.applyMultiply(current));
      return this;
    }

    translate(tx = 0, ty = 0) {
      return new ServerDomMatrix(this).multiplySelf(new ServerDomMatrix([1, 0, 0, 1, tx, ty]));
    }

    scale(scaleX = 1, scaleY = scaleX) {
      return new ServerDomMatrix(this).multiplySelf(new ServerDomMatrix([scaleX, 0, 0, scaleY, 0, 0]));
    }

    invertSelf() {
      const determinant = this.a * this.d - this.b * this.c;
      if (determinant === 0) {
        this.a = Number.NaN;
        this.b = Number.NaN;
        this.c = Number.NaN;
        this.d = Number.NaN;
        this.e = Number.NaN;
        this.f = Number.NaN;
        return this;
      }

      const { a, b, c, d, e, f } = this;
      this.a = d / determinant;
      this.b = -b / determinant;
      this.c = -c / determinant;
      this.d = a / determinant;
      this.e = (c * f - d * e) / determinant;
      this.f = (b * e - a * f) / determinant;
      return this;
    }

    toFloat64Array() {
      return [this.a, this.b, this.c, this.d, this.e, this.f];
    }

    private applyMultiply(other: ServerDomMatrix) {
      const { a, b, c, d, e, f } = this;
      this.a = a * other.a + c * other.b;
      this.b = b * other.a + d * other.b;
      this.c = a * other.c + c * other.d;
      this.d = b * other.c + d * other.d;
      this.e = a * other.e + c * other.f + e;
      this.f = b * other.e + d * other.f + f;
      return this;
    }

    private copyFrom(other: ServerDomMatrix) {
      this.a = other.a;
      this.b = other.b;
      this.c = other.c;
      this.d = other.d;
      this.e = other.e;
      this.f = other.f;
    }
  }

  runtime.DOMMatrix = ServerDomMatrix as unknown as typeof DOMMatrix;
}

function decodeText(buffer: Buffer) {
  const utf8Text = stripUtf8Bom(buffer.toString("utf8"));

  if (!shouldTryShiftJisFallback(utf8Text)) {
    return utf8Text;
  }

  const shiftJisText = decodeShiftJis(buffer);

  if (!shiftJisText) {
    return utf8Text;
  }

  return textDecodeScore(shiftJisText) > textDecodeScore(utf8Text) ? shiftJisText : utf8Text;
}

function extractHtmlText(html: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header, form, aside").remove();
  $("[hidden], [aria-hidden='true']").remove();
  $("[class], [id], [role]").each((_, element) => {
    const marker = [$(element).attr("id"), $(element).attr("class"), $(element).attr("role")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (isHtmlNoiseMarker(marker)) {
      $(element).remove();
    }
  });
  const title = cleanText($("title").first().text());
  const description = cleanText(
    $("meta[name='description']").attr("content") ??
      $("meta[property='og:description']").attr("content") ??
      "",
  );
  const body = cleanText($("article").text() || $("main").text() || $("body").text());
  return [title, description, body].filter(Boolean).join("\n\n");
}

function stripUtf8Bom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function shouldTryShiftJisFallback(value: string) {
  return replacementCharacterCount(value) >= 2;
}

function replacementCharacterCount(value: string) {
  return (value.match(/\uFFFD/g) ?? []).length;
}

function decodeShiftJis(buffer: Buffer) {
  try {
    return new TextDecoder("shift_jis").decode(buffer);
  } catch {
    return "";
  }
}

function textDecodeScore(value: string) {
  const sample = value.slice(0, 4000);
  const replacementPenalty = (sample.match(/\uFFFD/g) ?? []).length * 8;
  const readableCount = Array.from(sample).filter((char) =>
    /[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s.,;:!?()[\]{}'"。「」、・ー\-]/u.test(
      char,
    ),
  ).length;

  return readableCount - replacementPenalty;
}

function isHtmlNoiseMarker(marker: string) {
  const tokens = marker.split(/[^a-z0-9]+/).filter(Boolean);
  const tokenSet = new Set(tokens);
  const exactNoiseTokens = new Set([
    "cookie",
    "consent",
    "breadcrumb",
    "breadcrumbs",
    "pagination",
    "popup",
    "modal",
    "advert",
    "advertisement",
    "ads",
  ]);

  if (tokens.some((token) => exactNoiseTokens.has(token))) {
    return true;
  }

  const hasShareToken = tokens.some((token) => ["share", "shares", "sharing"].includes(token));
  const hasShareWidget =
    hasShareToken &&
    tokens.some((token) =>
      [
        "button",
        "buttons",
        "link",
        "links",
        "social",
        "widget",
        "widgets",
      ].includes(token),
    );
  const hasSocialWidget =
    tokenSet.has("social") &&
    tokens.some((token) =>
      ["button", "buttons", "link", "links", "widget", "widgets", "share", "sharing"].includes(
        token,
      ),
    );
  const hasAdBanner =
    (tokenSet.has("ad") || tokenSet.has("ads")) &&
    (tokenSet.has("banner") || tokenSet.has("banners"));
  const hasSubscribeWidget =
    (tokenSet.has("subscribe") || tokenSet.has("subscription")) &&
    tokens.some((token) =>
      [
        "banner",
        "banners",
        "box",
        "boxes",
        "button",
        "buttons",
        "cta",
        "email",
        "form",
        "forms",
        "mail",
        "modal",
        "popup",
        "widget",
        "widgets",
      ].includes(token),
    );
  const hasNewsletterWidget =
    tokenSet.has("newsletter") &&
    tokens.some((token) =>
      [
        "banner",
        "banners",
        "box",
        "boxes",
        "button",
        "buttons",
        "cta",
        "email",
        "form",
        "forms",
        "mail",
        "modal",
        "popup",
        "signup",
        "subscribe",
        "widget",
        "widgets",
      ].includes(token),
    );

  return hasShareWidget || hasSocialWidget || hasAdBanner || hasSubscribeWidget || hasNewsletterWidget;
}

function extractPdfTextFallback(buffer: Buffer) {
  const streams = extractPdfStreams(buffer);
  const parts: string[] = [];

  for (const stream of streams) {
    parts.push(...extractPdfStrings(stream.toString("latin1")));
  }

  if (parts.length === 0) {
    parts.push(...extractPdfStrings(buffer.toString("latin1")));
  }

  return cleanText(parts.join(" "));
}

function extractPdfStreams(buffer: Buffer) {
  const source = buffer.toString("latin1");
  const streams: Buffer[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const streamIndex = source.indexOf("stream", cursor);
    if (streamIndex === -1) break;

    let dataStart = streamIndex + "stream".length;
    if (source.slice(dataStart, dataStart + 2) === "\r\n") {
      dataStart += 2;
    } else if (source[dataStart] === "\n" || source[dataStart] === "\r") {
      dataStart += 1;
    }

    const endIndex = source.indexOf("endstream", dataStart);
    if (endIndex === -1) break;

    const dictionaryStart = Math.max(0, source.lastIndexOf("<<", streamIndex));
    const dictionary = source.slice(dictionaryStart, streamIndex);
    const raw = buffer.subarray(dataStart, endIndex);

    if (/\/FlateDecode\b/.test(dictionary)) {
      try {
        streams.push(inflateSync(raw, { maxOutputLength: MAX_PDF_FALLBACK_BYTES }));
      } catch {
        if (raw.length <= MAX_PDF_FALLBACK_BYTES) {
          streams.push(raw);
        }
      }
    } else {
      streams.push(raw);
    }

    cursor = endIndex + "endstream".length;
    if (streams.reduce((total, stream) => total + stream.length, 0) > MAX_PDF_FALLBACK_BYTES) {
      throw new ApiError("PDFの展開後サイズが大きすぎます。", 413);
    }
  }

  return streams;
}

function extractPdfStrings(value: string) {
  const strings: string[] = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)\s*T[Jj]/g;
  const arrayLiteralRegex = /\[([\s\S]*?)\]\s*TJ/g;
  const hexRegex = /<([0-9A-Fa-f\s]{4,})>\s*T[Jj]/g;

  for (const match of value.matchAll(literalRegex)) {
    strings.push(decodePdfLiteral(match[0].slice(1, match[0].lastIndexOf(")"))));
  }

  for (const arrayMatch of value.matchAll(arrayLiteralRegex)) {
    for (const literal of arrayMatch[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      strings.push(decodePdfLiteral(literal[0].slice(1, -1)));
    }
  }

  for (const match of value.matchAll(hexRegex)) {
    strings.push(decodePdfHex(match[1]));
  }

  return strings.filter((part) => cleanText(part).length > 0);
}

function decodePdfLiteral(value: string) {
  return value.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, escaped: string) => {
    if (escaped === "n") return "\n";
    if (escaped === "r") return "\r";
    if (escaped === "t") return "\t";
    if (escaped === "b") return "\b";
    if (escaped === "f") return "\f";
    if (/^[0-7]+$/.test(escaped)) {
      return String.fromCharCode(Number.parseInt(escaped, 8));
    }
    return escaped;
  });
}

function decodePdfHex(value: string) {
  const hex = value.replace(/\s+/g, "");
  const bytes = Buffer.from(hex.length % 2 === 0 ? hex : `${hex}0`, "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const chars: string[] = [];
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      chars.push(String.fromCharCode(bytes.readUInt16BE(index)));
    }
    return chars.join("");
  }

  return bytes.toString("latin1");
}

async function extractDocxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.values(zip.files)
    .filter((file) => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const texts = await readOfficeXmlFiles(files);
  return texts.map((xml) => extractXmlParagraphText(xml, ["w:p"], ["w:t"])).join("\n\n");
}

async function extractPptxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.values(zip.files)
    .filter((file) => /^ppt\/slides\/slide\d+\.xml$/i.test(file.name))
    .sort((a, b) => naturalCompare(a.name, b.name));
  const texts = await readOfficeXmlFiles(files);
  return texts.map((xml) => extractXmlParagraphText(xml, ["a:p"], ["a:t"])).join("\n\n");
}

async function extractXlsxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sharedFile = zip.file("xl/sharedStrings.xml");
  const sheetFiles = Object.values(zip.files)
    .filter((file) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(file.name))
    .sort((a, b) => naturalCompare(a.name, b.name));
  const texts = await readOfficeXmlFiles(sharedFile ? [sharedFile, ...sheetFiles] : sheetFiles);
  const sharedXml = sharedFile ? texts[0] : undefined;
  const sheets = sharedFile ? texts.slice(1) : texts;
  const sharedStrings = sharedXml ? extractSharedStrings(sharedXml) : [];

  return sheets
    .map((xml) => extractWorksheetText(xml, sharedStrings))
    .filter(Boolean)
    .join("\n\n");
}

async function readOfficeXmlFiles(files: JSZip.JSZipObject[]) {
  let declaredTotalBytes = 0;
  for (const file of files) {
    const uncompressedBytes = readZipUncompressedSize(file);
    if (
      uncompressedBytes > MAX_OFFICE_XML_ENTRY_BYTES ||
      declaredTotalBytes + uncompressedBytes > MAX_OFFICE_XML_TOTAL_BYTES
    ) {
      throw officeXmlSizeError();
    }
    declaredTotalBytes += uncompressedBytes;
  }

  const texts: string[] = [];
  let actualTotalBytes = 0;
  for (const file of files) {
    const remainingTotalBytes = MAX_OFFICE_XML_TOTAL_BYTES - actualTotalBytes;
    const result = await readOfficeXmlFile(
      file,
      Math.min(MAX_OFFICE_XML_ENTRY_BYTES, remainingTotalBytes),
    );
    actualTotalBytes += result.byteLength;
    texts.push(result.text);
  }

  return texts;
}

function readZipUncompressedSize(file: JSZip.JSZipObject) {
  const internal = file as JSZip.JSZipObject & {
    _data?: { uncompressedSize?: unknown };
  };
  const size = internal._data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) && size >= 0
    ? size
    : MAX_OFFICE_XML_ENTRY_BYTES + 1;
}

async function readOfficeXmlFile(file: JSZip.JSZipObject, maxBytes: number) {
  const stream = file.nodeStream("nodebuffer") as NodeJS.ReadableStream & {
    destroy: (error?: Error) => void;
  };

  return new Promise<{ text: string; byteLength: number }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    let settled = false;

    stream.on("data", (chunk: Buffer | Uint8Array | string) => {
      if (settled) {
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.byteLength;
      if (byteLength > maxBytes) {
        settled = true;
        stream.pause();
        stream.destroy();
        reject(officeXmlSizeError());
        return;
      }
      chunks.push(buffer);
    });
    stream.once("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    stream.once("end", () => {
      if (!settled) {
        settled = true;
        resolve({ text: Buffer.concat(chunks, byteLength).toString("utf8"), byteLength });
      }
    });
  });
}

function officeXmlSizeError() {
  return new ApiError(
    "Officeファイルの展開後サイズが大きすぎます。",
    413,
    "文書内のテキスト量を減らしてから、もう一度添付してください。",
  );
}

function extractSharedStrings(xml: string) {
  const entries: string[] = [];
  const sharedStringRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;

  while ((match = sharedStringRegex.exec(xml))) {
    const body = match[1] ?? "";
    const textRuns = extractXmlTextNodeValues(body, ["t"], { trim: false });
    const value = textRuns.length > 0 ? textRuns.join("") : decodeXmlEntities(stripXmlTags(body));
    entries.push(value.trim());
  }

  return entries;
}

function extractWorksheetText(xml: string, sharedStrings: string[]) {
  const cellValues: string[] = [];
  const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let match: RegExpExecArray | null;

  while ((match = cellRegex.exec(xml))) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const rawValue = firstMatch(body, /<v[^>]*>([\s\S]*?)<\/v>/) ?? "";
    const inlineValue = extractInlineXmlText(body, ["t"]);
    const value =
      attrs.includes('t="s"') && rawValue
        ? sharedStrings[Number(rawValue)] ?? rawValue
        : inlineValue || rawValue;

    if (value.trim()) {
      cellValues.push(decodeXmlEntities(value.trim()));
    }
  }

  return cellValues.join("\n");
}

function extractXmlTextNodes(xml: string, tags: string[]) {
  const values = extractXmlTextNodeValues(xml, tags);
  if (values.length > 0) {
    return values.join("\n");
  }

  return decodeXmlEntities(stripXmlTags(xml));
}

function extractXmlParagraphText(xml: string, paragraphTags: string[], textTags: string[]) {
  const paragraphs: string[] = [];
  for (const tag of paragraphTags) {
    const regex = new RegExp(
      `<${escapeXmlTagForRegex(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeXmlTagForRegex(tag)}>`,
      "g",
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml))) {
      const text = extractInlineXmlText(match[1] ?? "", textTags);
      if (text.trim()) {
        paragraphs.push(text.trim());
      }
    }
  }

  return paragraphs.length > 0 ? paragraphs.join("\n") : extractXmlTextNodes(xml, textTags);
}

function extractInlineXmlText(xml: string, tags: string[]) {
  const values = extractXmlTextNodeValues(xml, tags, { trim: false });
  if (values.length > 0) {
    return values.join("");
  }

  return decodeXmlEntities(stripXmlTags(xml));
}

function extractXmlTextNodeValues(xml: string, tags: string[], options: { trim?: boolean } = {}) {
  const values: string[] = [];
  const shouldTrim = options.trim ?? true;
  for (const tag of tags) {
    const escaped = escapeXmlTagForRegex(tag);
    const regex = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml))) {
      const stripped = stripXmlTags(match[1] ?? "");
      const value = decodeXmlEntities(shouldTrim ? stripped.trim() : stripped);
      if (value) {
        values.push(value);
      }
    }
  }

  return values;
}

function escapeXmlTagForRegex(tag: string) {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(":", "\\:");
}

function stripXmlTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&(?:lt|#0*60|#x0*3c);/gi, "<")
    .replace(/&(?:gt|#0*62|#x0*3e);/gi, ">")
    .replace(/&(?:quot|#0*34|#x0*22);/gi, '"')
    .replace(/&(?:apos|#0*39|#x0*27);/gi, "'")
    .replace(/&(?:nbsp|#0*160|#x0*a0);/gi, " ")
    .replace(/&(?:ldquo|rdquo|#0*8220|#0*8221|#x0*201c|#x0*201d);/gi, '"')
    .replace(/&(?:lsquo|rsquo|#0*8216|#0*8217|#x0*2018|#x0*2019);/gi, "'")
    .replace(/&(?:ndash|#0*8211|#x0*2013);/gi, "-")
    .replace(/&(?:mdash|#0*8212|#x0*2014);/gi, "-")
    .replace(/&(?:amp|#0*38|#x0*26);/gi, "&");
}

function cleanText(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").replace(/\s+/g, " ").trim();
}

function isHumanReadableText(value: string) {
  const cleaned = cleanText(value);
  if (cleaned.length < MIN_USEFUL_TEXT_CHARS) {
    return false;
  }

  const sample = cleaned.slice(0, 1200);
  const readableChars = Array.from(sample).filter((char) =>
    /[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}。、，．・ー\-()（）「」『』:：/]/u.test(
      char,
    ),
  ).length;

  return readableChars / Math.max(Array.from(sample).length, 1) >= 0.45;
}

function firstMatch(value: string, pattern: RegExp) {
  return pattern.exec(value)?.[1]?.trim();
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new ApiError("ファイル解析がタイムアウトしました。", 504));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
