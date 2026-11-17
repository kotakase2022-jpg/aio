import { describe, expect, test } from "vitest";
import {
  DEFAULT_SCRYPT_PARAMS,
  generatePassword,
  hashPassword,
  hashPasswordSync,
  isPlausibleEmail,
  normalizeEmail,
  parsePasswordHash,
  passwordProblem,
  rejectUnknownAccount,
  UNKNOWN_ACCOUNT_HASH,
  verifyPassword,
} from "@/lib/server/login-credentials";
import { TEST_SCRYPT_PARAMS } from "../helpers/login-accounts";

const password = "correct horse battery staple";

describe("login credentials", () => {
  test("a hash verifies its own password only", async () => {
    const encoded = await hashPassword(password, TEST_SCRYPT_PARAMS);

    expect(encoded).toMatch(/^scrypt:14:8:1:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}$/);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword(`${password}!`, encoded)).resolves.toBe(false);
    await expect(verifyPassword("", encoded)).resolves.toBe(false);
    // The retired shared access code is no password.
    await expect(verifyPassword("202607", encoded)).resolves.toBe(false);
  });

  test("new hashes use the production default, and the sync variant writes the same format", async () => {
    const encoded = await hashPassword(password);
    const parsed = parsePasswordHash(encoded);

    expect(parsed).toMatchObject(DEFAULT_SCRYPT_PARAMS);
    expect(DEFAULT_SCRYPT_PARAMS).toEqual({ log2N: 15, r: 8, p: 3 });
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);

    const sync = hashPasswordSync(password, TEST_SCRYPT_PARAMS);
    await expect(verifyPassword(password, sync)).resolves.toBe(true);
  });

  test("every hash gets its own salt", async () => {
    const first = hashPasswordSync(password, TEST_SCRYPT_PARAMS);
    const second = hashPasswordSync(password, TEST_SCRYPT_PARAMS);

    expect(first).not.toBe(second);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword(password, second)).resolves.toBe(true);
  });

  test("full-width input from a Japanese IME matches the ASCII password", async () => {
    const encoded = hashPasswordSync("abcd-EFGH-2345-jkmn", TEST_SCRYPT_PARAMS);

    await expect(verifyPassword("ａｂｃｄ－ＥＦＧＨ－２３４５－ｊｋｍｎ", encoded)).resolves.toBe(true);
  });

  test("malformed, non-canonical and out-of-range hashes are rejected, never verified", async () => {
    const encoded = hashPasswordSync(password, TEST_SCRYPT_PARAMS);
    const [, , , , salt, key] = encoded.split(":");
    const lastKeyIndex = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".indexOf(key.at(-1) ?? "");
    const nonCanonicalKey = `${key.slice(0, -1)}${"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[lastKeyIndex + 1]}`;
    const rejected = [
      "",
      "202607",
      "plain-text-password",
      `bcrypt:14:8:1:${salt}:${key}`,
      `scrypt:13:8:1:${salt}:${key}`,
      `scrypt:18:8:1:${salt}:${key}`,
      `scrypt:14:4:1:${salt}:${key}`,
      `scrypt:14:8:0:${salt}:${key}`,
      `scrypt:14:8:17:${salt}:${key}`,
      `scrypt:014:8:1:${salt}:${key}`,
      `scrypt:14:08:1:${salt}:${key}`,
      `scrypt:14:8:1:${salt.slice(0, 21)}:${key}`,
      `scrypt:14:8:1:${salt}:${key.slice(0, 42)}`,
      `scrypt:14:8:1:${salt}:${nonCanonicalKey}`,
      `${encoded} `,
    ];

    for (const value of rejected) {
      expect(parsePasswordHash(value), value).toBeNull();
      await expect(verifyPassword(password, value)).resolves.toBe(false);
    }
    expect(parsePasswordHash(encoded)).not.toBeNull();
  });

  test("an unknown email costs a real hash computation and always fails", async () => {
    // If this hash stopped parsing, the check would return early and reveal unknown emails by timing.
    expect(parsePasswordHash(UNKNOWN_ACCOUNT_HASH)).toMatchObject(DEFAULT_SCRYPT_PARAMS);
    await expect(rejectUnknownAccount(password)).resolves.toBe(false);
    await expect(rejectUnknownAccount("x".repeat(400))).resolves.toBe(false);
  });

  test("overlong login input is refused without hashing", async () => {
    const encoded = hashPasswordSync(password, TEST_SCRYPT_PARAMS);

    await expect(verifyPassword("x".repeat(257), encoded)).resolves.toBe(false);
  });

  test("generated passwords are long, unambiguous and distinct", () => {
    const generated = Array.from({ length: 50 }, () => generatePassword());

    for (const value of generated) {
      expect(value).toMatch(/^[a-km-np-zA-HJ-NP-Z2-9]{4}(?:-[a-km-np-zA-HJ-NP-Z2-9]{4}){4}$/);
      expect(passwordProblem(value)).toBeNull();
    }
    expect(new Set(generated).size).toBe(generated.length);
  });

  test("new passwords must be 15 to 256 characters without surrounding spaces", () => {
    expect(passwordProblem("a".repeat(14))).toMatch(/at least 15/);
    expect(passwordProblem("a".repeat(15))).toBeNull();
    expect(passwordProblem("a".repeat(256))).toBeNull();
    expect(passwordProblem("a".repeat(257))).toMatch(/at most 256/);
    expect(passwordProblem(` ${"a".repeat(20)}`)).toMatch(/space/);
    expect(passwordProblem(`${"a".repeat(20)}　`)).toMatch(/space/);
    expect(() => hashPasswordSync("short", TEST_SCRYPT_PARAMS)).toThrow(/at least 15/);
    expect(() => hashPasswordSync(password, { log2N: 12, r: 8, p: 1 })).toThrow(/outside the accepted range/);
  });

  test("emails are compared case-insensitively after NFKC normalization", () => {
    expect(normalizeEmail("  Editor@Example.COM ")).toBe("editor@example.com");
    expect(normalizeEmail("ｅｄｉｔｏｒ＠ｅｘａｍｐｌｅ．ｃｏｍ")).toBe("editor@example.com");
    expect(isPlausibleEmail("editor@example.com")).toBe(true);
    expect(isPlausibleEmail("editor@example.test")).toBe(true);
    for (const value of ["", "editor", "editor@", "@example.com", "editor@example", "a b@example.com", "editor@@example.com", "editor@.example.com"]) {
      expect(isPlausibleEmail(value), value).toBe(false);
    }
    expect(isPlausibleEmail(`${"a".repeat(243)}@example.com`)).toBe(false);
  });
});
