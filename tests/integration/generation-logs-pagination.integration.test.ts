import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCompletedGenerationJob, createSampleDraft } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import type { ArticleDraft, GenerationJob, GenerationLogPage } from "@/types/aio";

let tempDir = "";
const processEnvSnapshot = snapshotProcessEnv();
const baseTime = Date.UTC(2026, 9, 1, 0, 0, 0);

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-log-pages-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.VERCEL = "";
  vi.resetModules();
});

afterEach(async () => {
  vi.doUnmock("@/lib/server/supabase");
  vi.doUnmock("@/lib/server/supabase-gateway");
  await rm(tempDir, { recursive: true, force: true });
  restoreProcessEnv(processEnvSnapshot);
});

describe("generation log pages (local durable store)", () => {
  test("reaches every one of 41 jobs through stable creation-order pages without duplicates or gaps", async () => {
    const seeded = await seedLocalJobs(41);

    const pages = await readAllPages();

    expect(pages.map((page) => page.logs.length)).toEqual([20, 20, 1]);
    expect(pages.slice(0, 2).every((page) => typeof page.nextCursor === "string")).toBe(true);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(pages.every((page) => page.complete)).toBe(true);
    const listedIds = pages.flatMap((page) => page.logs.map((log) => log.id));
    expect(new Set(listedIds).size).toBe(41);
    // Newest creation first; recently updated old jobs must not jump between pages.
    expect(listedIds).toEqual(newestCreatedFirst(seeded).map((job) => job.id));
    expect(pages[2].logs[0]).toMatchObject({ id: "job-page-00", outputTitle: "Archived article 00", draftStatus: "draft" });
    expect(pages[2].logs[0].wordpressPostStatus).toBeUndefined();
  });

  test.each([
    { count: 0, label: "0", sizes: [0] },
    { count: 20, label: "20", sizes: [20] },
    { count: 21, label: "21", sizes: [20, 1] },
  ])("handles the $label-job boundary without a false next page", async ({ count, sizes }) => {
    await seedLocalJobs(count);

    const pages = await readAllPages();

    expect(pages.map((page) => page.logs.length)).toEqual(sizes);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(pages.slice(0, -1).every((page) => typeof page.nextCursor === "string")).toBe(true);
  });

  test("an unposted article from a later page keeps its ID, edits, structure and modes after save and reload", async () => {
    await seedLocalJobs(25);
    const { GET: getJob } = await import("@/app/api/generation-jobs/[id]/route");
    const { POST: saveDraftRoute } = await import("@/app/api/save-draft/route");
    const secondPage = (await readAllPages())[1];
    const oldest = secondPage.logs.find((log) => log.id === "job-page-00");
    expect(oldest).toMatchObject({ draftStatus: "draft" });
    expect(oldest?.wordpressPostStatus).toBeUndefined();

    const opened = await readJob(getJob, "job-page-00");
    const edited: ArticleDraft = {
      ...opened.draft!,
      editedTitle: "Edited archived comparison article",
      editedBodyHtml: `${opened.draft!.editedBodyHtml}<p>Manual reviewer addition.</p>`,
      faqItems: [{ question: "Edited question?", answer: "Edited answer." }],
    };
    const saveResponse = await saveDraftRoute(new Request("http://localhost/api/save-draft", {
      method: "POST",
      body: JSON.stringify({ draft: edited }),
    }));
    const saved = (await saveResponse.json()) as { draft: ArticleDraft; warnings: string[] };
    const reopened = await readJob(getJob, "job-page-00");

    expect(saveResponse.status).toBe(200);
    expect(saved.warnings).toEqual([]);
    expect(reopened.draft).toMatchObject({
      id: opened.draft!.id,
      editedTitle: "Edited archived comparison article",
      faqItems: [{ question: "Edited question?", answer: "Edited answer." }],
      status: "draft",
      updatedAt: saved.draft.updatedAt,
    });
    expect(reopened.draft!.editedBodyHtml).toContain("Manual reviewer addition.");
    expect(reopened.draft!.inputPayload).toMatchObject({ articleStructure: "comparison", tableMode: "none", supplementalFaqMode: "on" });
    expect(reopened.draft!.aiResult.resolved_article_structure).toBe("comparison");
    const drafts = JSON.parse(await readFile(path.join(tempDir, "drafts.json"), "utf8")) as Record<string, ArticleDraft>;
    expect(Object.keys(drafts)).toHaveLength(25);
    const relisted = (await readAllPages()).flatMap((page) => page.logs);
    expect(relisted.filter((log) => log.id === "job-page-00")).toEqual([
      expect.objectContaining({ outputTitle: "Edited archived comparison article", draftStatus: "draft" }),
    ]);
    expect(relisted.map((log) => log.id).indexOf("job-page-00")).toBe(24);
  });

  test("saving an article between page requests does not duplicate or drop later entries", async () => {
    const seeded = await seedLocalJobs(41);
    const { GET } = await import("@/app/api/generation-logs/route");
    const { POST: saveDraftRoute } = await import("@/app/api/save-draft/route");
    const first = await readPage(GET);
    const draft = seeded.find((job) => job.id === "job-page-05")!.draft!;

    await saveDraftRoute(new Request("http://localhost/api/save-draft", {
      method: "POST",
      body: JSON.stringify({ draft: { ...draft, editedTitle: "Saved while paging" } }),
    }));
    const second = await readPage(GET, first.nextCursor);
    const third = await readPage(GET, second.nextCursor);

    const ids = [first, second, third].flatMap((page) => page.logs.map((log) => log.id));
    expect(ids).toHaveLength(41);
    expect(new Set(ids).size).toBe(41);
    // The saved job now has the newest update time, yet it stays on its creation-order page.
    expect(first.logs.some((log) => log.id === "job-page-05")).toBe(false);
    expect(second.logs.find((log) => log.id === "job-page-05")?.outputTitle).toBe("Saved while paging");
  });

  test("a refresh can reload the range already shown without exceeding the page cap", async () => {
    await seedLocalJobs(45);
    const { GET } = await import("@/app/api/generation-logs/route");

    const refreshed = await readPage(GET, null, 40);

    expect(refreshed.logs).toHaveLength(40);
    expect(typeof refreshed.nextCursor).toBe("string");
    const rest = await readPage(GET, refreshed.nextCursor);
    expect(rest.logs.map((log) => log.id)).toEqual(["job-page-04", "job-page-03", "job-page-02", "job-page-01", "job-page-00"]);
  });

  test.each([
    ["/api/generation-logs?cursor=not-a-cursor", "生成ログの続きを読み込めませんでした。"],
    [`/api/generation-logs?cursor=${Buffer.from(JSON.stringify({ c: "2026-10-01", i: "x" })).toString("base64url")}`, "生成ログの続きを読み込めませんでした。"],
    [`/api/generation-logs?cursor=${Buffer.from(JSON.stringify({ c: "2026-10-01T00:00:00.000Z", i: "x\",id.gt.0" })).toString("base64url")}`, "生成ログの続きを読み込めませんでした。"],
    ["/api/generation-logs?limit=0", "生成ログの取得件数が正しくありません。"],
    ["/api/generation-logs?limit=101", "生成ログの取得件数が正しくありません。"],
    ["/api/generation-logs?limit=20abc", "生成ログの取得件数が正しくありません。"],
  ])("rejects %s with a Japanese recovery message", async (url, message) => {
    const { GET } = await import("@/app/api/generation-logs/route");

    const response = await GET(new Request(`http://localhost${url}`));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: message });
  });

  test("the paginated logs API stays behind the existing access-code session", async () => {
    process.env.DEMO_AUTH_SECRET = "test-only-demo-session-secret-32-characters";
    const { proxy } = await import("@/proxy");
    const { createDemoSessionToken, DEMO_AUTH_COOKIE_NAME } = await import("@/lib/demo-session");
    const cursor = Buffer.from(JSON.stringify({ c: "2026-10-01T00:00:00.000Z", i: "job-page-00" })).toString("base64url");

    const anonymous = await proxy(new NextRequest(`http://localhost/api/generation-logs?cursor=${cursor}`));
    const forged = await proxy(new NextRequest(`http://localhost/api/generation-logs?cursor=${cursor}`, {
      headers: { cookie: `${DEMO_AUTH_COOKIE_NAME}=demo-access-granted` },
    }));
    const signed = await proxy(new NextRequest(`http://localhost/api/generation-logs?cursor=${cursor}`, {
      headers: { cookie: `${DEMO_AUTH_COOKIE_NAME}=${await createDemoSessionToken()}` },
    }));

    expect(anonymous.status).toBe(401);
    expect(forged.status).toBe(401);
    expect(signed.status).toBe(200);
  });
});

describe("generation log pages (Supabase gateway)", () => {
  test("a gateway without list_job_page still pages the list_jobs window and flags a possibly truncated window", async () => {
    const gatewayJobs = Array.from({ length: 30 }, (_, index) => buildJob(index));
    const { ApiError } = await import("@/lib/server/http");
    const callSupabaseGateway = mockGateway(async (action, payload) => {
      // As deployed before November 16: unknown actions are rejected with this exact message.
      if (action === "list_job_page") throw new ApiError("Unsupported gateway action.", 400);
      expect(action).toBe("list_jobs");
      expect(payload).toEqual({ limit: 100 });
      return { jobs: [...gatewayJobs].reverse() };
    });
    const { listGenerationLogsPage, decodeGenerationLogCursor } = await import("@/lib/server/generation-jobs");

    const first = await listGenerationLogsPage({});
    const second = await listGenerationLogsPage({ cursor: decodeGenerationLogCursor(first.nextCursor!) });

    // The unsupported action is asked once, then skipped for a while instead of on every page.
    expect(callSupabaseGateway.mock.calls.map(([action]) => action)).toEqual(["list_job_page", "list_jobs", "list_jobs"]);
    expect(first.logs.map((log) => log.id)).toEqual(newestCreatedFirst(gatewayJobs).slice(0, 20).map((job) => job.id));
    expect(second.logs.map((log) => log.id)).toEqual(newestCreatedFirst(gatewayJobs).slice(20).map((job) => job.id));
    expect(second.nextCursor).toBeNull();
    expect(first.complete && second.complete).toBe(true);

    callSupabaseGateway.mockResolvedValueOnce({ jobs: Array.from({ length: 100 }, (_, index) => buildJob(index)) });
    const full = await listGenerationLogsPage({});
    expect(full.complete).toBe(false);
  });

  test("list_job_page reaches all of 150 jobs one page at a time, beyond the old 100-job window", async () => {
    const gatewayJobs = Array.from({ length: 150 }, (_, index) => buildJob(index, uuidFor(index)));
    const callSupabaseGateway = mockGateway(async (action, payload) => {
      expect(action).toBe("list_job_page");
      return keysetGatewayPage(gatewayJobs, payload as { limit: number; cursor: { createdAt: string; id: string } | null });
    });
    const { listGenerationLogsPage, decodeGenerationLogCursor } = await import("@/lib/server/generation-jobs");

    const pages: GenerationLogPage[] = [];
    let cursor: string | null = null;
    do {
      const page = await listGenerationLogsPage({ cursor: cursor ? decodeGenerationLogCursor(cursor) : null });
      pages.push(page);
      cursor = page.nextCursor;
    } while (cursor && pages.length < 20);

    expect(pages.map((page) => page.logs.length)).toEqual([20, 20, 20, 20, 20, 20, 20, 10]);
    expect(pages.every((page) => page.complete)).toBe(true);
    const listed = pages.flatMap((page) => page.logs.map((log) => log.id));
    expect(listed).toEqual(newestCreatedFirst(gatewayJobs).map((job) => job.id));
    // Only one page of rows is asked for each time, never the whole window.
    expect(callSupabaseGateway.mock.calls.every(([, payload]) => (payload as { limit: number }).limit === 20)).toBe(true);
    // The created_at value of the row (database format) travels through the opaque cursor unchanged.
    expect(callSupabaseGateway.mock.calls[1][1]).toMatchObject({
      cursor: { createdAt: expect.stringMatching(/\+00:00$/), id: gatewayJobs[130].id },
    });
  });

  test("a cursor the gateway rejects is reported as an invalid continuation", async () => {
    const { ApiError } = await import("@/lib/server/http");
    mockGateway(async () => {
      throw new ApiError("Invalid cursor.", 400);
    });
    const { listGenerationLogsPage } = await import("@/lib/server/generation-jobs");

    await expect(
      listGenerationLogsPage({ cursor: { createdAt: "2026-10-01T00:00:00.000Z", id: uuidFor(1) } }),
    ).rejects.toMatchObject({ status: 400, message: "生成ログの続きを読み込めませんでした。" });
  });

  test("other gateway failures are not mistaken for an old gateway", async () => {
    const { ApiError } = await import("@/lib/server/http");
    const callSupabaseGateway = mockGateway(async () => {
      throw new ApiError("Supabase gateway request failed.", 500);
    });
    const { listGenerationLogsPage } = await import("@/lib/server/generation-jobs");

    await expect(listGenerationLogsPage({})).rejects.toMatchObject({ status: 500 });
    expect(callSupabaseGateway.mock.calls.map(([action]) => action)).toEqual(["list_job_page"]);
  });
});

function uuidFor(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

// In-memory model of aio-store list_job_page: created_at desc, id desc, limit + 1 lookahead.
function keysetGatewayPage(jobs: GenerationJob[], { limit, cursor }: { limit: number; cursor: { createdAt: string; id: string } | null }) {
  const rows = [...jobs]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.id < b.id ? 1 : -1))
    .filter((job) =>
      !cursor ||
      Date.parse(job.createdAt) < Date.parse(cursor.createdAt) ||
      (Date.parse(job.createdAt) === Date.parse(cursor.createdAt) && job.id < cursor.id),
    )
    .slice(0, limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    jobs: page,
    nextCursor: rows.length > limit && last ? { createdAt: last.createdAt.replace("Z", "+00:00"), id: last.id } : null,
  };
}

describe("generation log pages (Supabase service role)", () => {
  test("requests one extra row with a stable keyset filter", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => {
      const job = buildJob(40 - index, `00000000-0000-4000-8000-${String(40 - index).padStart(12, "0")}`);
      return { id: job.id, input_payload: job, created_at: job.createdAt.replace("Z", "+00:00"), updated_at: job.updatedAt };
    });
    const query = mockSupabaseQuery({ data: rows, error: null });
    const { listGenerationLogsPage, decodeGenerationLogCursor } = await import("@/lib/server/generation-jobs");

    const first = await listGenerationLogsPage({});
    expect(query.calls).toEqual([
      ["select", "id,input_payload,created_at,updated_at"],
      ["eq", "input_payload->>kind", "article_generation_job"],
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["limit", 21],
    ]);
    expect(first.logs).toHaveLength(20);
    const cursor = decodeGenerationLogCursor(first.nextCursor!);
    expect(cursor).toEqual({ createdAt: rows[19].created_at, id: rows[19].id });

    query.calls.length = 0;
    await listGenerationLogsPage({ cursor });
    expect(query.calls).toContainEqual([
      "or",
      `created_at.lt."${rows[19].created_at}",and(created_at.eq."${rows[19].created_at}",id.lt."${rows[19].id}")`,
    ]);
  });

  test("rejects a non-UUID cursor before it reaches the database", async () => {
    const query = mockSupabaseQuery({ data: [], error: null });
    const { listGenerationLogsPage } = await import("@/lib/server/generation-jobs");

    await expect(listGenerationLogsPage({ cursor: { createdAt: "2026-10-01T00:00:00.000Z", id: "job-page-00" } })).rejects.toMatchObject({ status: 400 });
    expect(query.calls).toEqual([]);
  });

  test("returns a Japanese error when the Supabase page query fails", async () => {
    mockSupabaseQuery({ data: null, error: { message: "job log select failed" } });
    const { listGenerationLogsPage } = await import("@/lib/server/generation-jobs");

    await expect(listGenerationLogsPage({})).rejects.toMatchObject({
      message: "生成ログの読み込みに失敗しました。",
      detail: "job log select failed",
      status: 500,
    });
  });
});

async function seedLocalJobs(count: number) {
  const { saveGenerationJob } = await import("@/lib/server/generation-jobs");
  const { saveDraft } = await import("@/lib/server/drafts");
  const jobs: GenerationJob[] = [];
  for (let index = 0; index < count; index += 1) {
    const job = buildJob(index);
    await saveDraft(job.draft!);
    await saveGenerationJob(job);
    jobs.push(job);
  }
  return jobs;
}

function buildJob(index: number, id = `job-page-${String(index).padStart(2, "0")}`): GenerationJob {
  const template = createCompletedGenerationJob();
  const createdAt = new Date(baseTime + index * 60_000).toISOString();
  // Old jobs were updated most recently, so update-time ordering would reshuffle pages.
  const updatedAt = new Date(baseTime + (1000 - index) * 60_000).toISOString();
  const inputPayload = { ...template.inputPayload, articleStructure: "comparison" as const, tableMode: "none" as const, supplementalFaqMode: "on" as const };
  const draft = createSampleDraft({
    id: `draft-${id}`,
    inputPayload,
    aiResult: { ...template.draft!.aiResult, resolved_article_structure: "comparison", content_policy_version: 2 },
    editedTitle: `Archived article ${String(index).padStart(2, "0")}`,
    createdAt,
    updatedAt,
  });
  return { ...template, id, inputPayload, draft, draftId: draft.id, createdAt, updatedAt, completedAt: updatedAt };
}

function newestCreatedFirst(jobs: GenerationJob[]) {
  return [...jobs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function readAllPages() {
  const { GET } = await import("@/app/api/generation-logs/route");
  const pages: GenerationLogPage[] = [];
  let cursor: string | null = null;
  do {
    const page = await readPage(GET, cursor);
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor && pages.length < 10);
  return pages;
}

async function readPage(
  GET: (request: Request) => Promise<Response>,
  cursor: string | null = null,
  limit?: number,
) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const response = await GET(new Request(`http://localhost/api/generation-logs${params.size ? `?${params}` : ""}`));
  expect(response.status).toBe(200);
  const json = (await response.json()) as GenerationLogPage & { ok: boolean };
  expect(json.ok).toBe(true);
  return json;
}

async function readJob(
  GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>,
  id: string,
) {
  const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  return ((await response.json()) as { job: GenerationJob }).job;
}

function mockGateway(handler: (action: string, payload: unknown) => Promise<unknown>) {
  const callSupabaseGateway = vi.fn(handler);
  vi.doMock("@/lib/server/supabase", () => ({
    assertDurableStorageConfigured: vi.fn(),
    getSupabaseAdmin: vi.fn(() => null),
  }));
  vi.doMock("@/lib/server/supabase-gateway", () => ({
    callSupabaseGateway,
    isSupabaseGatewayConfigured: vi.fn(() => true),
  }));
  return callSupabaseGateway;
}

function mockSupabaseQuery(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "or"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  vi.doMock("@/lib/server/supabase", () => ({
    assertDurableStorageConfigured: vi.fn(),
    getSupabaseAdmin: vi.fn(() => ({ from: vi.fn(() => builder) })),
  }));
  vi.doMock("@/lib/server/supabase-gateway", () => ({
    callSupabaseGateway: vi.fn(),
    isSupabaseGatewayConfigured: vi.fn(() => false),
  }));
  return { calls };
}
