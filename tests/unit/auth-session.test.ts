import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/server/auth-session";
import type { AuthUser } from "@/lib/server/auth-users";
import { hashPasswordSync } from "@/lib/server/login-credentials";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import { TEST_SCRYPT_PARAMS } from "../helpers/login-accounts";

const processEnvSnapshot = snapshotProcessEnv();
const secret = "test-only-demo-session-secret-32-characters";
const now = Date.UTC(2026, 7, 24);
const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const editor: AuthUser = {
  email: "editor@example.test",
  passwordHash: hashPasswordSync("test-only-password-for-unit-tests", TEST_SCRYPT_PARAMS),
};

function configureAccounts(...users: AuthUser[]) {
  process.env.AIO_AUTH_USERS = JSON.stringify(users);
}

/** A token exactly as the retired access-code login issued it (v1, no account). */
function retiredAccessCodeToken(expiresAt: number) {
  const payload = `v1.${expiresAt}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

beforeEach(() => {
  process.env.DEMO_AUTH_SECRET = secret;
  configureAccounts(editor);
});

afterEach(() => {
  vi.unstubAllEnvs();
  restoreProcessEnv(processEnvSnapshot);
});

describe("login session", () => {
  test("accepts an authentic unexpired token and names its account", async () => {
    const token = await createSessionToken(editor, { now, maxAgeSeconds: 60 });

    expect(token).toMatch(/^v2\.\d{13}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(verifySessionToken(token, now + 30_000)).resolves.toEqual({ email: "editor@example.test" });
  });

  test("rejects fixed, tampered, and expired tokens", async () => {
    const token = await createSessionToken(editor, { now, maxAgeSeconds: 60 });
    const parts = token.split(".");
    const signature = parts[4];
    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const tampered = [...parts.slice(0, 4), tamperedSignature].join(".");
    const finalIndex = base64UrlAlphabet.indexOf(signature.at(-1) ?? "");
    const nonCanonicalSignature = `${signature.slice(0, -1)}${base64UrlAlphabet[finalIndex + 1]}`;
    const nonCanonical = [...parts.slice(0, 4), nonCanonicalSignature].join(".");

    await expect(verifySessionToken("demo-access-granted", now)).resolves.toBeNull();
    await expect(verifySessionToken(undefined, now)).resolves.toBeNull();
    await expect(verifySessionToken(tampered, now)).resolves.toBeNull();
    await expect(verifySessionToken(nonCanonical, now)).resolves.toBeNull();
    await expect(verifySessionToken(token, now + 60_001)).resolves.toBeNull();
    await expect(verifySessionToken(`${token}.extra`, now)).resolves.toBeNull();
    await expect(verifySessionToken(`${token}${"A".repeat(2048)}`, now)).resolves.toBeNull();
  });

  test("a token cannot be moved to another account by rewriting its subject", async () => {
    const owner: AuthUser = {
      email: "owner@example.test",
      passwordHash: hashPasswordSync("another-test-only-password", TEST_SCRYPT_PARAMS),
    };
    configureAccounts(editor, owner);
    const parts = (await createSessionToken(editor, { now })).split(".");
    const forged = [parts[0], parts[1], Buffer.from(owner.email).toString("base64url"), parts[3], parts[4]].join(".");
    const upperCased = [parts[0], parts[1], Buffer.from("EDITOR@example.test").toString("base64url"), parts[3], parts[4]].join(".");

    await expect(verifySessionToken(forged, now)).resolves.toBeNull();
    await expect(verifySessionToken(upperCased, now)).resolves.toBeNull();
  });

  test("a session from the retired access-code login is rejected even with the same secret", async () => {
    const retired = retiredAccessCodeToken(now + 60_000);
    // Shaped like the new format too: version swapped, account added, same old signature.
    const [, expiresAt, nonce, signature] = retired.split(".");
    const relabeled = ["v2", expiresAt, Buffer.from(editor.email).toString("base64url"), nonce, signature].join(".");

    await expect(verifySessionToken(retired, now)).resolves.toBeNull();
    await expect(verifySessionToken(relabeled, now)).resolves.toBeNull();
  });

  test("changing the password or removing the account ends its sessions", async () => {
    const token = await createSessionToken(editor, { now });
    await expect(verifySessionToken(token, now)).resolves.toEqual({ email: editor.email });

    // Same password, new hash (new salt): an operator re-issuing the password also ends old sessions.
    configureAccounts({
      email: editor.email,
      passwordHash: hashPasswordSync("test-only-password-for-unit-tests", TEST_SCRYPT_PARAMS),
    });
    await expect(verifySessionToken(token, now)).resolves.toBeNull();

    configureAccounts({
      email: "owner@example.test",
      passwordHash: hashPasswordSync("another-test-only-password", TEST_SCRYPT_PARAMS),
    });
    await expect(verifySessionToken(token, now)).resolves.toBeNull();

    process.env.AIO_AUTH_USERS = "";
    await expect(verifySessionToken(token, now)).resolves.toBeNull();

    configureAccounts(editor);
    await expect(verifySessionToken(token, now)).resolves.toEqual({ email: editor.email });
  });

  test("a token signed with another secret is rejected", async () => {
    const token = await createSessionToken(editor, { now });
    process.env.DEMO_AUTH_SECRET = "another-test-only-session-secret-32-chars";

    await expect(verifySessionToken(token, now)).resolves.toBeNull();
  });

  test("production refuses to sign without a secret and treats every token as signed out", async () => {
    const token = await createSessionToken(editor, { now });
    process.env.DEMO_AUTH_SECRET = "";
    vi.stubEnv("NODE_ENV", "production");

    await expect(createSessionToken(editor, { now })).rejects.toThrow(/DEMO_AUTH_SECRET is required/);
    await expect(verifySessionToken(token, now)).resolves.toBeNull();

    process.env.DEMO_AUTH_SECRET = "too-short";
    await expect(createSessionToken(editor, { now })).rejects.toThrow(/at least 32 characters/);
  });
});
