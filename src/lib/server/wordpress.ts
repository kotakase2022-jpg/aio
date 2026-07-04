import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ArticleDraft, WordpressConnection } from "@/types/aio";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { ApiError } from "@/lib/server/http";
import { saveDraft } from "@/lib/server/drafts";
import { markGenerationJobWordpressPost } from "@/lib/server/generation-jobs";
import {
  callSupabaseGateway,
  isSupabaseGatewayConfigured,
} from "@/lib/server/supabase-gateway";

type StoredConnection = WordpressConnection & {
  encryptedApplicationPassword: string;
};

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
      throw new ApiError("Failed to save WordPress connection.", 500, error.message);
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

  return publicConnection(connection, connection.encryptedApplicationPassword);
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
    throw new ApiError("WordPress connection not found.", 404);
  }

  const password = decryptSecret(connection.encryptedApplicationPassword);
  const authHeader = `Basic ${Buffer.from(`${connection.username}:${password}`).toString("base64")}`;

  const [categoryIds, tagIds] = await Promise.all([
    ensureTerms(connection.siteUrl, authHeader, "categories", draft.categories),
    ensureTerms(connection.siteUrl, authHeader, "tags", draft.tags),
  ]);

  let featuredMedia: number | undefined;
  const featured = draft.images.find((image) => image.slot === "featured");
  if (featured) {
    featuredMedia = await uploadMedia(connection.siteUrl, authHeader, featured.url, origin);
  }

  const response = await fetch(`${connection.siteUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: draft.editedTitle,
      slug: draft.editedSlug,
      excerpt: draft.editedMetaDescription,
      content: draft.editedBodyHtml,
      status,
      categories: categoryIds,
      tags: tagIds,
      featured_media: featuredMedia,
    }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    link?: string;
    message?: string;
    code?: string;
  };

  if (!response.ok) {
    throw new ApiError(
      "WordPress post failed.",
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
  const url = new URL(value.trim());
  return url.origin;
}

function getEncryptionKey() {
  const raw = process.env.WORDPRESS_ENCRYPTION_KEY;
  if (!raw && process.env.NODE_ENV === "production") {
    throw new ApiError(
      "WORDPRESS_ENCRYPTION_KEY is required in production.",
      500,
      "Set a random 32+ character value in Vercel Environment Variables.",
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
      throw new ApiError("Failed to load WordPress connection.", 500, error.message);
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

  return {
    id: connection.id,
    siteUrl: connection.siteUrl,
    username: connection.username,
    encryptedApplicationPassword: connection.connectionToken,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

async function ensureTerms(
  siteUrl: string,
  authHeader: string,
  type: "categories" | "tags",
  names: string[],
) {
  const ids: number[] = [];

  for (const name of names.filter(Boolean)) {
    const searchResponse = await fetch(
      `${siteUrl}/wp-json/wp/v2/${type}?search=${encodeURIComponent(name)}&per_page=20`,
      { headers: { Authorization: authHeader } },
    );
    const searchJson = (await searchResponse.json().catch(() => null)) as unknown;
    if (!searchResponse.ok) {
      throw new ApiError(
        `Failed to search WordPress ${singularTerm(type)}.`,
        searchResponse.status,
        readWordpressError(searchJson) ?? searchResponse.statusText,
      );
    }
    if (!Array.isArray(searchJson)) {
      throw new ApiError(
        `Unexpected WordPress ${type} search response.`,
        502,
        "WordPress REST API returned a non-list response while searching terms.",
      );
    }

    const existing = searchJson as Array<{
      id: number;
      name: string;
    }>;
    const match = existing.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (match) {
      ids.push(match.id);
      continue;
    }

    const createResponse = await fetch(`${siteUrl}/wp-json/wp/v2/${type}`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const created = (await createResponse.json().catch(() => ({}))) as {
      id?: number;
      message?: string;
    };
    if (!createResponse.ok || !created.id) {
      throw new ApiError(
        `Failed to create WordPress ${singularTerm(type)}.`,
        createResponse.status,
        readWordpressError(created),
      );
    }
    ids.push(created.id);
  }

  return ids;
}

function singularTerm(type: "categories" | "tags") {
  return type === "categories" ? "category" : "tag";
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
) {
  const resolvedUrl = imageUrl.startsWith("/")
    ? `${origin.replace(/\/$/, "")}${imageUrl}`
    : imageUrl;

  let buffer: Buffer;
  let contentType = "image/png";

  if (resolvedUrl.startsWith("data:")) {
    const match = /^data:(.+);base64,(.+)$/.exec(resolvedUrl);
    if (!match) {
      throw new ApiError("Featured image data URL is invalid.", 400);
    }
    contentType = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    const imageResponse = await fetch(resolvedUrl);
    if (!imageResponse.ok) {
      throw new ApiError("Failed to fetch featured image for WordPress upload.", 502);
    }
    contentType = imageResponse.headers.get("content-type") ?? contentType;
    buffer = Buffer.from(await imageResponse.arrayBuffer());
  }

  const extension = contentType.includes("jpeg") ? "jpg" : "png";
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="aio-featured-${Date.now()}.${extension}"`,
    },
    body: new Blob([new Uint8Array(buffer)], { type: contentType }),
  });

  const json = (await response.json().catch(() => ({}))) as {
    id?: number;
    message?: string;
  };

  if (!response.ok || !json.id) {
    throw new ApiError("WordPress media upload failed.", response.status, json.message);
  }

  return json.id;
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

  await supabase.from("wordpress_posts").insert({
    draft_id: draftId,
    connection_id: connectionId,
    post_url: postUrl,
    post_status: status,
  });
}
