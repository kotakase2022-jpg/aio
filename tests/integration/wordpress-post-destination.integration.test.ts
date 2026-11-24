import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";

// November 24 (Aizawa): the guide asks to choose 「コラム」 as the post destination, but the tool had no
// destination and always created standard posts. These tests cover choosing a post type.

let tempDir = "";
const processEnvSnapshot = snapshotProcessEnv();
const safeFetchMock = vi.fn(async (url: string | URL, init?: RequestInit, options?: unknown) => {
  void options;
  return fetch(url, init);
});

const site = "https://wordpress.example.com";

// What WordPress returns for GET /wp/v2/types?context=edit (trimmed to the fields the tool reads).
const wordpressTypes = {
  post: {
    name: "投稿",
    slug: "post",
    rest_base: "posts",
    rest_namespace: "wp/v2",
    taxonomies: ["category", "post_tag"],
    supports: { title: true, editor: true, thumbnail: true, excerpt: true },
    visibility: { show_ui: true, show_in_nav_menus: true },
  },
  page: {
    name: "固定ページ",
    slug: "page",
    rest_base: "pages",
    rest_namespace: "wp/v2",
    taxonomies: [],
    supports: { title: true, editor: true, thumbnail: true },
    visibility: { show_ui: true, show_in_nav_menus: true },
  },
  attachment: {
    name: "メディア",
    slug: "attachment",
    rest_base: "media",
    rest_namespace: "wp/v2",
    taxonomies: [],
    supports: { title: true },
    visibility: { show_ui: true, show_in_nav_menus: false },
  },
  wp_block: {
    name: "パターン",
    slug: "wp_block",
    rest_base: "blocks",
    rest_namespace: "wp/v2",
    taxonomies: [],
    supports: { title: true, editor: true },
    visibility: { show_ui: true, show_in_nav_menus: false },
  },
  column: {
    name: "コラム",
    slug: "column",
    rest_base: "column",
    rest_namespace: "wp/v2",
    taxonomies: ["column_category"],
    supports: { title: true, editor: true },
    visibility: { show_ui: true, show_in_nav_menus: true },
  },
  internal_log: {
    name: "内部ログ",
    slug: "internal_log",
    rest_base: "internal_log",
    rest_namespace: "wp/v2",
    taxonomies: [],
    supports: { title: true },
    visibility: { show_ui: false, show_in_nav_menus: false },
  },
};

type Recorded = { method: string; url: string; body: Record<string, unknown> | null; authorization: string | null };

function stubWordpress(handler: (request: Recorded) => Response | undefined) {
  const requests: Recorded[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const request: Recorded = {
        method: init?.method ?? "GET",
        url: String(url),
        body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null,
        authorization: headers.get("authorization"),
      };
      requests.push(request);
      return handler(request) ?? Response.json({ message: `Unexpected request ${request.method} ${request.url}` }, { status: 500 });
    }),
  );
  return requests;
}

async function connect() {
  const { saveWordpressConnection } = await import("@/lib/server/wordpress");
  return saveWordpressConnection({ siteUrl: site, username: "editor", applicationPassword: "secret-app-password" });
}

async function readReservations() {
  try {
    return JSON.parse(await readFile(path.join(tempDir, "wordpress-posts.json"), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const approvedDraft = () =>
  createSampleDraft({
    id: "draft-destination-1",
    status: "approved",
    categories: ["AIO"],
    tags: ["SEO"],
    images: [
      {
        id: "featured-1",
        slot: "featured",
        url: "https://images.example.com/featured.png",
        path: "generated/featured.png",
        altText: "アイキャッチ",
        prompt: "",
        source: "generated",
      },
    ],
    editedMetaDescription: "記事の要約",
  });

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-wp-destination-"));
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
    return { ...actual, safeFetch: safeFetchMock };
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
  vi.doUnmock("@/lib/server/safe-http");
  vi.unstubAllGlobals();
});

describe("WordPress post destinations", () => {
  test("lists the article destinations the connected user can create, without pages and WordPress internals", async () => {
    const connection = await connect();
    const requests = stubWordpress((request) =>
      request.url === `${site}/wp-json/wp/v2/types?context=edit` ? Response.json(wordpressTypes) : undefined,
    );
    const { listWordpressPostTypes } = await import("@/lib/server/wordpress");

    const postTypes = await listWordpressPostTypes({ connectionId: connection.id });

    expect(postTypes).toEqual([
      { slug: "post", name: "投稿", restBase: "posts", restNamespace: "wp/v2", categories: true, tags: true, featuredImage: true, excerpt: true },
      { slug: "column", name: "コラム", restBase: "column", restNamespace: "wp/v2", categories: false, tags: false, featuredImage: false, excerpt: false },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].authorization).toBe(`Basic ${Buffer.from("editor:secret-app-password").toString("base64")}`);
  });

  test("a draft sent to コラム goes to that post type and skips the fields コラム does not support", async () => {
    const connection = await connect();
    const requests = stubWordpress((request) => {
      if (request.url === `${site}/wp-json/wp/v2/types?context=edit`) return Response.json(wordpressTypes);
      if (request.method === "POST" && request.url === `${site}/wp-json/wp/v2/column`) {
        return Response.json({ id: 501, link: `${site}/?post_type=column&p=501` }, { status: 201 });
      }
      return undefined;
    });
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");

    const result = await publishDraftToWordpress({
      draft: approvedDraft(),
      connectionId: connection.id,
      status: "draft",
      origin: "http://localhost",
      postType: "column",
    });

    expect(result.postUrl).toBe(`${site}/?post_type=column&p=501`);
    expect(result.postType).toEqual({ slug: "column", name: "コラム" });
    const created = requests.filter((request) => request.method === "POST");
    expect(created.map((request) => request.url)).toEqual([`${site}/wp-json/wp/v2/column`]);
    expect(created[0].body).toMatchObject({ title: expect.any(String), status: "draft" });
    expect(created[0].body).not.toHaveProperty("categories");
    expect(created[0].body).not.toHaveProperty("tags");
    expect(created[0].body).not.toHaveProperty("excerpt");
    expect(created[0].body?.featured_media).toBeUndefined();
    // No term search or creation and no media upload for a destination that cannot use them.
    expect(requests.some((request) => /\/wp\/v2\/(categories|tags|media)/.test(request.url))).toBe(false);
    expect(requests.some((request) => request.url.startsWith("https://images.example.com"))).toBe(false);
    expect(result.warnings).toEqual([
      "投稿先「コラム」はカテゴリー・タグ・アイキャッチ画像・抜粋に対応していないため、これらは設定せずに投稿しました。必要な場合はWordPress管理画面で設定してください。",
    ]);
    expect(await readReservations()).toHaveProperty("draft-destination-1");
  });

  test("a destination the site does not offer is refused before anything is reserved or created", async () => {
    const connection = await connect();
    const requests = stubWordpress((request) =>
      request.url === `${site}/wp-json/wp/v2/types?context=edit` ? Response.json(wordpressTypes) : undefined,
    );
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");

    await expect(
      publishDraftToWordpress({ draft: approvedDraft(), connectionId: connection.id, status: "draft", origin: "http://localhost", postType: "news" }),
    ).rejects.toMatchObject({ status: 400, message: "選択した投稿先（news）がWordPressで見つかりません。" });
    expect(requests.map((request) => request.method)).toEqual(["GET"]);
    expect(await readReservations()).toEqual({});
  });

  test("a failed destination lookup stops the post before anything is reserved", async () => {
    const connection = await connect();
    stubWordpress((request) =>
      request.url === `${site}/wp-json/wp/v2/types?context=edit`
        ? Response.json({ code: "rest_forbidden", message: "Sorry, you are not allowed to do that." }, { status: 403 })
        : undefined,
    );
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");

    await expect(
      publishDraftToWordpress({ draft: approvedDraft(), connectionId: connection.id, status: "draft", origin: "http://localhost", postType: "column" }),
    ).rejects.toMatchObject({ status: 403, message: "WordPressの投稿先一覧を取得できませんでした。" });
    expect(await readReservations()).toEqual({});
  });

  test("a post type under its own REST namespace keeps the categories and excerpt it supports", async () => {
    const connection = await connect();
    const requests = stubWordpress((request) => {
      if (request.url === `${site}/wp-json/wp/v2/types?context=edit`) {
        return Response.json({
          column: { ...wordpressTypes.column, rest_base: "columns", rest_namespace: "custom/v1", taxonomies: ["category"], supports: { title: true, editor: true, excerpt: true } },
        });
      }
      if (request.url.startsWith(`${site}/wp-json/wp/v2/categories?search=`)) return Response.json([{ id: 7, name: "AIO" }]);
      if (request.method === "POST" && request.url === `${site}/wp-json/custom/v1/columns`) {
        return Response.json({ id: 502, link: `${site}/?post_type=column&p=502` }, { status: 201 });
      }
      return undefined;
    });
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");

    const result = await publishDraftToWordpress({
      draft: approvedDraft(),
      connectionId: connection.id,
      status: "publish",
      origin: "http://localhost",
      postType: "column",
    });

    const created = requests.filter((request) => request.method === "POST");
    expect(created.map((request) => request.url)).toEqual([`${site}/wp-json/custom/v1/columns`]);
    expect(created[0].body).toMatchObject({ categories: [7], excerpt: "記事の要約", status: "publish" });
    expect(created[0].body).not.toHaveProperty("tags");
    expect(result.warnings).toEqual([
      "投稿先「コラム」はタグ・アイキャッチ画像に対応していないため、これらは設定せずに投稿しました。必要な場合はWordPress管理画面で設定してください。",
    ]);
  });

  test.each([undefined, "post"])("postType %s keeps the standard post endpoint without reading the type list", async (postType) => {
    const connection = await connect();
    const requests = stubWordpress((request) => {
      if (request.method === "POST" && request.url === `${site}/wp-json/wp/v2/posts`) {
        return Response.json({ id: 503, link: `${site}/?p=503` }, { status: 201 });
      }
      return undefined;
    });
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");

    const result = await publishDraftToWordpress({
      draft: createSampleDraft({ id: `draft-standard-${postType ?? "none"}`, status: "approved", categories: [], tags: [], images: [] }),
      connectionId: connection.id,
      status: "draft",
      origin: "http://localhost",
      ...(postType ? { postType } : {}),
    });

    expect(result.postUrl).toBe(`${site}/?p=503`);
    expect(result.postType).toEqual({ slug: "post", name: "投稿" });
    expect(requests.some((request) => request.url.includes("/wp/v2/types"))).toBe(false);
  });

  test("the post-types route returns the destinations, and the post route rejects a malformed destination", async () => {
    const connection = await connect();
    stubWordpress((request) =>
      request.url === `${site}/wp-json/wp/v2/types?context=edit` ? Response.json(wordpressTypes) : undefined,
    );
    const { POST: listRoute } = await import("@/app/api/wordpress/post-types/route");
    const { POST: postRoute } = await import("@/app/api/wordpress/post/route");

    const listed = await listRoute(new Request("http://localhost/api/wordpress/post-types", {
      method: "POST",
      body: JSON.stringify({ connectionId: connection.id, connection }),
    }));
    const listedJson = (await listed.json()) as { ok: boolean; postTypes: Array<{ slug: string }> };
    const rejected = await postRoute(new Request("http://localhost/api/wordpress/post", {
      method: "POST",
      body: JSON.stringify({ draft: { id: "draft-x" }, connectionId: connection.id, status: "draft", postType: "コラム" }),
    }));

    expect(listed.status).toBe(200);
    expect(listedJson.postTypes.map((type) => type.slug)).toEqual(["post", "column"]);
    expect(rejected.status).toBe(400);
  });
});
