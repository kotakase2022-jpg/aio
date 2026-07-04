import { z } from "zod";
import { competitorResearchSchema } from "@/lib/server/ai-schemas";
import { createStructuredResponse } from "@/lib/server/openai";
import { errorJson, okJson } from "@/lib/server/http";
import { truncateText } from "@/lib/utils";
import type { CompetitorResearchResult } from "@/types/aio";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  references: z.array(z.object({ url: z.string().optional(), text: z.string().optional() })),
  competitors: z
    .array(z.object({ url: z.string().optional(), text: z.string().optional() }))
    .optional(),
  referenceFiles: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        ok: z.boolean(),
        text: z.string().optional(),
        error: z.string().optional(),
      }),
    )
    .optional(),
  competitorFiles: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        ok: z.boolean(),
        text: z.string().optional(),
        error: z.string().optional(),
      }),
    )
    .optional(),
  theme: z.string().optional(),
  keywords: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const compactPayload = {
      references: payload.references.slice(0, 5).map((reference) => ({
        url: reference.url,
        text: reference.text ? truncateText(reference.text, 900) : undefined,
      })),
      competitors: (payload.competitors ?? []).slice(0, 5).map((competitor) => ({
        url: competitor.url,
        text: competitor.text ? truncateText(competitor.text, 900) : undefined,
      })),
      referenceFiles: compactFiles(payload.referenceFiles),
      competitorFiles: compactFiles(payload.competitorFiles),
      theme: payload.theme ? truncateText(payload.theme, 1000) : "",
      keywords: payload.keywords ? truncateText(payload.keywords, 500) : "",
    };

    const result = await createStructuredResponse<CompetitorResearchResult>({
      schemaName: "competitor_research",
      schema: competitorResearchSchema,
      tools: [{ type: "web_search" }],
      instructions:
        "You are a Japanese BtoB content strategist. Use web_search when helpful. Return only structured JSON that matches the schema.",
      input: JSON.stringify({
        task:
          "参照情報・競合情報・添付ファイル抽出テキスト・テーマ・キーワードをもとに、競合記事、競合LP、関連上位記事の論点を短時間で調査し、日本語で構造化してください。検索クエリは最大3件、競合候補は3〜4件、各論点は2項目以内に絞ってください。未確認情報は断定しないでください。",
        payload: compactPayload,
      }),
      timeoutMs: 105_000,
      maxOutputTokens: 3500,
    });

    return okJson({ result });
  } catch (error) {
    return errorJson(error);
  }
}

function compactFiles(files: z.infer<typeof schema>["referenceFiles"]) {
  return (files ?? []).slice(0, 5).map((file) => ({
    name: file.name,
    type: file.type,
    ok: file.ok,
    text: file.text ? truncateText(file.text, 1000) : undefined,
    error: file.error,
  }));
}
