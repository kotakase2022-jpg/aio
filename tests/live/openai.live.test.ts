import { describe, expect, test, vi } from "vitest";
import type { ArticleFormPayload, CompetitorResearchResult, FetchResult } from "@/types/aio";
import {
  cleanEnvValue,
  expectLiveContractEnabled,
  expectRequiredEnv,
  loadLiveEnv,
} from "./live-test-helpers";
import { writeOpenAILiveArtifact } from "./openai-live-artifacts";

describe("OpenAI live sandbox contract", () => {
  test(
    "Responses API contract passes before real generation samples are evaluated",
    async () => {
      loadLiveEnv();
      expectLiveContractEnabled();
      expectRequiredEnv(["OPENAI_API_KEY"]);
      applyOpenAILiveModelOverride();
      vi.resetModules();

      const { createStructuredResponse, getTextModel } = await import("@/lib/server/openai");
      const health = await createStructuredResponse<{ ok: boolean; summary: string }>({
        instructions:
          "Return JSON only. Keep the summary short and mention AIO article generation.",
        input: "Live sandbox contract check for AIO article generation.",
        schemaName: "aio_live_openai_contract",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            summary: { type: "string" },
          },
          required: ["ok", "summary"],
        },
        maxOutputTokens: 300,
        timeoutMs: 60_000,
      });

      expect(getTextModel()).toBeTruthy();
      expect(health.ok).toBe(true);
      expect(health.summary.length).toBeGreaterThan(8);

      const { generateAioArticle } = await import("@/lib/server/article-generation");
      const minScore = Number(cleanEnvValue(process.env.AIO_LIVE_GENERATION_MIN_SCORE) || 75);

      for (const sample of liveGenerationSamples) {
        const form = buildLiveForm(sample);
        const fetchedReferences: FetchResult[] = [
          {
            url: sample.referenceUrl,
            title: sample.referenceTitle,
            text: sample.referenceText,
            ok: true,
            sourceType: "manual",
          },
        ];
        const fetchedCompetitors: FetchResult[] = sample.competitorText
          ? [
              {
                url: "https://sandbox.example.com/competitor",
                title: "Sandbox competitor note",
                text: sample.competitorText,
                ok: true,
                sourceType: "manual",
              },
            ]
          : [];
        const result = await generateAioArticle({
          form,
          fetchedReferences,
          fetchedCompetitors,
          competitorResearch: sample.competitorResearch ?? null,
        });

        const improvements = result.aio_score_self_evaluation.improvements.join(" ");

        expect(result.selected_title, sample.name).toBeTruthy();
        expect(result.body_html, sample.name).toContain("<h2");
        expect(result.faq_items.length, sample.name).toBeGreaterThanOrEqual(3);
        expect(result.image_prompts, sample.name).toHaveLength(0);
        expect(result.aio_score_self_evaluation.score, sample.name).toBeGreaterThanOrEqual(
          minScore,
        );
        expect(improvements, sample.name).not.toContain("テーマ・キーワードの固有語彙");
        expect(improvements, sample.name).not.toContain("一次情報の固有語彙");
        expect(improvements, sample.name).not.toContain("参照情報の固有語彙");

        const artifact = await writeOpenAILiveArtifact({
          sampleName: sample.name,
          textModel: getTextModel(),
          minScore,
          form,
          fetchedReferences,
          fetchedCompetitors,
          competitorResearch: sample.competitorResearch ?? null,
          result,
        });
        if (artifact) {
          console.log(`OpenAI live artifact written: ${artifact.htmlPath}`);
        }
      }
    },
    480_000,
  );
});

type LiveGenerationSample = {
  name: string;
  theme: string;
  primaryInfo: string;
  referenceUrl: string;
  referenceTitle: string;
  referenceText: string;
  competitorText?: string;
  competitorResearch?: CompetitorResearchResult;
};

const liveGenerationSamples: LiveGenerationSample[] = [
  {
    name: "one-person contractor workers compensation",
    theme:
      "一人親方の労災保険。キーワード: 加入条件、給付基礎日額、費用、補償開始日。想定読者: 建設業の一人親方。",
    primaryInfo:
      "当社の支援現場では、一人親方から「自分が特別加入の対象か」「給付基礎日額をいくらにすべきか」という相談が多い。LINEで口頭確認だけが残り、帳票不在のまま進むケースもあるため、加入前に業務内容、開始希望日、費用負担者を整理する必要がある。",
    referenceUrl: "https://sandbox.example.com/reference/oyakata",
    referenceTitle: "Sandbox one-person contractor reference",
    referenceText:
      "一人親方労災保険では、特別加入、加入条件、給付基礎日額、補償開始日、労働保険事務組合の確認が重要である。未確認の費用や対象範囲は断定せず、事前に参照元と本人の業務実態を照合する必要がある。",
  },
  {
    name: "SaaS onboarding operations",
    theme:
      "BtoB SaaSのオンボーディング改善。キーワード: 初期設定、利用定着、管理者教育、解約防止。想定読者: カスタマーサクセス責任者。",
    primaryInfo:
      "当社の支援では、初期設定が完了していても管理者教育が薄く、3週目に利用定着が止まる相談が多い。解約理由は機能不足よりも、社内承認フローと運用担当が曖昧なことに寄りやすい。",
    referenceUrl: "https://sandbox.example.com/reference/saas-onboarding",
    referenceTitle: "Sandbox SaaS onboarding reference",
    referenceText:
      "BtoB SaaSのオンボーディングでは、初期設定、管理者教育、利用定着、ヘルススコア、解約防止、社内承認フローを分けて確認する必要がある。",
    competitorText:
      "競合記事はオンボーディングチェックリストと初期設定手順を中心に解説している。差別化ポイントは、管理者教育、3週目の定着確認、社内承認フローの失敗例である。",
    competitorResearch: {
      summary: "競合は初期設定手順に偏り、利用定着と管理者教育の運用論が薄い。",
      queries: ["SaaS オンボーディング 初期設定", "SaaS 利用定着 管理者教育"],
      insights: [
        {
          url: "https://sandbox.example.com/competitor/saas",
          title: "競合オンボーディング記事",
          majorPoints: ["初期設定手順", "チェックリスト"],
          differentiationPoints: ["管理者教育", "3週目の利用定着", "社内承認フロー"],
          recommendations: ["競合との差別化として、運用担当と定着確認の失敗例を入れる"],
        },
      ],
    },
  },
  {
    name: "AIO content operations",
    theme:
      "BtoBマーケティングチーム向けAIO記事制作フロー。キーワード: 参照情報、一次情報、競合調査、WordPress投稿。",
    primaryInfo:
      "当社の制作現場では、汎用AIチャットに投げるだけだと参照情報と一次情報が混ざり、承認時に出典確認で戻ることが多い。WordPress投稿前の編集チェックが品質を左右する。",
    referenceUrl: "https://sandbox.example.com/reference/aio-workflow",
    referenceTitle: "Sandbox AIO workflow reference",
    referenceText:
      "AIO記事制作では、参照情報、一次情報、競合調査、構成案、本文HTML、FAQ、メタディスクリプション、WordPress下書き投稿までを分けて管理する必要がある。",
  },
];

function buildLiveForm(sample: LiveGenerationSample): ArticleFormPayload {
  return {
    references: [
      {
        id: `live-reference-${sample.name}`,
        text: sample.referenceText,
      },
    ],
    competitors: sample.competitorText
      ? [
          {
            id: `live-competitor-${sample.name}`,
            text: sample.competitorText,
          },
        ]
      : [],
    referenceFiles: [],
    competitorFiles: [],
    theme: sample.theme,
    primaryInfo: sample.primaryInfo,
    closingText:
      "詳しい運用設計や記事制作フローの見直しは、問い合わせフォームからご相談ください。",
    author: {
      name: "Live Sandbox Editor",
      title: "AIO Content Reviewer",
      bio: "Sandbox-only test author.",
    },
    visualTone: {
      mode: "preset",
      preset: "シンプルなBtoBホワイトペーパー風",
    },
    imageCount: 0,
    wordCount: 2000,
  };
}

function applyOpenAILiveModelOverride() {
  const liveModel = cleanEnvValue(process.env.OPENAI_LIVE_TEXT_MODEL);
  if (liveModel) {
    process.env.OPENAI_TEXT_MODEL = liveModel;
  }
}
