import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ArticleDraft, WordpressConnection, WordpressPostType } from "@/types/aio";
import { buildDraftArticleHtml } from "@/lib/draft-html";
import { STANDARD_WORDPRESS_POST_TYPE, WORDPRESS_POST_TYPE_SLUG_PATTERN } from "@/lib/wordpress-post-types";
import { wordpressRejectionHint } from "@/lib/wordpress-rejection-hints";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { ApiError } from "@/lib/server/http";
import { saveDraft } from "@/lib/server/drafts";
import { markGenerationJobWordpressPost } from "@/lib/server/generation-jobs";
import {
  callSupabaseGateway,
  isSupabaseGatewayConfigured,
} from "@/lib/server/supabase-gateway";
import {
  assertSafeOutboundUrl,
  safeFetch,
  UnsafeOutboundUrlError,
} from "@/lib/server/safe-http";
import { inspectImageFile } from "@/lib/server/image-file";
import { finishWordpressPost, releaseWordpressPost, reserveWordpressPost } from "@/lib/server/wordpress-posts";

type StoredConnection = WordpressConnection & {
  encryptedApplicationPassword: string;
};

// Not article destinations: fixed pages and WordPress's own internal post types.
const EXCLUDED_WORDPRESS_POST_TYPES = new Set([
  "page",
  "attachment",
  "nav_menu_item",
  "wp_block",
  "wp_template",
  "wp_template_part",
  "wp_navigation",
  "wp_global_styles",
  "wp_font_family",
  "wp_font_face",
]);
// REST route parts as WordPress registers them (e.g. "wp/v2" + "posts", or "_column" for a type
// named so). A rest_base has no dots or slashes; a namespace part never starts with a dot, so no
// "." or ".." part can appear.
const WORDPRESS_REST_BASE_PATTERN = /^[A-Za-z0-9_-]+$/;
const WORDPRESS_REST_NAMESPACE_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/;

const MAX_WORDPRESS_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_WORDPRESS_API_RESPONSE_BYTES = 1024 * 1024;
const MAX_WORDPRESS_POST_RESPONSE_BYTES = 10 * 1024 * 1024;

const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "aio-article-generator")
  : process.env.AIO_LOCAL_DATA_DIR || path.join(process.cwd(), ".data");
const connectionFile = path.join(dataDir, "wordpress-connections.json");

export async function saveWordpressConnection(input: {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}) {
  const now = new Date().toISOString();
  const connection: StoredConnection = {
    id: randomUUID(),
    siteUrl: normalizeSiteUrl(input.siteUrl),
    username: input.username.trim(),
    encryptedApplicationPassword: encryptSecret(input.applicationPassword),
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("wordpress_connections").insert({
      id: connection.id,
      site_url: connection.siteUrl,
      username: connection.username,
      encrypted_application_password: connection.encryptedApplicationPassword,
      created_at: connection.createdAt,
      updated_at: connection.updatedAt,
    });
    if (error) {
      throw new ApiError("WordPress接続情報の保存に失敗しました。", 500, error.message);
    }
  } else if (isSupabaseGatewayConfigured()) {
    await callSupabaseGateway("insert_wordpress_connection", {
      row: {
        id: connection.id,
        site_url: connection.siteUrl,
        username: connection.username,
        encrypted_application_password: connection.encryptedApplicationPassword,
        created_at: connection.createdAt,
        updated_at: connection.updatedAt,
      },
    });
  } else {
    const store = await readConnections();
    store[connection.id] = connection;
    await writeConnections(store);
  }

  return publicConnection(
    connection,
    createConnectionToken(connection, input.applicationPassword),
  );
}

// The post types the connected user can create, for the 投稿先 choice. Read from the site each time,
// so a post type added or exposed to the REST API later appears without reconnecting.
export async function listWordpressPostTypes({
  connectionId,
  connection: fallbackConnection,
}: {
  connectionId: string;
  connection?: WordpressConnection;
}) {
  const { connection, authHeader } = await resolveWordpressAuth(connectionId, fallbackConnection);
  return fetchWordpressPostTypes(connection.siteUrl, authHeader);
}

export async function publishDraftToWordpress({
  draft,
  connectionId,
  connection: fallbackConnection,
  status,
  origin,
  postType: requestedPostType,
}: {
  draft: ArticleDraft;
  connectionId: string;
  connection?: WordpressConnection;
  status: "draft" | "publish";
  origin: string;
  postType?: string;
}) {
  if (draft.status !== "approved") {
    throw new ApiError(
      "承認済みドラフトのみWordPress投稿できます。",
      409,
      "先に「承認済みに変更」を押してから投稿してください。",
    );
  }

  const { connection, authHeader } = await resolveWordpressAuth(connectionId, fallbackConnection);
  // Settle the destination before reserving: an unknown or unreadable one leaves nothing behind.
  const destination = await resolveWordpressPostType(connection.siteUrl, authHeader, requestedPostType);
  await reserveWordpressPost(draft.id, connection.id, status);
  let postAttempted = false;
  try {

  const [categoryIds, tagIds] = await Promise.all([
    destination.categories
      ? ensureTerms(connection.siteUrl, authHeader, "categories", draft.categories)
      : Promise.resolve([]),
    destination.tags
      ? ensureTerms(connection.siteUrl, authHeader, "tags", draft.tags)
      : Promise.resolve([]),
  ]);

  let featuredMedia: number | undefined;
  const featured = draft.images.find(
    (image) => image.slot === "featured" && image.url.trim(),
  );
  if (featured && destination.featuredImage) {
    featuredMedia = await uploadMedia(
      connection.siteUrl,
      authHeader,
      featured.url,
      origin,
      featured.altText,
    );
  }
  // Fields this post type cannot hold are not sent (and no terms or media are created for them).
  const skipped = [
    !destination.categories && draft.categories.some((name) => name.trim()) ? "カテゴリー" : "",
    !destination.tags && draft.tags.some((name) => name.trim()) ? "タグ" : "",
    !destination.featuredImage && featured ? "アイキャッチ画像" : "",
    !destination.excerpt && draft.editedMetaDescription?.trim() ? "抜粋" : "",
  ].filter(Boolean);

  postAttempted = true;
  const response = await wordpressApiFetch(
    `${connection.siteUrl}/wp-json/${destination.restNamespace}/${destination.restBase}`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: draft.editedTitle,
        slug: draft.editedSlug,
        ...(destination.excerpt ? { excerpt: draft.editedMetaDescription } : {}),
        content: buildDraftArticleHtml(draft, {
          imageUrlResolver: (url) => resolveAssetUrl(url, origin),
        }),
        status,
        ...(destination.categories ? { categories: categoryIds } : {}),
        ...(destination.tags ? { tags: tagIds } : {}),
        featured_media: featuredMedia,
      }),
    },
    MAX_WORDPRESS_POST_RESPONSE_BYTES,
  );

  const json = (await response.json().catch(() => ({}))) as {
    id?: number;
    link?: string;
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    // A server-side post hook can fail after creating the post. Only an explicit
    // client-error rejection is safe to release for another attempt.
    postAttempted = response.status >= 500;
    throw wordpressRequestError("WordPress投稿に失敗しました。", response, json);
  }
  if (!Number.isInteger(json.id) || !json.link || typeof json.link !== "string") {
    throw new ApiError("WordPressの投稿結果を確認できませんでした。", 502);
  }

  const updatedDraft: ArticleDraft = {
    ...draft,
    status: "posted",
    wordpressPostUrl: json.link,
    updatedAt: new Date().toISOString(),
  };
  const warnings: string[] = skipped.length
    ? [`投稿先「${destination.name}」は${skipped.join("・")}に対応していないため、これらは設定せずに投稿しました。必要な場合はWordPress管理画面で設定してください。`]
    : [];
  const warn = (label: string, error: unknown) => {
    warnings.push(`${label}。WordPress投稿は完了しています。再投稿せず投稿URLを確認してください: ${json.link} (${error instanceof Error ? error.message : "Unknown error"})`);
  };
  await finishWordpressPost(draft.id, json.link).catch((error: unknown) => warn("投稿結果の永続保存に失敗し、投稿予約は確認待ちです", error));
  await saveDraft(updatedDraft).catch((error: unknown) => warn("ドラフト状態の保存に失敗しました", error));
  await markGenerationJobWordpressPost({
    draftId: draft.id,
    status,
    postUrl: json.link ?? "",
  }).catch((error: unknown) => warn("生成ログの同期に失敗しました", error));

  return {
    postUrl: json.link,
    draft: updatedDraft,
    warnings,
    postType: { slug: destination.slug, name: destination.name },
  };
  } catch (error) {
    if (!postAttempted) {
      await releaseWordpressPost(draft.id);
      throw error;
    }
    throw new ApiError("WordPress投稿結果が不明です。重複投稿を防ぐため再送信を停止しました。", 502,
      `WordPress管理画面で確認し、管理者が投稿予約を照合してください。${error instanceof Error ? error.message : ""}`);
  }
}

async function resolveWordpressAuth(connectionId: string, fallbackConnection?: WordpressConnection) {
  const connection =
    (await loadStoredConnection(connectionId)) ||
    connectionFromToken(fallbackConnection);
  if (!connection) {
    throw new ApiError(
      "WordPress接続情報が見つかりません。",
      404,
      "WordPress接続情報を保存し直してから、もう一度投稿してください。",
    );
  }

  const password = decryptSecret(connection.encryptedApplicationPassword);
  const authHeader = `Basic ${Buffer.from(`${connection.username}:${password}`).toString("base64")}`;
  return { connection, authHeader };
}

async function resolveWordpressPostType(siteUrl: string, authHeader: string, requested?: string) {
  // Clients from before 投稿先 existed send no post type: post to 投稿 exactly as before.
  if (!requested || requested === STANDARD_WORDPRESS_POST_TYPE.slug) {
    return STANDARD_WORDPRESS_POST_TYPE;
  }
  // Use the site's own REST route for the type, never one sent by the browser.
  const match = (await fetchWordpressPostTypes(siteUrl, authHeader)).find(
    (postType) => postType.slug === requested,
  );
  if (!match) {
    throw new ApiError(
      `選択した投稿先（${requested}）がWordPressで見つかりません。`,
      400,
      "「投稿先」の一覧を読み込み直し、投稿先を選び直してから投稿してください。",
    );
  }
  return match;
}

async function fetchWordpressPostTypes(siteUrl: string, authHeader: string) {
  // context=edit lists only the types this user can create, with their supported fields.
  const response = await wordpressApiFetch(`${siteUrl}/wp-json/wp/v2/types?context=edit`, {
    headers: { Authorization: authHeader },
  });
  const json = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw wordpressRequestError("WordPressの投稿先一覧を取得できませんでした。", response, json);
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new ApiError(
      "WordPressの投稿先一覧の応答形式が不正です。",
      502,
      "WordPress REST APIが投稿タイプの一覧を返しませんでした。",
    );
  }

  const postTypes = Object.values(json as Record<string, unknown>).flatMap(readWordpressPostType);
  return [
    ...postTypes.filter((postType) => postType.slug === STANDARD_WORDPRESS_POST_TYPE.slug),
    ...postTypes.filter((postType) => postType.slug !== STANDARD_WORDPRESS_POST_TYPE.slug),
  ];
}

function readWordpressPostType(value: unknown): WordpressPostType[] {
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  const slug = typeof item.slug === "string" ? item.slug : "";
  const restBase = typeof item.rest_base === "string" ? item.rest_base : "";
  // rest_namespace exists from WordPress 5.9; older sites serve every type under wp/v2.
  const restNamespace =
    typeof item.rest_namespace === "string" && item.rest_namespace ? item.rest_namespace : "wp/v2";
  const visibility =
    item.visibility && typeof item.visibility === "object" ? (item.visibility as Record<string, unknown>) : {};
  if (
    !WORDPRESS_POST_TYPE_SLUG_PATTERN.test(slug) ||
    EXCLUDED_WORDPRESS_POST_TYPES.has(slug) ||
    !WORDPRESS_REST_BASE_PATTERN.test(restBase) ||
    !WORDPRESS_REST_NAMESPACE_PATTERN.test(restNamespace) ||
    visibility.show_ui === false
  ) {
    return [];
  }

  const supports =
    item.supports && typeof item.supports === "object" ? (item.supports as Record<string, unknown>) : null;
  // WordPress stores the title and body only for types that support them. Without both the article
  // would arrive empty yet count as posted, so such a type is not a destination. A custom type whose
  // supports are not reported cannot be checked, so it is left out too; 投稿 always has both, and
  // without the list it is posted as before (WordPress ignores fields a type does not register).
  if (supports ? supports.title !== true || supports.editor !== true : slug !== STANDARD_WORDPRESS_POST_TYPE.slug) {
    return [];
  }
  const taxonomies = Array.isArray(item.taxonomies)
    ? item.taxonomies.filter((taxonomy): taxonomy is string => typeof taxonomy === "string")
    : null;
  const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : slug;
  return [
    {
      slug,
      name,
      restBase,
      restNamespace,
      categories: taxonomies ? taxonomies.includes("category") : true,
      tags: taxonomies ? taxonomies.includes("post_tag") : true,
      featuredImage: supports ? supports.thumbnail === true : true,
      excerpt: supports ? supports.excerpt === true : true,
    },
  ];
}

function normalizeSiteUrl(value: string) {
  try {
    const url = assertSafeOutboundUrl(value.trim());
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new ApiError(
        "本番環境ではHTTPSのWordPressサイトURLが必要です。",
        400,
        "Application Passwordを安全に送信するため、https://で始まるURLを入力してください。",
      );
    }
    return url.origin;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof UnsafeOutboundUrlError) {
      throw new ApiError(
        "安全上の理由により、このWordPressサイトURLは使用できません。",
        400,
        "公開されたhttpまたはhttpsのWordPressサイトURLを入力してください。",
      );
    }
    throw error;
  }
}

function getEncryptionKey() {
  const raw = process.env.WORDPRESS_ENCRYPTION_KEY?.replace(/^\uFEFF/, "").trim();
  if ((!raw || raw.length < 32) && process.env.NODE_ENV === "production") {
    throw new ApiError(
      "本番環境ではWordPress認証情報の暗号化キーが必要です。",
      500,
      "Vercel Environment VariablesにWORDPRESS_ENCRYPTION_KEYを32文字以上のランダム文字列で設定してください。",
    );
  }

  return createHash("sha256")
    .update(raw || "aio-local-development-wordpress-key")
    .digest();
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split(":").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function loadStoredConnection(id: string): Promise<StoredConnection | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("wordpress_connections")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new ApiError("WordPress接続情報の読み込みに失敗しました。", 500, error.message);
    }

    if (!data) {
      return null;
    }

    return {
      id: String(data.id),
      siteUrl: String(data.site_url),
      username: String(data.username),
      encryptedApplicationPassword: String(data.encrypted_application_password),
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  }

  if (isSupabaseGatewayConfigured()) {
    const result = await callSupabaseGateway<{ row: Record<string, unknown> | null }>(
      "get_wordpress_connection",
      { id },
    );
    if (!result.row) {
      return null;
    }

    return {
      id: String(result.row.id),
      siteUrl: String(result.row.site_url),
      username: String(result.row.username),
      encryptedApplicationPassword: String(result.row.encrypted_application_password),
      createdAt: String(result.row.created_at),
      updatedAt: String(result.row.updated_at),
    };
  }

  const store = await readConnections();
  return store[id] ?? null;
}

async function readConnections(): Promise<Record<string, StoredConnection>> {
  try {
    return JSON.parse(await readFile(connectionFile, "utf8")) as Record<string, StoredConnection>;
  } catch {
    return {};
  }
}

async function writeConnections(store: Record<string, StoredConnection>) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(connectionFile, JSON.stringify(store, null, 2), "utf8");
}

function publicConnection(
  connection: StoredConnection,
  connectionToken?: string,
): WordpressConnection {
  return {
    id: connection.id,
    siteUrl: connection.siteUrl,
    username: connection.username,
    connectionToken,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

function connectionFromToken(connection?: WordpressConnection): StoredConnection | null {
  if (!connection?.connectionToken) {
    return null;
  }

  try {
    const payload = JSON.parse(decryptSecret(connection.connectionToken)) as {
      version?: unknown;
      id?: unknown;
      siteUrl?: unknown;
      username?: unknown;
      applicationPassword?: unknown;
    };
    if (
      payload.version !== 1 ||
      typeof payload.id !== "string" ||
      typeof payload.siteUrl !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.applicationPassword !== "string" ||
      payload.id !== connection.id ||
      payload.siteUrl !== connection.siteUrl ||
      payload.username !== connection.username
    ) {
      throw new Error("Connection token metadata mismatch");
    }

    return {
      id: payload.id,
      siteUrl: normalizeSiteUrl(payload.siteUrl),
      username: payload.username,
      encryptedApplicationPassword: encryptSecret(payload.applicationPassword),
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  } catch {
    throw new ApiError(
      "WordPress接続情報を確認できませんでした。",
      400,
      "接続情報が古いか変更されています。WordPress接続情報を保存し直してください。",
    );
  }
}

function createConnectionToken(
  connection: StoredConnection,
  applicationPassword: string,
) {
  return encryptSecret(
    JSON.stringify({
      version: 1,
      id: connection.id,
      siteUrl: connection.siteUrl,
      username: connection.username,
      applicationPassword,
    }),
  );
}

async function ensureTerms(
  siteUrl: string,
  authHeader: string,
  type: "categories" | "tags",
  names: string[],
) {
  const ids: number[] = [];

  for (const name of names.filter(Boolean)) {
    const searchResponse = await wordpressApiFetch(
      `${siteUrl}/wp-json/wp/v2/${type}?search=${encodeURIComponent(name)}&per_page=20`,
      { headers: { Authorization: authHeader } },
    );
    const searchJson = (await searchResponse.json().catch(() => null)) as unknown;
    if (!searchResponse.ok) {
      throw wordpressRequestError(`WordPress${termLabel(type)}の検索に失敗しました。`, searchResponse, searchJson);
    }
    if (!Array.isArray(searchJson)) {
      throw new ApiError(
        `WordPress${termLabel(type)}検索の応答形式が不正です。`,
        502,
        "WordPress REST APIが一覧形式ではないターム検索結果を返しました。",
      );
    }

    const existing = searchJson as Array<Record<string, unknown>>;
    const match = existing.find((item) => readTermName(item).toLowerCase() === name.toLowerCase());
    if (match) {
      ids.push(readWordpressTermId(match, type, "search"));
      continue;
    }

    const createResponse = await wordpressApiFetch(`${siteUrl}/wp-json/wp/v2/${type}`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const created = (await createResponse.json().catch(() => ({}))) as Record<string, unknown>;
    if (!createResponse.ok) {
      throw wordpressRequestError(`WordPress${termLabel(type)}の作成に失敗しました。`, createResponse, created);
    }
    ids.push(readWordpressTermId(created, type, "create"));
  }

  return ids;
}

function readWordpressTermId(
  value: Record<string, unknown>,
  type: "categories" | "tags",
  operation: "search" | "create",
) {
  if (Number.isInteger(value.id) && Number(value.id) > 0) {
    return Number(value.id);
  }

  throw new ApiError(
    `WordPress${termLabel(type)}${termOperationLabel(operation)}の応答形式が不正です。`,
    502,
    "WordPress REST APIが数値IDを持たないタームを返しました。",
  );
}

function readTermName(value: Record<string, unknown>) {
  return typeof value.name === "string" ? value.name : "";
}

function termLabel(type: "categories" | "tags") {
  return type === "categories" ? "カテゴリー" : "タグ";
}

function termOperationLabel(operation: "search" | "create") {
  return operation === "search" ? "検索" : "作成";
}

// What the site put in a REST error body: the message, else the code. Undefined when the body is
// no such error, e.g. a server's own HTML page.
function readWordpressError(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record.message === "string"
    ? record.message
    : typeof record.code === "string"
      ? record.code
      : undefined;
}

// Removes <...> markup in one pass; a "<" with no ">" after it stays as text. Linear in the length:
// a backtracking pattern such as /<[^>]*>/g grows with the square of a long body without ">"
// (CodeRabbit).
function withoutMarkup(text: string) {
  let result = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("<", index);
    const close = open === -1 ? -1 : text.indexOf(">", open + 1);
    if (close === -1) {
      result += text.slice(index);
      break;
    }
    result += text.slice(index, open);
    index = close + 1;
  }
  return result;
}

const MAX_REPORTED_WORDPRESS_MESSAGE = 300;

function readWordpressErrorCode(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const code = (value as Record<string, unknown>).code;
  return typeof code === "string" ? code : undefined;
}

// A failed WordPress request. For 401 and 403 the detail starts with what usually causes the
// refusal and what to do (November 24, Aizawa: a 403 from the site's server showed only the step
// that failed), then what the site said, without markup (WordPress wraps some messages in <strong>)
// and shortened. Any other failure keeps the site's message as it is, else the HTTP status text.
function wordpressRequestError(
  message: string,
  response: { status: number; statusText: string },
  body: unknown,
) {
  const reported = readWordpressError(body);
  const hint = wordpressRejectionHint(response.status, readWordpressErrorCode(body));
  if (!hint) {
    return new ApiError(message, response.status, reported ?? (response.statusText || undefined));
  }

  const said = reported === undefined ? "" : withoutMarkup(reported).trim();
  let shortened = said;
  if (said.length > MAX_REPORTED_WORDPRESS_MESSAGE) {
    const cut = said.slice(0, MAX_REPORTED_WORDPRESS_MESSAGE);
    // Never end on half of a surrogate pair (an emoji, for example).
    shortened = `${/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut}…`;
  }
  return new ApiError(message, response.status, shortened ? `${hint} WordPressの応答：${shortened}` : hint);
}

async function uploadMedia(
  siteUrl: string,
  authHeader: string,
  imageUrl: string,
  origin: string,
  altText: string,
) {
  const resolvedUrl = imageUrl.startsWith("/")
    ? `${origin.replace(/\/$/, "")}${imageUrl}`
    : imageUrl;

  let buffer: Buffer;
  let contentType = "image/png";

  const localAsset = await readLocalUploadAsset(imageUrl);
  if (localAsset) {
    buffer = localAsset;
    contentType = "";
  } else if (resolvedUrl.startsWith("data:")) {
    const match = /^data:(.+);base64,(.+)$/.exec(resolvedUrl);
    if (!match || !/^[A-Za-z0-9+/\s]*={0,2}$/.test(match[2])) {
      throw new ApiError("アイキャッチ画像のデータURLが不正です。", 400);
    }
    contentType = match[1];
    buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  } else {
    const imageResponse = await safeFetch(
      resolvedUrl,
      {},
      {
        allowRedirects: true,
        maxRedirects: 3,
        maxResponseBytes: 10 * 1024 * 1024,
        timeoutMs: 30_000,
      },
    );
    if (!imageResponse.ok) {
      throw new ApiError(
        "WordPress投稿用のアイキャッチ画像を取得できませんでした。",
        502,
        `画像URLの取得に失敗しました（HTTP ${imageResponse.status}）。画像を再生成するか、画像なしで投稿してください。`,
      );
    }
    contentType = imageResponse.headers.get("content-type") ?? contentType;
    buffer = Buffer.from(await imageResponse.arrayBuffer());
  }

  if (buffer.length > MAX_WORDPRESS_MEDIA_BYTES) {
    throw new ApiError("WordPress投稿用の画像は10MB以下にしてください。", 400);
  }
  const image = inspectImageFile(buffer, contentType);
  contentType = image.contentType;

  const extension = image.extension;
  const response = await wordpressApiFetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="aio-featured-${Date.now()}.${extension}"`,
    },
    body: buffer,
  });

  const json = (await response.json().catch(() => ({}))) as {
    id?: number;
    message?: string;
  };

  if (!response.ok) {
    throw wordpressRequestError("WordPressのメディアアップロードに失敗しました。", response, json);
  }
  if (!json.id) {
    throw new ApiError("WordPressのメディアアップロードに失敗しました。", response.status, json.message);
  }

  const mediaId = json.id;
  const normalizedAltText = altText.trim();
  if (normalizedAltText) {
    await updateMediaAltText(siteUrl, authHeader, mediaId, normalizedAltText);
  }

  return mediaId;
}

async function readLocalUploadAsset(imageUrl: string) {
  if (process.env.VERCEL || !imageUrl.startsWith("/uploads/")) {
    return null;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(imageUrl, "http://local.invalid").pathname);
  } catch {
    throw new ApiError("ローカル画像のパスが不正です。", 400);
  }

  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const candidatePath = path.resolve(process.cwd(), "public", `.${pathname}`);
  try {
    const [resolvedRoot, resolvedFile] = await Promise.all([
      realpath(uploadsRoot),
      realpath(candidatePath),
    ]);
    const relativePath = path.relative(resolvedRoot, resolvedFile);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Local upload path escapes its root");
    }

    const metadata = await stat(resolvedFile);
    if (!metadata.isFile()) {
      throw new Error("Local upload path is not a file");
    }
    if (metadata.size > MAX_WORDPRESS_MEDIA_BYTES) {
      throw new ApiError("WordPress投稿用の画像は10MB以下にしてください。", 400);
    }
    return await readFile(resolvedFile);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      "WordPress投稿用のローカル画像を読み込めませんでした。",
      400,
      "画像をアップロードし直すか、画像なしで投稿してください。",
    );
  }
}

async function updateMediaAltText(
  siteUrl: string,
  authHeader: string,
  mediaId: number,
  altText: string,
) {
  const response = await wordpressApiFetch(`${siteUrl}/wp-json/wp/v2/media/${mediaId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ alt_text: altText }),
  });
  const json = (await response.json().catch(() => ({}))) as {
    id?: number;
    message?: string;
  };

  if (!response.ok) {
    throw wordpressRequestError("WordPressメディアの代替テキスト更新に失敗しました。", response, json);
  }
  if (json.id !== mediaId) {
    throw new ApiError(
      "WordPressメディアの代替テキスト更新に失敗しました。",
      response.status,
      json.message,
    );
  }
}

function resolveAssetUrl(url: string, origin: string) {
  if (url.startsWith("/")) {
    return `${origin.replace(/\/$/, "")}${url}`;
  }

  return url;
}

function wordpressApiFetch(
  url: string,
  init: NonNullable<Parameters<typeof safeFetch>[1]> = {},
  maxResponseBytes = MAX_WORDPRESS_API_RESPONSE_BYTES,
) {
  return safeFetch(url, init, {
    allowRedirects: false,
    maxResponseBytes,
    timeoutMs: 30_000,
  });
}
