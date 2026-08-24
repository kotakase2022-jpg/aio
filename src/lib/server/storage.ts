import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import {
  callSupabaseGateway,
  isSupabaseGatewayConfigured,
} from "@/lib/server/supabase-gateway";
import { ApiError } from "@/lib/server/http";

const DEFAULT_BUCKET = "article-assets";
const ALLOWED_ASSET_FOLDERS = new Set(["uploads", "authors", "article-inserts", "generated"]);

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
  if (!ALLOWED_ASSET_FOLDERS.has(folder)) {
    throw new ApiError("画像の保存先が正しくありません。", 400);
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectPath = `${folder}/${Date.now()}-${safeName}`;
  const supabase = getSupabaseAdmin();
  const bucket = getStorageBucket();

  let durableStorageError = "";
  if (supabase) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType, upsert: true });

    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      return { url: data.publicUrl, path: objectPath, mode: "supabase" as const };
    }
    durableStorageError = error.message;
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

  if (process.env.VERCEL) {
    throw new ApiError(
      "画像の永続保存に失敗しました。",
      503,
      durableStorageError ||
        "Supabase Storageが利用できません。環境変数とarticle-assetsバケットを確認してください。",
    );
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
