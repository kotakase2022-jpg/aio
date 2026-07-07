import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/server/http";
import { sanitizeForPostgres } from "@/lib/server/postgres-sanitize";
import { assertDurableStorageConfigured, getSupabaseAdmin } from "@/lib/server/supabase";
import {
  callSupabaseGateway,
  isSupabaseGatewayConfigured,
} from "@/lib/server/supabase-gateway";
import { truncateText } from "@/lib/utils";
import type {
  ArticleFormPayload,
  DraftStatus,
  GenerationJob,
  GenerationLogSummary,
  GenerationStep,
} from "@/types/aio";

type LocalJobStore = Record<string, GenerationJob>;

const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "aio-article-generator")
  : process.env.AIO_LOCAL_DATA_DIR || path.join(process.cwd(), ".data");
const jobFile = path.join(dataDir, "generation-jobs.json");

const initialSteps: GenerationStep[] = [
  { id: "fetch_refs", label: "参照URL本文抽出", status: "pending" },
  { id: "fetch_competitors", label: "競合URL本文抽出", status: "pending" },
  { id: "merge_research", label: "競合調査統合", status: "pending" },
  { id: "generate_outline", label: "記事構成案生成", status: "pending" },
  { id: "generate_body", label: "AIO本文生成", status: "pending" },
  { id: "generate_meta", label: "タイトル・メタ・FAQ生成", status: "pending" },
  { id: "image_prompts", label: "画像プロンプト生成", status: "pending" },
  { id: "images", label: "画像生成または反映", status: "pending" },
  { id: "save", label: "ドラフト保存", status: "pending" },
];

export function createInitialGenerationSteps() {
  return initialSteps.map((step) => ({ ...step }));
}

export async function createGenerationJob({
  inputPayload,
  competitorResearch,
}: {
  inputPayload: ArticleFormPayload;
  competitorResearch?: GenerationJob["competitorResearch"];
}) {
  assertDurableStorageConfigured("記事生成ジョブ");

  const now = new Date().toISOString();
  const job: GenerationJob = {
    kind: "article_generation_job",
    id: randomUUID(),
    status: "queued",
    steps: createInitialGenerationSteps(),
    inputPayload,
    competitorResearch: competitorResearch ?? null,
    fetchedReferences: [],
    fetchedCompetitors: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveGenerationJob(job);
  return job;
}

export async function getGenerationJob(id: string) {
  assertDurableStorageConfigured("記事生成ジョブの取得");

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("article_inputs")
      .select("id,input_payload,created_at,updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new ApiError("生成ジョブの読み込みに失敗しました。", 500, error.message);
    }

    return data ? rowToJob(data as Record<string, unknown>) : null;
  }

  if (isSupabaseGatewayConfigured()) {
    const result = await callSupabaseGateway<{ job: GenerationJob | null }>("get_job", {
      id,
    });
    return result.job;
  }

  const store = await readLocalJobs();
  return store[id] ?? null;
}

export async function saveGenerationJob(job: GenerationJob) {
  assertDurableStorageConfigured("記事生成ジョブの保存");

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("article_inputs").upsert(
      sanitizeForPostgres({
        id: job.id,
        input_payload: job,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      }),
      { onConflict: "id" },
    );

    if (error) {
      throw new ApiError("生成ジョブの保存に失敗しました。", 500, error.message);
    }

    return job;
  }

  if (isSupabaseGatewayConfigured()) {
    await callSupabaseGateway<{ job: GenerationJob }>("upsert_job", { job });
    return job;
  }

  const store = await readLocalJobs();
  store[job.id] = job;
  await writeLocalJobs(store);
  return job;
}

export async function updateGenerationJob(
  id: string,
  updater: (job: GenerationJob) => GenerationJob,
) {
  const current = await getGenerationJob(id);
  if (!current) {
    throw new ApiError(
      "生成ジョブが見つかりません。",
      404,
      "古い生成状態をクリアし、もう一度「AIによる記事作成」を実行してください。",
    );
  }

  const next = updater(current);
  next.updatedAt = new Date().toISOString();
  await saveGenerationJob(next);
  return next;
}

export async function updateGenerationStep(
  jobId: string,
  stepId: string,
  status: GenerationStep["status"],
  detail?: string,
) {
  return updateGenerationJob(jobId, (job) => ({
    ...job,
    steps: job.steps.map((step) =>
      step.id === stepId ? { ...step, status, detail } : step,
    ),
  }));
}

export async function cancelGenerationJob(id: string) {
  return updateGenerationJob(id, (job) => ({
    ...job,
    status: "canceled",
    completedAt: new Date().toISOString(),
    error: "ユーザー操作により記事作成を停止しました。",
    steps: job.steps.map((step) =>
      step.status === "running" ? { ...step, status: "error", detail: "停止しました" } : step,
    ),
  }));
}

export async function assertGenerationJobActive(id: string) {
  const job = await getGenerationJob(id);
  if (!job) {
    throw new ApiError(
      "生成ジョブが見つかりません。",
      404,
      "古い生成状態をクリアし、もう一度「AIによる記事作成」を実行してください。",
    );
  }

  if (job.status === "canceled") {
    throw new ApiError("記事作成は停止済みです。", 409);
  }

  return job;
}

export async function listGenerationJobs(limit = 30) {
  assertDurableStorageConfigured("生成ログの取得");

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("article_inputs")
      .select("id,input_payload,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(Math.max(limit * 4, 40));

    if (error) {
      throw new ApiError("生成ログの読み込みに失敗しました。", 500, error.message);
    }

    return (data ?? [])
      .map((row) => rowToJob(row as Record<string, unknown>))
      .filter(isGenerationJob)
      .slice(0, limit);
  }

  if (isSupabaseGatewayConfigured()) {
    const result = await callSupabaseGateway<{ jobs: GenerationJob[] }>("list_jobs", {
      limit,
    });
    return result.jobs;
  }

  const store = await readLocalJobs();
  return Object.values(store)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export async function listGenerationLogs(limit = 20) {
  const jobs = await listGenerationJobs(limit);
  return jobs.map(jobToLogSummary);
}

export async function markGenerationJobWordpressPost({
  draftId,
  status,
  postUrl,
}: {
  draftId: string;
  status: "draft" | "publish";
  postUrl: string;
}) {
  const jobs = await listGenerationJobs(100);
  const job = jobs.find((item) => item.draftId === draftId || item.draft?.id === draftId);
  if (!job) {
    return null;
  }

  const now = new Date().toISOString();
  const next: GenerationJob = {
    ...job,
    wordpressPostStatus: status,
    wordpressPostUrl: postUrl,
    wordpressPostedAt: now,
    updatedAt: now,
    draft: job.draft
      ? {
          ...job.draft,
          status: "posted",
          wordpressPostUrl: postUrl || job.draft.wordpressPostUrl,
          updatedAt: now,
        }
      : job.draft,
  };
  await saveGenerationJob(next);
  return next;
}

function rowToJob(row: Record<string, unknown>) {
  const payload = row.input_payload;
  if (!isRecord(payload) || payload.kind !== "article_generation_job") {
    return null;
  }

  return {
    ...payload,
    id: String(payload.id ?? row.id),
    createdAt: String(payload.createdAt ?? row.created_at ?? new Date().toISOString()),
    updatedAt: String(payload.updatedAt ?? row.updated_at ?? new Date().toISOString()),
  } as GenerationJob;
}

function isGenerationJob(value: GenerationJob | null): value is GenerationJob {
  return Boolean(value);
}

function jobToLogSummary(job: GenerationJob): GenerationLogSummary {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    inputSummary: summarizeInput(job.inputPayload),
    outputTitle: job.draft?.editedTitle,
    outputSlug: job.draft?.editedSlug,
    draftStatus: job.draft?.status as DraftStatus | undefined,
    wordpressPostStatus: job.wordpressPostStatus,
    wordpressPostUrl: job.wordpressPostUrl,
    error: job.error,
  };
}

function summarizeInput(input: ArticleFormPayload) {
  const references =
    input.references.filter((item) => item.url?.trim() || item.text?.trim()).length +
    (input.referenceFiles ?? []).filter((file) => file.ok).length;
  const competitors =
    input.competitors.filter((item) => item.url?.trim() || item.text?.trim()).length +
    (input.competitorFiles ?? []).filter((file) => file.ok).length;
  const theme = input.theme?.trim()
    ? truncateText(input.theme.replace(/\s+/g, " "), 70)
    : "テーマ未入力";
  const primaryInfo = input.primaryInfo?.trim()
    ? ` / 一次情報: ${truncateText(input.primaryInfo.replace(/\s+/g, " "), 40)}`
    : "";
  const tone = summarizeTone(input);
  return `${theme} / 参照${references}件 / 競合${competitors}件 / 画像${input.imageCount ?? 2}枚 / ${input.wordCount ?? 3000}字 / ${tone}${primaryInfo}`;
}

function summarizeTone(input: ArticleFormPayload) {
  if (input.visualTone.mode === "upload") {
    return `画像アップロード${input.visualTone.uploadedImageName ? `: ${input.visualTone.uploadedImageName}` : ""}`;
  }

  if (input.visualTone.mode === "custom") {
    return `画像トーン: ${truncateText(input.visualTone.custom ?? "", 36) || "自由入力"}`;
  }

  return `画像トーン: ${truncateText(input.visualTone.preset ?? "", 36) || "プリセット"}`;
}

async function readLocalJobs(): Promise<LocalJobStore> {
  try {
    return JSON.parse(await readFile(jobFile, "utf8")) as LocalJobStore;
  } catch {
    return {};
  }
}

async function writeLocalJobs(store: LocalJobStore) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(jobFile, JSON.stringify(store, null, 2), "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
