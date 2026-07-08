import { afterEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import type { GenerationLogSummary } from "@/types/aio";

vi.mock("@/lib/server/generation-jobs", () => ({
  listGenerationLogs: vi.fn(),
}));

const processEnvSnapshot = snapshotProcessEnv();

afterEach(() => {
  restoreProcessEnv(processEnvSnapshot);
});

describe("demo authentication and log routes", () => {
  test("demo auth rejects wrong code and sets secure cookie for the correct code", async () => {
    process.env.DEMO_ACCESS_CODE = "202607";
    const { POST, DELETE } = await import("@/app/api/demo-auth/route");

    const rejected = await POST(
      new Request("http://localhost/api/demo-auth", {
        method: "POST",
        body: JSON.stringify({ code: "wrong" }),
      }),
    );
    const rejectedJson = await rejected.json();

    expect(rejected.status).toBe(401);
    expect(rejectedJson).toMatchObject({
      ok: false,
      error: "アクセスコードが違います。",
    });

    const accepted = await POST(
      new Request("http://localhost/api/demo-auth", {
        method: "POST",
        body: JSON.stringify({ code: "202607" }),
      }),
    );
    const acceptedJson = await accepted.json();
    const setCookie = accepted.headers.get("set-cookie") ?? "";

    expect(accepted.status).toBe(200);
    expect(acceptedJson).toMatchObject({ ok: true });
    expect(setCookie).toContain("aio_demo_auth=demo-access-granted");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");

    const deleted = await DELETE();
    expect(deleted.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  test("proxy redirects unauthenticated pages and returns Japanese API auth errors", async () => {
    const { proxy } = await import("@/proxy");

    const pageResponse = proxy(
      new NextRequest("http://localhost/?tab=preview"),
    );
    expect(pageResponse.status).toBe(307);
    expect(pageResponse.headers.get("location")).toBe(
      "http://localhost/demo-login?next=%2F%3Ftab%3Dpreview",
    );

    const apiResponse = proxy(
      new NextRequest("http://localhost/api/generate-article"),
    );
    const apiJson = await apiResponse.json();
    expect(apiResponse.status).toBe(401);
    expect(apiJson).toMatchObject({
      ok: false,
      error: "認証が必要です。アクセスコードを入力してください。",
    });
  });

  test("generation logs route returns persisted summaries", async () => {
    const { listGenerationLogs } = await import("@/lib/server/generation-jobs");
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
    vi.mocked(listGenerationLogs).mockResolvedValueOnce(logs);
    const { GET } = await import("@/app/api/generation-logs/route");

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(listGenerationLogs).toHaveBeenCalledWith(20);
    expect(json).toMatchObject({ ok: true, logs });
  });
});
