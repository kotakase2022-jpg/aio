import { describe, expect, test, vi } from "vitest";
import type { ArticleFormPayload, CompetitorResearchResult, FetchResult } from "@/types/aio";
import {
  cleanEnvValue,
  expectLiveContractEnabled,
  expectRequiredEnv,
  loadLiveEnv,
} from "./live-test-helpers";
import {
  resolveOpenAILiveArtifactDir,
  shouldWriteOpenAILiveArtifacts,
  writeOpenAILiveArtifact,
} from "./openai-live-artifacts";

describe("OpenAI live sandbox contract", () => {
  test(
    "Responses API contract passes before real generation samples are evaluated",
    async () => {
      loadLiveEnv();
      expectLiveContractEnabled();
      expectRequiredEnv(["OPENAI_API_KEY"]);
      applyOpenAILiveModelOverride();
      if (shouldWriteOpenAILiveArtifacts()) {
        resolveOpenAILiveArtifactDir();
      }
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
      }
    },
    480_000,
  );
});

type LiveGenerationSample = {
  name: string;
  audienceType: NonNullable<ArticleFormPayload["audienceType"]>;
  articleStructure: NonNullable<ArticleFormPayload["articleStructure"]>;
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
    name: "delta financing textbook",
    audienceType: "btob",
    articleStructure: "textbook",
    theme:
      "中小企業の資金調達。キーワード: 資金繰り、融資、ファクタリング、必要書類。想定読者: 資金調達手段を比較する中小企業経営者。",
    primaryInfo:
      "当社への相談では、資金調達手段を金利や入金速度だけで選び、必要書類や返済負担の確認が後回しになるケースがある。最初に資金使途、必要時期、返済原資、売掛金の有無を整理している。",
    referenceUrl: "https://sandbox.example.com/reference/delta-financing",
    referenceTitle: "Sandbox Delta financing reference",
    referenceText:
      "中小企業の資金調達では、融資、ファクタリング、補助金などで対象、必要書類、審査、入金時期、返済または手数料の条件が異なる。個別条件を確認せず一般的な基準として断定してはならない。",
  },
  {
    name: "delta financing case",
    audienceType: "btob",
    articleStructure: "case",
    theme:
      "中小企業の資金調達をケース型で解説。キーワード: 運転資金、売掛金、融資、判断条件。想定読者: 入金までの資金繰りに悩む中小企業経営者。",
    primaryInfo:
      "当社への相談では、売上は計上済みでも入金前に仕入れや給与の支払いが来る状況がある。実際の支援実績を装わず、仮想事例では資金使途、必要時期、返済原資、売掛金の確度を判断の分かれ目として示している。",
    referenceUrl: "https://sandbox.example.com/reference/delta-case",
    referenceTitle: "Sandbox Delta case reference",
    referenceText:
      "運転資金の調達方法は、資金使途、必要時期、返済原資、売掛金の有無、必要書類によって選択肢が変わる。仮想事例は仮定と明示し、特定企業の実績として扱わない。",
    competitorText:
      "競合記事は資金調達方法の一覧を中心に説明している。差別化ポイントは、具体的な状況、前提条件、選択肢、判断の分かれ目を仮想事例で示すことである。",
    competitorResearch: {
      summary: "競合は方法一覧に偏り、条件ごとの判断の分かれ目が薄い。",
      queries: ["中小企業 資金調達 方法", "運転資金 売掛金 融資"],
      insights: [
        {
          url: "https://sandbox.example.com/competitor/delta",
          title: "競合資金調達記事",
          majorPoints: ["資金調達方法一覧", "融資とファクタリング"],
          differentiationPoints: ["前提条件", "判断の分かれ目", "仮想事例の明示"],
          recommendations: ["実績と誤認されない仮想事例で選択肢の判断条件を示す"],
        },
      ],
    },
  },
  {
    name: "aniha oral care faq",
    audienceType: "btoc",
    articleStructure: "faq",
    theme:
      "犬猫のオーラルケアをFAQ型で解説。キーワード: 歯磨き、口臭、口の変化、動物病院への相談。想定読者: 犬猫と暮らす一般の飼い主。",
    primaryInfo:
      "当院では、飼い主から『歯磨きを嫌がる』『口臭が気になる』『どの変化で受診すべきか』という相談が多い。無理に歯磨きを続けるのではなく、食べ方や口の触られ方の変化を記録して相談材料にしてもらう。",
    referenceUrl: "https://sandbox.example.com/reference/aniha-oral-care",
    referenceTitle: "Sandbox Aniha oral care reference",
    referenceText:
      "犬猫のオーラルケアでは、歯磨きの方法だけでなく、口臭、食べ方、口を触られる反応などの変化を観察する。診断や受診時期を一律に断定せず、異変が続く場合は獣医師へ相談する。",
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
    audienceType: sample.audienceType,
    articleStructure: sample.articleStructure,
    primaryInfo: sample.primaryInfo,
    closingText:
      sample.audienceType === "btoc"
        ? "口の変化が続く場合や判断に迷う場合は、記録した内容を添えて動物病院へ相談してください。"
        : "自社に合う資金調達条件を整理したい場合は、必要時期と資金使途を添えて問い合わせフォームからご相談ください。",
    author: {
      name: "Live Sandbox Editor",
      title: "AIO Content Reviewer",
      bio: "Sandbox-only test author.",
    },
    visualTone: {
      mode: "preset",
      preset:
        sample.audienceType === "btoc"
          ? "温かみのある生活者向け編集記事風"
          : "コンサルティング資料風",
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
