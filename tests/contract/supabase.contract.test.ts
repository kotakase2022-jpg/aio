import { describe, expect, test, vi } from "vitest";
import { createCompletedGenerationJob } from "../fixtures/article";
import { createMockHttpServer, sendJson } from "../helpers/mock-http-server";

describe("Supabase staging contract", () => {
  test("generation jobs use service-role PostgREST upsert and select contracts", async () => {
    const job = createCompletedGenerationJob();
    const server = await createMockHttpServer((request, response) => {
      expect(request.headers.apikey).toBe("sb_test_service_role");
      expect(request.headers.authorization).toBe("Bearer sb_test_service_role");

      if (request.method === "POST" && request.pathname === "/rest/v1/article_inputs") {
        sendJson(response, []);
        return;
      }

      if (request.method === "GET" && request.pathname === "/rest/v1/article_inputs") {
        expect(request.search).toContain("select=");
        if (request.search.includes(`id=eq.${job.id}`)) {
          sendJson(response, {
            id: job.id,
            input_payload: job,
            created_at: job.createdAt,
            updated_at: job.updatedAt,
          });
          return;
        }

        expect(request.search).toContain("order=updated_at.desc");
        sendJson(response, [
          {
            id: job.id,
            input_payload: job,
            created_at: job.createdAt,
            updated_at: job.updatedAt,
          },
        ]);
        return;
      }

      sendJson(response, { message: `Unexpected route ${request.method} ${request.pathname}` }, 500);
    });

    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = server.origin;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_test_service_role";
      process.env.SUPABASE_GATEWAY_TOKEN = "";
      vi.resetModules();
      const { saveGenerationJob, getGenerationJob, listGenerationJobs } = await import(
        "@/lib/server/generation-jobs"
      );

      await saveGenerationJob(job);
      const loaded = await getGenerationJob(job.id);
      const list = await listGenerationJobs(5);
      const upsertRequest = server.requests[0];
      const upsertBody = upsertRequest.json as Record<string, unknown>;

      expect(upsertRequest.search).toContain("on_conflict=id");
      expect(String(upsertRequest.headers.prefer)).toContain("resolution=merge-duplicates");
      expect(upsertBody).toMatchObject({
        id: job.id,
        input_payload: {
          kind: "article_generation_job",
          id: job.id,
          status: "completed",
        },
      });
      expect(loaded?.id).toBe(job.id);
      expect(list[0].id).toBe(job.id);
      expect(server.requests.map((request) => `${request.method} ${request.pathname}`)).toEqual([
        "POST /rest/v1/article_inputs",
        "GET /rest/v1/article_inputs",
        "GET /rest/v1/article_inputs",
      ]);
    } finally {
      await server.close();
    }
  });

  test("Supabase permission errors surface explicit grant failures", async () => {
    const server = await createMockHttpServer((_request, response) => {
      sendJson(
        response,
        {
          code: "42501",
          message: "permission denied for table article_inputs",
          hint: "Grant the required privileges to the current role.",
        },
        403,
      );
    });

    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = server.origin;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_test_service_role";
      process.env.SUPABASE_GATEWAY_TOKEN = "";
      vi.resetModules();
      const { saveGenerationJob } = await import("@/lib/server/generation-jobs");

      await expect(saveGenerationJob(createCompletedGenerationJob())).rejects.toMatchObject({
        status: 500,
        detail: "permission denied for table article_inputs",
      });
    } finally {
      await server.close();
    }
  });
});
