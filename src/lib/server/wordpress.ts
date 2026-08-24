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
import type { ArticleDraft, WordpressConnection } from "@/types/aio";
import { buildDraftArticleHtml } from "@/lib/draft-html";
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

type StoredConnection = WordpressConnection & {
  encryptedApplicationPassword: string;
};

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

export async function publishDraftToWordpress({
  draft,
  connectionId,
  connection: fallbackConnection,
  status,
  origin,
}: {
  draft: ArticleDraft;
  connectionId: string;
  connection?: WordpressConnection;
  status: "draft" | "publish";
  origin: string;
}) {
  if (draft.status !== "approved") {
    throw new ApiError(
      "承認済みドラフトのみWordPress投稿できます。",
      409,
      "先に「承認済みに変更」を押してから投稿してください。",
    );
  }

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

  const [categoryIds, tagIds] = await Promise.all([
    ensureTerms(connection.siteUrl, authHeader, "categories", draft.categories),
    ensureTerms(connection.siteUrl, authHeader, "tags", draft.tags),
  ]);

  let featuredMedia: number | undefined;
  const featured = draft.images.find(
    (image) => image.slot === "featured" && image.url.trim(),
  );
  if (featured) {
    featuredMedia = await uploadMedia(
      connection.siteUrl,
      authHeader,
      featured.url,
      origin,
      featured.altText,
    );
  }

  const response = await wordpressApiFetch(
    `${connection.siteUrl}/wp-json/wp/v2/posts`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: draft.editedTitle,
        slug: draft.editedSlug,
        excerpt: draft.editedMetaDescription,
        content: buildDraftArticleHtml(draft, {
          imageUrlResolver: (url) => resolveAssetUrl(url, origin),
        }),
        status,
        categories: categoryIds,
        tags: tagIds,
        featured_media: featuredMedia,
      }),
    },
    MAX_WORDPRESS_POST_RESPONSE_BYTES,
  );

  const json = (await response.json().catch(() => ({}))) as {
    link?: string;
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ApiError(
      "WordPress投稿に失敗しました。",
      response.status,
      json.message ?? json.code ?? response.statusText,
    );
  }

  const updatedDraft: ArticleDraft = {
    ...draft,
    status: "posted",
    wordpressPostUrl: json.link,
    updatedAt: new Date().toISOString(),
  };
  await saveDraft(updatedDraft);
  await saveWordpressPostRecord(draft.id, connection.id, json.link ?? "", status);
  await markGenerationJobWordpressPost({
    draftId: draft.id,
    status,
    postUrl: json.link ?? "",
  });

  return { postUrl: json.link ?? "", draft: updatedDraft };
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
      throw new ApiError(
        `WordPress${termLabel(type)}の検索に失敗しました。`,
        searchResponse.status,
        readWordpressError(searchJson) ?? searchResponse.statusText,
      );
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
      throw new ApiError(
        `WordPress${termLabel(type)}の作成に失敗しました。`,
        createResponse.status,
        readWordpressError(created),
      );
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

  if (!response.ok || !json.id) {
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

  if (!response.ok || json.id !== mediaId) {
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

async function saveWordpressPostRecord(
  draftId: string,
  connectionId: string,
  postUrl: string,
  status: "draft" | "publish",
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (isSupabaseGatewayConfigured()) {
      await callSupabaseGateway("insert_wordpress_post", {
        row: {
          draft_id: draftId,
          connection_id: connectionId,
          post_url: postUrl,
          post_status: status,
        },
      });
    }
    return;
  }

  const { error } = await supabase.from("wordpress_posts").insert({
    draft_id: draftId,
    connection_id: connectionId,
    post_url: postUrl,
    post_status: status,
  });
  if (error) {
    throw new ApiError(
      "WordPress投稿結果の保存に失敗しました。",
      500,
      `WordPressへの投稿自体は完了しています。重複投稿を避けるため、投稿URLを確認してください。${error.message ? ` (${error.message})` : ""}`,
    );
  }
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
