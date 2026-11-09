import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApiError } from "@/lib/server/http";
import { assertDurableStorageConfigured, getSupabaseAdmin } from "@/lib/server/supabase";
import { callSupabaseGateway, isSupabaseGatewayConfigured } from "@/lib/server/supabase-gateway";
import { withLocalStoreLock, writeLocalJson } from "@/lib/server/local-store";

type PostReservation = { reserved: boolean; postUrl?: string | null };
type PostRow = { id: string; draft_id: string; connection_id: string; post_status: "draft" | "publish"; post_url: string | null };
const filename = path.join(process.env.VERCEL ? path.join(os.tmpdir(), "aio-article-generator")
  : process.env.AIO_LOCAL_DATA_DIR || path.join(process.cwd(), ".data"), "wordpress-posts.json");

export async function reserveWordpressPost(draftId: string, connectionId: string, status: "draft" | "publish") {
  assertDurableStorageConfigured("WordPress投稿予約");
  const row: PostRow = { id: draftId, draft_id: draftId, connection_id: connectionId, post_status: status, post_url: null };
  const supabase = getSupabaseAdmin();
  let result: PostReservation;
  if (supabase) {
    const { data, error: readError } = await supabase.from("wordpress_posts")
      .select("id,post_url").eq("draft_id", draftId).limit(1).maybeSingle();
    if (readError) throw new ApiError("WordPress投稿履歴を確認できませんでした。", 503, readError.message);
    if (data) {
      result = { reserved: false, postUrl: data.post_url };
    } else {
      const { error } = await supabase.from("wordpress_posts").insert(row);
      if (error && error.code !== "23505") throw new ApiError("WordPress投稿予約に失敗しました。", 503, error.message);
      result = { reserved: !error };
    }
  } else if (isSupabaseGatewayConfigured()) {
    result = await callSupabaseGateway<PostReservation>("reserve_wordpress_post", { row });
  } else {
    result = await withLocalStoreLock(filename, async () => {
      const store = await readPosts();
      if (store[draftId]) return { reserved: false, postUrl: store[draftId].post_url };
      store[draftId] = row;
      await writeLocalJson(filename, store);
      return { reserved: true };
    });
  }
  if (!result.reserved) {
    throw new ApiError("このドラフトは投稿済み、投稿中、または投稿結果の確認待ちです。", 409,
      `重複投稿を防ぐため再送信しません。WordPress管理画面で投稿結果を確認してください。${result.postUrl ? ` 投稿URL: ${result.postUrl}` : ""}`);
  }
}

export async function finishWordpressPost(draftId: string, postUrl: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("wordpress_posts").update({ post_url: postUrl }).eq("id", draftId);
    if (error) throw new ApiError("WordPress投稿結果の保存に失敗しました。", 500, error.message);
  } else if (isSupabaseGatewayConfigured()) {
    await callSupabaseGateway("finish_wordpress_post", { draftId, postUrl });
  } else {
    await withLocalStoreLock(filename, async () => {
      const store = await readPosts();
      if (!store[draftId]) throw new Error("WordPress post reservation is missing.");
      store[draftId].post_url = postUrl;
      await writeLocalJson(filename, store);
    });
  }
}

export async function releaseWordpressPost(draftId: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("wordpress_posts").delete().eq("id", draftId).is("post_url", null);
    if (error) throw new ApiError("WordPress投稿予約の解除に失敗しました。", 500, error.message);
  } else if (isSupabaseGatewayConfigured()) {
    await callSupabaseGateway("release_wordpress_post", { draftId });
  } else {
    await withLocalStoreLock(filename, async () => {
      const store = await readPosts();
      if (store[draftId]?.post_url === null) delete store[draftId];
      await writeLocalJson(filename, store);
    });
  }
}

async function readPosts(): Promise<Record<string, PostRow>> {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}
