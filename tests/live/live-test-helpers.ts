import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "vitest";

export function loadLiveEnv() {
  // Precedence must match scripts/check-live-readiness.mjs (loadDotenvFiles): the sandbox-only
  // `.env.live*` files override any shell-exported values, while `.env` / `.env.local` only fill
  // gaps. Otherwise the readiness check could validate a sandbox host from `.env.live.local` while
  // the live tests actually run against a production URL exported in the shell \u2014 risking writes to
  // or deletes against production Supabase/WordPress.
  for (const fileName of [".env", ".env.local", ".env.live", ".env.live.local"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const isLiveFile = fileName.startsWith(".env.live");
    const text = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = cleanEnvValue(trimmed.slice(separator + 1));
      if (key && (isLiveFile || process.env[key] == null)) {
        process.env[key] = value;
      }
    }
  }
}

export function expectLiveContractEnabled() {
  expect(
    cleanEnvValue(process.env.AIO_LIVE_CONTRACT_TESTS),
    "Set AIO_LIVE_CONTRACT_TESTS=1 only when running against sandbox external services.",
  ).toBe("1");
}

export function expectRequiredEnv(names: string[]) {
  const missing = names.filter((name) => !cleanEnvValue(process.env[name]));
  expect(
    missing,
    `Missing required sandbox environment variables: ${missing.join(", ")}`,
  ).toEqual([]);
}

export function expectNonProductionConfirmed() {
  expect(
    cleanEnvValue(process.env.AIO_LIVE_CONFIRM_NON_PRODUCTION),
    "Set AIO_LIVE_CONFIRM_NON_PRODUCTION=1 only after confirming live tests target sandbox/staging resources, never production.",
  ).toBe("1");
}

export function expectSupabaseWriteTargetConfirmed() {
  const nonProductionConfirmed =
    cleanEnvValue(process.env.AIO_LIVE_CONFIRM_NON_PRODUCTION) === "1";
  const productionWriteConfirmed =
    cleanEnvValue(process.env.AIO_LIVE_CONFIRM_PRODUCTION_WRITE) === "1";

  expect(
    nonProductionConfirmed && productionWriteConfirmed,
    "Set only one Supabase live write confirmation flag.",
  ).toBe(false);
  expect(
    nonProductionConfirmed || productionWriteConfirmed,
    "Set AIO_LIVE_CONFIRM_NON_PRODUCTION=1 for sandbox/staging Supabase, or AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1 only after explicit production write/delete approval.",
  ).toBe(true);
}

export function cleanEnvValue(value: string | undefined) {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function basicAuth(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
