import type { ArticleFormPayload } from "@/types/aio";

// Synthetic brief using only the scoped example supplied in the change request.
// This is not a customer generation log or a verified commercial offer.
export const deltaNov11Form: ArticleFormPayload = {
  references: [{ id: "delta-reference", text: "中小企業の資金調達には融資とファクタリングなどの選択肢があります。融資は返済原資、ファクタリングは売掛金の有無と契約条件を確認します。具体的な料率、入金期間や成功実績はここでは提示していません。" }],
  competitors: [{ id: "delta-competitor", text: "比較対象の記事は相談先の一覧を扱っています。必要書類、返済負担、希望時期、売掛金の有無で判断するための材料を読者に示してください。" }],
  theme: "資金繰りに悩む中小企業経営者向け。融資とファクタリングについて必要書類、返済負担、相談時期を整理し、自社に合う選択基準を示す。",
  audienceType: "btob",
  articleStructure: "comparison",
  structureInstruction: "読者が自社の条件と照合して判断できる順序。相談先の羅列で終わらない。",
  primaryInfoTypes: ["criteria-knowhow"],
  primaryInfo: "デルタのファクタリング相談では希望日の5営業日前に相談してください。この目安はデルタのファクタリング相談に限定します。融資や資金調達全般の目安ではありません。デルタでは相談時に資金使途、必要時期、返済原資、売掛金の有無を整理しています。実際の料率や入金日は個別条件の確認が必要です。",
  tableMode: "auto",
  supplementalFaqMode: "auto",
  closingText: "資金使途と希望時期を整理し、契約条件を個別に確認してから相談してください。",
  author: {},
  visualTone: { mode: "preset", preset: "コンサルティング資料風" },
  imageCount: 0,
  wordCount: 1000,
};
