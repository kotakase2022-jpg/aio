import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";

/**
 * In-memory stand-in for the Supabase tables and RPCs the generation flow uses, answering the
 * PostgREST query shapes of src/lib/server and of the aio-store Edge Function. Both RPCs apply
 * the same checks as their SQL in supabase/migrations, evaluated when the "database" processes
 * the request, so a test can hold a request and apply it late. The SQL itself is verified on a
 * real PostgreSQL by tests/fixtures/sql/*.sql; this model only lets the app code run against it.
 */

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type Result = { data: unknown; error: DbError | null };

const completionMigration = readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "20261117051104_guarded_generation_completion.sql"),
  "utf8",
);
const deadlineMinutes = Number(
  /completion_deadline constant interval := interval '(\d+) minutes'/.exec(completionMigration)?.[1],
);
if (!Number.isFinite(deadlineMinutes)) throw new Error("Completion deadline not found in the migration.");
/** The deadline aio_complete_generation_job enforces, read from the migration. */
export const MIRROR_COMPLETION_DEADLINE_MS = deadlineMinutes * 60 * 1000;

/** Parameter names of aio_complete_generation_job, in declaration order, read from the migration. */
export const COMPLETION_RPC_PARAMETERS = [
  ...(/create or replace function public\.aio_complete_generation_job\(([^)]*)\)/.exec(completionMigration)?.[1] ?? "")
    .matchAll(/^\s*(\w+)\s+\w+/gm),
].map((match) => match[1]);

export const GATEWAY_TEST_URL = "https://mirror-project.supabase.co";
export const GATEWAY_TEST_TOKEN = "test-only-gateway-token";

export type StoreMirror = ReturnType<typeof createSupabaseStoreMirror>;

export function createSupabaseStoreMirror() {
  const tables: Record<string, Map<string, Row>> = {
    article_inputs: new Map(),
    article_drafts: new Map(),
    article_images: new Map(),
    aio_gateway_tokens: new Map([["token", { token_hash: sha256Hex(GATEWAY_TEST_TOKEN), active: true }]]),
  };
  const rpcCalls: Array<{ name: string; args: Row }> = [];
  /** Every write that left a job row "completed", and through which path. */
  const completionWrites: Array<"rpc" | "update" | "upsert"> = [];
  const functions = new Set(["aio_save_draft", "aio_complete_generation_job"]);
  let pendingHold: { arrived: () => void; release: Promise<void> } | null = null;

  function row(table: string, id: string) {
    return tables[table].get(id);
  }

  function noteCompletion(input: Row | undefined, via: "rpc" | "update" | "upsert") {
    if (isRecord(input?.input_payload) && input.input_payload.status === "completed") completionWrites.push(via);
  }

  /** A completion request (the guarded RPC, or a plain job update to "completed") waits here. */
  async function applyLateIfHeld(completes: boolean) {
    if (!completes || !pendingHold) return;
    const hold = pendingHold;
    pendingHold = null;
    hold.arrived();
    await hold.release;
  }

  /** aio_save_draft: compare-and-set on the draft revision, then the draft and its images. */
  function saveDraftRows(draftRow: Row, imageRows: unknown, expectedUpdatedAt: unknown): DbError | null {
    const draftId = String(draftRow.id ?? "");
    if (!draftId || !Array.isArray(imageRows)) return { code: "22023", message: "Invalid draft or image payload" };
    const existing = row("article_drafts", draftId);
    if (expectedUpdatedAt != null && !sameInstant(existing?.updated_at, expectedUpdatedAt)) {
      return { code: "40001", message: "Draft changed; reload the latest revision" };
    }
    const images = imageRows as Row[];
    if (images.some((image) => image.draft_id !== draftId || (row("article_images", String(image.id)) && row("article_images", String(image.id))!.draft_id !== draftId))) {
      return { code: "22023", message: "Image belongs to another draft" };
    }
    if (images.some((image) => !["featured", "inline-1", "inline-2"].includes(String(image.slot)))) {
      return { code: "23514", message: "new row for relation \"article_images\" violates check constraint" };
    }
    tables.article_drafts.set(draftId, { created_at: existing?.created_at ?? new Date().toISOString(), ...structuredClone(draftRow) });
    for (const [id, image] of tables.article_images) {
      if (image.draft_id === draftId && !images.some((kept) => kept.id === id)) tables.article_images.delete(id);
    }
    for (const image of images) {
      tables.article_images.set(String(image.id), { created_at: new Date().toISOString(), ...structuredClone(image) });
    }
    return null;
  }

  /** aio_complete_generation_job, with the checks of its SQL in the same order. */
  function completeJob(args: Row): DbError | null {
    const jobRow = args.job_row as Row | undefined;
    const payload = jobRow?.input_payload as Row | undefined;
    const draftRow = args.draft_row as Row | undefined;
    if (
      !isRecord(jobRow) || !isRecord(payload) || !isRecord(draftRow) || !Array.isArray(args.image_rows) ||
      args.expected_updated_at == null || jobRow.updated_at == null ||
      payload.kind !== "article_generation_job" || payload.status !== "completed" ||
      payload.id !== jobRow.id || payload.draftId !== draftRow.id
    ) {
      return { code: "22023", message: "Invalid generation completion payload" };
    }
    const stored = row("article_inputs", String(jobRow.id));
    const storedPayload = stored?.input_payload as Row | undefined;
    if (!stored || storedPayload?.kind !== "article_generation_job" || storedPayload.status !== "running") {
      return { code: "JOB01", message: "Generation job is no longer running" };
    }
    if (Date.now() >= Date.parse(String(stored.created_at)) + MIRROR_COMPLETION_DEADLINE_MS) {
      return { code: "JOB01", message: "Generation job passed its completion deadline" };
    }
    if (!sameInstant(stored.updated_at, args.expected_updated_at)) {
      return { code: "40001", message: "Generation job changed; reload it" };
    }
    if (row("article_drafts", String(draftRow.id))) return { code: "23505", message: "Generated draft already exists" };
    const draftError = saveDraftRows(draftRow, args.image_rows, null);
    if (draftError) return draftError;
    stored.input_payload = structuredClone(payload);
    stored.updated_at = jobRow.updated_at;
    noteCompletion(stored, "rpc");
    return null;
  }

  async function rpc(name: string, args: Row): Promise<Result> {
    rpcCalls.push({ name, args: structuredClone(args) });
    if (!functions.has(name)) {
      return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name} in the schema cache` } };
    }
    // The request has been sent; the database applies it only when the test releases it.
    await applyLateIfHeld(name === "aio_complete_generation_job");
    const error = name === "aio_save_draft"
      ? saveDraftRows(args.draft_row as Row, args.image_rows, args.expected_updated_at)
      : completeJob(args);
    return { data: null, error };
  }

  function from(table: string) {
    if (!tables[table]) throw new Error(`unexpected table ${table}`);
    const filters: Array<[string, unknown]> = [];
    const orders: Array<[string, boolean]> = [];
    let limit = Number.POSITIVE_INFINITY;
    let update: Row | null = null;

    const matches = (candidate: Row) =>
      filters.every(([column, value]) =>
        column === "updated_at" || column === "created_at"
          ? sameInstant(candidate[column], value)
          : readColumn(candidate, column) === value,
      );
    const run = (): Result => {
      const rows = [...tables[table].values()].filter(matches);
      if (update) {
        for (const target of rows) {
          Object.assign(target, structuredClone(update));
          if (table === "article_inputs") noteCompletion(target, "update");
        }
        return { data: rows.map((target) => ({ id: target.id })), error: null };
      }
      const sorted = rows.map((candidate) => structuredClone(candidate)).sort((a, b) => {
        for (const [column, ascending] of orders) {
          const order = String(a[column] ?? "").localeCompare(String(b[column] ?? ""));
          if (order !== 0) return ascending ? order : -order;
        }
        return 0;
      });
      return { data: sorted.slice(0, limit), error: null };
    };
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: (column: string, options: { ascending?: boolean } = {}) => {
        orders.push([column, options.ascending ?? true]);
        return builder;
      },
      limit: (count: number) => {
        limit = count;
        return builder;
      },
      update: (values: Row) => {
        update = values;
        return builder;
      },
      upsert: async (values: Row) => {
        const id = String(values.id);
        tables[table].set(id, { ...(tables[table].get(id) ?? {}), ...structuredClone(values) });
        if (table === "article_inputs") noteCompletion(tables[table].get(id), "upsert");
        return { data: null, error: null };
      },
      maybeSingle: async () => {
        await applyLateIfHeld(completesJob());
        const { data } = run();
        return { data: (data as Row[])[0] ?? null, error: null };
      },
      then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
        applyLateIfHeld(completesJob()).then(run).then(resolve, reject),
    };
    function completesJob() {
      return table === "article_inputs" && isRecord(update?.input_payload) && update.input_payload.status === "completed";
    }
    return builder;
  }

  return {
    client: { from, rpc },
    tables,
    rpcCalls,
    completionWrites,
    /** Removes an RPC, as on a database where its migration has not been applied. */
    dropFunction: (name: string) => functions.delete(name),
    /**
     * The next request that would complete a job (the guarded RPC, or a plain update of the job
     * row to "completed") waits until released, as if the database applied it late.
     */
    holdNextCompletion() {
      let arrived!: () => void;
      let release!: () => void;
      const arrival = new Promise<void>((resolve) => { arrived = resolve; });
      pendingHold = { arrived: () => arrived(), release: new Promise<void>((resolve) => { release = resolve; }) };
      return { arrival, release: () => release() };
    },
    seedJob(job: { id: string; createdAt: string; updatedAt: string } & Row) {
      tables.article_inputs.set(job.id, {
        id: job.id,
        input_payload: structuredClone(job),
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      });
    },
  };
}

/**
 * Loads the real aio-store Edge Function with its Supabase client replaced by the mirror and routes
 * the app's gateway requests to it. `intercept` can answer an action first (for example, as an
 * older deployed version that lacks it would).
 */
export async function connectAioStoreGateway(
  mirror: StoreMirror,
  intercept?: (action: string) => Response | undefined,
) {
  vi.doMock("npm:@supabase/supabase-js@2", () => ({ createClient: () => mirror.client }));
  let handler: ((request: Request) => Promise<Response>) | undefined;
  vi.stubGlobal("Deno", {
    env: { get: (name: string) => ({ SUPABASE_URL: GATEWAY_TEST_URL, SUPABASE_SERVICE_ROLE_KEY: "test-only" } as Record<string, string>)[name] },
    serve: (serve: (request: Request) => Promise<Response>) => {
      handler = serve;
    },
  });
  // Not a literal: the Deno source stays outside the app's TypeScript program.
  const gatewayModule = "../../supabase/functions/aio-store/index.ts";
  await import(/* @vite-ignore */ gatewayModule);
  if (!handler) throw new Error("aio-store did not register a request handler.");
  const serve = handler;
  const actions: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(`${GATEWAY_TEST_URL}/functions/v1/aio-store`)) {
      throw new Error(`unexpected request to ${request.url}`);
    }
    const action = String(((await request.clone().json()) as { action?: unknown }).action);
    actions.push(action);
    return intercept?.(action) ?? serve(request);
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = GATEWAY_TEST_URL;
  process.env.SUPABASE_GATEWAY_TOKEN = GATEWAY_TEST_TOKEN;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  return { actions };
}

function readColumn(candidate: Row, column: string) {
  const jsonPath = /^(\w+)->>(\w+)$/.exec(column);
  if (!jsonPath) return candidate[column];
  const json = candidate[jsonPath[1]];
  return isRecord(json) ? json[jsonPath[2]] : undefined;
}

function sameInstant(a: unknown, b: unknown) {
  return a != null && b != null && Date.parse(String(a)) === Date.parse(String(b));
}

function isRecord(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
