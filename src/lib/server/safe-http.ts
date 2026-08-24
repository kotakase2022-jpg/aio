import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

const DEFAULT_RESPONSE_LIMIT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

const blockedIpv4Addresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}
const blockedIpv6Addresses = new BlockList();
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:2::", 48],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

export class UnsafeOutboundUrlError extends Error {
  constructor(detail?: string) {
    super("安全上の理由により、このURLは取得できません。");
    this.name = "UnsafeOutboundUrlError";
    this.cause = detail;
  }
}

export class OutboundResponseTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`取得先の応答が上限（${Math.floor(limitBytes / 1024 / 1024)}MB）を超えています。`);
    this.name = "OutboundResponseTooLargeError";
  }
}

type SafeFetchOptions = {
  allowRedirects?: boolean;
  maxRedirects?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
};

export type SafeResponse = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

export type SafeFetch = (
  value: string | URL,
  init?: NonNullable<Parameters<typeof undiciFetch>[1]>,
  options?: SafeFetchOptions,
) => Promise<SafeResponse>;

export const publicDnsLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      if (addresses.length === 0 || addresses.some((item) => !isPublicIpAddress(item.address))) {
        callback(new UnsafeOutboundUrlError(`Blocked DNS result for ${hostname}`), "");
        return;
      }

      const requestedFamily =
        options.family === 4 || options.family === "IPv4"
          ? 4
          : options.family === 6 || options.family === "IPv6"
            ? 6
            : 0;
      const eligibleAddresses = requestedFamily
        ? addresses.filter((item) => item.family === requestedFamily)
        : addresses;
      if (eligibleAddresses.length === 0) {
        callback(new Error(`No DNS address matched the requested family for ${hostname}`), "");
        return;
      }

      if (options.all) {
        callback(null, eligibleAddresses);
        return;
      }

      const selected = eligibleAddresses[0];
      callback(null, selected.address, selected.family);
    })
    .catch((error: unknown) => {
      callback(error instanceof Error ? error : new Error("DNS lookup failed"), "");
    });
};

const publicNetworkAgent = new Agent({
  connect: { lookup: publicDnsLookup },
});

export function assertSafeOutboundUrl(value: string | URL) {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new UnsafeOutboundUrlError("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new UnsafeOutboundUrlError("Unsupported protocol or URL credentials");
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    (isIP(hostname) > 0 && !isPublicIpAddress(hostname))
  ) {
    throw new UnsafeOutboundUrlError(`Blocked hostname: ${hostname}`);
  }

  return url;
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    return !blockedIpv4Addresses.check(address, "ipv4");
  }
  if (family === 6) {
    return !blockedIpv6Addresses.check(address, "ipv6");
  }
  return false;
}

export async function safeFetch(
  value: string | URL,
  init: NonNullable<Parameters<typeof undiciFetch>[1]> = {},
  options: SafeFetchOptions = {},
): Promise<SafeResponse> {
  const allowRedirects = options.allowRedirects ?? false;
  const maxRedirects = options.maxRedirects ?? 3;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_RESPONSE_LIMIT_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = (init.method ?? "GET").toUpperCase();

  if (allowRedirects && method !== "GET" && method !== "HEAD") {
    throw new Error("Redirects are only supported for safe outbound GET/HEAD requests.");
  }

  let currentUrl = assertSafeOutboundUrl(value);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  for (let redirectCount = 0; ; redirectCount += 1) {
    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(currentUrl, {
        ...init,
        dispatcher: publicNetworkAgent,
        redirect: "manual",
        signal,
      });
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      if (cause instanceof UnsafeOutboundUrlError) {
        throw cause;
      }
      throw error;
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!allowRedirects || !location || redirectCount >= maxRedirects) {
        await response.body?.cancel();
        throw new UnsafeOutboundUrlError("Unexpected or excessive redirect");
      }

      currentUrl = assertSafeOutboundUrl(new URL(location, currentUrl));
      await response.body?.cancel();
      continue;
    }

    return bufferResponse(response, maxResponseBytes);
  }
}

async function bufferResponse(
  response: Awaited<ReturnType<typeof undiciFetch>>,
  maxBytes: number,
): Promise<SafeResponse> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new OutboundResponseTooLargeError(maxBytes);
  }

  if (!response.body) {
    return response;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new OutboundResponseTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => responseHeaders.set(key, value));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
