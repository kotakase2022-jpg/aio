export const UNKNOWN_QUALITY_REGENERATION_ACTION =
  "診断された問題に対して、本文・タイトル・FAQの該当箇所を特定し、参照情報、一次情報、競合差分、具体例、注意点を補って自然に書き直す。";

export function qualityRegenerationAction(checkId: string) {
  if (checkId.startsWith("title-")) {
    return "タイトルを、テーマ・一次情報・読者の判断軸が一目で分かる具体表現に変える。";
  }

  if (checkId === "answer-first") {
    return "冒頭400字以内で、結論、定義、読者が最初に判断すべきことを先に示す。";
  }

  if (checkId === "generic-opening-frame") {
    return "冒頭を背景説明から始めず、結論、定義、現場観察、条件のいずれかで書き出す。In today's fast-paced digital landscape、ever-evolving landscape型の英語定型導入も削る。";
  }

  if (checkId === "generic-opening-density") {
    return "冒頭400字以内の近年、重要です、本記事では等を削り、参照情報、一次情報、現場で見た条件、読者の判断材料から書き出す。";
  }

  if (checkId === "generic-ending-frame") {
    return "末尾の定型句を削り、記事固有の判断基準、次に確認する情報、問い合わせ前の準備事項へ置き換える。";
  }

  if (checkId === "generic-phrases") {
    return "近年、重要です、注目されています、わかりやすく解説、today's fast-paced digital landscape、unlock the potential等の汎用句を削り、参照元の事実、一次情報、固有名詞、現場例、判断基準に置き換える。";
  }

  if (checkId === "verbose-ai-phrasing") {
    return "することができます、することが重要です等の冗長な述語を、確認します、分けます、できます等の短い動詞に直し、主語と判断を明確にする。";
  }

  if (checkId === "sentence-variety") {
    return "同じ語尾が続く段落を分割し、断定、条件、例外、問いかけを混ぜて抑揚を出す。";
  }

  if (checkId === "connector-variety") {
    return "また、さらに、そのため等の連続を減らし、短い結論文、現場例、条件文で段落を始める。";
  }

  if (checkId === "sentence-frame-variety") {
    return "結論として、具体的には等の定型文頭を減らし、現場観察、比較、失敗例から段落を始める。";
  }

  if (checkId === "numeric-claim-support") {
    return "数字の近くに、出典、条件、時点、目安、現場観察のいずれかを添える。";
  }

  if (checkId === "unsupported-claims") {
    return "必ず、完全に、誰でも等の強い断定を弱め、根拠、条件、例外、未確認情報の扱いを添える。";
  }

  if (checkId === "heading-storyline") {
    return "まず/次に/最後に型の見出しを、判断、失敗、比較、現場差分が伝わる見出しに置き換える。";
  }

  if (checkId === "editorial-headings") {
    return "重要なポイント、メリット等の見出しを、読者の判断、失敗、比較軸が分かる見出しに変える。";
  }

  if (checkId === "sentence-length") {
    return "長い一文を、結論、条件、例外、具体例に分けて短くする。";
  }

  if (checkId === "concrete-detail") {
    return "数字、固有名詞、現場例、担当、費用、期間、失敗例を増やして抽象論を減らす。";
  }

  if (checkId === "editorial-evidence") {
    return "現場観察、判断基準、失敗/リスク、体制・費用・期間、出典注記を複数種類入れる。";
  }

  if (checkId === "section-specificity") {
    return "薄いH2/H3に、数字、現場例、判断基準、失敗/注意点、体制・費用・期間、出典のうち2つ以上を足す。";
  }

  if (checkId === "structured-elements") {
    return "本文に箇条書きとFAQを入れ、読者が比較・確認・次の行動を取りやすい構造にする。";
  }

  if (checkId === "definition") {
    return "冒頭近くに、AI検索が引用しやすい「〇〇とは...」型の短い定義文を入れる。";
  }

  if (checkId === "comparison-table") {
    return "表を項目/内容だけで終えず、判断基準、比較軸、条件、費用、期間、担当、注意点を入れる。";
  }

  if (checkId === "target-length-alignment") {
    return "指定文字数に合わせて、参照情報・一次情報・競合差分にもとづく具体例や判断基準を増減する。";
  }

  if (checkId === "primary-info-reflection") {
    return "一次情報の固有語彙を、当社の経験、相談傾向、現場観察として冒頭と各H2に戻す。";
  }

  if (checkId === "primary-info-opening-placement") {
    return "一次情報の固有語彙を、冒頭400字以内の結論、定義、読者の判断材料に戻し、後半だけで触れる一般論を避ける。";
  }

  if (checkId === "primary-info-digestion") {
    return "一次情報を丸写しせず、固有語彙は残して読者向けの判断材料、例外、注意点に言い換える。";
  }

  if (checkId === "reference-info-reflection") {
    return "参照情報の固有語彙を、定義、条件、判断基準、具体例、注意点として本文に戻す。";
  }

  if (checkId === "reference-info-digestion") {
    return "参照情報を丸写しせず、事実関係は保って出典注記、条件、注意点として再構成する。";
  }

  if (checkId === "competitor-insight-reflection") {
    return "競合情報を、比較軸、不足論点、差別化ポイントとして本文に戻す。";
  }

  if (checkId === "competitor-insight-digestion") {
    return "競合文を写さず、競合の主張を比較材料と自社記事の差別化論点に言い換える。";
  }

  if (checkId === "cta-reflection") {
    return "結び文章/CTAの固有語彙を、本文末尾の自然な誘導文として必ず戻す。";
  }

  if (checkId === "theme-keyword-reflection") {
    return "テーマ・キーワードの固有語彙を、タイトル、冒頭、見出し、FAQへ自然に戻す。";
  }

  if (checkId === "target-reader-reflection") {
    return "想定読者の課題、立場、判断基準が分かる表現を、冒頭、見出し、具体例、FAQに戻す。";
  }

  if (checkId === "search-intent-reflection") {
    return "検索意図に含まれる知りたいこと、比較軸、次の行動を、結論、本文、FAQで明確に答える。";
  }

  if (checkId === "source-awareness") {
    return "未確認情報を断定せず、出典、参照元、照合状況、未確認の扱いを本文に明記する。";
  }

  if (checkId === "source-url-presence") {
    return "本文末尾または該当箇所に、読者が確認できる出典URLや参照元リンクを残す。";
  }

  if (checkId.startsWith("faq-")) {
    return "FAQを、読者の不安、条件、比較、次の行動に答える実務的な質問と回答に直す。";
  }

  return UNKNOWN_QUALITY_REGENERATION_ACTION;
}
