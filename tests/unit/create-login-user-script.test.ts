import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { parseAuthUsers } from "@/lib/server/auth-users";
import { DEFAULT_SCRYPT_PARAMS, parsePasswordHash, verifyPassword } from "@/lib/server/login-credentials";

const execFileAsync = promisify(execFile);
const scriptPath = path.join(process.cwd(), "scripts", "create-login-user.mjs");

describe("create-login-user script", () => {
  test("prints a generated password once and an entry that logs in with it", async () => {
    const { stdout } = await execFileAsync(process.execPath, [scriptPath, " New.User@Example.COM "]);
    const password = stdout.match(/^ {2}([a-km-np-zA-HJ-NP-Z2-9]{4}(?:-[a-km-np-zA-HJ-NP-Z2-9]{4}){4})$/m)?.[1];
    const wholeValue = stdout.match(/^ {2}(\[\{"email".*\}\])$/m)?.[1];

    expect(password).toBeTruthy();
    expect(wholeValue).toBeTruthy();
    const config = parseAuthUsers(wholeValue);
    expect(config.ok).toBe(true);
    if (!config.ok || !password) return;
    const account = config.users.get("new.user@example.com");
    expect(account).toBeTruthy();
    expect(parsePasswordHash(account!.passwordHash)).toMatchObject(DEFAULT_SCRYPT_PARAMS);
    await expect(verifyPassword(password, account!.passwordHash)).resolves.toBe(true);
    // The hash never contains the password.
    expect(account!.passwordHash).not.toContain(password);
  });

  test("hashes a password from standard input without printing it", async () => {
    const chosen = "operator-chosen password 2026";
    const result = await runWithInput(["owner@example.com", "--password-stdin"], `${chosen}\r\n`);
    const entry = result.stdout.match(/^ {2}(\{"email".*\})$/m)?.[1];

    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain(chosen);
    expect(entry).toBeTruthy();
    const { email, passwordHash } = JSON.parse(entry!) as { email: string; passwordHash: string };
    expect(email).toBe("owner@example.com");
    await expect(verifyPassword(chosen, passwordHash)).resolves.toBe(true);
  });

  test("refuses a short password, a bad email and unknown options", async () => {
    const short = await runWithInput(["owner@example.com", "--password-stdin"], "short\n");
    expect(short.code).toBe(1);
    expect(short.stderr).toMatch(/at least 15 characters/);
    expect(short.stdout).toBe("");

    const badEmail = await runWithInput(["not-an-email"], "");
    expect(badEmail.code).toBe(1);
    expect(badEmail.stderr).toMatch(/Not an email address/);
    expect(badEmail.stdout).toBe("");

    const unknownOption = await runWithInput(["owner@example.com", "--password=abc"], "");
    expect(unknownOption.code).toBe(2);
    expect(unknownOption.stderr).toMatch(/Usage:/);

    const noEmail = await runWithInput([], "");
    expect(noEmail.code).toBe(2);
  });
});

function runWithInput(args: string[], input: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}
