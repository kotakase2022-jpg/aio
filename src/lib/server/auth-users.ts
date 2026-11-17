import {
  isPlausibleEmail,
  normalizeEmail,
  parsePasswordHash,
} from "@/lib/server/login-credentials";

/**
 * Login accounts: a JSON array of `{ "email": "...", "passwordHash": "scrypt:..." }` entries made with
 * `node scripts/create-login-user.mjs <email>`. Without a valid value nobody can log in (fail closed).
 */
export const AUTH_USERS_ENV_NAME = "AIO_AUTH_USERS";

export type AuthUser = { readonly email: string; readonly passwordHash: string };

export type AuthUsersConfig =
  | { ok: true; users: ReadonlyMap<string, AuthUser> }
  | { ok: false; reason: string };

let cached: { raw: string | undefined; config: AuthUsersConfig } | undefined;

/** Parsed once per distinct value, so the proxy can check every request against the current accounts. */
export function readAuthUsers(): AuthUsersConfig {
  // A static property read (not process.env[name]), which Next.js resolves at runtime everywhere.
  const raw = process.env.AIO_AUTH_USERS;
  if (!cached || cached.raw !== raw) {
    cached = { raw, config: parseAuthUsers(raw) };
  }
  return cached.config;
}

export function findAuthUser(email: string): AuthUser | null {
  const config = readAuthUsers();
  return config.ok ? (config.users.get(normalizeEmail(email)) ?? null) : null;
}

/** Any invalid entry disables every login, so a broken value is noticed at once. Reasons name no account. */
export function parseAuthUsers(raw: string | undefined): AuthUsersConfig {
  const text = raw?.replace(/^﻿/, "").trim();
  if (!text) {
    return { ok: false, reason: `${AUTH_USERS_ENV_NAME} is not set.` };
  }

  let entries: unknown;
  try {
    entries = JSON.parse(text);
  } catch {
    return { ok: false, reason: `${AUTH_USERS_ENV_NAME} is not valid JSON.` };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, reason: `${AUTH_USERS_ENV_NAME} must be a non-empty JSON array.` };
  }

  const users = new Map<string, AuthUser>();
  for (const [index, entry] of entries.entries()) {
    const label = `${AUTH_USERS_ENV_NAME}[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, reason: `${label} is not an object.` };
    }

    const { email, passwordHash } = entry as Record<string, unknown>;
    const normalizedEmail = typeof email === "string" ? normalizeEmail(email) : "";
    if (!isPlausibleEmail(normalizedEmail)) {
      return { ok: false, reason: `${label}.email is not an email address.` };
    }
    if (typeof passwordHash !== "string" || !parsePasswordHash(passwordHash)) {
      return {
        ok: false,
        reason: `${label}.passwordHash is not a hash made by scripts/create-login-user.mjs.`,
      };
    }
    if (users.has(normalizedEmail)) {
      return { ok: false, reason: `${label}.email repeats an earlier entry.` };
    }

    users.set(normalizedEmail, { email: normalizedEmail, passwordHash });
  }

  return { ok: true, users };
}
