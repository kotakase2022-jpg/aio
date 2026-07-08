import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sampleFormPayload } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";

let tempDir = "";
const processEnvSnapshot = snapshotProcessEnv();

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-job-tests-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.VERCEL = "";
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
});

describe("generation job cancellation and restoration", () => {
  test("cancel route persists canceled state and active guard rejects it after reload", async () => {
    const { createGenerationJob, assertGenerationJobActive } = await import(
      "@/lib/server/generation-jobs"
    );
    const { POST: cancelPost } = await import("@/app/api/generation-jobs/[id]/cancel/route");
    const { GET: getJob } = await import("@/app/api/generation-jobs/[id]/route");
    const job = await createGenerationJob({ inputPayload: sampleFormPayload });

    const cancelResponse = await cancelPost(new Request("http://localhost"), {
      params: Promise.resolve({ id: job.id }),
    });
    const cancelJson = await cancelResponse.json();
    const getResponse = await getJob(new Request("http://localhost"), {
      params: Promise.resolve({ id: job.id }),
    });
    const getJson = await getResponse.json();

    expect(cancelResponse.status).toBe(200);
    expect(cancelJson.job.status).toBe("canceled");
    expect(getJson.job.status).toBe("canceled");
    await expect(assertGenerationJobActive(job.id)).rejects.toMatchObject({
      message: "記事作成は停止済みです。",
      status: 409,
    });

    vi.resetModules();
    const { getGenerationJob } = await import("@/lib/server/generation-jobs");
    const reloaded = await getGenerationJob(job.id);
    expect(reloaded?.status).toBe("canceled");
  });

  test("runner does not resurrect a job canceled before background work starts", async () => {
    const { createGenerationJob, cancelGenerationJob, getGenerationJob } = await import(
      "@/lib/server/generation-jobs"
    );
    const { runArticleGenerationJob } = await import("@/lib/server/article-generation-job-runner");
    const job = await createGenerationJob({ inputPayload: sampleFormPayload });

    await cancelGenerationJob(job.id);
    await runArticleGenerationJob(job.id);

    const current = await getGenerationJob(job.id);
    expect(current?.status).toBe("canceled");
    expect(current?.draft).toBeUndefined();
    expect(current?.startedAt).toBeUndefined();
  });
});

describe("generation job persistence with Supabase", () => {
  test("returns Japanese errors when Supabase job saving fails", async () => {
    mockSupabaseClient({
      from: vi.fn(() => ({
        upsert: vi.fn(async () => ({ error: { message: "job upsert failed" } })),
      })),
    });
    const { createGenerationJob } = await import("@/lib/server/generation-jobs");

    await expect(createGenerationJob({ inputPayload: sampleFormPayload })).rejects.toMatchObject({
      message: "生成ジョブの保存に失敗しました。",
      detail: "job upsert failed",
      status: 500,
    });
  });

  test("returns Japanese errors when Supabase job loading fails", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: { message: "job select failed" },
    }));
    mockSupabaseClient({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      })),
    });
    const { getGenerationJob } = await import("@/lib/server/generation-jobs");

    await expect(getGenerationJob("job-load-failure")).rejects.toMatchObject({
      message: "生成ジョブの読み込みに失敗しました。",
      detail: "job select failed",
      status: 500,
    });
  });

  test("returns Japanese errors when Supabase generation log loading fails", async () => {
    const limit = vi.fn(async () => ({
      data: null,
      error: { message: "job log select failed" },
    }));
    mockSupabaseClient({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({ limit })),
        })),
      })),
    });
    const { listGenerationLogs } = await import("@/lib/server/generation-jobs");

    await expect(listGenerationLogs()).rejects.toMatchObject({
      message: "生成ログの読み込みに失敗しました。",
      detail: "job log select failed",
      status: 500,
    });
  });
});

function mockSupabaseClient(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/server/supabase", () => ({
    assertDurableStorageConfigured: vi.fn(),
    getSupabaseAdmin: vi.fn(() => client),
  }));
  vi.doMock("@/lib/server/supabase-gateway", () => ({
    callSupabaseGateway: vi.fn(),
    isSupabaseGatewayConfigured: vi.fn(() => false),
  }));
}
