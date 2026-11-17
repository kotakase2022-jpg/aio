import { randomBytes, randomInt, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

// Email and password rules for login accounts. Deliberately self-contained (node:crypto only, no app
// imports): scripts/create-login-user.mjs imports this file directly, so the operator's script and the
// login route always agree on normalization and on the hash format.

export type ScryptParams = { log2N: number; r: number; p: number };

/**
 * scrypt N=2^15 (32 MiB), r=8, p=3: one of the equivalent minimum settings in the OWASP Password Storage
 * Cheat Sheet, chosen for its low memory use per login on serverless functions.
 */
export const DEFAULT_SCRYPT_PARAMS: Readonly<ScryptParams> = Object.freeze({ log2N: 15, r: 8, p: 3 });
/** NIST SP 800-63B-4 minimum for a password that is the only authentication factor. */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 256;
export const EMAIL_MAX_LENGTH = 254;

// A configured hash must stay inside these bounds: below them a guess costs too little, above them one
// login could reserve an unbounded amount of memory.
const PARAM_LIMITS = { log2N: [14, 17], r: [8, 8], p: [1, 16] } as const;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const HASH_PATTERN = /^scrypt:(\d{1,2}):(\d{1,2}):(\d{1,2}):([A-Za-z0-9_-]{22,86}):([A-Za-z0-9_-]{43})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
// Unambiguous symbols only (no 0/O/o, 1/I/l), so a password read aloud or retyped stays exact.
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Same parameters as new hashes and matches no password: an unknown email costs one hash computation,
// like a wrong password, so the response time does not reveal which emails are registered.
// Exported only so a test can pin that it parses (otherwise the check would return early).
export const UNKNOWN_ACCOUNT_HASH = [
  "scrypt",
  DEFAULT_SCRYPT_PARAMS.log2N,
  DEFAULT_SCRYPT_PARAMS.r,
  DEFAULT_SCRYPT_PARAMS.p,
  "A".repeat(22),
  "A".repeat(43),
].join(":");

export type ParsedPasswordHash = ScryptParams & { salt: Buffer; key: Buffer };

/** Lower-case, NFKC (full-width input from a Japanese IME becomes ASCII) and no surrounding spaces. */
export function normalizeEmail(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function isPlausibleEmail(email: string) {
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}

/** About 116 bits: five groups of four symbols from a 56-symbol alphabet. */
export function generatePassword() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join(""),
  ).join("-");
}

/** Why a new password cannot be used, or null. Login itself only bounds the input length. */
export function passwordProblem(password: string) {
  const normalized = password.normalize("NFKC");
  if (normalized !== normalized.trim()) {
    return "The password must not start or end with a space.";
  }
  if (normalized.length < PASSWORD_MIN_LENGTH) {
    return `The password must have at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (normalized.length > PASSWORD_MAX_LENGTH) {
    return `The password must have at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}

export async function hashPassword(password: string, params: ScryptParams = DEFAULT_SCRYPT_PARAMS) {
  assertNewPassword(password, params);
  const salt = randomBytes(SALT_BYTES);
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(normalizePassword(password), salt, KEY_BYTES, scryptOptions(params), (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
  return encodePasswordHash(params, salt, key);
}

/** Synchronous variant for test setup that cannot await (the Playwright config). */
export function hashPasswordSync(password: string, params: ScryptParams = DEFAULT_SCRYPT_PARAMS) {
  assertNewPassword(password, params);
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(normalizePassword(password), salt, KEY_BYTES, scryptOptions(params));
  return encodePasswordHash(params, salt, key);
}

export async function verifyPassword(password: string, encodedHash: string) {
  const parsed = parsePasswordHash(encodedHash);
  const normalized = normalizePassword(password);
  // The same limit as passwordProblem, counted after normalization: whatever the script accepted
  // logs in, however the characters are typed (composed or not).
  if (!parsed || normalized.length > PASSWORD_MAX_LENGTH) {
    return false;
  }

  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(normalized, parsed.salt, parsed.key.length, scryptOptions(parsed), (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
  return timingSafeEqual(key, parsed.key);
}

/**
 * Does the same as a real check for an email that has no account, then fails: the same hash work,
 * or the same early refusal for an overlong password.
 */
export async function rejectUnknownAccount(password: string) {
  await verifyPassword(password, UNKNOWN_ACCOUNT_HASH);
  return false;
}

/** `scrypt:<log2 N>:<r>:<p>:<salt base64url>:<key base64url>`, canonical and within the accepted bounds. */
export function parsePasswordHash(encoded: string): ParsedPasswordHash | null {
  const match = HASH_PATTERN.exec(encoded);
  if (!match) {
    return null;
  }

  const [log2NText, rText, pText, saltText, keyText] = match.slice(1);
  const params = { log2N: Number(log2NText), r: Number(rText), p: Number(pText) };
  if (
    String(params.log2N) !== log2NText ||
    String(params.r) !== rText ||
    String(params.p) !== pText ||
    !paramsWithinLimits(params)
  ) {
    return null;
  }

  const salt = decodeCanonicalBase64Url(saltText);
  const key = decodeCanonicalBase64Url(keyText);
  if (!salt || salt.length < SALT_BYTES || !key || key.length !== KEY_BYTES) {
    return null;
  }

  return { ...params, salt, key };
}

function assertNewPassword(password: string, params: ScryptParams) {
  const problem = passwordProblem(password);
  if (problem) {
    throw new Error(problem);
  }
  if (!paramsWithinLimits(params)) {
    throw new Error("The scrypt parameters are outside the accepted range.");
  }
}

function paramsWithinLimits({ log2N, r, p }: ScryptParams) {
  const within = (value: number, [min, max]: readonly [number, number]) =>
    Number.isInteger(value) && value >= min && value <= max;
  return within(log2N, PARAM_LIMITS.log2N) && within(r, PARAM_LIMITS.r) && within(p, PARAM_LIMITS.p);
}

function scryptOptions({ log2N, r, p }: ScryptParams) {
  const N = 2 ** log2N;
  // scrypt needs about 128 * N * r bytes; the default 32 MiB limit is just too small for N=2^15.
  return { N, r, p, maxmem: 256 * N * r };
}

function normalizePassword(password: string) {
  return password.normalize("NFKC");
}

function encodePasswordHash({ log2N, r, p }: ScryptParams, salt: Buffer, key: Buffer) {
  return ["scrypt", log2N, r, p, salt.toString("base64url"), key.toString("base64url")].join(":");
}

function decodeCanonicalBase64Url(value: string) {
  const bytes = Buffer.from(value, "base64url");
  return bytes.toString("base64url") === value ? bytes : null;
}
