import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { loadLiveEnv } from "../live/live-test-helpers";

describe("loadLiveEnv", () => {
  test("lets .env.live.local override shell-exported production-like values", async () => {
    await withTempProject(async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://production.example.com";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "production-service-role";
      process.env.AIO_LIVE_CONTRACT_TESTS = "0";

      await writeFile(
        ".env.live.local",
        [
          "AIO_LIVE_CONTRACT_TESTS=1",
          "NEXT_PUBLIC_SUPABASE_URL=https://aio-sandbox.supabase.co",
          "SUPABASE_SERVICE_ROLE_KEY=sandbox-service-role",
        ].join("\n"),
        "utf8",
      );

      loadLiveEnv();

      expect(process.env.AIO_LIVE_CONTRACT_TESTS).toBe("1");
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://aio-sandbox.supabase.co");
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe("sandbox-service-role");
    });
  });

  test("keeps shell-exported values when only normal .env files define the same key", async () => {
    await withTempProject(async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shell.example.com";
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await writeFile(
        ".env.local",
        [
          "NEXT_PUBLIC_SUPABASE_URL=https://local.example.com",
          "SUPABASE_SERVICE_ROLE_KEY=local-service-role",
        ].join("\n"),
        "utf8",
      );

      loadLiveEnv();

      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://shell.example.com");
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe("local-service-role");
    });
  });

  test("applies dotenv precedence from base env to live-local env", async () => {
    await withTempProject(async () => {
      await writeFile(
        ".env",
        [
          "AIO_LIVE_CONTRACT_TESTS=0",
          "NEXT_PUBLIC_SUPABASE_URL=https://base.example.com",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        ".env.local",
        "NEXT_PUBLIC_SUPABASE_URL=https://local.example.com",
        "utf8",
      );
      await writeFile(
        ".env.live",
        "NEXT_PUBLIC_SUPABASE_URL=https://live-stage.example.com",
        "utf8",
      );
      await writeFile(
        ".env.live.local",
        [
          "AIO_LIVE_CONTRACT_TESTS=1",
          "NEXT_PUBLIC_SUPABASE_URL=https://live-local-stage.example.com",
        ].join("\n"),
        "utf8",
      );

      loadLiveEnv();

      expect(process.env.AIO_LIVE_CONTRACT_TESTS).toBe("1");
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(
        "https://live-local-stage.example.com",
      );
    });
  });
});

async function withTempProject(callback: () => Promise<void>) {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "aio-live-env-"));
  const previousCwd = process.cwd();
  const previousEnv = { ...process.env };

  process.chdir(projectDir);
  try {
    await callback();
  } finally {
    process.chdir(previousCwd);
    restoreEnv(previousEnv);
    await rm(projectDir, { recursive: true, force: true });
  }
}

function restoreEnv(previousEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, previousEnv);
}
