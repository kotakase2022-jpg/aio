import { readFile } from "node:fs/promises";
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
import { withLocalStoreLock, writeLocalJson } from "@/lib/server/local-store";
import { articleFormSchema } from "@/lib/server/article-form-schema";
import type {
  ArticleDraft,
  ArticleFormPayload,
  DraftStatus,
  GenerationJob,
  GenerationLogPage,
  GenerationLogSummary,
  GenerationStep,
} from "@/types/aio";

type LocalJobStore = Record<string, GenerationJob>;

const dataDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "aio-article-generator")
  : process.env.AIO_LOCAL_DATA_DIR || path.join(process.cwd(), ".data");
const jobFile = path.join(dataDir, "generation-jobs.json");

// The POST worker has a 300-second budget; allow another minute before recovery.
const GENERATION_JOB_EXPIRY_MS = 6 * 60 * 1000;

export const DRAFT_SAVED_STEP_DETAIL = "ドラフトを保存しました";
const UNCONFIRMED_SAVE_STEP_DETAIL =
  "保存された記事本体を確認できませんでした。生成ログの「更新」を押してから開き直し、内容を確認してください。";

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

export async function recoverStaleGenerationJob(job: GenerationJob, now = Date.now()) {
  if (!isGenerationJobExpired(job, now)) return job;

  return updateGenerationJob(job.id, (current) => {
    if (!isGenerationJobExpired(current, now)) return current;
    const error = "記事生成が制限時間を超えたため停止しました。入力内容を確認し、もう一度「AIによる記事作成」を実行してください。";
    return {
      ...current,
      status: "failed",
      completedAt: new Date(now).toISOString(),
      error,
      steps: current.steps.map((step) =>
        step.status === "running" ? { ...step, status: "error", detail: error } : step,
      ),
    };
  });
}

/**
 * Jobs finished before the completion write became atomic can be stored as "completed" while
 * their save step still reads "running". Present that step from the canonical draft read
 * instead of the stale value. This only shapes the response; the stored job is not rewritten.
 */
export function presentCompletedSaveStep(job: GenerationJob, canonicalDraftFound: boolean): GenerationJob {
  if (job.status !== "completed") return job;
  const saveStep = job.steps.find((step) => step.id === "save");
  if (saveStep?.status !== "running") return job;
  return {
    ...job,
    steps: job.steps.map((step): GenerationStep => {
      if (step.id !== "save") return step;
      return canonicalDraftFound
        ? { ...step, status: "done", detail: DRAFT_SAVED_STEP_DETAIL }
        : { ...step, status: "error", detail: UNCONFIRMED_SAVE_STEP_DETAIL };
    }),
  };
}

function isGenerationJobExpired(job: GenerationJob, now: number) {
  if (job.status !== "queued" && job.status !== "running") return false;
  const startedAt = job.status === "running" ? Date.parse(job.startedAt ?? "") : NaN;
  const beganAt = Number.isFinite(startedAt) ? startedAt : Date.parse(job.createdAt);
  return Number.isFinite(beganAt) && now - beganAt >= GENERATION_JOB_EXPIRY_MS;
}

export async function saveGenerationJob(job: GenerationJob, expectedUpdatedAt?: string): Promise<GenerationJob | null> {
  assertDurableStorageConfigured("記事生成ジョブの保存");

  const supabase = getSupabaseAdmin();
  if (supabase) {
    if (expectedUpdatedAt) {
      const { data, error } = await supabase.from("article_inputs")
        .update(sanitizeForPostgres({ input_payload: job, updated_at: job.updatedAt }))
        .eq("id", job.id).eq("updated_at", expectedUpdatedAt).select("id").maybeSingle();
      if (error) throw new ApiError("生成ジョブの保存に失敗しました。", 500, error.message);
      return data ? job : null;
    }
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
    const result = await callSupabaseGateway<{ job: GenerationJob | null }>("upsert_job", { job, expectedUpdatedAt });
    return result.job;
  }

  return withLocalStoreLock(jobFile, async () => {
    const store = await readLocalJobs();
    if (expectedUpdatedAt && store[job.id]?.updatedAt !== expectedUpdatedAt) return null;
    store[job.id] = job;
    await writeLocalJson(jobFile, store);
    return job;
  });
}

export async function updateGenerationJob(
  id: string,
  updater: (job: GenerationJob) => GenerationJob,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await getGenerationJob(id);
    if (!current) {
      throw new ApiError(
        "生成ジョブが見つかりません。",
        404,
        "古い生成状態をクリアし、もう一度「AIによる記事作成」を実行してください。",
      );
    }

    if (current.status === "canceled" || current.status === "failed") return current;
    const next = updater(current);
    if (next === current || (current.status === "completed" && next.status !== "completed")) return current;
    next.updatedAt = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString();
    if (await saveGenerationJob(next, current.updatedAt)) return next;
  }
  throw new ApiError("生成ジョブが更新されました。もう一度お試しください。", 409);
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
  return updateGenerationJob(id, (job) => job.status === "completed" || job.status === "failed" ? job : ({
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

  if (job.status === "failed" || job.status === "completed") {
    throw new ApiError("記事作成は終了済みです。", 409);
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

export const GENERATION_LOG_PAGE_SIZE = 20;
export const GENERATION_LOG_MAX_PAGE_SIZE = 100;
// Deployed aio-store gateways expose list_jobs over the most recently updated rows only.
const LEGACY_GATEWAY_JOB_WINDOW = 100;
const CURSOR_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const CURSOR_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GenerationLogCursor = { createdAt: string; id: string };

export function encodeGenerationLogCursor(cursor: GenerationLogCursor) {
  return Buffer.from(JSON.stringify({ c: cursor.createdAt, i: cursor.id }), "utf8").toString("base64url");
}

export function decodeGenerationLogCursor(value: string): GenerationLogCursor {
  if (value.length <= 512 && /^[A-Za-z0-9_-]+$/.test(value)) {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
      if (
        isRecord(parsed) &&
        typeof parsed.c === "string" &&
        typeof parsed.i === "string" &&
        CURSOR_TIMESTAMP_PATTERN.test(parsed.c) &&
        Number.isFinite(Date.parse(parsed.c)) &&
        CURSOR_ID_PATTERN.test(parsed.i)
      ) {
        return { createdAt: parsed.c, id: parsed.i };
      }
    } catch {
      // Reported below as an invalid cursor.
    }
  }
  throw invalidGenerationLogCursorError();
}

/**
 * One page of generation logs, newest creation first with the job ID as a tiebreaker.
 * Creation time never changes, so saving or posting a job cannot move it between pages.
 */
export async function listGenerationLogsPage({
  limit = GENERATION_LOG_PAGE_SIZE,
  cursor = null,
}: {
  limit?: number;
  cursor?: GenerationLogCursor | null;
} = {}): Promise<GenerationLogPage> {
  assertDurableStorageConfigured("生成ログの取得");
  const pageSize = Math.min(Math.max(Math.floor(limit), 1), GENERATION_LOG_MAX_PAGE_SIZE);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    // article_inputs.id is a UUID column; anything else cannot be a cursor we issued.
    if (cursor && !UUID_PATTERN.test(cursor.id)) throw invalidGenerationLogCursorError();
    let query = supabase
      .from("article_inputs")
      .select("id,input_payload,created_at,updated_at")
      .eq("input_payload->>kind", "article_generation_job")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);
    if (cursor) {
      query = query.or(
        `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt."${cursor.id}")`,
      );
    }
    const { data, error } = await query;
    if (error) {
      throw new ApiError("生成ログの読み込みに失敗しました。", 500, error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const pageRows = rows.slice(0, pageSize);
    const lastRow = pageRows.at(-1);
    return {
      logs: pageRows.map(rowToJob).filter(isGenerationJob).map(jobToLogSummary),
      nextCursor:
        rows.length > pageSize && lastRow
          ? encodeGenerationLogCursor({ createdAt: String(lastRow.created_at), id: String(lastRow.id) })
          : null,
      complete: true,
    };
  }

  if (isSupabaseGatewayConfigured()) {
    const keysetPage = await listGatewayJobPage(pageSize, cursor);
    if (keysetPage) return keysetPage;
    // A gateway deployed before list_job_page has no cursor action, so page within its widest
    // window and say so when that window is full instead of silently hiding older jobs.
    const result = await callSupabaseGateway<{ jobs: GenerationJob[] }>("list_jobs", {
      limit: LEGACY_GATEWAY_JOB_WINDOW,
    });
    const jobs = result.jobs ?? [];
    return paginateJobsByCreation(jobs, pageSize, cursor, jobs.length < LEGACY_GATEWAY_JOB_WINDOW);
  }

  const store = await readLocalJobs();
  return paginateJobsByCreation(Object.values(store), pageSize, cursor, true);
}

// Until this time, the gateway is known to predate list_job_page; skip the extra round trip.
let gatewayJobPageUnsupportedUntil = 0;
const GATEWAY_JOB_PAGE_RECHECK_MS = 5 * 60 * 1000;

async function listGatewayJobPage(
  pageSize: number,
  cursor: GenerationLogCursor | null,
): Promise<GenerationLogPage | null> {
  // article_inputs ids are UUIDs; any other cursor id was issued by the window fallback.
  if (Date.now() < gatewayJobPageUnsupportedUntil || (cursor && !UUID_PATTERN.test(cursor.id))) return null;
  try {
    const result = await callSupabaseGateway<{
      jobs: GenerationJob[];
      nextCursor: GenerationLogCursor | null;
    }>("list_job_page", { limit: pageSize, cursor });
    return {
      logs: (result.jobs ?? []).map(jobToLogSummary),
      nextCursor: result.nextCursor ? encodeGenerationLogCursor(result.nextCursor) : null,
      complete: true,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && error.message === "Unsupported gateway action.") {
      gatewayJobPageUnsupportedUntil = Date.now() + GATEWAY_JOB_PAGE_RECHECK_MS;
      return null;
    }
    if (error instanceof ApiError && error.status === 400 && error.message === "Invalid cursor.") {
      throw invalidGenerationLogCursorError();
    }
    throw error;
  }
}

function paginateJobsByCreation(
  jobs: GenerationJob[],
  pageSize: number,
  cursor: GenerationLogCursor | null,
  complete: boolean,
): GenerationLogPage {
  const cursorTime = cursor ? creationTime(cursor.createdAt) : 0;
  const remaining = [...jobs]
    .sort((a, b) => creationTime(b.createdAt) - creationTime(a.createdAt) || compareIdsDescending(a.id, b.id))
    .filter((job) => {
      if (!cursor) return true;
      const jobTime = creationTime(job.createdAt);
      return jobTime < cursorTime || (jobTime === cursorTime && job.id < cursor.id);
    });
  const page = remaining.slice(0, pageSize);
  const last = page.at(-1);
  return {
    logs: page.map(jobToLogSummary),
    nextCursor:
      remaining.length > pageSize && last
        ? encodeGenerationLogCursor({ createdAt: new Date(creationTime(last.createdAt)).toISOString(), id: last.id })
        : null,
    complete,
  };
}

function creationTime(value: string) {
  const time = Date.parse(value);
  // A malformed legacy timestamp sorts as the oldest entry, consistently for sort and cursor.
  return Number.isFinite(time) ? time : 0;
}

function compareIdsDescending(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

function invalidGenerationLogCursorError() {
  return new ApiError(
    "生成ログの続きを読み込めませんでした。",
    400,
    "生成ログの「更新」を押してから、もう一度お試しください。",
  );
}

export async function syncGenerationJobDraft(draft: ArticleDraft) {
  const jobs = await listGenerationJobs(100);
  const job = jobs.find((item) => item.draftId === draft.id || item.draft?.id === draft.id);
  if (!job) {
    return null;
  }

  return updateGenerationJob(job.id, (current) => ({
    ...current,
    draft,
    draftId: draft.id,
  }));
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
  return updateGenerationJob(job.id, (current) => ({
    ...current,
    wordpressPostStatus: status,
    wordpressPostUrl: postUrl,
    wordpressPostedAt: now,
    updatedAt: now,
    draft: current.draft
      ? {
          ...current.draft,
          status: "posted",
          wordpressPostUrl: postUrl || current.draft.wordpressPostUrl,
          updatedAt: now,
        }
      : current.draft,
  }));
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
    updatedAt: String(row.updated_at ?? payload.updatedAt ?? new Date().toISOString()),
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
  if (!articleFormSchema.safeParse(input).success) {
    return "入力形式が不正です。新規生成で入力し直してください。";
  }
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
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
