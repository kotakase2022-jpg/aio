import { hashPasswordSync, type ScryptParams } from "../../src/lib/server/login-credentials";

/** The cheapest scrypt setting the app accepts; only test accounts use it, to keep the suites fast. */
export const TEST_SCRYPT_PARAMS: ScryptParams = { log2N: 14, r: 8, p: 1 };

/**
 * Test-only login, valid only on the local servers and in-process routes of the test suites. Production
 * accounts are created by the operator with scripts/create-login-user.mjs and never live in this repository.
 */
export const testLoginAccount = {
  email: "editor@example.test",
  password: "test-only-password-for-local-servers",
} as const;

/**
 * A second test-only login whose password is 300 code units as typed and 150 after NFKC (A + combining
 * ring, composed into one character). The limit counts the normalized form, so it must log in.
 */
export const composedOnNormalizationAccount = {
  email: "combining@example.test",
  password: "A\u030A".repeat(150),
} as const;

export type TestAccount = { email: string; password: string };

/** An AIO_AUTH_USERS value for the given accounts (fresh salts on every call). */
export function authUsersValue(accounts: readonly TestAccount[] = [testLoginAccount]) {
  return JSON.stringify(
    accounts.map(({ email, password }) => ({
      email,
      passwordHash: hashPasswordSync(password, TEST_SCRYPT_PARAMS),
    })),
  );
}
