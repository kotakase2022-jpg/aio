import { after } from "next/server";
import { z } from "zod";
import { runArticleGenerationJob } from "@/lib/server/article-generation-job-runner";
import { createGenerationJob } from "@/lib/server/generation-jobs";
import { errorJson, okJson } from "@/lib/server/http";
import type { ArticleFormPayload, CompetitorResearchResult } from "@/types/aio";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  form: z.record(z.string(), z.unknown()),
  competitorResearch: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const job = await createGenerationJob({
      inputPayload: body.form as ArticleFormPayload,
      competitorResearch: body.competitorResearch as CompetitorResearchResult | null | undefined,
    });

    after(async () => {
      await runArticleGenerationJob(job.id);
    });

    return okJson({ job }, { status: 202 });
  } catch (error) {
    return errorJson(error);
  }
}
