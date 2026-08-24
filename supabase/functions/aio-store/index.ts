import { createClient } from "npm:@supabase/supabase-js@2";

type Payload = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-aio-store-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = getServiceKey();

if (!supabaseUrl || !serviceKey) {
  throw new Error("Supabase Edge Function is missing admin environment variables.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      throw new HttpError("Method not allowed.", 405);
    }

    await assertGatewayToken(request.headers.get("x-aio-store-token") ?? "");

    const body = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.action !== "string") {
      throw new HttpError("Invalid gateway request.", 400);
    }

    const payload = isRecord(body.payload) ? body.payload : {};

    switch (body.action) {
      case "upsert_job":
        return ok(await upsertJob(payload));
      case "get_job":
        return ok(await getJob(payload));
      case "list_jobs":
        return ok(await listJobs(payload));
      case "upsert_draft":
        return ok(await upsertDraft(payload));
      case "get_draft":
        return ok(await getDraft(payload));
      case "insert_wordpress_connection":
        return ok(await insertWordpressConnection(payload));
      case "get_wordpress_connection":
        return ok(await getWordpressConnection(payload));
      case "insert_wordpress_post":
        return ok(await insertWordpressPost(payload));
      case "upload_asset":
        return ok(await uploadAsset(payload));
      default:
        throw new HttpError("Unsupported gateway action.", 400);
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected gateway error.";
    return json({ ok: false, error: message }, status);
  }
});

async function upsertJob(payload: Payload) {
  const job = requireRecord(payload.job, "job");
  const { error } = await supabase.from("article_inputs").upsert({
    id: requireString(job.id, "job.id"),
    input_payload: job,
    created_at: String(job.createdAt ?? new Date().toISOString()),
    updated_at: String(job.updatedAt ?? new Date().toISOString()),
  });

  if (error) throw new HttpError(error.message, 500);
  return { job };
}

async function getJob(payload: Payload) {
  const id = requireString(payload.id, "id");
  const { data, error } = await supabase
    .from("article_inputs")
    .select("id,input_payload,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new HttpError(error.message, 500);
  return { job: data ? rowToJob(data as Payload) : null };
}

async function listJobs(payload: Payload) {
  const limit = clampLimit(Number(payload.limit ?? 20), 1, 100);
  const { data, error } = await supabase
    .from("article_inputs")
    .select("id,input_payload,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(Math.max(limit * 4, 40));

  if (error) throw new HttpError(error.message, 500);
  const jobs = (data ?? [])
    .map((row) => rowToJob(row as Payload))
    .filter(Boolean)
    .slice(0, limit);
  return { jobs };
}

async function upsertDraft(payload: Payload) {
  const row = requireRecord(payload.row, "row");
  const images = Array.isArray(payload.images) ? payload.images : [];
  const draftId = requireString(row.id, "row.id");

  const { error } = await supabase.from("article_drafts").upsert(row);
  if (error) throw new HttpError(error.message, 500);

  if (images.length > 0) {
    const { error: imageError } = await supabase.from("article_images").upsert(images);
    if (imageError) throw new HttpError(imageError.message, 500);

    const imageIds = images.map((image) => requireString(image.id, "images[].id"));
    const { error: cleanupError } = await supabase
      .from("article_images")
      .delete()
      .eq("draft_id", draftId)
      .not("id", "in", `(${imageIds.join(",")})`);
    if (cleanupError) throw new HttpError(cleanupError.message, 500);
  } else {
    const { error: deleteError } = await supabase
      .from("article_images")
      .delete()
      .eq("draft_id", draftId);
    if (deleteError) throw new HttpError(deleteError.message, 500);
  }

  return { draftId };
}

async function getDraft(payload: Payload) {
  const id = requireString(payload.id, "id");
  const { data, error } = await supabase
    .from("article_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new HttpError(error.message, 500);
  if (!data) return { row: null, images: [] };

  const { data: images, error: imagesError } = await supabase
    .from("article_images")
    .select("*")
    .eq("draft_id", id)
    .order("created_at", { ascending: true });
  if (imagesError) throw new HttpError(imagesError.message, 500);

  return { row: data, images: images ?? [] };
}

async function insertWordpressConnection(payload: Payload) {
  const row = requireRecord(payload.row, "row");
  const { error } = await supabase.from("wordpress_connections").insert(row);
  if (error) throw new HttpError(error.message, 500);
  return { id: row.id };
}

async function getWordpressConnection(payload: Payload) {
  const id = requireString(payload.id, "id");
  const { data, error } = await supabase
    .from("wordpress_connections")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new HttpError(error.message, 500);
  return { row: data ?? null };
}

async function insertWordpressPost(payload: Payload) {
  const row = requireRecord(payload.row, "row");
  const { error } = await supabase.from("wordpress_posts").insert(row);
  if (error) throw new HttpError(error.message, 500);
  return { id: row.id ?? null };
}

async function uploadAsset(payload: Payload) {
  const bucket = requireBucketName(payload.bucket, "bucket");
  const objectPath = requireString(payload.objectPath, "objectPath");
  const contentType = requireString(payload.contentType, "contentType");
  const base64 = requireString(payload.base64, "base64");
  const bytes = decodeBase64(base64);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, bytes, { contentType, upsert: true });

  if (error) throw new HttpError(error.message, 500);

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return { url: data.publicUrl, path: objectPath };
}

async function assertGatewayToken(token: string) {
  if (!token) {
    throw new HttpError("Missing gateway token.", 401);
  }

  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabase
    .from("aio_gateway_tokens")
    .select("token_hash")
    .eq("token_hash", tokenHash)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new HttpError(error.message, 500);
  if (!data) throw new HttpError("Invalid gateway token.", 401);
}

function getServiceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeys) return null;

  const parsed = JSON.parse(secretKeys) as Record<string, string>;
  return parsed.service_role ?? parsed.default ?? Object.values(parsed)[0] ?? null;
}

function rowToJob(row: Payload) {
  const payload = row.input_payload;
  if (!isRecord(payload) || payload.kind !== "article_generation_job") {
    return null;
  }

  return {
    ...payload,
    id: String(payload.id ?? row.id),
    createdAt: String(payload.createdAt ?? row.created_at ?? new Date().toISOString()),
    updatedAt: String(payload.updatedAt ?? row.updated_at ?? new Date().toISOString()),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function ok(body: unknown) {
  return json({ ok: true, ...(isRecord(body) ? body : { data: body }) });
}

function isRecord(value: unknown): value is Payload {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): Payload {
  if (!isRecord(value)) throw new HttpError(`${field} is required.`, 400);
  return value;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(`${field} is required.`, 400);
  }
  return value;
}

function requireBucketName(value: unknown, field: string) {
  const bucket = requireString(value, field).replace(/^\uFEFF/, "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new HttpError(`${field} is invalid.`, 400);
  }
  return bucket;
}

function clampLimit(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
