import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), "scripts", "check-live-readiness.mjs");

describe("check-live-readiness script", () => {
  test("loads sandbox-only .env.live.local before the normal .env.local file", async () => {
    await withTempProject(async (projectDir) => {
      await writeFile(
        path.join(projectDir, ".env.local"),
        [
          "NEXT_PUBLIC_SUPABASE_URL=https://production.example.com",
          "SUPABASE_SERVICE_ROLE_KEY=",
          "AIO_LIVE_SUPABASE_ALLOW_WRITE=",
          "AIO_LIVE_CONFIRM_NON_PRODUCTION=",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        path.join(projectDir, ".env.live.local"),
        [
          "AIO_LIVE_CONTRACT_TESTS=1",
          "NEXT_PUBLIC_SUPABASE_URL=https://aio-sandbox.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=sandbox-service-role",
          "AIO_LIVE_SUPABASE_ALLOW_WRITE=1",
          "AIO_LIVE_CONFIRM_NON_PRODUCTION=1",
        ].join("\n"),
        "utf8",
      );

      const result = await runReadiness(projectDir, "supabase");

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("- supabase: ready");
      expect(result.stdout).not.toContain("production.example.com");
    });
  });

  test("lets .env.live.local override production-like shell app env", async () => {
    await withTempProject(async (projectDir) => {
      await writeFile(
        path.join(projectDir, ".env.live.local"),
        [
          "AIO_LIVE_CONTRACT_TESTS=1",
          "NEXT_PUBLIC_SUPABASE_URL=https://aio-sandbox.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=sandbox-service-role",
          "AIO_LIVE_SUPABASE_ALLOW_WRITE=1",
          "AIO_LIVE_CONFIRM_NON_PRODUCTION=1",
        ].join("\n"),
        "utf8",
      );

      const result = await runReadiness(projectDir, "supabase", {
        NEXT_PUBLIC_SUPABASE_URL: "https://production.example.com",
        SUPABASE_SERVICE_ROLE_KEY: "production-service-role",
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("- supabase: ready");
      expect(result.stdout).not.toContain("production.example.com");
    });
  });

  test("fails closed when sandbox write confirmation is missing", async () => {
    await withTempProject(async (projectDir) => {
      await writeFile(
        path.join(projectDir, ".env.live.local"),
        [
          "AIO_LIVE_CONTRACT_TESTS=1",
          "NEXT_PUBLIC_SUPABASE_URL=https://aio-sandbox.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=sandbox-service-role",
        ].join("\n"),
        "utf8",
      );

      const result = await runReadiness(projectDir, "supabase");

      expect(result.code).toBe(1);
      expect(result.stdout).toContain("AIO_LIVE_SUPABASE_ALLOW_WRITE is missing.");
      expect(result.stderr).toContain("Live sandbox checks are not ready.");
    });
  });

  test("fails closed for production-like live write hosts unless explicitly allowlisted", async () => {
    await withTempProject(async (projectDir) => {
      await writeFile(
        path.join(projectDir, ".env.live.local"),
        [
          "AIO_LIVE_CONTRACT_TESTS=1",
          "NEXT_PUBLIC_SUPABASE_URL=https://production.example.com",
          "SUPABASE_SERVICE_ROLE_KEY=sandbox-service-role",
          "AIO_LIVE_SUPABASE_ALLOW_WRITE=1",
          "AIO_LIVE_CONFIRM_NON_PRODUCTION=1",
        ].join("\n"),
        "utf8",
      );

      const result = await runReadiness(projectDir, "supabase");

      expect(result.code).toBe(1);
      expect(result.stdout).toContain(
        "NEXT_PUBLIC_SUPABASE_URL host (production.example.com) does not look like a sandbox/staging host.",
      );
      expect(result.stdout).toContain("AIO_LIVE_SANDBOX_HOST_ALLOWLIST");
      expect(result.stderr).toContain("Live sandbox checks are not ready.");
    });
  });

  test("allows an explicitly reviewed non-production host through the live sandbox allowlist", async () => {
    await withTempProject(async (projectDir) => {
      await writeFile(
        path.join(projectDir, ".env.live.local"),
        [
          "AIO_LIVE_CONTRACT_TESTS=1",
          "NEXT_PUBLIC_SUPABASE_URL=https://reviewed-project.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=sandbox-service-role",
          "AIO_LIVE_SUPABASE_ALLOW_WRITE=1",
          "AIO_LIVE_CONFIRM_NON_PRODUCTION=1",
          "AIO_LIVE_SANDBOX_HOST_ALLOWLIST=reviewed-project.supabase.co",
        ].join("\n"),
        "utf8",
      );

      const result = await runReadiness(projectDir, "supabase");

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("- supabase: ready");
    });
  });
});

async function withTempProject(callback: (projectDir: string) => Promise<void>) {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "aio-live-readiness-"));
  try {
    await callback(projectDir);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}

async function runReadiness(
  projectDir: string,
  provider: string,
  envOverrides: Record<string, string> = {},
) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, provider], {
      cwd: projectDir,
      env: { ...cleanProcessEnv(), ...envOverrides },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: failure.code ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

function cleanProcessEnv() {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      key.startsWith("AIO_LIVE_") ||
      key.startsWith("WORDPRESS_SANDBOX_") ||
      key === "NEXT_PUBLIC_SUPABASE_URL" ||
      key === "SUPABASE_SERVICE_ROLE_KEY"
    ) {
      delete env[key];
    }
  }
  return env;
}
