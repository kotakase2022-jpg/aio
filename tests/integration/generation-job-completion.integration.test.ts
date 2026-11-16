import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCompletedGenerationJob, createSampleDraft, sampleArticleResult, sampleFormPayload } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import type { ArticleDraft, GenerationJob } from "@/types/aio";

const persistedJobSnapshots: GenerationJob[] = [];
const polledJobs: GenerationJob[] = [];
const canonicalDrafts = new Map<string, ArticleDraft>();
let pollAfterEachJobWrite = false;

vi.mock("@/lib/server/content", () => ({ fetchUrlContent: vi.fn() }));
vi.mock("@/lib/server/article-generation", () => ({ generateAioArticle: vi.fn() }));
vi.mock("@/lib/server/article-images", () => ({ createArticleImagesForDraft: vi.fn() }));
vi.mock("@/lib/server/drafts", () => ({
  saveDraft: vi.fn(async (draft: ArticleDraft) => {
    canonicalDrafts.set(draft.id, structuredClone(draft));
    return { draft, storageMode: "local" as const };
  }),
  getDraft: vi.fn(async (id: string) => structuredClone(canonicalDrafts.get(id) ?? null)),
}));
vi.mock("@/lib/server/local-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/local-store")>();
  return {
    ...actual,
    writeLocalJson: vi.fn(async (filename: string, value: unknown) => {
      await actual.writeLocalJson(filename, value);
      if (!filename.endsWith("generation-jobs.json")) return;
      const jobs = Object.values(value as Record<string, GenerationJob>);
      persistedJobSnapshots.push(...jobs.map((job) => structuredClone(job)));
      if (!pollAfterEachJobWrite) return;
      // Simulate the browser polling immediately after this storage write is visible.
      const { GET } = await import("@/app/api/generation-jobs/[id]/route");
      for (const job of jobs) {
        const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: job.id }) });
        const json = (await response.json()) as { job: GenerationJob };
        polledJobs.push(json.job);
      }
    }),
  };
});

let tempDir = "";
const processEnvSnapshot = snapshotProcessEnv();

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-job-completion-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.VERCEL = "";
  persistedJobSnapshots.length = 0;
  polledJobs.length = 0;
  canonicalDrafts.clear();
  pollAfterEachJobWrite = false;
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
});

describe("generation job completion visibility", () => {
  test("a poll never observes a completed job whose draft-save step is still running", async () => {
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");
    const { createGenerationJob, getGenerationJob } = await import("@/lib/server/generation-jobs");
    const { runArticleGenerationJob } = await import("@/lib/server/article-generation-job-runner");
    vi.mocked(generateAioArticle).mockResolvedValueOnce(sampleArticleResult);
    vi.mocked(createArticleImagesForDraft).mockResolvedValueOnce([]);
    const job = await createGenerationJob({
      inputPayload: { ...sampleFormPayload, references: [{ id: "manual", text: "Manual evidence" }], imageCount: 0 },
    });
    pollAfterEachJobWrite = true;

    await runArticleGenerationJob(job.id);

    const completedWrites = persistedJobSnapshots.filter((snapshot) => snapshot.status === "completed");
    const completedPolls = polledJobs.filter((polled) => polled.status === "completed");
    expect(completedWrites.length).toBeGreaterThan(0);
    expect(completedPolls.length).toBeGreaterThan(0);
    for (const observed of [...completedWrites, ...completedPolls]) {
      expect(observed.steps.filter((step) => step.status !== "done")).toEqual([]);
      expect(observed.steps.find((step) => step.id === "save")).toMatchObject({ status: "done", detail: "ドラフトを保存しました" });
    }
    const final = await getGenerationJob(job.id);
    expect(final?.status).toBe("completed");
    expect(final?.draftId).toBeTruthy();
    expect(canonicalDrafts.get(final!.draftId!)?.editedTitle).toBe(sampleArticleResult.selected_title);
  });

  test("a worker that runs past the job deadline stops without saving an article", async () => {
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");
    const { saveDraft } = await import("@/lib/server/drafts");
    const { createGenerationJob, getGenerationJob } = await import("@/lib/server/generation-jobs");
    const { runArticleGenerationJob } = await import("@/lib/server/article-generation-job-runner");
    // Outside Vercel nothing ends the request at 300 s; here the model call alone takes 7 minutes.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.mocked(generateAioArticle).mockImplementationOnce(async () => {
        vi.setSystemTime(Date.now() + 7 * 60 * 1000);
        return sampleArticleResult;
      });
      vi.mocked(createArticleImagesForDraft).mockResolvedValueOnce([]);
      const job = await createGenerationJob({
        inputPayload: { ...sampleFormPayload, references: [{ id: "manual", text: "Manual evidence" }], imageCount: 0 },
      });

      await runArticleGenerationJob(job.id);

      const final = await getGenerationJob(job.id);
      expect(final?.status).toBe("failed");
      expect(final?.error).toContain("記事生成が制限時間を超えたため停止しました");
      expect(final?.draftId).toBeUndefined();
      expect(vi.mocked(saveDraft)).not.toHaveBeenCalled();
      expect(canonicalDrafts.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a completed job whose save step was left running is shown as saved only when the article is stored", async () => {
    const { saveGenerationJob } = await import("@/lib/server/generation-jobs");
    const { GET } = await import("@/app/api/generation-jobs/[id]/route");
    const stored = createCompletedGenerationJob();
    stored.id = "job-legacy-save-running";
    stored.steps = [
      { id: "images", label: "画像生成または反映", status: "done", detail: "0枚を反映" },
      { id: "save", label: "ドラフト保存", status: "running" },
    ];
    const canonical = createSampleDraft({ id: stored.draftId, editedTitle: "Stored canonical title", updatedAt: "2026-11-13T04:05:31.123Z" });
    canonicalDrafts.set(canonical.id, canonical);
    await saveGenerationJob(stored);

    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: stored.id }) });
    const json = (await response.json()) as { job: GenerationJob };

    expect(response.status).toBe(200);
    expect(json.job.draft?.editedTitle).toBe("Stored canonical title");
    expect(json.job.steps.find((step) => step.id === "save")).toMatchObject({ status: "done", detail: "ドラフトを保存しました" });
    expect(json.job.steps.find((step) => step.id === "images")).toMatchObject({ status: "done", detail: "0枚を反映" });
  });

  test("a completed job without a readable stored article is not shown as saved", async () => {
    const { saveGenerationJob, getGenerationJob } = await import("@/lib/server/generation-jobs");
    const { GET } = await import("@/app/api/generation-jobs/[id]/route");
    const stored = createCompletedGenerationJob();
    stored.id = "job-legacy-save-unconfirmed";
    stored.steps = [{ id: "save", label: "ドラフト保存", status: "running" }];
    await saveGenerationJob(stored);

    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: stored.id }) });
    const json = (await response.json()) as { job: GenerationJob };
    const save = json.job.steps.find((step) => step.id === "save");

    expect(save?.status).toBe("error");
    expect(save?.detail).toContain("保存された記事本体を確認できませんでした");
    // The read-time presentation never rewrites the stored record.
    const reread = await getGenerationJob(stored.id);
    expect(reread?.steps.find((step) => step.id === "save")?.status).toBe("running");
  });
});
