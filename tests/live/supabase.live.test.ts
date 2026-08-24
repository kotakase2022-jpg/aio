import { describe, expect, test, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { GenerationJob } from "@/types/aio";
import {
  cleanEnvValue,
  expectLiveContractEnabled,
  expectRequiredEnv,
  expectSupabaseWriteTargetConfirmed,
  loadLiveEnv,
} from "./live-test-helpers";

describe("Supabase live sandbox contract", () => {
  test(
    "writes, reads, lists, and cleans up a disposable generation job",
    async () => {
      loadLiveEnv();
      expectLiveContractEnabled();
      expectSupabaseWriteTargetConfirmed();
      expect(cleanEnvValue(process.env.AIO_LIVE_SUPABASE_ALLOW_WRITE)).toBe("1");
      expectRequiredEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
      vi.resetModules();

      const { createCompletedGenerationJob } = await import("../fixtures/article");
      const {
        getGenerationJob,
        listGenerationJobs,
        markGenerationJobWordpressPost,
        saveGenerationJob,
      } = await import("@/lib/server/generation-jobs");
      const id = randomUUID();
      const draftId = `live-contract-${Date.now()}-${id}`;
      const baseJob = createCompletedGenerationJob();
      const job = {
        ...baseJob,
        id,
        draftId,
        draft: baseJob.draft
          ? {
              ...baseJob.draft,
              id: draftId,
            }
          : baseJob.draft,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies GenerationJob;

      try {
        await saveGenerationJob(job);
        const loaded = await getGenerationJob(job.id);
        const listed = await listGenerationJobs(50);

        expect(loaded?.id).toBe(job.id);
        expect(listed.some((item) => item.id === job.id)).toBe(true);

        await markGenerationJobWordpressPost({
          draftId,
          status: "draft",
          postUrl: "https://sandbox.example.com/live-contract-draft/",
        });
        const posted = await getGenerationJob(job.id);
        expect(posted?.wordpressPostStatus).toBe("draft");
        expect(posted?.wordpressPostUrl).toBe("https://sandbox.example.com/live-contract-draft/");
        expect(posted?.draft?.status).toBe("posted");
      } finally {
        const cleanup = await deleteSupabaseArticleInput(job.id);
        expect(cleanup.ok).toBe(true);
      }
    },
    90_000,
  );

  test(
    "replaces disposable draft image rows without deleting the new image",
    async () => {
      loadLiveEnv();
      expectLiveContractEnabled();
      expectSupabaseWriteTargetConfirmed();
      expect(cleanEnvValue(process.env.AIO_LIVE_SUPABASE_ALLOW_WRITE)).toBe("1");
      expectRequiredEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
      vi.resetModules();

      const { createSampleDraft, transparentPixelDataUrl } = await import(
        "../fixtures/article"
      );
      const { getDraft, saveDraft } = await import("@/lib/server/drafts");
      const draftId = randomUUID();
      const firstImageId = randomUUID();
      const replacementImageId = randomUUID();
      const draft = createSampleDraft({
        id: draftId,
        images: [
          {
            id: firstImageId,
            slot: "featured",
            url: transparentPixelDataUrl,
            path: `generated/live-contract/${firstImageId}.png`,
            prompt: "Disposable first image",
            altText: "Disposable first image",
            source: "generated",
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      try {
        await saveDraft(draft);
        expect((await getDraft(draftId))?.images.map((image) => image.id)).toEqual([
          firstImageId,
        ]);

        await saveDraft({
          ...draft,
          images: [
            {
              id: replacementImageId,
              slot: "featured",
              url: transparentPixelDataUrl,
              path: `generated/live-contract/${replacementImageId}.png`,
              prompt: "Disposable replacement image",
              altText: "Disposable replacement image",
              source: "generated",
            },
          ],
          updatedAt: new Date().toISOString(),
        });
        expect((await getDraft(draftId))?.images.map((image) => image.id)).toEqual([
          replacementImageId,
        ]);

        await saveDraft({
          ...draft,
          images: [],
          updatedAt: new Date().toISOString(),
        });
        expect((await getDraft(draftId))?.images).toEqual([]);
      } finally {
        const cleanup = await deleteSupabaseDraft(draftId);
        expect(cleanup.ok).toBe(true);
      }
    },
    90_000,
  );
});

async function deleteSupabaseArticleInput(id: string) {
  const baseUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, "");
  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const response = await fetch(
    `${baseUrl}/rest/v1/article_inputs?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  return {
    ok: response.ok,
    status: response.status,
    detail: await response.text().catch(() => ""),
  };
}

async function deleteSupabaseDraft(id: string) {
  const baseUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, "");
  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const response = await fetch(
    `${baseUrl}/rest/v1/article_drafts?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  return {
    ok: response.ok,
    status: response.status,
    detail: await response.text().catch(() => ""),
  };
}
