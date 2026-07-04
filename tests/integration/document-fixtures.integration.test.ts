import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { extractAttachmentText } from "@/lib/server/file-extraction";

const fixtureDir = path.join(process.cwd(), "tests", "fixtures", "files");

describe("document fixture extraction", () => {
  test.each([
    ["sample.pdf", "AIO PDF fixture content"],
    ["sample.docx", "AIO DOCX fixture content"],
    ["sample.pptx", "AIO PPTX fixture content"],
    ["sample.xlsx", "AIO XLSX fixture content"],
  ])("extracts readable text from %s", async (filename, expectedText) => {
    const buffer = await readFile(path.join(fixtureDir, filename));

    const text = await extractAttachmentText({
      buffer,
      filename,
      contentType: contentTypeFor(filename),
    });

    expect(text).toContain(expectedText);
    expect(text.length).toBeGreaterThan(40);
  });
});

function contentTypeFor(filename: string) {
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (filename.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
