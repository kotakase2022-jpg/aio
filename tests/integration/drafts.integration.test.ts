import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCompletedGenerationJob, createSampleDraft } from "../fixtures/article";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";
import { deltaNov11Form } from "../fixtures/delta-nov11";
import { buildDraftArticleHtml } from "@/lib/draft-html";

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
  test("saving a restored draft accepts null as absent optional competitor research", async () => {
    const { POST } = await import("@/app/api/save-draft/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = { ...createSampleDraft({ id: "legacy-null-research", images: [], faqItems: [] }), competitorResearch: null };
    const response = await POST(new Request("http://localhost/api/save-draft", { method: "POST", body: JSON.stringify({ draft }) }));
    expect(response.status).toBe(200);
    const restored = await getDraft(draft.id);
    expect(restored?.competitorResearch).toBeUndefined();
    expect(restored?.editedBodyHtml).toBe(draft.editedBodyHtml);
    expect(restored?.faqItems).toEqual([]);
  });

  test.each(["not research", [], false])("still rejects malformed competitor research: %j", async (competitorResearch) => {
    const { POST } = await import("@/app/api/save-draft/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = { ...createSampleDraft({ id: "invalid-research" }), competitorResearch };
    const response = await POST(new Request("http://localhost/api/save-draft", { method: "POST", body: JSON.stringify({ draft }) }));
    expect(response.status).toBe(400);
    expect(await getDraft(draft.id)).toBeNull();
  });

  test("preserves presentation options and body Q&A across save, edit, approve and reload", async () => {
    const { POST: save } = await import("@/app/api/save-draft/route");
    const { POST: approve } = await import("@/app/api/approve-draft/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({ id: "nov11-options", inputPayload: { ...deltaNov11Form, articleStructure: "faq", tableMode: "none", supplementalFaqMode: "none" }, editedBodyHtml: "<h2>いつ相談しますか？</h2><p>デルタのファクタリング相談では希望日の5営業日前に相談します。</p>", images: [], author: {} });
    const saved = await save(new Request("http://localhost/api/save-draft", { method: "POST", body: JSON.stringify({ draft }) }));
    expect(saved.status).toBe(200);
    const reloaded = await getDraft(draft.id);
    expect(reloaded?.inputPayload).toEqual(draft.inputPayload);
    expect(buildDraftArticleHtml(reloaded!)).toBe(buildDraftArticleHtml(draft));
    const edited = { ...reloaded!, editedBodyHtml: `${reloaded!.editedBodyHtml}<p>編集者が追加した個別条件。</p>` };
    const approved = await approve(new Request("http://localhost/api/approve-draft", { method: "POST", body: JSON.stringify({ draft: edited }) }));
    expect(approved.status).toBe(200);
    const restored = await getDraft(draft.id);
    expect(restored?.status).toBe("approved");
    expect(buildDraftArticleHtml(restored!)).toContain("編集者が追加した個別条件。");
    expect(buildDraftArticleHtml(restored!)).not.toMatch(/<table|aio-faq-block/);
  });
  test("saving rejects a malformed local store without overwriting it", async () => {
    const { saveDraft } = await import("@/lib/server/drafts");
    const draftFile = path.join(tempDir, "drafts.json");
    const malformedStore = '{"existing-draft":';
    await writeFile(draftFile, malformedStore, "utf8");

    await expect.soft(saveDraft(createSampleDraft())).rejects.toBeInstanceOf(SyntaxError);
    await expect(readFile(draftFile, "utf8")).resolves.toBe(malformedStore);
  });

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

  test("save and approve routes keep generation logs and reopened output in sync", async () => {
    const { saveGenerationJob, getGenerationJob, listGenerationLogs } = await import(
      "@/lib/server/generation-jobs"
    );
    const { POST: savePost } = await import("@/app/api/save-draft/route");
    const { POST: approvePost } = await import("@/app/api/approve-draft/route");
    const job = createCompletedGenerationJob();
    const editedDraft = {
      ...job.draft!,
      editedTitle: "Final human-edited production title",
      editedBodyHtml: "<h2>Final section</h2><p>Final persisted body.</p>",
      status: "draft" as const,
    };
    await saveGenerationJob(job);

    const saveResponse = await savePost(
      new Request("http://localhost/api/save-draft", {
        method: "POST",
        body: JSON.stringify({ draft: editedDraft }),
      }),
    );
    expect(saveResponse.status).toBe(200);
    await expect(listGenerationLogs(10)).resolves.toEqual([
      expect.objectContaining({
        id: job.id,
        outputTitle: "Final human-edited production title",
        draftStatus: "draft",
      }),
    ]);

    const approveResponse = await approvePost(
      new Request("http://localhost/api/approve-draft", {
        method: "POST",
        body: JSON.stringify({ draftId: editedDraft.id, draft: editedDraft }),
      }),
    );
    expect(approveResponse.status).toBe(200);

    const reopenedJob = await getGenerationJob(job.id);
    expect(reopenedJob?.draft).toMatchObject({
      id: editedDraft.id,
      editedTitle: "Final human-edited production title",
      editedBodyHtml: "<h2>Final section</h2><p>Final persisted body.</p>",
      status: "approved",
    });
    await expect(listGenerationLogs(10)).resolves.toEqual([
      expect.objectContaining({
        id: job.id,
        outputTitle: "Final human-edited production title",
        draftStatus: "approved",
      }),
    ]);
  });
});
