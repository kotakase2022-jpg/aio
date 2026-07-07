export function qualityCheckEditGuidance(checkId: string) {
  if (checkId.startsWith("title-")) {
    return "修正先: タイトル。テーマ、一次情報、読者の判断軸が伝わる表現にします。";
  }

  if (checkId.startsWith("meta-description-")) {
    return "修正先: メタディスクリプション。検索結果で読む理由が伝わるよう、記事固有の判断軸、一次情報、対象読者を短く入れます。";
  }

  if (checkId === "faq-count") {
    return "修正先: FAQ。読者の不安、比較、次の行動に答える質問を追加します。";
  }

  if (checkId === "faq-answer-specificity") {
    return "修正先: FAQ回答。条件、例、注意点、判断基準を足します。";
  }

  if (checkId.startsWith("faq-")) {
    return "修正先: FAQ質問。テーマ、一次情報、競合差分に基づく具体的な問いにします。";
  }

  if (checkId === "primary-info-digestion") {
    return "修正先: 本文HTML。一次情報の固有語彙を残しつつ、読者向けの判断材料や注意点へ言い換えます。";
  }

  if (checkId === "reference-info-digestion") {
    return "修正先: 本文HTML。参照元の事実は保ち、定義、条件、注意点、出典注記として再構成します。";
  }

  if (checkId === "target-reader-reflection") {
    return "修正先: 本文HTML。想定読者の課題、立場、判断基準が分かる表現を冒頭、見出し、具体例、FAQに戻します。";
  }

  if (checkId === "search-intent-reflection") {
    return "修正先: 本文HTML。検索意図に含まれる疑問、比較軸、次の行動を結論、本文、FAQで明確に答えます。";
  }

  if (checkId === "competitor-insight-digestion") {
    return "修正先: 本文HTML。競合文を写さず、比較軸、不足論点、差別化ポイントへ再構成します。";
  }

  if (checkId.includes("reference")) {
    return "修正先: 本文HTML。参照情報の固有語彙を、定義、判断基準、具体例、注意点に戻します。";
  }

  if (checkId.includes("competitor")) {
    return "修正先: 本文HTML。競合情報を比較軸、不足論点、差別化ポイントとして整理します。";
  }

  if (checkId === "target-length-alignment") {
    return "修正先: 本文HTML。指定文字数に合わせて、具体例、判断基準、注意点、不要な重複表現を増減します。";
  }

  if (checkId === "answer-first") {
    return "修正先: 本文HTML。冒頭420字以内に、結論、定義、読者が最初に判断すべきことを先に置きます。";
  }

  if (checkId === "definition") {
    return "修正先: 本文HTML。冒頭付近に「〇〇とは...」型の短い定義文を追加し、AIが引用しやすい一文にします。";
  }

  if (checkId === "editorial-headings") {
    return "修正先: 本文HTML。「重要なポイント」「メリット」「まとめ」型の見出しを、判断軸、失敗例、比較観点が伝わる表現に変えます。";
  }

  if (checkId === "section-specificity") {
    return "修正先: 本文HTML。薄いH2/H3に、数字、現場例、判断基準、失敗例、費用、期間、出典のうち2つ以上を足します。";
  }

  if (checkId === "concrete-detail") {
    return "修正先: 本文HTML。抽象説明だけで終わらせず、数字、現場例、判断基準、失敗例を少なくとも2種類追加します。";
  }

  if (checkId === "editorial-evidence") {
    return "修正先: 本文HTML。現場例、判断基準、注意点、体制、費用感、参照元の扱いを複数入れ、編集者が確認した記事に近づけます。";
  }

  if (checkId === "structured-elements") {
    return "修正先: 本文HTML。読者が比較・確認しやすいように、箇条書きとFAQの両方を本文内に追加します。";
  }

  if (checkId === "unsupported-claims") {
    return "修正先: 本文HTML。『必ず』『圧倒的』『最適』などの強い断定を、出典、条件、対象範囲、確認時点つきの表現に直します。";
  }

  if (checkId === "source-awareness") {
    return "修正先: 本文HTML。参照元で確認できる事実と未確認の解釈を分け、出典URLや確認条件を読者が追える形で残します。";
  }

  if (checkId === "theme-keyword-reflection") {
    return "修正先: 本文HTML。入力テーマ・キーワードの固有語彙を、タイトル、冒頭、見出し、FAQのいずれかに自然に戻します。";
  }

  if (checkId === "primary-info-reflection") {
    return "修正先: 本文HTML。一次情報を、当社の経験、相談傾向、現場観察、支援時の判断基準として本文に戻します。";
  }

  if (checkId === "primary-info-opening-placement") {
    return "修正先: 本文HTML。一次情報の固有語彙を、冒頭の結論・定義・読者の判断材料にも戻します。";
  }

  if (checkId === "cta-reflection") {
    return "修正先: 本文HTML。入力された結び文章/CTAの意図を、記事末尾の自然な次アクションとして反映します。";
  }

  if (checkId === "generic-opening-frame") {
    return "修正先: 本文HTML。冒頭をテンプレ導入ではなく、結論、定義、現場観察、条件から書き出します。";
  }

  if (checkId === "generic-opening-density") {
    return "修正先: 本文HTML。冒頭400字以内の汎用句を減らし、参照情報、一次情報、現場で見た条件、読者の判断材料から始めます。";
  }

  if (checkId === "generic-ending-frame") {
    return "修正先: 本文HTML。末尾の定型句を削り、記事固有の判断基準、次に確認する情報、問い合わせ前の準備事項に置き換えます。";
  }

  if (checkId === "generic-phrases") {
    return "修正先: 本文HTML。「近年」「重要です」「わかりやすく解説」などの汎用表現を削り、参照元の事実、一次情報、判断基準、現場例へ置き換えます。";
  }

  if (checkId === "verbose-ai-phrasing") {
    return "修正先: 本文HTML。「することができます」型の冗長な述語を、「確認します」「分けます」「できます」など短く具体的な動詞に置き換えます。";
  }

  if (checkId === "numeric-claim-support") {
    return "修正先: 本文HTML。数字の近くに出典、条件、時点、目安、現場観察を補います。";
  }

  if (checkId === "source-url-presence") {
    return "修正先: 本文HTML。本文末尾または該当箇所に、読者が確認できる出典URLを残します。";
  }

  if (checkId === "heading-storyline") {
    return "修正先: 本文HTML。まず/次に型の見出しを、判断、失敗、比較、現場差分が伝わる見出しへ変えます。";
  }

  if (checkId === "sentence-length") {
    return "修正先: 本文HTML。長い一文を、結論、条件、例外、具体例に分けて短くします。";
  }

  if (checkId === "sentence-variety") {
    return "修正先: 本文HTML。同じ語尾が続く段落を分け、断定、条件、例外、問い、短い具体例を混ぜて抑揚を出します。";
  }

  if (checkId === "connector-variety") {
    return "修正先: 本文HTML。「また」「さらに」「そのため」の連続を減らし、接続語なしの短文、現場例、条件文で段落を始めます。";
  }

  if (checkId === "sentence-frame-variety") {
    return "修正先: 本文HTML。「結論として」「具体的には」型の文頭を減らし、現場観察、比較、失敗例、例外から自然に書き出します。";
  }

  if (checkId === "comparison-table") {
    return "修正先: 本文HTML。表に判断基準、比較軸、条件、費用、期間、担当、注意点を入れます。";
  }

  return "修正先: 本文HTML。一般論を減らし、具体例、判断基準、注意点、出典への意識を足します。";
}
