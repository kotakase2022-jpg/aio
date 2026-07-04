import { describe, expect, test, vi } from "vitest";
import type { GenerationJob } from "@/types/aio";
import {
  cleanEnvValue,
  expectLiveContractEnabled,
  expectRequiredEnv,
  loadLiveEnv,
} from "./live-test-helpers";

describe("Supabase live sandbox contract", () => {
  test(
    "writes, reads, lists, and cleans up a disposable generation job",
    async () => {
      loadLiveEnv();
      expectLiveContractEnabled();
      expect(cleanEnvValue(process.env.AIO_LIVE_SUPABASE_ALLOW_WRITE)).toBe("1");
      expectRequiredEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
      vi.resetModules();

      const { createCompletedGenerationJob } = await import("../fixtures/article");
      const { saveGenerationJob, getGenerationJob, listGenerationJobs } = await import(
        "@/lib/server/generation-jobs"
      );
      const job = {
        ...createCompletedGenerationJob(),
        id: `live-contract-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies GenerationJob;

      try {
        await saveGenerationJob(job);
        const loaded = await getGenerationJob(job.id);
        const listed = await listGenerationJobs(50);

        expect(loaded?.id).toBe(job.id);
        expect(listed.some((item) => item.id === job.id)).toBe(true);
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
