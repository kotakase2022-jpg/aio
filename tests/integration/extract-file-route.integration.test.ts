import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const fixtureDir = path.join(process.cwd(), "tests", "fixtures", "files");

describe("extract-file-content route", () => {
  test("extracts uploaded text file into attachment payload", async () => {
    const { POST } = await import("@/app/api/extract-file-content/route");
    const formData = new FormData();
    formData.set(
      "file",
      new File(["AIO uploaded reference text."], "reference.txt", { type: "text/plain" }),
    );

    const response = await POST(
      new Request("http://localhost/api/extract-file-content", {
        method: "POST",
        body: formData,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.attachment).toMatchObject({
      name: "reference.txt",
      ok: true,
      text: "AIO uploaded reference text.",
    });
  });

  test("rejects missing and oversized files without crashing", async () => {
    const { POST } = await import("@/app/api/extract-file-content/route");

    const missing = await POST(
      new Request("http://localhost/api/extract-file-content", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({ ok: false, error: "File is required." });

    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array(12 * 1024 * 1024 + 1)], "large.txt", { type: "text/plain" }),
    );
    const oversized = await POST(
      new Request("http://localhost/api/extract-file-content", {
        method: "POST",
        body: formData,
      }),
    );
    expect(oversized.status).toBe(400);
    await expect(oversized.json()).resolves.toMatchObject({ ok: false, error: "File is too large." });
  });

  test.each([
    ["sample.pdf", "AIO PDF fixture content"],
    ["sample.docx", "AIO DOCX fixture content"],
    ["sample.pptx", "AIO PPTX fixture content"],
    ["sample.xlsx", "AIO XLSX fixture content"],
  ])("extracts %s through the upload API payload", async (filename, expectedText) => {
    const { POST } = await import("@/app/api/extract-file-content/route");
    const buffer = await readFile(path.join(fixtureDir, filename));
    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array(buffer)], filename, { type: contentTypeFor(filename) }),
    );

    const response = await POST(
      new Request("http://localhost/api/extract-file-content", {
        method: "POST",
        body: formData,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.attachment).toEqual(
      expect.objectContaining({
        name: filename,
        ok: true,
        type: contentTypeFor(filename),
      }),
    );
    expect(json.attachment.text).toContain(expectedText);
    expect(json.attachment.textLength).toBe(json.attachment.text.length);
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
