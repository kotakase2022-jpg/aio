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
