import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import type { ArticleDraft } from "@/types/aio";

type StoredRow = Record<string, unknown> & { id: string; updated_at: string };

const processEnvSnapshot = snapshotProcessEnv();
let storedRows: Map<string, StoredRow>;
let rpcGate: { reached: () => void; release: Promise<void> } | null;

beforeEach(() => {
  storedRows = new Map();
  rpcGate = null;
  vi.resetModules();
  // Mirrors aio_save_draft: compare-and-set on updated_at, raising 40001 on a stale revision.
  const rpc = vi.fn(async (_name: string, args: { draft_row: StoredRow; expected_updated_at: string | null }) => {
    if (rpcGate) {
      const gate = rpcGate;
      rpcGate = null;
      gate.reached();
      await gate.release;
    }
    const existing = storedRows.get(args.draft_row.id);
    if (args.expected_updated_at !== null && existing?.updated_at !== args.expected_updated_at) {
      return { error: { code: "40001", message: "Draft changed; reload the latest revision" } };
    }
    storedRows.set(args.draft_row.id, structuredClone(args.draft_row));
    return { error: null };
  });
  const from = vi.fn((table: string) => {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      },
      order: () => query,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: structuredClone(storedRows.get(String(filters.id)) ?? null), error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    if (table !== "article_drafts" && table !== "article_images" && table !== "article_inputs") {
      throw new Error(`unexpected table ${table}`);
    }
    return query;
  });
  vi.doMock("@/lib/server/supabase", () => ({
    assertDurableStorageConfigured: vi.fn(),
    getSupabaseAdmin: vi.fn(() => ({ rpc, from })),
  }));
});

afterEach(() => {
  vi.doUnmock("@/lib/server/supabase");
  restoreProcessEnv(processEnvSnapshot);
});

describe("draft save retries", () => {
  test("a late request cannot overwrite the newer save that retried it", async () => {
    const { saveDraft } = await import("@/lib/server/drafts");
    const { POST } = await import("@/app/api/save-draft/route");
    const original = createSampleDraft({ id: "draft-retry", images: [], editedTitle: "Original", updatedAt: "2026-11-16T00:00:00.000Z" });
    await saveDraft(original);
    let reached!: () => void;
    const reachedRpc = new Promise<void>((resolve) => { reached = resolve; });
    let release!: () => void;
    rpcGate = { reached: () => reached(), release: new Promise<void>((resolve) => { release = resolve; }) };

    // The first attempt stalls inside the database call after reading the stored revision.
    const late = POST(saveRequest({ ...original, editedTitle: "Attempt that timed out" }));
    await reachedRpc;
    const retried = await POST(saveRequest({ ...original, editedTitle: "Retried newer edit" }));
    release();
    const lateResponse = await late;

    expect(retried.status).toBe(200);
    expect(lateResponse.status).toBe(409);
    expect(await lateResponse.json()).toMatchObject({
      ok: false,
      error: "同じ記事への別の保存処理と重なったため、今回の内容は保存していません。",
      detail: "入力中の内容はこの画面に残っています。数秒待ってから、もう一度保存してください。",
    });
    expect(storedRows.get("draft-retry")?.edited_title).toBe("Retried newer edit");
    expect(storedRows.size).toBe(1);
  });

  test("retrying after a committed request whose response was lost saves the same article", async () => {
    const { saveDraft, getDraft } = await import("@/lib/server/drafts");
    const { POST } = await import("@/app/api/save-draft/route");
    const original = createSampleDraft({ id: "draft-lost-response", images: [], editedTitle: "Original", updatedAt: "2026-11-16T00:00:00.000Z" });
    await saveDraft(original);

    const committed = await POST(saveRequest({ ...original, editedTitle: "Committed but unanswered" }));
    // The browser never saw that response and still holds its pre-save revision.
    const retried = await POST(saveRequest({ ...original, editedTitle: "Committed but unanswered" }));

    expect(committed.status).toBe(200);
    expect(retried.status).toBe(200);
    expect(storedRows.size).toBe(1);
    expect((await getDraft("draft-lost-response"))?.editedTitle).toBe("Committed but unanswered");
  });

  test("approval uses the same stale-write protection", async () => {
    const { saveDraft } = await import("@/lib/server/drafts");
    const { POST } = await import("@/app/api/approve-draft/route");
    const original = createSampleDraft({ id: "draft-approve-retry", images: [], updatedAt: "2026-11-16T00:00:00.000Z" });
    await saveDraft(original);
    let reached!: () => void;
    const reachedRpc = new Promise<void>((resolve) => { reached = resolve; });
    let release!: () => void;
    rpcGate = { reached: () => reached(), release: new Promise<void>((resolve) => { release = resolve; }) };

    const late = POST(approveRequest({ ...original, editedTitle: "Late approval" }));
    await reachedRpc;
    const retried = await POST(approveRequest({ ...original, editedTitle: "Retried approval" }));
    release();

    expect(retried.status).toBe(200);
    expect((await late).status).toBe(409);
    expect(storedRows.get("draft-approve-retry")).toMatchObject({ edited_title: "Retried approval", status: "approved" });
  });
});

function saveRequest(draft: ArticleDraft) {
  return new Request("http://localhost/api/save-draft", { method: "POST", body: JSON.stringify({ draft }) });
}

function approveRequest(draft: ArticleDraft) {
  return new Request("http://localhost/api/approve-draft", { method: "POST", body: JSON.stringify({ draftId: draft.id, draft }) });
}
