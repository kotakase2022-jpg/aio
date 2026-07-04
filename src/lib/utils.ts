import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinCsv(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

export function truncateText(value: string, maxLength = 20000): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n\n[truncated]`;
}

export function parseCsvRows(value: string): string[][] {
  if (!value.trim()) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    throw new Error("CSV has an unterminated quoted field.");
  }

  if (row.length === 0 && cell === "" && /[\r\n]$/.test(value)) {
    return rows;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

export function parseCsvObjects(value: string): Record<string, string>[] {
  const [headers, ...rows] = parseCsvRows(value);
  if (!headers) {
    return [];
  }

  return rows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), row[index] ?? ""])),
    );
}
