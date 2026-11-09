import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createCompletedGenerationJob } from "../fixtures/article";

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => null),
  assertDurableStorageConfigured: vi.fn(),
}));
vi.mock("@/lib/server/supabase-gateway", () => ({
  isSupabaseGatewayConfigured: vi.fn(() => false),
  callSupabaseGateway: vi.fn(),
}));

let directory: string;
const previousDirectory = process.env.AIO_LOCAL_DATA_DIR;
beforeEach(async () => {
  vi.resetModules();
  directory = await mkdtemp(path.join(os.tmpdir(), "aio-canonical-read-"));
  process.env.AIO_LOCAL_DATA_DIR = directory;
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (previousDirectory === undefined) delete process.env.AIO_LOCAL_DATA_DIR;
  else process.env.AIO_LOCAL_DATA_DIR = previousDirectory;
  await rm(directory, { recursive: true, force: true });
});

test("canonical read failure never returns an older editable job snapshot; retry restores latest edits", async () => {
  const jobs = await import("@/lib/server/generation-jobs");
  const drafts = await import("@/lib/server/drafts");
  const job = createCompletedGenerationJob();
  const current = { ...job.draft!, editedTitle: "Latest editor-approved answer", status: "approved" as const };
  await jobs.saveGenerationJob(job);
  await drafts.saveDraft(current);
  const read = vi.spyOn(drafts, "getDraft").mockRejectedValueOnce(new Error("Canonical image store unavailable"));
  const { GET } = await import("@/app/api/generation-jobs/[id]/route");
  const request = () => GET(new Request(`http://localhost/api/generation-jobs/${job.id}`), {
    params: Promise.resolve({ id: job.id }),
  });
  const failed = await request();
  expect(failed.status).toBe(500);
  const failure = await failed.json();
  expect(failure).toMatchObject({ ok: false });
  expect(failure).not.toHaveProperty("job");
  expect(read).toHaveBeenCalledWith(current.id);
  const retried = await request();
  expect(retried.status).toBe(200);
  expect((await retried.json()).job.draft).toEqual(current);
  await expect(drafts.getDraft(current.id)).resolves.toEqual(current);
});
