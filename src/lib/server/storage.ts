import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import {
  callSupabaseGateway,
  isSupabaseGatewayConfigured,
} from "@/lib/server/supabase-gateway";

const DEFAULT_BUCKET = "article-assets";

export async function storeAsset({
  buffer,
  contentType,
  filename,
  folder = "uploads",
}: {
  buffer: Buffer;
  contentType: string;
  filename: string;
  folder?: string;
}) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectPath = `${folder}/${Date.now()}-${safeName}`;
  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  if (supabase) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType, upsert: true });

    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      return { url: data.publicUrl, path: objectPath, mode: "supabase" as const };
    }
  }

  if (isSupabaseGatewayConfigured()) {
    const stored = await callSupabaseGateway<{ url: string; path: string }>("upload_asset", {
      bucket,
      objectPath,
      contentType,
      base64: buffer.toString("base64"),
    });

    return { url: stored.url, path: stored.path, mode: "supabase-gateway" as const };
  }

  try {
    const publicDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(publicDir, { recursive: true });
    const localPath = path.join(publicDir, path.basename(objectPath));
    await writeFile(localPath, buffer);
    return {
      url: `/uploads/${folder}/${path.basename(objectPath)}`,
      path: localPath,
      mode: "local" as const,
    };
  } catch {
    return {
      url: `data:${contentType};base64,${buffer.toString("base64")}`,
      path: objectPath,
      mode: "data-url" as const,
    };
  }
}

function getStorageBucket() {
  const bucket = cleanEnvValue(process.env.SUPABASE_STORAGE_BUCKET) || DEFAULT_BUCKET;
  return isValidBucketName(bucket) ? bucket : DEFAULT_BUCKET;
}

function cleanEnvValue(value?: string) {
  return value?.replace(/^\uFEFF/, "").trim();
}

function isValidBucketName(value: string) {
  return /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(value);
}
