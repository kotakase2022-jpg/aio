import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCompletedGenerationJob, createSampleDraft } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";

let tempDir = "";
const processEnvSnapshot = snapshotProcessEnv();

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
  restoreProcessEnv(processEnvSnapshot);
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

  test("approve-draft sanitizes an edited draft supplied inline", async () => {
    const { POST: approvePost } = await import("@/app/api/approve-draft/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({
      id: "draft-inline-approve",
      status: "draft",
      editedBodyHtml:
        '<h2 onclick="alert(1)">Safe</h2><a href="javascript:alert(1)">bad</a><img src="data:image/png;base64,iVBORw0KGgo=" onerror="alert(1)"><script>alert(1)</script>',
    });

    const response = await approvePost(
      new Request("http://localhost/api/approve-draft", {
        method: "POST",
        body: JSON.stringify({ draft }),
      }),
    );
    const stored = await getDraft("draft-inline-approve");

    expect(response.status).toBe(200);
    expect(stored?.status).toBe("approved");
    expect(stored?.editedBodyHtml).toContain("<h2>Safe</h2>");
    expect(stored?.editedBodyHtml).toContain("data:image/png;base64,iVBORw0KGgo=");
    expect(stored?.editedBodyHtml).not.toMatch(/onclick|onerror|javascript:|<script/i);
  });

  test("approve-draft rejects invalid payloads as user-correctable input errors", async () => {
    const { POST: approvePost } = await import("@/app/api/approve-draft/route");

    const response = await approvePost(
      new Request("http://localhost/api/approve-draft", {
        method: "POST",
        body: JSON.stringify({ draftId: "" }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      ok: false,
      error: "入力内容が不正です。",
    });
    expect(json.detail).toContain("承認する下書き情報が見つかりません。");
  });

  test("approve-draft returns 404 for missing persisted drafts", async () => {
    const { POST: approvePost } = await import("@/app/api/approve-draft/route");

    const response = await approvePost(
      new Request("http://localhost/api/approve-draft", {
        method: "POST",
        body: JSON.stringify({ draftId: "missing-draft" }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toMatchObject({
      ok: false,
      error: "下書きが見つかりません。",
      detail:
        "生成ログから下書きを開き直すか、編集内容を保存してからもう一度承認してください。",
    });
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
