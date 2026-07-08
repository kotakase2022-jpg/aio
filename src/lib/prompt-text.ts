export function truncatePromptLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (maxLength <= 0) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  if (maxLength === 1) {
    return "…";
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}
