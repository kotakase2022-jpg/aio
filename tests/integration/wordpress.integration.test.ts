import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";

let tempDir = "";
const processEnvSnapshot = snapshotProcessEnv();
const safeFetchMock = vi.fn(
  async (url: string | URL, init?: RequestInit, options?: unknown) => {
    void options;
    return fetch(url, init);
  },
);

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-wp-tests-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.WORDPRESS_ENCRYPTION_KEY = "wordpress-test-key-32-characters";
  process.env.VERCEL = "";
  safeFetchMock.mockClear();
  vi.resetModules();
  vi.doMock("@/lib/server/safe-http", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/server/safe-http")>();
    return {
      ...actual,
      safeFetch: safeFetchMock,
    };
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
  vi.doUnmock("@/lib/server/supabase");
  vi.doUnmock("@/lib/server/supabase-gateway");
  vi.doUnmock("@/lib/server/safe-http");
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

  test("saveWordpressConnection rejects private-network destinations", async () => {
    const { saveWordpressConnection } = await import("@/lib/server/wordpress");

    await expect(
      saveWordpressConnection({
        siteUrl: "http://127.0.0.1:8080",
        username: "editor",
        applicationPassword: "secret-app-password",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "安全上の理由により、このWordPressサイトURLは使用できません。",
    });
  });

  test("saveWordpressConnection requires HTTPS in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { saveWordpressConnection } = await import("@/lib/server/wordpress");

    await expect(
      saveWordpressConnection({
        siteUrl: "http://wordpress.example.com",
        username: "editor",
        applicationPassword: "secret-app-password",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "本番環境ではHTTPSのWordPressサイトURLが必要です。",
    });
  });

  test("fallback connection token cannot be replayed with altered destination metadata", async () => {
    const { saveWordpressConnection, publishDraftToWordpress } = await import(
      "@/lib/server/wordpress"
    );
    const connection = await saveWordpressConnection({
      siteUrl: "https://wordpress.example.com",
      username: "editor",
      applicationPassword: "secret-app-password",
    });
    await rm(path.join(tempDir, "wordpress-connections.json"), { force: true });
    const fetchMock = vi.fn(async () =>
      Response.json({ link: "https://attacker.example/stolen" }, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const draft = createSampleDraft({
      status: "approved",
      categories: [],
      tags: [],
      images: [],
    });

    await expect(
      publishDraftToWordpress({
        draft,
        connectionId: "missing-connection",
        connection: {
          ...connection,
          id: "missing-connection",
          siteUrl: "https://attacker.example",
        },
        status: "draft",
        origin: "http://localhost",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "WordPress接続情報を確認できませんでした。",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("saveWordpressConnection returns a Japanese error when Supabase saving fails", async () => {
    mockSupabaseClient({
      from: vi.fn(() => ({
        insert: vi.fn(async () => ({
          error: { message: "connection insert failed" },
        })),
      })),
    });
    const { saveWordpressConnection } = await import("@/lib/server/wordpress");

    await expect(
      saveWordpressConnection({
        siteUrl: "https://wordpress.example.com",
        username: "editor",
        applicationPassword: "secret-app-password",
      }),
    ).rejects.toMatchObject({
      status: 500,
      message: "WordPress接続情報の保存に失敗しました。",
      detail: "connection insert failed",
    });
  });

  test("saveWordpressConnection rejects a weak production encryption key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.WORDPRESS_ENCRYPTION_KEY = "short";
    const { saveWordpressConnection } = await import("@/lib/server/wordpress");

    await expect(
      saveWordpressConnection({
        siteUrl: "https://wordpress.example.com",
        username: "editor",
        applicationPassword: "secret-app-password",
      }),
    ).rejects.toMatchObject({
      status: 500,
      message: "本番環境ではWordPress認証情報の暗号化キーが必要です。",
    });
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
      message: "WordPress投稿に失敗しました。",
      detail: "Invalid credentials",
    });
  });

  test("allows a WordPress post response large enough to include the submitted article", async () => {
    const { saveWordpressConnection, publishDraftToWordpress } = await import(
      "@/lib/server/wordpress"
    );
    const connection = await saveWordpressConnection({
      siteUrl: "https://wordpress.example.com",
      username: "editor",
      applicationPassword: "secret-app-password",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ link: "https://wordpress.example.com/large-response" }, { status: 201 }),
      ),
    );

    await publishDraftToWordpress({
      draft: createSampleDraft({
        status: "approved",
        categories: [],
        tags: [],
        images: [],
      }),
      connectionId: connection.id,
      status: "draft",
      origin: "http://localhost",
    });

    const postCall = safeFetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/wp-json/wp/v2/posts"),
    );
    expect(postCall?.[2]).toMatchObject({ maxResponseBytes: 10 * 1024 * 1024 });
  });

  test("reads a relative local featured image without making a loopback request", async () => {
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsRoot, { recursive: true });
    const localAssetDir = await mkdtemp(path.join(uploadsRoot, "wp-contract-"));
    const imagePath = path.join(localAssetDir, "featured.png");
    await writeFile(
      imagePath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    );

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: "https://wordpress.example.com",
        username: "editor",
        applicationPassword: "secret-app-password",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (value: string | URL) => {
          const url = String(value);
          if (url.endsWith("/wp-json/wp/v2/media")) {
            return Response.json({ id: 301 }, { status: 201 });
          }
          if (url.endsWith("/wp-json/wp/v2/media/301")) {
            return Response.json({ id: 301 });
          }
          if (url.endsWith("/wp-json/wp/v2/posts")) {
            return Response.json(
              { link: "https://wordpress.example.com/local-featured" },
              { status: 201 },
            );
          }
          return Response.json({ message: `Unexpected URL ${url}` }, { status: 500 });
        }),
      );
      const localUrl = `/uploads/${path.basename(localAssetDir)}/featured.png`;

      const result = await publishDraftToWordpress({
        draft: createSampleDraft({
          status: "approved",
          categories: [],
          tags: [],
          images: [
            {
              id: "local-featured",
              slot: "featured",
              url: localUrl,
              path: imagePath,
              prompt: "Local featured image",
              altText: "Local featured image",
              source: "uploaded",
            },
          ],
        }),
        connectionId: connection.id,
        status: "draft",
        origin: "http://localhost:3000",
      });

      expect(result.postUrl).toBe("https://wordpress.example.com/local-featured");
      expect(safeFetchMock.mock.calls.some(([url]) => String(url).includes(localUrl))).toBe(false);
    } finally {
      await rm(localAssetDir, { recursive: true, force: true });
    }
  });

  test("publishDraftToWordpress returns a Japanese error when the stored connection is missing", async () => {
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");
    const draft = createSampleDraft({
      status: "approved",
      categories: [],
      tags: [],
      images: [],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishDraftToWordpress({
        draft,
        connectionId: "missing-wordpress-connection",
        status: "draft",
        origin: "http://localhost",
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "WordPress接続情報が見つかりません。",
      detail: "WordPress接続情報を保存し直してから、もう一度投稿してください。",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("publishDraftToWordpress returns a Japanese error when Supabase connection loading fails", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: { message: "connection select failed" },
    }));
    mockSupabaseClient({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      })),
    });
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");
    const draft = createSampleDraft({
      status: "approved",
      categories: [],
      tags: [],
      images: [],
    });

    await expect(
      publishDraftToWordpress({
        draft,
        connectionId: "wp-connection-load-failure",
        status: "draft",
        origin: "http://localhost",
      }),
    ).rejects.toMatchObject({
      status: 500,
      message: "WordPress接続情報の読み込みに失敗しました。",
      detail: "connection select failed",
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

function mockSupabaseClient(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/server/supabase", () => ({
    getSupabaseAdmin: vi.fn(() => client),
  }));
  vi.doMock("@/lib/server/supabase-gateway", () => ({
    callSupabaseGateway: vi.fn(),
    isSupabaseGatewayConfigured: vi.fn(() => false),
  }));
}
