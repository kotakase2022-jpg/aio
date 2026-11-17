import { findAuthUser, type AuthUser } from "@/lib/server/auth-users";

export const SESSION_COOKIE_NAME = "aio_session";
/** Cookie of the retired access-code login. Never read; login and logout expire it. */
export const RETIRED_SESSION_COOKIE_NAME = "aio_demo_auth";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

// v1 tokens came from the retired access-code login and identified nobody; only v2 is accepted.
const TOKEN_VERSION = "v2";
const DEVELOPMENT_SECRET = "aio-local-development-session-secret-change-me";
const MAX_TOKEN_LENGTH = 2048;

export type AuthSession = { email: string };

export async function createSessionToken(
  user: AuthUser,
  {
    now = Date.now(),
    maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
  }: {
    now?: number;
    maxAgeSeconds?: number;
  } = {},
) {
  const expiresAt = now + maxAgeSeconds * 1000;
  const subject = encodeBase64Url(new TextEncoder().encode(user.email));
  const nonce = encodeBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload = `${TOKEN_VERSION}.${expiresAt}.${subject}.${nonce}`;
  const signature = await sign(signedContent(payload, user));
  return `${payload}.${signature}`;
}

/** The signed-in account, or null. Never throws: any doubt means "not signed in". */
export async function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<AuthSession | null> {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 5) {
    return null;
  }

  const [version, expiresAtText, subject, nonce, signature] = parts;
  const expiresAt = Number(expiresAtText);
  if (
    version !== TOKEN_VERSION ||
    !/^\d{13}$/.test(expiresAtText) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + SESSION_MAX_AGE_SECONDS * 1000 + 60_000 ||
    !/^[A-Za-z0-9_-]{4,1016}$/.test(subject) ||
    !/^[A-Za-z0-9_-]{20,32}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{40,48}$/.test(signature)
  ) {
    return null;
  }

  try {
    const email = decodeSubject(subject);
    // Only an account that is still configured, with the password hash the session was signed with,
    // keeps its sessions: removing the account or changing its password ends them.
    const user = email ? findAuthUser(email) : null;
    if (!user || user.email !== email) {
      return null;
    }

    const signatureBytes = decodeBase64Url(signature);
    if (encodeBase64Url(signatureBytes) !== signature) {
      return null;
    }

    const key = await importSigningKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(signedContent(`${version}.${expiresAtText}.${subject}.${nonce}`, user)),
    );
    return valid ? { email: user.email } : null;
  } catch {
    return null;
  }
}

function signedContent(payload: string, user: AuthUser) {
  return `${payload}\n${user.passwordHash}`;
}

function decodeSubject(subject: string) {
  const bytes = decodeBase64Url(subject);
  if (encodeBase64Url(bytes) !== subject) {
    return null;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function sign(content: string) {
  const key = await importSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
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

// The variable keeps its original name so existing deployments need no new secret.
function getSigningSecret() {
  const configured = process.env.DEMO_AUTH_SECRET?.replace(/^﻿/, "").trim();
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
