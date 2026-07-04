import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-wp-tests-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.WORDPRESS_ENCRYPTION_KEY = "wordpress-test-key-32-characters";
  process.env.VERCEL = "";
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  delete process.env.AIO_LOCAL_DATA_DIR;
});

describe("WordPress connection and posting", () => {
  test("connect route returns Japanese validation details for missing application password", async () => {
    const { POST } = await import("@/app/api/wordpress/connect/route");

    const response = await POST(
      new Request("http://localhost/api/wordpress/connect", {
        method: "POST",
        body: JSON.stringify({
          siteUrl: "https://wordpress.example.com",
          username: "editor",
          applicationPassword: "",
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      ok: false,
      error: "WordPress接続情報を確認してください。",
      detail: "Application Passwordを入力してください。",
    });
  });

  test("saveWordpressConnection stores encrypted credentials only", async () => {
    const { saveWordpressConnection } = await import("@/lib/server/wordpress");

    const connection = await saveWordpressConnection({
      siteUrl: "https://wordpress.example.com/path",
      username: "editor",
      applicationPassword: "secret-app-password",
    });
    const rawStore = await readFile(path.join(tempDir, "wordpress-connections.json"), "utf8");

    expect(connection.siteUrl).toBe("https://wordpress.example.com");
    expect(connection.connectionToken).not.toBe("secret-app-password");
    expect(rawStore).not.toContain("secret-app-password");
  });

  test("publishDraftToWordpress fails clearly when the WordPress API rejects a post", async () => {
    const { saveWordpressConnection, publishDraftToWordpress } = await import(
      "@/lib/server/wordpress"
    );
    const connection = await saveWordpressConnection({
      siteUrl: "https://wordpress.example.com",
      username: "editor",
      applicationPassword: "secret-app-password",
    });
    const draft = createSampleDraft({
      status: "approved",
      categories: [],
      tags: [],
      images: [],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "Invalid credentials" }, { status: 401 }),
      ),
    );

    await expect(
      publishDraftToWordpress({
        draft,
        connectionId: connection.id,
        status: "draft",
        origin: "http://localhost",
      }),
    ).rejects.toMatchObject({
      status: 401,
      detail: "Invalid credentials",
    });
  });

  test("publishDraftToWordpress rejects unapproved drafts before external requests", async () => {
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");
    const draft = createSampleDraft({ status: "draft" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishDraftToWordpress({
        draft,
        connectionId: "wp-connection-1",
        status: "draft",
        origin: "http://localhost",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "承認済みドラフトのみWordPress投稿できます。",
      detail: "先に「承認済みに変更」を押してから投稿してください。",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
