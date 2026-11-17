import { afterEach, describe, expect, test } from "vitest";
import { findAuthUser, parseAuthUsers, readAuthUsers } from "@/lib/server/auth-users";
import { hashPasswordSync } from "@/lib/server/login-credentials";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import { TEST_SCRYPT_PARAMS } from "../helpers/login-accounts";

const processEnvSnapshot = snapshotProcessEnv();
const hash = hashPasswordSync("test-only-password-for-unit-tests", TEST_SCRYPT_PARAMS);
const otherHash = hashPasswordSync("another-test-only-password", TEST_SCRYPT_PARAMS);

afterEach(() => {
  restoreProcessEnv(processEnvSnapshot);
});

describe("login accounts (AIO_AUTH_USERS)", () => {
  test("valid entries are keyed by their normalized email", () => {
    const config = parseAuthUsers(
      `﻿ ${JSON.stringify([
        { email: "  Editor@Example.test ", passwordHash: hash },
        { email: "owner@example.test", passwordHash: otherHash, name: "ignored extra field" },
      ])} `,
    );

    expect(config.ok).toBe(true);
    if (!config.ok) return;
    expect([...config.users.keys()]).toEqual(["editor@example.test", "owner@example.test"]);
    expect(config.users.get("editor@example.test")).toEqual({ email: "editor@example.test", passwordHash: hash });
  });

  test("a missing, blank or broken value disables every login, with a reason that names no account", () => {
    const cases: Array<[string | undefined, RegExp]> = [
      [undefined, /is not set/],
      ["", /is not set/],
      ["   ", /is not set/],
      ["202607", /non-empty JSON array/],
      ["not json", /not valid JSON/],
      ["{}", /non-empty JSON array/],
      ["[]", /non-empty JSON array/],
      ["[null]", /\[0\] is not an object/],
      [JSON.stringify([[]]), /\[0\] is not an object/],
      [JSON.stringify([{ passwordHash: hash }]), /\[0\]\.email is not an email address/],
      [JSON.stringify([{ email: "editor", passwordHash: hash }]), /\[0\]\.email is not an email address/],
      [JSON.stringify([{ email: "editor@example.test" }]), /\[0\]\.passwordHash/],
      [JSON.stringify([{ email: "editor@example.test", passwordHash: "202607" }]), /\[0\]\.passwordHash/],
      [JSON.stringify([{ email: "editor@example.test", passwordHash: `${hash} ` }]), /\[0\]\.passwordHash/],
      [
        JSON.stringify([
          { email: "editor@example.test", passwordHash: hash },
          { email: "secret-owner@example.test", passwordHash: "plain-password" },
        ]),
        /\[1\]\.passwordHash/,
      ],
      [
        JSON.stringify([
          { email: "editor@example.test", passwordHash: hash },
          { email: "EDITOR@example.test", passwordHash: otherHash },
        ]),
        /\[1\]\.email repeats an earlier entry/,
      ],
    ];

    for (const [raw, reason] of cases) {
      const config = parseAuthUsers(raw);
      expect(config.ok, String(raw)).toBe(false);
      if (config.ok) continue;
      expect(config.reason).toMatch(reason);
      expect(config.reason).not.toMatch(/@|scrypt:|plain-password/);
    }
  });

  test("lookups follow the current environment value", () => {
    process.env.AIO_AUTH_USERS = JSON.stringify([{ email: "editor@example.test", passwordHash: hash }]);
    expect(findAuthUser(" EDITOR@example.test")).toEqual({ email: "editor@example.test", passwordHash: hash });
    expect(findAuthUser("someone@example.test")).toBeNull();

    process.env.AIO_AUTH_USERS = JSON.stringify([{ email: "editor@example.test", passwordHash: otherHash }]);
    expect(findAuthUser("editor@example.test")?.passwordHash).toBe(otherHash);

    process.env.AIO_AUTH_USERS = "";
    expect(readAuthUsers().ok).toBe(false);
    expect(findAuthUser("editor@example.test")).toBeNull();

    delete process.env.AIO_AUTH_USERS;
    expect(findAuthUser("editor@example.test")).toBeNull();
  });
});
