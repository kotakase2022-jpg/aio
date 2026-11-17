import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import { authUsersValue, testLoginAccount } from "../helpers/login-accounts";
import type { GenerationLogSummary } from "@/types/aio";

vi.mock("@/lib/server/generation-jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/generation-jobs")>()),
  listGenerationLogsPage: vi.fn(),
}));

const processEnvSnapshot = snapshotProcessEnv();
const sessionSecret = "test-only-demo-session-secret-32-characters";
const retiredAccessCode = "202607";
const configurationError = "認証設定に不備があります。管理者に連絡してください。";
const invalidCredentialsError = "メールアドレスまたはパスワードが違います。";

beforeEach(() => {
  process.env.DEMO_AUTH_SECRET = sessionSecret;
  process.env.AIO_AUTH_USERS = authUsersValue();
});

afterEach(() => {
  vi.unstubAllEnvs();
  restoreProcessEnv(processEnvSnapshot);
});

function loginRequest(body: unknown) {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function logIn(credentials: { email: string; password: string } = testLoginAccount) {
  const { POST } = await import("@/app/api/auth/session/route");
  const response = await POST(loginRequest(credentials));
  expect(response.status).toBe(200);
  const sessionCookie = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("aio_session="));
  return sessionCookie!.split(";")[0];
}

function apiRequest(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);
}

describe("email and password login", () => {
  test("the right email and password get a secure session cookie", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    const accepted = await POST(
      loginRequest({ email: "  EDITOR@example.test ", password: ` ${testLoginAccount.password} ` }),
    );
    const cookies = accepted.headers.getSetCookie();
    const session = cookies.find((cookie) => cookie.startsWith("aio_session=")) ?? "";

    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toEqual({ ok: true });
    expect(session).toMatch(/^aio_session=v2\.\d{13}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
    expect(session).not.toContain(testLoginAccount.password);
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=lax");
    expect(session).toContain("Path=/");
    expect(session).toContain("Max-Age=1209600");
    // Login also expires the cookie of the retired access-code login.
    expect(cookies.find((cookie) => cookie.startsWith("aio_demo_auth="))).toContain("Max-Age=0");
  });

  test("a wrong password, an unknown email and the retired access code get 401 with one message", async () => {
    const { POST } = await import("@/app/api/auth/session/route");
    const attempts = [
      { email: testLoginAccount.email, password: "wrong-password-for-this-account" },
      { email: testLoginAccount.email, password: retiredAccessCode },
      { email: "nobody@example.test", password: testLoginAccount.password },
      { email: testLoginAccount.email, password: "x".repeat(257) },
    ];

    for (const attempt of attempts) {
      const rejected = await POST(loginRequest(attempt));
      expect(rejected.status, attempt.password.slice(0, 12)).toBe(401);
      await expect(rejected.json()).resolves.toEqual({ ok: false, error: invalidCredentialsError });
      expect(rejected.headers.getSetCookie()).toEqual([]);
    }
  });

  test("a request without both email and password is refused, including the retired code alone", async () => {
    const { POST } = await import("@/app/api/auth/session/route");

    for (const body of [
      { code: retiredAccessCode },
      { email: testLoginAccount.email },
      { password: testLoginAccount.password },
      { email: "   ", password: "   " },
      { email: 1, password: ["x"] },
      "not json",
      // Valid JSON that is not an object.
      "null",
      "123",
      "\"text\"",
      "[]",
    ]) {
      const rejected = await POST(loginRequest(body));
      expect(rejected.status, JSON.stringify(body)).toBe(400);
      await expect(rejected.json()).resolves.toEqual({
        ok: false,
        error: "メールアドレスとパスワードを入力してください。",
      });
      expect(rejected.headers.getSetCookie()).toEqual([]);
    }
  });

  test("without valid accounts every login fails with a configuration error, even the old default code", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/auth/session/route");

    for (const value of [
      undefined,
      "",
      "   ",
      retiredAccessCode,
      "not json",
      "[]",
      JSON.stringify([{ email: testLoginAccount.email, passwordHash: testLoginAccount.password }]),
    ]) {
      if (value === undefined) {
        delete process.env.AIO_AUTH_USERS;
      } else {
        process.env.AIO_AUTH_USERS = value;
      }

      for (const body of [{ code: retiredAccessCode }, testLoginAccount, {}]) {
        const rejected = await POST(loginRequest(body));
        expect(rejected.status, `${String(value)} ${JSON.stringify(body)}`).toBe(500);
        await expect(rejected.json()).resolves.toEqual({ ok: false, error: configurationError });
        expect(rejected.headers.getSetCookie()).toEqual([]);
      }
    }
    // The server log says why, without naming an account or a hash.
    expect(consoleError).toHaveBeenCalledWith(expect.stringMatching(/^Login is unavailable: AIO_AUTH_USERS/));
    expect(consoleError.mock.calls.flat().join("\n")).not.toMatch(/@|scrypt:|test-only-password/);
  });

  test("a password the account script accepts also logs in, counted after normalization", async () => {
    // 300 code units as typed, 150 after NFKC: within the limit both when created and when typed again.
    const account = { email: "combining@example.test", password: "Å".repeat(150) };
    process.env.AIO_AUTH_USERS = authUsersValue([account]);
    const { POST } = await import("@/app/api/auth/session/route");

    const accepted = await POST(loginRequest(account));

    expect(accepted.status).toBe(200);
    expect(accepted.headers.getSetCookie().some((cookie) => cookie.startsWith("aio_session=v2."))).toBe(true);
  });

  test("production without a session secret refuses to log in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.DEMO_AUTH_SECRET = "";
    const { POST } = await import("@/app/api/auth/session/route");

    const rejected = await POST(loginRequest(testLoginAccount));

    expect(rejected.status).toBe(500);
    await expect(rejected.json()).resolves.toEqual({ ok: false, error: configurationError });
    expect(rejected.headers.getSetCookie()).toEqual([]);
  });

  test("logout clears the session cookie and the retired cookie", async () => {
    const { DELETE } = await import("@/app/api/auth/session/route");

    const response = await DELETE();
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(cookies.find((cookie) => cookie.startsWith("aio_session="))).toMatch(/^aio_session=;.*Max-Age=0/);
    expect(cookies.find((cookie) => cookie.startsWith("aio_demo_auth="))).toMatch(/^aio_demo_auth=;.*Max-Age=0/);
  });
});

describe("authentication proxy", () => {
  test("unauthenticated pages go to the login screen, and APIs answer in Japanese", async () => {
    const { proxy } = await import("@/proxy");

    const pageResponse = await proxy(new NextRequest("http://localhost/?tab=preview"));
    expect(pageResponse.status).toBe(307);
    expect(pageResponse.headers.get("location")).toBe("http://localhost/login?next=%2F%3Ftab%3Dpreview");

    const apiResponse = await proxy(apiRequest("/api/generate-article"));
    expect(apiResponse.status).toBe(401);
    await expect(apiResponse.json()).resolves.toMatchObject({
      ok: false,
      error: "認証が必要です。ログインしてください。",
    });

    expect((await proxy(apiRequest("/login"))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(apiRequest("/api/auth/session"))).headers.get("x-middleware-next")).toBe("1");
  });

  test("the retired access-code screen leads to the login screen and its API admits nobody", async () => {
    const { proxy } = await import("@/proxy");

    const retiredScreen = await proxy(new NextRequest("http://localhost/demo-login?next=%2F%3Ftab%3Dpreview"));
    expect(retiredScreen.status).toBe(307);
    expect(retiredScreen.headers.get("location")).toBe("http://localhost/login?next=%2F%3Ftab%3Dpreview");

    const retiredApi = await proxy(
      new NextRequest("http://localhost/api/demo-auth", {
        method: "POST",
        body: JSON.stringify({ code: retiredAccessCode }),
      }),
    );
    expect(retiredApi.status).toBe(401);
    expect(retiredApi.headers.get("set-cookie")).toBeNull();
  });

  test("legacy cookies, including a signed access-code session, cannot pass; a login session can", async () => {
    const { proxy } = await import("@/proxy");
    const retiredPayload = `v1.${Date.now() + 60_000}.${randomBytes(18).toString("base64url")}`;
    const retiredToken = `${retiredPayload}.${createHmac("sha256", sessionSecret).update(retiredPayload).digest("base64url")}`;

    for (const cookie of [
      "aio_demo_auth=demo-access-granted",
      `aio_demo_auth=${retiredToken}`,
      `aio_session=${retiredToken}`,
      "aio_session=demo-access-granted",
    ]) {
      const forged = await proxy(apiRequest("/api/generation-logs", cookie));
      expect(forged.status, cookie.slice(0, 20)).toBe(401);
    }

    const cookie = await logIn();
    const accepted = await proxy(apiRequest("/api/generation-logs", cookie));
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("x-middleware-next")).toBe("1");

    const loginWhileSignedIn = await proxy(apiRequest("/login", cookie));
    expect(loginWhileSignedIn.status).toBe(307);
    expect(loginWhileSignedIn.headers.get("location")).toBe("http://localhost/");
  });

  test("removing an account or changing its password ends its sessions at once", async () => {
    const { proxy } = await import("@/proxy");
    const cookie = await logIn();
    expect((await proxy(apiRequest("/api/generation-logs", cookie))).status).toBe(200);

    // The operator re-issues the password of the same person: a new hash, so old sessions end.
    process.env.AIO_AUTH_USERS = authUsersValue();
    expect((await proxy(apiRequest("/api/generation-logs", cookie))).status).toBe(401);

    const fresh = await logIn();
    process.env.AIO_AUTH_USERS = authUsersValue([
      { email: "owner@example.test", password: "another-test-only-password" },
    ]);
    expect((await proxy(apiRequest("/api/generation-logs", fresh))).status).toBe(401);

    process.env.AIO_AUTH_USERS = "";
    expect((await proxy(apiRequest("/api/generation-logs", fresh))).status).toBe(401);
  });
});

describe("generation log route", () => {
  test("generation logs route returns persisted summaries", async () => {
    const { listGenerationLogsPage } = await import("@/lib/server/generation-jobs");
    const logs: GenerationLogSummary[] = [
      {
        id: "job-1",
        status: "completed",
        createdAt: "2026-07-02T00:00:00.000Z",
        updatedAt: "2026-07-02T00:01:00.000Z",
        inputSummary: "参照1件 / 画像2枚 / 3000字",
        outputTitle: "AIO記事",
        wordpressPostStatus: "draft",
      },
    ];
    vi.mocked(listGenerationLogsPage).mockResolvedValueOnce({ logs, nextCursor: null, complete: true });
    const { GET } = await import("@/app/api/generation-logs/route");

    const response = await GET(new Request("http://localhost/api/generation-logs"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(listGenerationLogsPage).toHaveBeenCalledWith({ limit: 20, cursor: null });
    expect(json).toMatchObject({ ok: true, logs, nextCursor: null, complete: true });
  });
});
