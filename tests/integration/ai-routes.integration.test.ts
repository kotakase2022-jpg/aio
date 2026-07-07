import { describe, expect, test, vi } from "vitest";
import type { CompetitorResearchResult, ThemeCandidateResult } from "@/types/aio";

vi.mock("@/lib/server/openai", () => ({
  createStructuredResponse: vi.fn(),
}));

describe("AI route handlers", () => {
  test("theme candidates route compacts uploaded file text and requests structured output", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const result: ThemeCandidateResult = {
      summary: "AIO候補を生成しました。",
      candidates: [
        {
          title: "現場情報を活かしたAIO記事設計",
          keywords: ["AIO", "一次情報"],
          targetReader: "BtoBマーケ担当者",
          searchIntent: "AI検索に強い記事テーマを決めたい",
          angle: "一次情報を差別化軸にする",
        },
      ],
    };
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(result);
    const { POST } = await import("@/app/api/theme-candidates/route");

    const response = await POST(
      new Request("http://localhost/api/theme-candidates", {
        method: "POST",
        body: JSON.stringify({
          references: [{ url: "https://example.com/ref", text: "reference ".repeat(300) }],
          competitors: [{ text: "competitor ".repeat(300) }],
          referenceFiles: [
            {
              name: "field-notes.txt",
              type: "text/plain",
              ok: true,
              text: "uploaded reference ".repeat(200),
            },
          ],
          competitorFiles: [],
          competitorResearch: null,
          currentTheme: "theme ".repeat(300),
          primaryInfo: "field observation ".repeat(200),
        }),
      }),
    );
    const json = await response.json();
    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: {
        references: Array<{ text?: string }>;
        referenceFiles: Array<{ text?: string }>;
        currentTheme: string;
        primaryInfo: string;
      };
    };

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, result });
    expect(call?.schemaName).toBe("theme_candidates");
    expect(call?.tools).toEqual([{ type: "web_search" }]);
    expect(input.payload.references[0].text?.startsWith("reference ")).toBe(true);
    expect(input.payload.references[0].text).toContain("[truncated]");
    expect(input.payload.referenceFiles[0].text).toContain("[truncated]");
    expect(input.payload.currentTheme).toContain("[truncated]");
    expect(input.payload.primaryInfo).toContain("[truncated]");
    expect(input.payload.primaryInfo).toContain("field observation");
    expect(call?.instructions).toContain("primary first-party information");
    expect(call?.instructions).toContain("original angles");
    expect(call?.instructions).toContain("Do not paste it verbatim");
  });

  test("competitor research route limits payload size before web search", async () => {
    const { createStructuredResponse } = await import("@/lib/server/openai");
    const result: CompetitorResearchResult = {
      summary: "競合論点を整理しました。",
      queries: ["AIO BtoB 記事"],
      insights: [
        {
          url: "https://competitor.example.com",
          title: "競合記事",
          majorPoints: ["比較表"],
          differentiationPoints: ["一次情報"],
          recommendations: ["現場例を追加"],
        },
      ],
    };
    vi.mocked(createStructuredResponse).mockResolvedValueOnce(result);
    const { POST } = await import("@/app/api/competitor-research/route");

    const response = await POST(
      new Request("http://localhost/api/competitor-research", {
        method: "POST",
        body: JSON.stringify({
          references: Array.from({ length: 7 }, (_, index) => ({
            url: `https://example.com/ref-${index}`,
            text: "reference ".repeat(200),
          })),
          competitors: Array.from({ length: 7 }, (_, index) => ({
            url: `https://example.com/competitor-${index}`,
            text: "competitor ".repeat(200),
          })),
          referenceFiles: [
            {
              name: "reference.txt",
              type: "text/plain",
              ok: true,
              text: "file reference ".repeat(200),
            },
          ],
          competitorFiles: [],
          theme: "theme ".repeat(300),
          keywords: "keyword ".repeat(120),
        }),
      }),
    );
    const json = await response.json();
    const call = vi.mocked(createStructuredResponse).mock.calls.at(-1)?.[0];
    const input = JSON.parse(String(call?.input)) as {
      payload: {
        references: Array<{ text?: string }>;
        competitors: Array<{ text?: string }>;
        referenceFiles: Array<{ text?: string }>;
        theme: string;
        keywords: string;
      };
    };

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, result });
    expect(call?.schemaName).toBe("competitor_research");
    expect(call?.tools).toEqual([{ type: "web_search" }]);
    expect(input.payload.references).toHaveLength(5);
    expect(input.payload.competitors).toHaveLength(5);
    expect(input.payload.references[0].text).toContain("[truncated]");
    expect(input.payload.referenceFiles[0].text).toContain("[truncated]");
    expect(input.payload.theme).toContain("[truncated]");
    expect(input.payload.keywords).toContain("[truncated]");
  });
});
