export function englishTokenAppearsInText(term: string, text: string) {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_])${escapedTerm}(?![A-Za-z0-9_])`, "i").test(text);
}
