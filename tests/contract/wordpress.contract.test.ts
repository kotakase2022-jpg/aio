import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";
import { createMockHttpServer, sendJson } from "../helpers/mock-http-server";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-wp-contract-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.WORDPRESS_ENCRYPTION_KEY = "wordpress-contract-key-32-characters";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.VERCEL = "";
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  delete process.env.AIO_LOCAL_DATA_DIR;
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

      if (request.method === "POST" && request.pathname === "/wp-json/wp/v2/posts") {
        expect(request.json).toMatchObject({
          title: "AIO Content Operations Guide",
          slug: "aio-content-operations-guide",
          status: "draft",
          categories: [11],
          featured_media: 301,
        });
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
        images: [
          {
            id: "featured-contract",
            slot: "featured",
            url: `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
            path: "generated/featured.png",
            prompt: "contract image",
            altText: "Contract featured image",
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
          "POST /wp-json/wp/v2/posts",
        ]),
      );
      expect(requestNames.filter((name) => name === "GET /wp-json/wp/v2/tags")).toHaveLength(3);
      expect(requestNames.filter((name) => name === "POST /wp-json/wp/v2/tags")).toHaveLength(3);
      expect(requestNames.indexOf("POST /wp-json/wp/v2/media")).toBeLessThan(
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
          draft: createSampleDraft({ status: "approved" }),
          connectionId: connection.id,
          status: "draft",
          origin: "http://localhost",
        }),
      ).rejects.toMatchObject({
        status: 401,
        message: "Failed to search WordPress category.",
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
            url: `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
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
        message: "WordPress media upload failed.",
        detail: "Featured media storage is unavailable.",
      });

      const requestNames = server.requests.map((request) => `${request.method} ${request.pathname}`);
      expect(requestNames).toContain("POST /wp-json/wp/v2/media");
      expect(requestNames).not.toContain("POST /wp-json/wp/v2/posts");
    } finally {
      await server.close();
    }
  });
});
