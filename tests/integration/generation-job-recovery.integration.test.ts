import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { GenerationJob } from "@/types/aio";
import { sampleFormPayload } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => null),
  assertDurableStorageConfigured: vi.fn(),
}));
vi.mock("@/lib/server/supabase-gateway", () => ({
  isSupabaseGatewayConfigured: vi.fn(() => false),
  callSupabaseGateway: vi.fn(),
}));

const now = "2026-11-09T12:06:00.000Z";
const expiredAt = "2026-11-09T12:00:00.000Z";
const processEnvSnapshot = snapshotProcessEnv();
let tempDir = "";

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-job-recovery-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.VERCEL = "";
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
});

async function seedJob(overrides: Partial<GenerationJob> = {}) {
  const jobs = await import("@/lib/server/generation-jobs");
  const created = await jobs.createGenerationJob({ inputPayload: sampleFormPayload });
  const job: GenerationJob = {
    ...created,
    status: "running",
    createdAt: expiredAt,
    startedAt: expiredAt,
    steps: created.steps.map((step, index) => ({
      ...step,
      status: index === 0 ? "done" : index === 1 ? "running" : "pending",
    })),
    ...overrides,
  };
  await jobs.saveGenerationJob(job);
  return job;
}

async function getStatus(id: string) {
  const { GET } = await import("@/app/api/generation-jobs/[id]/route");
  return GET(new Request(`http://localhost/api/generation-jobs/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("generation job status recovery", () => {
  test.each(["queued", "running"] as const)("expires %s at six minutes despite a recent updatedAt", async (status) => {
    const jobs = await import("@/lib/server/generation-jobs");
    const job = await seedJob({ status, startedAt: status === "running" ? expiredAt : undefined });

    const response = await getStatus(job.id);
    const { job: recovered } = await response.json();
    expect(response.status).toBe(200);
    expect(recovered.status).toBe("failed");
    expect(recovered.completedAt).toBe(now);
    expect(recovered.error).toContain("制限時間");
    expect(recovered.error).toContain("もう一度「AIによる記事作成」");
    expect(recovered.steps[0]).toEqual(job.steps[0]);
    expect(recovered.steps[1]).toMatchObject({ status: "error", detail: recovered.error });
    expect(recovered.steps[2]).toEqual(job.steps[2]);
    await expect(jobs.getGenerationJob(job.id)).resolves.toEqual(recovered);
    expect((await (await getStatus(job.id)).json()).job).toEqual(recovered);
  });

  test.each(["queued", "running"] as const)("keeps %s active until the six-minute boundary", async (status) => {
    const recent = "2026-11-09T12:00:00.001Z";
    const job = await seedJob({
      status,
      createdAt: status === "queued" ? recent : "2026-11-09T11:00:00.000Z",
      startedAt: status === "running" ? recent : undefined,
    });
    const response = await getStatus(job.id);
    expect(response.status).toBe(200);
    expect((await response.json()).job).toEqual(job);
  });

  test.each([undefined, "invalid-date"])("falls back to createdAt when startedAt is %s", async (startedAt) => {
    const job = await seedJob({ startedAt });
    expect((await (await getStatus(job.id)).json()).job.status).toBe("failed");
  });

  test.each(["completed", "canceled", "failed"] as const)("does not rewrite a stale %s job", async (status) => {
    const jobs = await import("@/lib/server/generation-jobs");
    const job = await seedJob({ status, completedAt: expiredAt, error: "Original result" });
    expect((await (await getStatus(job.id)).json()).job).toEqual(job);
    await expect(jobs.getGenerationJob(job.id)).resolves.toEqual(job);
  });

  test("generic reads do not expire old fixtures or mutate job state", async () => {
    const jobs = await import("@/lib/server/generation-jobs");
    const job = await seedJob();
    await expect(jobs.getGenerationJob(job.id)).resolves.toEqual(job);
    await expect(jobs.listGenerationJobs()).resolves.toEqual([job]);
  });

  test("keeps missing-job GET semantics", async () => {
    const response = await getStatus("missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  test.each(["running", "completed", "failed"] as const)("cannot replace failed recovery with late worker %s", async (status) => {
    const jobs = await import("@/lib/server/generation-jobs");
    const failed = await seedJob({ status: "failed", completedAt: now, error: "Recovery result" });
    const result = await jobs.updateGenerationJob(failed.id, (current) => ({
      ...current,
      status,
      error: "Late worker result",
      completedAt: "2026-11-09T12:07:00.000Z",
    }));
    expect(result).toEqual(failed);
    await jobs.updateGenerationStep(failed.id, "fetch_competitors", "done");
    await expect(jobs.getGenerationJob(failed.id)).resolves.toEqual(failed);
  });

  test.each(["running", "failed", "canceled"] as const)("cannot change completed to %s", async (status) => {
    const jobs = await import("@/lib/server/generation-jobs");
    const completed = await seedJob({ status: "completed", completedAt: now });
    await expect(jobs.updateGenerationJob(completed.id, (current) => ({ ...current, status }))).resolves.toEqual(completed);
    await expect(jobs.getGenerationJob(completed.id)).resolves.toEqual(completed);
  });

  test.each(["failed", "completed"] as const)("active guard rejects %s jobs", async (status) => {
    const jobs = await import("@/lib/server/generation-jobs");
    const job = await seedJob({ status });
    await expect(jobs.assertGenerationJobActive(job.id)).rejects.toMatchObject({ status: 409 });
  });

  test.each(["completed", "canceled", "failed"] as const)("CAS recovery preserves a concurrent %s result", async (status) => {
    const jobs = await import("@/lib/server/generation-jobs");
    const job = await seedJob();
    const store = await mockCasStore(job);
    const terminal = { ...job, status, completedAt: now, error: "Concurrent result" };
    store.beforeNextWrite(() => store.replace(terminal));

    const response = await getStatus(job.id);
    const { job: result } = await response.json();
    expect(response.status).toBe(200);
    expect(result).toMatchObject({ status, error: "Concurrent result", completedAt: now });
    await expect(jobs.getGenerationJob(job.id)).resolves.toEqual(result);
    expect(store.revisions[0]).toBe("2026-11-09T12:00:00.123456+00:00");
  });

  test("CAS rejects a late completion already in flight when GET recovers the job", async () => {
    const jobs = await import("@/lib/server/generation-jobs");
    const job = await seedJob();
    const store = await mockCasStore(job);
    store.beforeNextWrite(async () => {
      expect((await getStatus(job.id)).status).toBe(200);
    });

    const result = await jobs.updateGenerationJob(job.id, (current) => ({
      ...current,
      status: "completed",
      completedAt: now,
    }));
    expect(result.status).toBe("failed");
    expect(result.error).toContain("制限時間");
    await expect(jobs.getGenerationJob(job.id)).resolves.toEqual(result);
  });
});

async function mockCasStore(job: GenerationJob) {
  const { getSupabaseAdmin } = await import("@/lib/server/supabase");
  let stored = structuredClone(job);
  let revision = "2026-11-09T12:00:00.123456+00:00";
  let beforeWrite: (() => void | Promise<void>) | undefined;
  const revisions: string[] = [];
  vi.mocked(getSupabaseAdmin).mockReturnValue({ from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { input_payload: structuredClone(stored), updated_at: revision }, error: null,
    }) }) }),
    update: (row: { input_payload: GenerationJob; updated_at: string }) => {
      let expected: string;
      const query = {
        eq: (key: string, value: string) => {
          if (key === "updated_at") expected = value;
          return query;
        },
        select: () => ({ maybeSingle: async () => {
          revisions.push(expected);
          const hook = beforeWrite;
          beforeWrite = undefined;
          await hook?.();
          if (expected !== revision) return { data: null, error: null };
          stored = structuredClone(row.input_payload);
          revision = row.updated_at;
          return { data: { id: stored.id }, error: null };
        } }),
      };
      return query;
    },
  }) } as unknown as ReturnType<typeof getSupabaseAdmin>);
  return {
    revisions,
    beforeNextWrite: (hook: () => void | Promise<void>) => { beforeWrite = hook; },
    replace: (next: GenerationJob) => {
      stored = structuredClone(next);
      revision = now;
    },
  };
}
