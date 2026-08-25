export const primaryInformationOptions = [
  {
    id: "frequent-consultations",
    label: "顧客・現場から多い相談",
    description: "日常的に寄せられる相談や、繰り返し起きる課題",
  },
  {
    id: "case-results",
    label: "自社の支援事例・成果",
    description: "支援前後の変化、成果が出た条件、再現できた進め方",
  },
  {
    id: "failures-lessons",
    label: "失敗例・改善の教訓",
    description: "うまくいかなかった方法と、現場で見直した判断",
  },
  {
    id: "original-data",
    label: "独自データ・調査結果",
    description: "自社集計、アンケート、利用状況、問い合わせ傾向",
  },
  {
    id: "criteria-knowhow",
    label: "自社の判断基準・ノウハウ",
    description: "比較基準、優先順位、チェック項目、運用ルール",
  },
  {
    id: "customer-voice",
    label: "顧客の声・具体的な反応",
    description: "顧客が使った言葉、導入時の不安、導入後の反応",
  },
  {
    id: "service-background",
    label: "商品・サービス開発の背景",
    description: "なぜ作ったか、どの課題を解くか、設計上のこだわり",
  },
  {
    id: "expert-opinion",
    label: "自社独自の見解・提言",
    description: "業界の常識と異なる考え、今後重視すべき論点",
  },
] as const;

export type PrimaryInformationType = (typeof primaryInformationOptions)[number]["id"];

const primaryInformationTypeSet = new Set<string>(
  primaryInformationOptions.map((option) => option.id),
);

export function isPrimaryInformationType(value: string): value is PrimaryInformationType {
  return primaryInformationTypeSet.has(value);
}

export function primaryInformationLabels(types: readonly string[]) {
  return types.flatMap((type) => {
    const option = primaryInformationOptions.find((candidate) => candidate.id === type);
    return option ? [option.label] : [];
  });
}

export function primaryInformationTypesForRestore(
  types: readonly string[] | undefined,
): PrimaryInformationType[] {
  return (types ?? []).filter(isPrimaryInformationType);
}
