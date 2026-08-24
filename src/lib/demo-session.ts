export const DEMO_AUTH_COOKIE_NAME = "aio_demo_auth";
export const DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

const TOKEN_VERSION = "v1";
const DEVELOPMENT_SECRET = "aio-local-development-session-secret-change-me";

export async function createDemoSessionToken({
  now = Date.now(),
  maxAgeSeconds = DEMO_SESSION_MAX_AGE_SECONDS,
}: {
  now?: number;
  maxAgeSeconds?: number;
} = {}) {
  const expiresAt = now + maxAgeSeconds * 1000;
  const nonce = encodeBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload = `${TOKEN_VERSION}.${expiresAt}.${nonce}`;
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function verifyDemoSessionToken(token: string | undefined, now = Date.now()) {
  if (!token || token.length > 256) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const [version, expiresAtText, nonce, signature] = parts;
  const expiresAt = Number(expiresAtText);
  if (
    version !== TOKEN_VERSION ||
    !/^\d{13}$/.test(expiresAtText) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + DEMO_SESSION_MAX_AGE_SECONDS * 1000 + 60_000 ||
    !/^[A-Za-z0-9_-]{20,32}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{40,48}$/.test(signature)
  ) {
    return false;
  }

  const payload = `${version}.${expiresAtText}.${nonce}`;
  const key = await importSigningKey();
  try {
    const signatureBytes = decodeBase64Url(signature);
    if (encodeBase64Url(signatureBytes) !== signature) {
      return false;
    }
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

async function sign(payload: string) {
  const key = await importSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

async function importSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function getSigningSecret() {
  const configured = process.env.DEMO_AUTH_SECRET?.replace(/^\uFEFF/, "").trim();
  if (configured) {
    if (configured.length < 32) {
      throw new Error("DEMO_AUTH_SECRET must contain at least 32 characters.");
    }
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DEMO_AUTH_SECRET is required in production.");
  }

  return DEVELOPMENT_SECRET;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
