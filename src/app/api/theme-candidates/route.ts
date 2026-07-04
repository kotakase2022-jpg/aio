import { z } from "zod";
import { themeCandidateSchema } from "@/lib/server/ai-schemas";
import { createStructuredResponse } from "@/lib/server/openai";
import { errorJson, okJson } from "@/lib/server/http";
import { truncateText } from "@/lib/utils";
import type { ThemeCandidateResult } from "@/types/aio";

export const runtime = "nodejs";
export const maxDuration = 90;

const fileSchema = z.object({
  name: z.string(),
  type: z.string(),
  ok: z.boolean(),
  text: z.string().optional(),
  error: z.string().optional(),
});

const inputSchema = z.object({
  references: z.array(z.object({ url: z.string().optional(), text: z.string().optional() })),
  competitors: z.array(z.object({ url: z.string().optional(), text: z.string().optional() })),
  referenceFiles: z.array(fileSchema).optional(),
  competitorFiles: z.array(fileSchema).optional(),
  competitorResearch: z.record(z.string(), z.unknown()).optional().nullable(),
  currentTheme: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = inputSchema.parse(await request.json());
    const result = await createStructuredResponse<ThemeCandidateResult>({
      schemaName: "theme_candidates",
      schema: themeCandidateSchema,
      tools: [{ type: "web_search" }],
      instructions: [
        "You are a Japanese BtoB AIO/SEO content strategist.",
        "Suggest article theme and keyword candidates from the provided reference material, competitor material, uploaded file extracts, and optional existing competitor research.",
        "Use web_search only when URL context or current competitor context is needed.",
        "Return only structured JSON matching the schema.",
      ].join("\n"),
      input: JSON.stringify({
        task:
          "参照情報と競合情報をもとに、AIO記事に適したテーマ・キーワード候補を3〜5案、日本語で提案してください。各候補は、記事タイトル案、主要キーワード、想定読者、検索意図、差別化できる切り口を含めてください。未確認の情報は断定しないでください。",
        payload: compactPayload(payload),
      }),
      timeoutMs: 75_000,
      maxOutputTokens: 2800,
    });

    return okJson({ result });
  } catch (error) {
    return errorJson(error);
  }
}

function compactPayload(payload: z.infer<typeof inputSchema>) {
  return {
    references: payload.references.slice(0, 8).map((item) => ({
      url: item.url,
      text: item.text ? truncateText(item.text, 1200) : undefined,
    })),
    competitors: payload.competitors.slice(0, 8).map((item) => ({
      url: item.url,
      text: item.text ? truncateText(item.text, 1200) : undefined,
    })),
    referenceFiles: compactFiles(payload.referenceFiles),
    competitorFiles: compactFiles(payload.competitorFiles),
    competitorResearch: payload.competitorResearch,
    currentTheme: payload.currentTheme ? truncateText(payload.currentTheme, 800) : "",
  };
}

function compactFiles(files: z.infer<typeof fileSchema>[] | undefined) {
  return (files ?? []).slice(0, 8).map((file) => ({
    name: file.name,
    type: file.type,
    ok: file.ok,
    text: file.text ? truncateText(file.text, 1500) : undefined,
    error: file.error,
  }));
}
