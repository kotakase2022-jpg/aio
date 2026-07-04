import { describe, expect, test } from "vitest";
import { extractAttachmentText } from "@/lib/server/file-extraction";
import { ApiError } from "@/lib/server/http";

describe("extractAttachmentText", () => {
  test("extracts UTF-8 text and strips BOM", async () => {
    const text = await extractAttachmentText({
      buffer: Buffer.from("\uFEFFAIO reference text for extraction."),
      filename: "reference.txt",
      contentType: "text/plain",
    });

    expect(text).toBe("AIO reference text for extraction.");
  });

  test("extracts visible HTML metadata and body while ignoring scripts", async () => {
    const html = `
      <html>
        <head><title>AIO HTML</title><meta name="description" content="Reference description"></head>
        <body><main><h1>Main heading</h1><p>Useful article body text for AIO.</p></main><script>secret()</script></body>
      </html>
    `;

    const text = await extractAttachmentText({
      buffer: Buffer.from(html),
      filename: "reference.html",
      contentType: "text/html",
    });

    expect(text).toContain("AIO HTML");
    expect(text).toContain("Reference description");
    expect(text).toContain("Useful article body text for AIO.");
    expect(text).not.toContain("secret");
  });

  test("rejects empty and unsupported files with ApiError", async () => {
    await expect(
      extractAttachmentText({
        buffer: Buffer.alloc(0),
        filename: "empty.txt",
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 400 });

    await expect(
      extractAttachmentText({
        buffer: Buffer.from("name,value\nAIO,1"),
        filename: "input.csv",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
