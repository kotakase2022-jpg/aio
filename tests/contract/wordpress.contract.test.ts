import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import { createMockHttpServer, sendJson } from "../helpers/mock-http-server";

let tempDir = "";
const processEnvSnapshot = snapshotProcessEnv();

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-wp-contract-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.WORDPRESS_ENCRYPTION_KEY = "wordpress-contract-key-32-characters";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.VERCEL = "";
  vi.resetModules();
  // Contract servers bind to loopback by design. Only this test module bypasses the
  // production SSRF guard; dedicated safe-http tests verify that production rejects it.
  vi.doMock("@/lib/server/safe-http", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/server/safe-http")>();
    return {
      ...actual,
      assertSafeOutboundUrl: (value: string | URL) => new URL(value),
      safeFetch: async (url: string | URL, init?: RequestInit) => fetch(url, init),
    };
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
  vi.doUnmock("@/lib/server/safe-http");
});

describe("WordPress REST API contract", () => {
  test("publishes approved drafts with terms, featured media, and post payload", async () => {
    const authHeader = `Basic ${Buffer.from("editor:secret-app-password").toString("base64")}`;
    const server = await createMockHttpServer((request, response) => {
      expect(request.headers.authorization).toBe(authHeader);

      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        expect(request.search).toContain("search=Content");
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/categories") {
        expect(request.json).toMatchObject({ name: "Content Marketing" });
        sendJson(response, { id: 11, name: "Content Marketing" }, 201);
        return;
      }

      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/tags") {
        expect(["AIO", "AI search", "B2B"]).toContain((request.json as { name: string }).name);
        const id = 20 + server.requests.filter((item) => item.pathname === request.pathname).length;
        sendJson(response, { id, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/media") {
        expect(request.headers["content-type"]).toContain("image/png");
        expect(request.headers["content-disposition"]).toContain("aio-featured");
        expect(request.bodyText.length).toBeGreaterThan(0);
        sendJson(response, { id: 301 }, 201);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/media/301") {
        expect(request.json).toMatchObject({ alt_text: "Contract featured image" });
        sendJson(response, { id: 301 }, 200);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/posts") {
        expect(request.json).toMatchObject({
          title: "AIO Content Operations Guide",
          slug: "aio-content-operations-guide",
          status: "draft",
          categories: [11],
          featured_media: 301,
        });
        const content = (request.json as { content: string }).content;
        expect(content).toContain('src="http://localhost/uploads/generated/inline-contract.png"');
        expect(content).toContain('alt="Contract inline image"');
        expect(content).not.toContain("aio-image:inline-contract");
        expect(content).not.toContain("Inline duplicate");
        expect(content).toContain('class="aio-faq-block"');
        expect(content).toContain("What is AIO?");
        expect((request.json as { tags: number[] }).tags).toHaveLength(3);
        sendJson(response, { link: `${server.origin}/aio-content-operations-guide/` }, 201);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });
      const draft = createSampleDraft({
        status: "approved",
        editedBodyHtml:
          '<h2>Contract body</h2><figure data-image-slot="inline-1"><img src="aio-image:inline-contract" alt="Inline"></figure><p><img src="/uploads/generated/inline-contract.png" alt="Inline duplicate"></p>',
        images: [
          {
            id: "featured-contract",
            slot: "featured",
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
            path: "generated/featured.png",
            prompt: "contract image",
            altText: "Contract featured image",
            source: "generated",
          },
          {
            id: "inline-contract",
            slot: "inline-1",
            url: "/uploads/generated/inline-contract.png",
            path: "generated/inline-contract.png",
            prompt: "inline image",
            altText: "Contract inline image",
            source: "generated",
          },
        ],
      });

      const result = await publishDraftToWordpress({
        draft,
        connectionId: connection.id,
        status: "draft",
        origin: "http://localhost",
      });

      expect(result.postUrl).toBe(`${server.origin}/aio-content-operations-guide/`);
      expect(result.draft.status).toBe("posted");
      const requestNames = server.requests.map(
        (request) => `${request.method} ${request.pathname}`,
      );
      expect(requestNames).toEqual(
        expect.arrayContaining([
          "GET /wp-json/wp/v2/categories",
          "POST /wp-json/wp/v2/categories",
          "POST /wp-json/wp/v2/media",
          "POST /wp-json/wp/v2/media/301",
          "POST /wp-json/wp/v2/posts",
        ]),
      );
      expect(requestNames.filter((name) => name === "GET /wp-json/wp/v2/tags")).toHaveLength(3);
      expect(requestNames.filter((name) => name === "POST /wp-json/wp/v2/tags")).toHaveLength(3);
      expect(requestNames.indexOf("POST /wp-json/wp/v2/media")).toBeLessThan(
        requestNames.indexOf("POST /wp-json/wp/v2/media/301"),
      );
      expect(requestNames.indexOf("POST /wp-json/wp/v2/media/301")).toBeLessThan(
        requestNames.indexOf("POST /wp-json/wp/v2/posts"),
      );
    } finally {
      await server.close();
    }
  });

  test("stops before posting when WordPress term search fails", async () => {
    const server = await createMockHttpServer((request, response) => {
      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(
          response,
          {
            code: "rest_cannot_view",
            message: "Sorry, you are not allowed to list categories.",
          },
          401,
        );
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });

      await expect(
        publishDraftToWordpress({
          draft: createSampleDraft({ status: "approved", tags: [] }),
          connectionId: connection.id,
          status: "draft",
          origin: "http://localhost",
        }),
      ).rejects.toMatchObject({
        status: 401,
        message: "WordPressカテゴリーの検索に失敗しました。",
        detail: "Sorry, you are not allowed to list categories.",
      });

      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).toContain("GET /wp-json/wp/v2/categories");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/media");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });

  test("stops before posting when a matched WordPress term has a non-numeric id", async () => {
    const server = await createMockHttpServer((request, response) => {
      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, [{ id: "11", name: "Content Marketing" }]);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });

      await expect(
        publishDraftToWordpress({
          draft: createSampleDraft({ status: "approved", tags: [] }),
          connectionId: connection.id,
          status: "draft",
          origin: "http://localhost",
        }),
      ).rejects.toMatchObject({
        status: 502,
        message: "WordPressカテゴリー検索の応答形式が不正です。",
        detail: "WordPress REST APIが数値IDを持たないタームを返しました。",
      });

      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).toContain("GET /wp-json/wp/v2/categories");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });

  test("stops before posting when a created WordPress term has a non-numeric id", async () => {
    const server = await createMockHttpServer((request, response) => {
      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, { id: "11", name: (request.json as { name: string }).name }, 201);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });

      await expect(
        publishDraftToWordpress({
          draft: createSampleDraft({ status: "approved", tags: [] }),
          connectionId: connection.id,
          status: "draft",
          origin: "http://localhost",
        }),
      ).rejects.toMatchObject({
        status: 502,
        message: "WordPressカテゴリー作成の応答形式が不正です。",
        detail: "WordPress REST APIが数値IDを持たないタームを返しました。",
      });

      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).toContain("POST /wp-json/wp/v2/categories");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });

  test("stops before creating a post when featured media upload fails", async () => {
    const server = await createMockHttpServer((request, response) => {
      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, { id: 11, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, { id: 21, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/media") {
        sendJson(response, { message: "Featured media storage is unavailable." }, 503);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });
      const draft = createSampleDraft({
        status: "approved",
        images: [
          {
            id: "featured-media-failure",
            slot: "featured",
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
            path: "generated/featured.png",
            prompt: "contract image",
            altText: "Contract featured image",
            source: "generated",
          },
        ],
      });

      await expect(
        publishDraftToWordpress({
          draft,
          connectionId: connection.id,
          status: "draft",
          origin: "http://localhost",
        }),
      ).rejects.toMatchObject({
        status: 503,
        message: "WordPressのメディアアップロードに失敗しました。",
        detail: "Featured media storage is unavailable.",
      });

      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).toContain("POST /wp-json/wp/v2/media");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });

  test("stops before creating a post when featured media alt update fails", async () => {
    const server = await createMockHttpServer((request, response) => {
      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, { id: 11, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, { id: 21, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/media") {
        sendJson(response, { id: 301 }, 201);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/media/301") {
        expect(request.json).toMatchObject({ alt_text: "Contract featured image" });
        sendJson(response, { message: "Alt text cannot be updated." }, 403);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });
      const draft = createSampleDraft({
        status: "approved",
        images: [
          {
            id: "featured-alt-failure",
            slot: "featured",
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
            path: "generated/featured.png",
            prompt: "contract image",
            altText: "Contract featured image",
            source: "generated",
          },
        ],
      });

      await expect(
        publishDraftToWordpress({
          draft,
          connectionId: connection.id,
          status: "draft",
          origin: "http://localhost",
        }),
      ).rejects.toMatchObject({
        status: 403,
        message: "WordPressメディアの代替テキスト更新に失敗しました。",
        detail: "Alt text cannot be updated.",
      });

      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).toContain("POST /wp-json/wp/v2/media");
      expect(requestNames).toContain("POST /wp-json/wp/v2/media/301");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });

  test("reports featured image fetch failures in Japanese before creating a post", async () => {
    const server = await createMockHttpServer((request, response) => {
      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, { id: 11, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, { id: 21, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "GET" && request.pathname === "/missing-featured.png") {
        sendJson(response, { message: "not found" }, 404);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });
      const draft = createSampleDraft({
        status: "approved",
        images: [
          {
            id: "featured-fetch-failure",
            slot: "featured",
            url: `${server.origin}/missing-featured.png`,
            path: "generated/missing-featured.png",
            prompt: "contract image",
            altText: "Missing featured image",
            source: "generated",
          },
        ],
      });

      await expect(
        publishDraftToWordpress({
          draft,
          connectionId: connection.id,
          status: "draft",
          origin: "http://localhost",
        }),
      ).rejects.toMatchObject({
        status: 502,
        message: "WordPress投稿用のアイキャッチ画像を取得できませんでした。",
        detail:
          "画像URLの取得に失敗しました（HTTP 404）。画像を再生成するか、画像なしで投稿してください。",
      });

      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).toContain("GET /missing-featured.png");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });

  test("skips featured media upload when the featured image URL is empty", async () => {
    const server = await createMockHttpServer((request, response) => {
      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/categories") {
        sendJson(response, { id: 11, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "GET" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, []);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/tags") {
        sendJson(response, { id: 21, name: (request.json as { name: string }).name }, 201);
        return;
      }

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/posts") {
        expect(request.json).toMatchObject({
          status: "draft",
        });
        expect(request.json).not.toHaveProperty("featured_media");
        sendJson(response, { link: `${server.origin}/post-without-featured-media/` }, 201);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      const { saveWordpressConnection, publishDraftToWordpress } = await import(
        "@/lib/server/wordpress"
      );
      const connection = await saveWordpressConnection({
        siteUrl: server.origin,
        username: "editor",
        applicationPassword: "secret-app-password",
      });
      const draft = createSampleDraft({
        status: "approved",
        images: [
          {
            id: "featured-empty-url",
            slot: "featured",
            url: "",
            path: "data-url-omitted",
            prompt: "omitted image",
            altText: "Omitted featured image",
            source: "generated",
          },
        ],
      });

      const result = await publishDraftToWordpress({
        draft,
        connectionId: connection.id,
        status: "draft",
        origin: "http://localhost",
      });

      expect(result.postUrl).toBe(`${server.origin}/post-without-featured-media/`);
      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/media");
      expect(requestNames).toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });
});
