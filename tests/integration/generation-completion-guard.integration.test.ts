import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCompletedGenerationJob, createSampleDraft, sampleArticleResult, sampleFormPayload } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import {
  COMPLETION_RPC_PARAMETERS,
  connectAioStoreGateway,
  createSupabaseStoreMirror,
  type StoreMirror,
} from "../helpers/supabase-store-mirror";
import type { ArticleDraft, GenerationJob } from "@/types/aio";

const { scheduledWork } = vi.hoisted(() => ({ scheduledWork: [] as Array<() => Promise<void>> }));

vi.mock("@/lib/server/content", () => ({ fetchUrlContent: vi.fn() }));
vi.mock("@/lib/server/article-generation", () => ({ generateAioArticle: vi.fn() }));
vi.mock("@/lib/server/article-images", () => ({ createArticleImagesForDraft: vi.fn() }));
// Runs nothing by itself: each test decides when the worker that the start request scheduled runs.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => {
    scheduledWork.push(task);
  },
}));

const DEADLINE_MESSAGE = "記事生成が制限時間を超えたため停止しました";
const processEnvSnapshot = snapshotProcessEnv();
const storageModes = ["supabase", "gateway"] as const;
type StorageMode = (typeof storageModes)[number];
let tempDir = "";

beforeEach(async () => {
  vi.resetModules();
  scheduledWork.length = 0;
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-completion-guard-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T09:00:00.000Z"));
  const { generateAioArticle } = await import("@/lib/server/article-generation");
  const { createArticleImagesForDraft } = await import("@/lib/server/article-images");
  vi.mocked(generateAioArticle).mockImplementation(async ({ form }) => ({
    ...sampleArticleResult,
    selected_title: `Article for ${String(form.theme)}`,
  }));
  vi.mocked(createArticleImagesForDraft).mockResolvedValue([]);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/server/supabase");
  vi.doUnmock("npm:@supabase/supabase-js@2");
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
});

async function useStore(mode: StorageMode, intercept?: (action: string) => Response | undefined) {
  const mirror = createSupabaseStoreMirror();
  if (mode === "supabase") {
    vi.doMock("@/lib/server/supabase", () => ({
      isSupabaseConfigured: () => true,
      isDurableStorageConfigured: () => true,
      assertDurableStorageConfigured: () => undefined,
      getSupabaseAdmin: () => mirror.client,
    }));
    return { mirror, gatewayActions: [] as string[] };
  }
  const { actions } = await connectAioStoreGateway(mirror, intercept);
  return { mirror, gatewayActions: actions };
}

/** Starts a generation through the route; its worker runs only when the test calls it. */
async function startGeneration(theme: string) {
  const { POST } = await import("@/app/api/generation-jobs/route");
  const response = await POST(new Request("http://localhost/api/generation-jobs", {
    method: "POST",
    body: JSON.stringify({
      form: { ...sampleFormPayload, theme, references: [{ id: "manual", text: "Manual evidence" }], imageCount: 0 },
    }),
  }));
  expect(response.status).toBe(202);
  const { job } = (await response.json()) as { job: GenerationJob };
  const worker = scheduledWork.shift();
  expect(worker).toBeDefined();
  return { job, runWorker: worker! };
}

async function readJob(id: string) {
  const { getGenerationJob } = await import("@/lib/server/generation-jobs");
  return getGenerationJob(id);
}

async function readStatus(id: string) {
  const { GET } = await import("@/app/api/generation-jobs/[id]/route");
  const response = await GET(new Request(`http://localhost/api/generation-jobs/${id}`), { params: Promise.resolve({ id }) });
  return { status: response.status, body: (await response.json()) as { job: GenerationJob } };
}

function completionCalls(mirror: StoreMirror) {
  return mirror.rpcCalls.filter((call) => call.name === "aio_complete_generation_job");
}

function draftTitles(mirror: StoreMirror) {
  return [...mirror.tables.article_drafts.values()].map((row) => row.edited_title);
}

describe.each(storageModes)("guarded generation completion (%s)", (mode) => {
  test("the article and the job completion are committed by one guarded database write", async () => {
    const { mirror, gatewayActions } = await useStore(mode);
    const { job, runWorker } = await startGeneration("Guarded theme");

    await runWorker();

    const completed = await readJob(job.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.steps.filter((step) => step.status !== "done")).toEqual([]);
    expect(draftTitles(mirror)).toEqual(["Article for Guarded theme"]);
    expect(mirror.tables.article_drafts.get(completed!.draftId!)?.edited_title).toBe("Article for Guarded theme");
    // No separate, unguarded draft save or job update completes the job.
    expect(mirror.rpcCalls.map((call) => call.name)).toEqual(["aio_complete_generation_job"]);
    expect(mirror.completionWrites).toEqual(["rpc"]);
    // PostgREST matches the function by its argument names.
    expect(Object.keys(completionCalls(mirror)[0].args).sort()).toEqual([...COMPLETION_RPC_PARAMETERS].sort());
    if (mode === "gateway") {
      expect(gatewayActions).toContain("complete_job");
      expect(gatewayActions).not.toContain("upsert_draft");
    }
  });

  test("a completion the database applies after the deadline adds no article, even after the editor started again", async () => {
    const { mirror } = await useStore(mode);
    const first = await startGeneration("First theme");
    const late = mirror.holdNextCompletion();
    const firstWorker = first.runWorker();
    await late.arrival;

    // The completion request is on its way but reaches the database only 7 minutes after the job
    // started. Meanwhile the browser gave up holding the job and the editor generated again.
    vi.setSystemTime(Date.now() + 7 * 60 * 1000);
    const second = await startGeneration("Second theme");
    await second.runWorker();
    late.release();
    await firstWorker;

    // One article, and one generation in the log that shows it.
    const { listGenerationLogsPage } = await import("@/lib/server/generation-jobs");
    const logs = (await listGenerationLogsPage()).logs;
    expect(logs.filter((log) => log.status === "completed").map((log) => log.outputTitle)).toEqual(["Article for Second theme"]);
    expect(logs.find((log) => log.id === first.job.id)?.status).toBe("failed");
    expect(draftTitles(mirror)).toEqual(["Article for Second theme"]);
    const firstJob = await readJob(first.job.id);
    expect(firstJob?.status).toBe("failed");
    expect(firstJob?.error).toContain(DEADLINE_MESSAGE);
    expect(firstJob?.draftId).toBeUndefined();
    expect((await readJob(second.job.id))?.status).toBe("completed");
    const lateDraftId = String((completionCalls(mirror)[0].args.draft_row as { id: string }).id);
    expect(mirror.tables.article_drafts.has(lateDraftId)).toBe(false);
    // What the browser reads once the status endpoint answers again.
    const status = await readStatus(first.job.id);
    expect(status.status).toBe(200);
    expect(status.body.job.status).toBe("failed");
    expect(mirror.completionWrites).toEqual(["rpc"]);
    expect(mirror.rpcCalls.filter((call) => call.name === "aio_save_draft")).toEqual([]);
  });

  test("a cancel that lands while the completion is on its way wins, and no article is saved", async () => {
    const { mirror } = await useStore(mode);
    const { job, runWorker } = await startGeneration("Canceled theme");
    const pending = mirror.holdNextCompletion();
    const worker = runWorker();
    await pending.arrival;

    const { POST: cancel } = await import("@/app/api/generation-jobs/[id]/cancel/route");
    const canceled = await cancel(new Request(`http://localhost/api/generation-jobs/${job.id}/cancel`, { method: "POST" }), {
      params: Promise.resolve({ id: job.id }),
    });
    expect(canceled.status).toBe(200);
    pending.release();
    await worker;

    const final = await readJob(job.id);
    expect(final?.status).toBe("canceled");
    expect(final?.draftId).toBeUndefined();
    expect(draftTitles(mirror)).toEqual([]);
    expect(mirror.completionWrites).toEqual([]);
  });

  test("a job written after the completion read it is re-read, so that write is kept", async () => {
    const { mirror } = await useStore(mode);
    const { job, runWorker } = await startGeneration("Revised theme");
    const pending = mirror.holdNextCompletion();
    const worker = runWorker();
    await pending.arrival;

    const { updateGenerationStep } = await import("@/lib/server/generation-jobs");
    await updateGenerationStep(job.id, "images", "done", "Refreshed by another write");
    pending.release();
    await worker;

    const final = await readJob(job.id);
    expect(final?.status).toBe("completed");
    expect(final?.steps.find((step) => step.id === "images")?.detail).toBe("Refreshed by another write");
    expect(completionCalls(mirror)).toHaveLength(2);
    expect(draftTitles(mirror)).toEqual(["Article for Revised theme"]);
  });

  test("the editor save and approval of an article from a long-finished job are not affected", async () => {
    const { mirror, gatewayActions } = await useStore(mode);
    const draft = createSampleDraft({ id: "5d7b5f2e-4a0c-4c55-9f4e-2f3c2a9d8b10", images: [], updatedAt: "2026-11-10T09:00:00.000Z" });
    const finished = createCompletedGenerationJob();
    mirror.seedJob({
      ...finished,
      id: "7f0c8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
      draft,
      draftId: draft.id,
      createdAt: "2026-11-10T08:55:00.000Z",
      updatedAt: "2026-11-10T09:00:00.000Z",
    });
    const { saveDraft } = await import("@/lib/server/drafts");
    await saveDraft(draft);
    mirror.rpcCalls.length = 0;
    gatewayActions.length = 0;

    const { POST: save } = await import("@/app/api/save-draft/route");
    const saved = await save(draftRequest("save-draft", { ...draft, editedTitle: "Edited a week later" }));
    expect(saved.status).toBe(200);
    const { POST: approve } = await import("@/app/api/approve-draft/route");
    const approved = await approve(draftRequest("approve-draft", { ...draft, editedTitle: "Edited a week later" }));
    expect(approved.status).toBe(200);

    expect(mirror.tables.article_drafts.get(draft.id)).toMatchObject({ edited_title: "Edited a week later", status: "approved" });
    expect(mirror.rpcCalls.map((call) => call.name)).toEqual(["aio_save_draft", "aio_save_draft"]);
    if (mode === "gateway") expect(gatewayActions).not.toContain("complete_job");
  });
});

describe("storage that predates the completion guard", () => {
  test("a database without aio_complete_generation_job still completes generation the previous way, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { mirror } = await useStore("supabase");
    mirror.dropFunction("aio_complete_generation_job");
    const { job, runWorker } = await startGeneration("Before the migration");

    await runWorker();

    expect((await readJob(job.id))?.status).toBe("completed");
    expect(draftTitles(mirror)).toEqual(["Article for Before the migration"]);
    expect(mirror.rpcCalls.map((call) => call.name)).toEqual(["aio_complete_generation_job", "aio_save_draft"]);
    expect(mirror.completionWrites).toEqual(["update"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("without the database deadline guard"));
  });

  test("a deployed aio-store without complete_job still completes generation the previous way, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Exactly what aio-store v6 answers for an action it does not know.
    const { mirror, gatewayActions } = await useStore("gateway", (action) =>
      action === "complete_job" ? Response.json({ ok: false, error: "Unsupported gateway action." }, { status: 400 }) : undefined,
    );
    const { job, runWorker } = await startGeneration("Before the gateway");

    await runWorker();

    expect((await readJob(job.id))?.status).toBe("completed");
    expect(draftTitles(mirror)).toEqual(["Article for Before the gateway"]);
    expect(gatewayActions.filter((action) => ["complete_job", "upsert_draft"].includes(action))).toEqual(["complete_job", "upsert_draft"]);
    expect(mirror.completionWrites).toEqual(["update"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("without the database deadline guard"));
  });

  test("a deployed aio-store on a database without the migration also completes the previous way", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { mirror, gatewayActions } = await useStore("gateway");
    mirror.dropFunction("aio_complete_generation_job");
    const { job, runWorker } = await startGeneration("Gateway before the migration");

    await runWorker();

    expect((await readJob(job.id))?.status).toBe("completed");
    expect(draftTitles(mirror)).toEqual(["Article for Gateway before the migration"]);
    expect(gatewayActions.filter((action) => ["complete_job", "upsert_draft"].includes(action))).toEqual(["complete_job", "upsert_draft"]);
    expect(mirror.completionWrites).toEqual(["update"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("without the database deadline guard"));
  });

  test("other completion failures are not mistaken for an old gateway", async () => {
    const { mirror } = await useStore("gateway", (action) =>
      action === "complete_job" ? Response.json({ ok: false, error: "Invalid gateway request." }, { status: 400 }) : undefined,
    );
    const { job, runWorker } = await startGeneration("Rejected request");

    await runWorker();

    const final = await readJob(job.id);
    expect(final?.status).toBe("failed");
    expect(final?.error).toBe("Invalid gateway request.");
    expect(draftTitles(mirror)).toEqual([]);
    expect(mirror.completionWrites).toEqual([]);
  });
});

describe("aio-store complete_job", () => {
  async function completionRequest(mirror: StoreMirror, { createdMinutesAgo, expectedRevision }: { createdMinutesAgo: number; expectedRevision?: string }) {
    const createdAt = new Date(Date.now() - createdMinutesAgo * 60 * 1000).toISOString();
    const stored = { ...createCompletedGenerationJob(), id: "c4a1d7e2-3b5f-4a69-8d0e-7f1a2b3c4d5e", status: "running" as const, createdAt, updatedAt: createdAt };
    mirror.seedJob(stored);
    const draft = createSampleDraft({ id: "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b", images: [] });
    const { draftSaveRows } = await import("@/lib/server/drafts");
    const { draftRow, imageRows } = draftSaveRows(draft);
    const { callSupabaseGateway } = await import("@/lib/server/supabase-gateway");
    return callSupabaseGateway("complete_job", {
      job: { ...stored, status: "completed", draft, draftId: draft.id, updatedAt: new Date().toISOString() },
      expectedUpdatedAt: expectedRevision ?? createdAt,
      row: draftRow,
      images: imageRows,
    });
  }

  test("answers a completion past the deadline with the message the app maps to a stopped job", async () => {
    const { mirror } = await useStore("gateway");
    const { GATEWAY_JOB_NOT_ACTIVE_MESSAGE } = await import("@/lib/server/generation-jobs");

    await expect(completionRequest(mirror, { createdMinutesAgo: 6.5 })).rejects.toMatchObject({
      status: 409,
      message: GATEWAY_JOB_NOT_ACTIVE_MESSAGE,
    });
    expect(draftTitles(mirror)).toEqual([]);
    expect(mirror.completionWrites).toEqual([]);
  });

  test("answers a stale job revision with a conflict the app retries", async () => {
    const { mirror } = await useStore("gateway");
    const { GATEWAY_JOB_NOT_ACTIVE_MESSAGE } = await import("@/lib/server/generation-jobs");

    const rejected = completionRequest(mirror, { createdMinutesAgo: 1, expectedRevision: "2026-11-17T08:00:00.000Z" });
    await expect(rejected).rejects.toMatchObject({ status: 409 });
    await expect(rejected).rejects.not.toMatchObject({ message: GATEWAY_JOB_NOT_ACTIVE_MESSAGE });
    expect(draftTitles(mirror)).toEqual([]);
  });

  test("rejects a request without image rows and writes nothing", async () => {
    const { mirror } = await useStore("gateway");
    const job = { ...createCompletedGenerationJob(), id: "0b9f3a52-6c1d-4e7f-9a8b-1c2d3e4f5a6b" };
    mirror.seedJob({ ...job, status: "running", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const { callSupabaseGateway } = await import("@/lib/server/supabase-gateway");
    const { draftSaveRows } = await import("@/lib/server/drafts");

    await expect(callSupabaseGateway("complete_job", {
      job,
      expectedUpdatedAt: new Date().toISOString(),
      row: draftSaveRows(job.draft!).draftRow,
    })).rejects.toMatchObject({ status: 400, message: "images is required." });
    expect(mirror.rpcCalls).toEqual([]);
    expect(mirror.tables.article_inputs.get(job.id)?.input_payload).toMatchObject({ status: "running" });
  });
});

describe("guarded generation completion (local development store)", () => {
  async function seedRunningJob() {
    const jobs = await import("@/lib/server/generation-jobs");
    const created = await jobs.createGenerationJob({ inputPayload: sampleFormPayload });
    await jobs.updateGenerationJob(created.id, (job) => ({ ...job, status: "running", startedAt: new Date().toISOString() }));
    return { jobs, job: created };
  }

  function completion(draft: ArticleDraft) {
    return (job: GenerationJob): GenerationJob => ({ ...job, status: "completed", draft, draftId: draft.id });
  }

  async function storedDrafts() {
    try {
      return JSON.parse(await readFile(path.join(tempDir, "drafts.json"), "utf8")) as Record<string, ArticleDraft>;
    } catch {
      return {};
    }
  }

  test("a completion that reaches the store after the deadline writes nothing", async () => {
    const { jobs, job } = await seedRunningJob();
    const draft = createSampleDraft({ id: "local-late-draft" });

    await expect(jobs.completeGenerationJob(job.id, draft, (current) => {
      // Everything up to here was on time; the write itself only happens 7 minutes later.
      vi.setSystemTime(Date.now() + 7 * 60 * 1000);
      return completion(draft)(current);
    })).rejects.toMatchObject({ status: 409, message: expect.stringContaining(DEADLINE_MESSAGE) });

    expect((await jobs.getGenerationJob(job.id))?.status).toBe("running");
    expect(await storedDrafts()).toEqual({});
  });

  test("a job written after the completion read it is re-read before the completion is stored", async () => {
    const { jobs, job } = await seedRunningJob();
    const draft = createSampleDraft({ id: "local-retried-draft" });
    let attempts = 0;

    const completed = await jobs.completeGenerationJob(job.id, draft, (current) => {
      attempts += 1;
      // Another write reaches the job store first, between this read and the completion.
      if (attempts === 1) void jobs.saveGenerationJob({ ...current, error: "written in between", updatedAt: new Date(Date.now() + 5).toISOString() });
      return completion(draft)(current);
    });

    expect(attempts).toBe(2);
    expect(completed.status).toBe("completed");
    expect((await jobs.getGenerationJob(job.id))).toMatchObject({ status: "completed", draftId: draft.id, error: "written in between" });
    expect(Object.keys(await storedDrafts())).toEqual([draft.id]);
  });

  test("a job that is no longer running is not completed", async () => {
    const { jobs, job } = await seedRunningJob();
    await jobs.cancelGenerationJob(job.id);
    const draft = createSampleDraft({ id: "local-canceled-draft" });

    await expect(jobs.completeGenerationJob(job.id, draft, completion(draft))).rejects.toMatchObject({ status: 409 });
    expect((await jobs.getGenerationJob(job.id))?.status).toBe("canceled");
    expect(await storedDrafts()).toEqual({});
  });
});

function draftRequest(route: "save-draft" | "approve-draft", draft: ArticleDraft) {
  return new Request(`http://localhost/api/${route}`, {
    method: "POST",
    body: JSON.stringify(route === "approve-draft" ? { draftId: draft.id, draft } : { draft }),
  });
}
