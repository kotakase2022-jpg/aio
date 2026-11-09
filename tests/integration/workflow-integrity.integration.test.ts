import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft, sampleFormPayload } from "../fixtures/article";
import type { GenerationJob } from "@/types/aio";

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => null),
  assertDurableStorageConfigured: vi.fn(),
}));
vi.mock("@/lib/server/supabase-gateway", () => ({
  isSupabaseGatewayConfigured: vi.fn(() => false),
  callSupabaseGateway: vi.fn(),
}));
vi.mock("@/lib/server/safe-http", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/safe-http")>(),
  safeFetch: vi.fn(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: vi.fn(),
}));

let directory: string;
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  directory = await mkdtemp(path.join(os.tmpdir(), "aio-integrity-"));
  process.env.AIO_LOCAL_DATA_DIR = directory;
});
afterEach(async () => {
  delete process.env.AIO_LOCAL_DATA_DIR;
  await rm(directory, { recursive: true, force: true });
});

describe("workflow integrity regressions", () => {
  test("a failed image write cannot commit the draft body or approval", async () => {
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    let committed = false;
    const rpc = vi.fn(async () => ({ error: { message: "image write failed" } }));
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      rpc,
      from: (table: string) => ({ upsert: async () => {
        if (table === "article_drafts") committed = true;
        return { error: table === "article_images" ? { message: "image write failed" } : null };
      } }),
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    const { saveDraft } = await import("@/lib/server/drafts");
    await expect(saveDraft(createSampleDraft({ status: "approved" }))).rejects.toThrow();
    expect(committed).toBe(false);
    expect(rpc).toHaveBeenCalledWith("aio_save_draft", expect.objectContaining({
      draft_row: expect.objectContaining({ status: "approved" }),
      image_rows: expect.arrayContaining([expect.objectContaining({ id: "img-1" })]),
    }));
  });

  test.each(["save-draft", "approve-draft"])("%s reports a committed write despite log-sync failure", async (route) => {
    const jobs = await import("@/lib/server/generation-jobs");
    vi.spyOn(jobs, "syncGenerationJobDraft").mockRejectedValueOnce(new Error("log store unavailable"));
    const { POST } = route === "save-draft"
      ? await import("@/app/api/save-draft/route")
      : await import("@/app/api/approve-draft/route");
    const draft = createSampleDraft();
    const response = await POST(new Request(`http://localhost/api/${route}`, {
      method: "POST", body: JSON.stringify({ draft }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.warnings).toEqual([expect.stringContaining("log store unavailable")]);
    const { getDraft } = await import("@/lib/server/drafts");
    expect((await getDraft(draft.id))?.status).toBe(route === "approve-draft" ? "approved" : "draft");
  });

  test("rejects malformed job arrays before persisting a job", async () => {
    const { POST } = await import("@/app/api/generation-jobs/route");
    const response = await POST(new Request("http://localhost/api/generation-jobs", {
      method: "POST", body: JSON.stringify({ form: { ...sampleFormPayload, competitors: null } }),
    }));
    expect(response.status).toBe(400);
    const { listGenerationLogs } = await import("@/lib/server/generation-jobs");
    await expect(listGenerationLogs()).resolves.toEqual([]);
  });

  test("accepted cancellation wins over a delayed worker write", async () => {
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    let stored: GenerationJob;
    let pause = false;
    const reached = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const persist = async (row: { input_payload: GenerationJob }, expected?: string) => {
      if (pause) { pause = false; reached.resolve(); await release.promise; }
      if (expected && stored.updatedAt !== expected) return { data: null, error: null };
      stored = structuredClone(row.input_payload);
      return { data: { id: stored.id }, error: null };
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: () => ({
      upsert: (row: { input_payload: GenerationJob }) => persist(row),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { input_payload: structuredClone(stored) }, error: null }) }) }),
      update: (row: { input_payload: GenerationJob }) => {
        let expected: string | undefined;
        const query = {
          eq: (key: string, value: string) => { if (key === "updated_at") expected = value; return query; },
          select: () => ({ maybeSingle: () => persist(row, expected) }),
        };
        return query;
      },
    }) } as unknown as ReturnType<typeof getSupabaseAdmin>);
    const jobs = await import("@/lib/server/generation-jobs");
    const job = await jobs.createGenerationJob({ inputPayload: sampleFormPayload });
    await jobs.updateGenerationJob(job.id, (current) => ({ ...current, status: "running" }));
    pause = true;
    const worker = jobs.updateGenerationStep(job.id, "images", "done");
    await reached.promise;
    await jobs.cancelGenerationJob(job.id);
    release.resolve();
    await worker;
    expect((await jobs.getGenerationJob(job.id))?.status).toBe("canceled");
    await expect(jobs.assertGenerationJobActive(job.id)).rejects.toMatchObject({ status: 409 });
  });

  test("job compare-and-swap uses the raw database timestamp including fractional precision", async () => {
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    const { createCompletedGenerationJob } = await import("../fixtures/article");
    const job = { ...createCompletedGenerationJob(), status: "running" as const };
    const rawTimestamp = "2026-11-09T10:00:00.123456+00:00";
    const filters: Array<[string, string]> = [];
    const query = {
      eq: (key: string, value: string) => { filters.push([key, value]); return query; },
      select: () => ({ maybeSingle: async () => ({ data: { id: job.id }, error: null }) }),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { input_payload: job, updated_at: rawTimestamp }, error: null }) }) }),
      update: () => query,
    }) } as unknown as ReturnType<typeof getSupabaseAdmin>);
    const jobs = await import("@/lib/server/generation-jobs");
    await jobs.updateGenerationStep(job.id, "save", "done");
    expect(filters).toContainEqual(["updated_at", rawTimestamp]);
  });

  test("a confirmed WordPress post returns a warning when receipt persistence fails and still blocks retry", async () => {
    const { safeFetch } = await import("@/lib/server/safe-http");
    vi.mocked(safeFetch).mockResolvedValue(new Response(JSON.stringify({ id: 123, link: "https://wordpress.example.com/confirmed" }), { status: 201 }));
    const receipts = await import("@/lib/server/wordpress-posts");
    vi.spyOn(receipts, "finishWordpressPost").mockRejectedValueOnce(new Error("receipt store unavailable"));
    const wordpress = await import("@/lib/server/wordpress");
    const connection = await wordpress.saveWordpressConnection({ siteUrl: "https://wordpress.example.com", username: "test", applicationPassword: "test-only" });
    const args = { draft: createSampleDraft({ status: "approved", images: [], tags: [], categories: [] }), connectionId: connection.id, status: "publish" as const, origin: "https://app.example.com" };
    const result = await wordpress.publishDraftToWordpress(args);
    expect(result.postUrl).toBe("https://wordpress.example.com/confirmed");
    expect(result.warnings).toEqual([expect.stringContaining("receipt store unavailable")]);
    await expect(wordpress.publishDraftToWordpress(args)).rejects.toMatchObject({ status: 409 });
    expect(safeFetch).toHaveBeenCalledTimes(1);
  });

  test.each(["timeout", "server-error"])("an ambiguous WordPress %s retains the reservation and blocks another remote POST", async (failure) => {
    const { safeFetch } = await import("@/lib/server/safe-http");
    if (failure === "timeout") {
      vi.mocked(safeFetch).mockRejectedValue(new Error("response lost after remote commit"));
    } else {
      vi.mocked(safeFetch).mockResolvedValue(Response.json({ message: "post hook failed" }, { status: 503 }));
    }
    const wordpress = await import("@/lib/server/wordpress");
    const connection = await wordpress.saveWordpressConnection({ siteUrl: "https://wordpress.example.com", username: "test", applicationPassword: "test-only" });
    const args = { draft: createSampleDraft({ status: "approved", images: [], tags: [], categories: [] }), connectionId: connection.id, status: "publish" as const, origin: "https://app.example.com" };
    await expect(wordpress.publishDraftToWordpress(args)).rejects.toMatchObject({ status: 502, message: expect.stringContaining("不明") });
    await expect(wordpress.publishDraftToWordpress(args)).rejects.toMatchObject({ status: 409 });
    expect(safeFetch).toHaveBeenCalledTimes(1);
  });

  test("WordPress retry cannot duplicate a successful remote post after local save failure", async () => {
    const drafts = await import("@/lib/server/drafts");
    const draft = createSampleDraft({ status: "approved", images: [], tags: [], categories: [] });
    await drafts.saveDraft(draft);
    const { safeFetch } = await import("@/lib/server/safe-http");
    vi.mocked(safeFetch).mockResolvedValue(new Response(JSON.stringify({ id: 123, link: "https://wordpress.example.com/post" }), { status: 201 }));
    const wordpress = await import("@/lib/server/wordpress");
    const connection = await wordpress.saveWordpressConnection({ siteUrl: "https://wordpress.example.com", username: "test", applicationPassword: "test-only" });
    vi.spyOn(drafts, "saveDraft").mockRejectedValueOnce(new Error("draft write failed"));
    const args = { draft, connectionId: connection.id, status: "publish" as const, origin: "https://app.example.com" };
    await expect(wordpress.publishDraftToWordpress(args)).resolves.toMatchObject({ postUrl: "https://wordpress.example.com/post" });
    await wordpress.publishDraftToWordpress(args).catch(() => undefined);
    expect(safeFetch).toHaveBeenCalledTimes(1);
  });
});
