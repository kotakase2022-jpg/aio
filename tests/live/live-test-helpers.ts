import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect } from "vitest";

export function loadLiveEnv() {
  for (const fileName of [".env.live.local", ".env.live", ".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!existsSync(filePath)) {
      continue;
    }

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
      if (key && process.env[key] == null) {
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

export function cleanEnvValue(value: string | undefined) {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function basicAuth(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
