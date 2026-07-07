import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ArticleDraft } from "@/types/aio";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { ApiError } from "@/lib/server/http";
import { sanitizeForPostgres } from "@/lib/server/postgres-sanitize";
import {
  callSupabaseGateway,
  isSupabaseGatewayConfigured,
} from "@/lib/server/supabase-gateway";

type LocalDraftStore = Record<string, ArticleDraft>;

const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "aio-article-generator")
  : process.env.AIO_LOCAL_DATA_DIR || path.join(process.cwd(), ".data");
const draftFile = path.join(dataDir, "drafts.json");

export async function saveDraft(draft: ArticleDraft) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const row = draftToRow(draft);
    const { error } = await supabase.from("article_drafts").upsert(row);
    if (error) {
      throw new ApiError("Failed to save draft to Supabase.", 500, error.message);
    }

    await supabase.from("article_images").delete().eq("draft_id", draft.id);
    if (draft.images.length > 0) {
      const { error: imageError } = await supabase.from("article_images").insert(
        draftToImageRows(draft),
      );
      if (imageError) {
        throw new ApiError("Failed to save draft images to Supabase.", 500, imageError.message);
      }
    }

    return { draft, storageMode: "supabase" as const };
  }

  if (isSupabaseGatewayConfigured()) {
    await callSupabaseGateway("upsert_draft", {
      row: draftToRow(draft),
      images: draftToImageRows(draft),
    });

    return { draft, storageMode: "supabase-gateway" as const };
  }

  const store = await readLocalDrafts();
  store[draft.id] = draft;
  await writeLocalDrafts(store);
  return { draft, storageMode: "local" as const };
}

export async function getDraft(id: string) {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("article_drafts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new ApiError("Failed to load draft from Supabase.", 500, error.message);
    }

    if (!data) {
      return null;
    }

    const { data: imageRows, error: imageError } = await supabase
      .from("article_images")
      .select("*")
      .eq("draft_id", id)
      .order("created_at", { ascending: true });

    if (imageError) {
      throw new ApiError("Failed to load draft images from Supabase.", 500, imageError.message);
    }

    return rowToDraft(data as Record<string, unknown>, imageRows as Record<string, unknown>[]);
  }

  if (isSupabaseGatewayConfigured()) {
    const result = await callSupabaseGateway<{
      row: Record<string, unknown> | null;
      images: Record<string, unknown>[];
    }>("get_draft", { id });
    return result.row ? rowToDraft(result.row, result.images) : null;
  }

  const store = await readLocalDrafts();
  return store[id] ?? null;
}

export async function approveDraft(id: string) {
  const draft = await getDraft(id);
  if (!draft) {
    throw new ApiError(
      "下書きが見つかりません。",
      404,
      "生成ログから下書きを開き直すか、編集内容を保存してからもう一度承認してください。",
    );
  }

  const updated: ArticleDraft = {
    ...draft,
    status: "approved",
    updatedAt: new Date().toISOString(),
  };

  return saveDraft(updated);
}

async function readLocalDrafts(): Promise<LocalDraftStore> {
  try {
    const content = await readFile(draftFile, "utf8");
    return JSON.parse(content) as LocalDraftStore;
  } catch {
    return {};
  }
}

async function writeLocalDrafts(store: LocalDraftStore) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(draftFile, JSON.stringify(store, null, 2), "utf8");
}

function draftToRow(draft: ArticleDraft) {
  return sanitizeForPostgres({
    id: draft.id,
    input_payload: draft.inputPayload,
    fetched_references: draft.fetchedReferences,
    fetched_competitors: draft.fetchedCompetitors,
    competitor_research: draft.competitorResearch ?? null,
    ai_result: draft.aiResult,
    edited_title: draft.editedTitle,
    edited_slug: draft.editedSlug,
    edited_meta_description: draft.editedMetaDescription,
    edited_body_html: draft.editedBodyHtml,
    faq_items: draft.faqItems,
    tags: draft.tags,
    categories: draft.categories,
    generated_image_urls: draft.images.map((image) => image.url),
    author_payload: draft.author,
    status: draft.status,
    wordpress_post_url: draft.wordpressPostUrl ?? null,
    updated_at: draft.updatedAt,
  });
}

function draftToImageRows(draft: ArticleDraft) {
  return sanitizeForPostgres(
    draft.images.map((image) => ({
      draft_id: draft.id,
      slot: image.slot,
      image_url: image.url,
      storage_path: image.path,
      prompt: image.prompt,
      alt_text: image.altText,
      source: image.source,
    })),
  );
}

function rowToDraft(
  row: Record<string, unknown>,
  imageRows: Record<string, unknown>[] = [],
): ArticleDraft {
  return {
    id: String(row.id),
    inputPayload: row.input_payload as ArticleDraft["inputPayload"],
    fetchedReferences: row.fetched_references as ArticleDraft["fetchedReferences"],
    fetchedCompetitors: row.fetched_competitors as ArticleDraft["fetchedCompetitors"],
    competitorResearch: row.competitor_research as ArticleDraft["competitorResearch"],
    aiResult: row.ai_result as ArticleDraft["aiResult"],
    editedTitle: String(row.edited_title ?? ""),
    editedSlug: String(row.edited_slug ?? ""),
    editedMetaDescription: String(row.edited_meta_description ?? ""),
    editedBodyHtml: String(row.edited_body_html ?? ""),
    faqItems: row.faq_items as ArticleDraft["faqItems"],
    tags: row.tags as string[],
    categories: row.categories as string[],
    images: imageRows.map((image) => ({
      id: String(image.id),
      slot: image.slot as ArticleDraft["images"][number]["slot"],
      url: String(image.image_url ?? ""),
      path: image.storage_path ? String(image.storage_path) : undefined,
      prompt: String(image.prompt ?? ""),
      altText: String(image.alt_text ?? ""),
      source: image.source as ArticleDraft["images"][number]["source"],
    })),
    author: row.author_payload as ArticleDraft["author"],
    status: row.status as ArticleDraft["status"],
    wordpressPostUrl: row.wordpress_post_url ? String(row.wordpress_post_url) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
