import { describe, expect, test, vi } from "vitest";
import type { GenerationJob } from "@/types/aio";
import {
  cleanEnvValue,
  expectLiveContractEnabled,
  expectNonProductionConfirmed,
  expectRequiredEnv,
  loadLiveEnv,
} from "./live-test-helpers";

describe("Supabase live sandbox contract", () => {
  test(
    "writes, reads, lists, and cleans up a disposable generation job",
    async () => {
      loadLiveEnv();
      expectLiveContractEnabled();
      expectNonProductionConfirmed();
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
      const id = `live-contract-${Date.now()}`;
      const baseJob = createCompletedGenerationJob();
      const job = {
        ...baseJob,
        id,
        draftId: `${id}-draft`,
        draft: baseJob.draft
          ? {
              ...baseJob.draft,
              id: `${id}-draft`,
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
          draftId: `${id}-draft`,
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
