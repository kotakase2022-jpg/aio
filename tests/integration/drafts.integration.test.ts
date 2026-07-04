import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCompletedGenerationJob, createSampleDraft } from "../fixtures/article";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-tests-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.VERCEL = "";
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  delete process.env.AIO_LOCAL_DATA_DIR;
});

describe("draft persistence route handlers", () => {
  test("save-draft sanitizes HTML and persists local draft data", async () => {
    const { POST } = await import("@/app/api/save-draft/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({
      id: "draft-route-save",
      editedBodyHtml: '<h2>Safe</h2><script>alert("x")</script><p>Body</p>',
    });

    const response = await POST(
      new Request("http://localhost/api/save-draft", {
        method: "POST",
        body: JSON.stringify({ draft }),
      }),
    );
    const json = await response.json();
    const stored = await getDraft("draft-route-save");

    expect(response.status).toBe(200);
    expect(json.storageMode).toBe("local");
    expect(json.draft.editedBodyHtml).toBe("<h2>Safe</h2><p>Body</p>");
    expect(stored?.editedBodyHtml).toBe("<h2>Safe</h2><p>Body</p>");
  });

  test("approve-draft moves persisted drafts to approved status", async () => {
    const { POST: savePost } = await import("@/app/api/save-draft/route");
    const { POST: approvePost } = await import("@/app/api/approve-draft/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({ id: "draft-approve" });

    await savePost(
      new Request("http://localhost/api/save-draft", {
        method: "POST",
        body: JSON.stringify({ draft }),
      }),
    );

    const response = await approvePost(
      new Request("http://localhost/api/approve-draft", {
        method: "POST",
        body: JSON.stringify({ draftId: "draft-approve" }),
      }),
    );
    const stored = await getDraft("draft-approve");

    expect(response.status).toBe(200);
    expect(stored?.status).toBe("approved");
    expect(stored?.updatedAt).not.toBe(draft.updatedAt);
  });

  test("generation logs summarize persisted jobs without Supabase", async () => {
    const { saveGenerationJob, listGenerationLogs } = await import("@/lib/server/generation-jobs");
    const job = createCompletedGenerationJob();

    await saveGenerationJob(job);
    const logs = await listGenerationLogs(10);
    const store = JSON.parse(await readFile(path.join(tempDir, "generation-jobs.json"), "utf8"));

    expect(store[job.id].status).toBe("completed");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: job.id,
      status: "completed",
      outputTitle: "AIO Content Operations Guide",
      draftStatus: "draft",
    });
    expect(logs[0].inputSummary).toContain("AIO article generation");
  });
});
