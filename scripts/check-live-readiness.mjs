import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const providers = new Set(["openai", "supabase", "wordpress"]);
const requestedProviders = process.argv
  .slice(2)
  .map((item) => item.toLowerCase())
  .filter(Boolean);
const selectedProviders =
  requestedProviders.length > 0 ? requestedProviders : Array.from(providers);

const unknownProviders = selectedProviders.filter((provider) => !providers.has(provider));
if (unknownProviders.length > 0) {
  console.error(`Unknown live readiness provider: ${unknownProviders.join(", ")}`);
  process.exit(1);
}

loadDotenvFiles();

const checks = selectedProviders.map(checkProvider);
const failed = checks.filter((check) => check.errors.length > 0);

console.log("Live sandbox readiness:");
for (const check of checks) {
  const status = check.errors.length === 0 ? "ready" : "not ready";
  console.log(`- ${check.provider}: ${status}`);
  for (const error of check.errors) {
    console.log(`  - ${error}`);
  }
}

if (failed.length > 0) {
  console.error(
    "Live sandbox checks are not ready. Set the missing sandbox-only environment variables before running live tests.",
  );
  process.exit(1);
}

function checkProvider(provider) {
  if (provider === "openai") {
    return {
      provider,
      errors: [
        ...missing(["AIO_LIVE_CONTRACT_TESTS", "OPENAI_API_KEY"]),
        ...requireValue("AIO_LIVE_CONTRACT_TESTS", "1"),
      ],
    };
  }

  if (provider === "supabase") {
    return {
      provider,
      errors: [
        ...missing([
          "AIO_LIVE_CONTRACT_TESTS",
          "NEXT_PUBLIC_SUPABASE_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "AIO_LIVE_SUPABASE_ALLOW_WRITE",
          "AIO_LIVE_CONFIRM_NON_PRODUCTION",
        ]),
        ...requireValue("AIO_LIVE_CONTRACT_TESTS", "1"),
        ...requireValue("AIO_LIVE_SUPABASE_ALLOW_WRITE", "1"),
        ...requireValue("AIO_LIVE_CONFIRM_NON_PRODUCTION", "1"),
        ...warnProductionLikeUrl("NEXT_PUBLIC_SUPABASE_URL"),
      ],
    };
  }

  return {
    provider,
    errors: [
      ...missing([
        "AIO_LIVE_CONTRACT_TESTS",
        "WORDPRESS_SANDBOX_SITE_URL",
        "WORDPRESS_SANDBOX_USERNAME",
        "WORDPRESS_SANDBOX_APPLICATION_PASSWORD",
        "AIO_LIVE_WORDPRESS_ALLOW_POST",
        "AIO_LIVE_WORDPRESS_ALLOW_MEDIA",
        "AIO_LIVE_CONFIRM_NON_PRODUCTION",
      ]),
      ...requireValue("AIO_LIVE_CONTRACT_TESTS", "1"),
      ...requireValue("AIO_LIVE_WORDPRESS_ALLOW_POST", "1"),
      ...requireValue("AIO_LIVE_WORDPRESS_ALLOW_MEDIA", "1"),
      ...requireValue("AIO_LIVE_CONFIRM_NON_PRODUCTION", "1"),
      ...warnProductionLikeUrl("WORDPRESS_SANDBOX_SITE_URL"),
    ],
  };
}

function missing(names) {
  return names
    .filter((name) => !cleanEnvValue(process.env[name]))
    .map((name) => `${name} is missing.`);
}

function requireValue(name, expected) {
  const value = cleanEnvValue(process.env[name]);
  if (!value || value === expected) {
    return [];
  }
  return [`${name} must be ${expected}.`];
}

function warnProductionLikeUrl(name) {
  const value = cleanEnvValue(process.env[name]);
  if (!value) {
    return [];
  }

  let host = "";
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return [`${name} must be a valid URL.`];
  }

  const looksSandbox =
    /(^localhost$|\.local$|sandbox|staging|stage|test|dev|preview|demo)/i.test(host);
  if (looksSandbox || cleanEnvValue(process.env.AIO_LIVE_CONFIRM_NON_PRODUCTION) === "1") {
    return [];
  }

  return [
    `${name} host (${host}) does not look like a sandbox/staging host. Keep AIO_LIVE_CONFIRM_NON_PRODUCTION=1 only after verifying this is not production.`,
  ];
}

function loadDotenvFiles() {
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

function cleanEnvValue(value) {
  return (value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}
