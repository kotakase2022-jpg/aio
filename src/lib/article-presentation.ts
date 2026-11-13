import * as cheerio from "cheerio";
import type { ArticleElementMode, ArticleStructure } from "@/types/aio";

export type ArticlePresentation = {
  articleStructure?: ArticleStructure;
  theme?: string;
  structureInstruction?: string;
  regenerationInstruction?: string;
  tableMode?: ArticleElementMode;
  supplementalFaqMode?: ArticleElementMode;
};

export function resolveArticleStructure(input: ArticlePresentation): ArticleStructure {
  if (input.articleStructure && input.articleStructure !== "auto") return input.articleStructure;
  // The dedicated brief takes precedence over the broader theme in automatic mode.
  for (const instruction of [input.structureInstruction, input.regenerationInstruction, input.theme]) {
    if (!instruction) continue;
    const text = instruction.replace(/(?:課題解決型|問題解決型|比較型|FAQ型|Q\s*&\s*A型|ケース型|教科書型)\s*(?:ではなく|ではない|でなく|じゃなく|にしない|を避け|を除く|以外|は不要)/gi, "");
    if (/課題解決型|問題解決型|problem[ _-]solution/i.test(text)) return "problem_solution";
    if (/比較型|comparison/i.test(text)) return "comparison";
    if (/FAQ型|Q\s*&\s*A(?:型|中心)|質問と回答を中心/i.test(text)) return "faq";
    if (/ケース型|case study/i.test(text)) return "case";
    if (/教科書型|textbook/i.test(text)) return "textbook";
  }
  return "auto";
}

export function readElementMode(value: unknown): ArticleElementMode {
  return value === "none" || value === "on" ? value : "auto";
}

export function readArticleStructure(value: unknown): ArticleStructure {
  return value === "textbook" || value === "faq" || value === "case" || value === "comparison" || value === "problem_solution" ? value : "auto";
}

export function buildPresentationInstruction(input: ArticlePresentation) {
  const structure = resolveArticleStructure(input);
  const plans: Record<ArticleStructure, string> = {
    auto: "Infer an appropriate structure from the editorial brief; do not default to a textbook template.",
    textbook: "Explain the concept, alternatives, criteria, conditions and cautions systematically.",
    faq: "The MAIN body_html must be Q&A-centered: at least 3 concrete question H2 headings ending in ？, each immediately followed by its answer. Allocate most body text to those answers, not to a normal explanatory article. Keep the opening short. Do not wrap the main questions in a generic FAQ/よくある質問 section. Main Q&A is edited in body_html, NOT faq_items.",
    case: "Follow ONE concrete scenario throughout the WHOLE article, not a generic comparison article with one example added near the end. Start the first H2 with the scenario and its assumptions, then organize subsequent H2 sections around that same situation's options, decision forks and next action. If no verified case is supplied, label it explicitly as a hypothetical 想定例/仮想ケース in the first scenario heading and never invent company results or figures. The short opening must state that scenario's conditional decision; general definitions and comparison tables only support that case.",
    comparison: "Organize the WHOLE article around comparison axes and selection criteria: compare alternatives under the same conditions across multiple H2 sections, then explain which option fits which situation. A comparison table alone is NOT a comparison article.",
    problem_solution: "Organize in order: 問題 -> 原因 -> 対処方法 -> 判断基準 -> 行動. Use meaningful H2 headings for these five stages and make the next action practical and conditional, not a generic conclusion.",
  };
  return [
    `Structure plan: ${structure === "faq" ? "FAQ" : structure}. ${plans[structure]}`,
    "Apply theme, structureInstruction and regenerationInstruction to the plan as well as the copy. Explicit structure selection and element modes override conflicting free-text requests.",
    input.tableMode === "none"
      ? "Tables: none. Do not emit any table elements; explain comparisons in prose or lists."
      : input.tableMode === "on"
        ? "Tables: required. Include a useful source-backed table with meaningful comparison/decision axes. Never invent values to fill cells."
        : "Tables: automatic. Use a table only if comparable alternatives/conditions and enough evidence make it useful; otherwise omit it. Tables are NOT mandatory.",
    input.supplementalFaqMode === "none"
      ? "Supplemental FAQ: none. Return faq_items: []; do not add a closing FAQ block. This does NOT disable the main Q&A body of an FAQ-type article."
      : input.supplementalFaqMode === "on"
        ? "Supplemental FAQ: required. Return 1-3 useful unanswered questions in faq_items. Never duplicate main-body questions."
        : "Supplemental FAQ: automatic. Return [] when the main body already resolves the reader's questions. Otherwise return only necessary, nonduplicate follow-up questions in faq_items. Do NOT add FAQ automatically to every article.",
    "faq_items is ONLY the supplemental FAQ. Never repeat it in body_html. Keep main Q&A questions and supplemental questions distinct, even when answers are paraphrased.",
  ].join("\n");
}

export function convertTablesToProse(html: string) {
  if (!/<table\b/i.test(html)) return html;
  const $ = cheerio.load(html, null, false);
  // Keep cell content and links; the explicit 'none' preference removes the format,
  // not the evidence an editor may have entered in a table.
  $("table").toArray().reverse().forEach((table) => {
    const caption = $(table).children("caption").html();
    const rows = $(table).find("tr").map((_, row) =>
      `<p>${$(row).children("th, td").map((__, cell) => $(cell).html() ?? "").get().join(" / ")}</p>`,
    ).get().join("");
    $(table).replaceWith(`<div class="aio-table-text">${caption ? `<p>${caption}</p>` : ""}${rows}</div>`);
  });
  return $.root().html() ?? "";
}

export function mainQuestionHeadings(html: string) {
  const $ = cheerio.load(html, null, false);
  $(".aio-faq-block, .aio-source-block, .aio-author-block").remove();
  return $("h2, h3").map((_, element) => $(element).text().trim()).get().filter((text) => /[?？]$|(?:ですか|ますか)[。.]?$/.test(text));
}
