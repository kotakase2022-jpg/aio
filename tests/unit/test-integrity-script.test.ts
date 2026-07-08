import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), "scripts", "check-test-integrity.mjs");
const testCall = ["te", "st"].join("");

describe("check-test-integrity script", () => {
  test("passes a minimal E2E test with an assertion", async () => {
    await withTempProject(async (projectDir) => {
      await writeProjectTest(
        projectDir,
        "tests/e2e/example.spec.ts",
        `
          import { expect, test } from "@playwright/test";

          ${testCall}("example flow", async () => {
            expect(1).toBe(1);
          });
        `,
      );

      const result = await runIntegrity(projectDir);

      expect(result.stdout).toContain("Test integrity check passed");
      expect(result.stderr).toBe("");
    });
  });

  test("rejects focused or placeholder tests", async () => {
    await withTempProject(async (projectDir) => {
      const focusedModifier = ["test", "only"].join(".");
      const placeholderModifier = ["test", "todo"].join(".");
      await writeProjectTest(
        projectDir,
        "tests/e2e/example.spec.ts",
        `
          import { expect, test } from "@playwright/test";

          ${focusedModifier}("focused flow", async () => {
            expect(1).toBe(1);
          });

          ${placeholderModifier}("unfinished flow");
        `,
      );

      const result = await runIntegrity(projectDir);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("forbidden test modifier");
    });
  });

  test("rejects test files without assertions and projects without E2E tests", async () => {
    await withTempProject(async (projectDir) => {
      await writeProjectTest(
        projectDir,
        "tests/unit/no-assertion.test.ts",
        `
          import { test } from "vitest";

          ${testCall}("missing assertion", () => {
            const value = 1 + 1;
            return value;
          });
        `,
      );

      const result = await runIntegrity(projectDir);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("E2E test files are required");
      expect(result.stderr).toContain("does not appear to contain an assertion");
    });
  });
});

async function withTempProject(callback: (projectDir: string) => Promise<void>) {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), "aio-integrity-"));
  try {
    await callback(projectDir);
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
}

async function writeProjectTest(projectDir: string, relativePath: string, source: string) {
  const filePath = path.join(projectDir, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, source.trimStart(), "utf8");
}

async function runIntegrity(projectDir: string) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: projectDir,
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
