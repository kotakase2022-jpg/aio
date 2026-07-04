import { describe, expect, test } from "vitest";

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
});
