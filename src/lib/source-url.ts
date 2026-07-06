export function normalizeSourceUrl(url: string) {
  const trimmed = normalizeSourceUrlValue(url).replace(/[)）、。,\s]+$/g, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed.replace(/\/$/, "") : "";
}

export function normalizeSourceUrls(sourceUrls?: string[]) {
  return uniqueSourceUrlsByCanonicalKey(
    sourceUrls?.map(normalizeSourceUrl).filter((url) => url.length > 0) ?? [],
  ).slice(0, 8);
}

export function uniqueSourceUrlsByCanonicalKey(urls: string[]) {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const key = canonicalSourceUrlKey(url);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function canonicalSourceUrlKey(url: string) {
  try {
    const parsed = new URL(normalizeSourceUrlValue(url));
    const hostname = parsed.hostname.replace(/^www\./i, "");
    const pathname = parsed.pathname.replace(/\/$/, "");
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${hostname}${port}${pathname}${canonicalSourceSearch(parsed.searchParams)}`;
  } catch {
    return url;
  }
}

export function sourceUrlCandidates(url: string) {
  try {
    const normalizedUrl = normalizeSourceUrlValue(url);
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname.replace(/\/$/, "");
    const canonicalSearch = canonicalSourceSearch(parsed.searchParams);
    const normalized = `${parsed.origin}${pathname}${canonicalSearch}`;
    const hostnameWithoutWww = parsed.hostname.replace(/^www\./i, "");
    const canonicalOrigin =
      hostnameWithoutWww === parsed.hostname ? "" : `${parsed.protocol}//${hostnameWithoutWww}`;
    return uniqueStrings([
      normalizedUrl,
      normalizedUrl.replace(/\/$/, ""),
      normalized,
      `${parsed.hostname}${pathname}${canonicalSearch}`,
      canonicalOrigin ? `${canonicalOrigin}${pathname}${canonicalSearch}` : "",
      canonicalOrigin ? `${hostnameWithoutWww}${pathname}${canonicalSearch}` : "",
    ]).filter((candidate) => candidate.length >= 8);
  } catch {
    const normalizedUrl = normalizeSourceUrlValue(url);
    return [normalizedUrl, normalizedUrl.replace(/\/$/, "")].filter(
      (candidate) => candidate.length >= 8,
    );
  }
}

export function articleContainsCanonicalSourceUrl(url: string, articleText: string) {
  const expectedKey = canonicalSourceUrlKey(url);
  return extractHttpUrls(decodeHtmlUrlDelimiters(articleText)).some(
    (candidate) => canonicalSourceUrlKey(candidate) === expectedKey,
  );
}

export function extractHttpUrls(text: string) {
  return (text.match(/https?:\/\/[^\s<>"')）]+/g) ?? []).map((url) =>
    trimTrailingUrlDecorations(url),
  );
}

function canonicalSourceSearch(searchParams: URLSearchParams) {
  const entries = Array.from(searchParams.entries())
    .filter(([key]) => !isTrackingSearchParam(key))
    .sort(([left], [right]) => left.localeCompare(right));

  const params = new URLSearchParams(entries);
  const search = params.toString();
  return search ? `?${search}` : "";
}

function isTrackingSearchParam(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.startsWith("utm_") ||
    ["fbclid", "gclid", "gbraid", "wbraid", "msclkid", "yclid"].includes(normalized)
  );
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items));
}

function trimTrailingUrlDecorations(url: string) {
  return url
    .replace(/(?:&quot;|&#0*34;|&#x0*22;|&apos;|&#0*39;|&#x0*27;)+$/gi, "")
    .replace(/[.,、。)）]+$/g, "");
}

function normalizeSourceUrlValue(value: string) {
  return trimTrailingUrlDecorations(decodeHtmlUrlDelimiters(value).trim())
    .replace(/^[<>"']+/g, "")
    .replace(/[<>"']+$/g, "");
}

export function decodeHtmlAmpersands(value: string) {
  return value.replace(/&(?:amp|#0*38|#x0*26);/gi, "&");
}

function decodeHtmlUrlDelimiters(value: string) {
  return decodeHtmlAmpersands(value)
    .replace(/&(?:quot|#0*34|#x0*22);/gi, '"')
    .replace(/&(?:apos|#0*39|#x0*27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
