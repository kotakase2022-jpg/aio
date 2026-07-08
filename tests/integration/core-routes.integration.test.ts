import { describe, expect, test, vi } from "vitest";
import { sampleArticleResult, sampleFormPayload } from "../fixtures/article";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: vi.fn(),
  };
});

vi.mock("@/lib/server/article-generation", () => ({
  generateAioArticle: vi.fn(),
}));

vi.mock("@/lib/server/article-generation-job-runner", () => ({
  runArticleGenerationJob: vi.fn(),
}));

vi.mock("@/lib/server/content", () => ({
  fetchUrlContent: vi.fn(),
}));

vi.mock("@/lib/server/generation-jobs", () => ({
  createGenerationJob: vi.fn(),
}));

vi.mock("@/lib/server/storage", () => ({
  storeAsset: vi.fn(),
}));

describe("core API route handlers", () => {
  test("generate article route delegates validated payload to article generation", async () => {
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    vi.mocked(generateAioArticle).mockResolvedValueOnce(sampleArticleResult);
    const { POST } = await import("@/app/api/generate-article/route");

    const response = await POST(
      new Request("http://localhost/api/generate-article", {
        method: "POST",
        body: JSON.stringify({
          form: sampleFormPayload,
          fetchedReferences: [{ url: "https://example.com", text: "reference", ok: true }],
          fetchedCompetitors: [],
          competitorResearch: null,
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ ok: true, result: sampleArticleResult });
    expect(generateAioArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        form: expect.objectContaining({ theme: sampleFormPayload.theme }),
        fetchedReferences: expect.arrayContaining([
          expect.objectContaining({ url: "https://example.com" }),
        ]),
        fetchedCompetitors: [],
        competitorResearch: null,
      }),
    );
  });

  test("fetch URL content route validates URL and returns extracted result", async () => {
    const { fetchUrlContent } = await import("@/lib/server/content");
    vi.mocked(fetchUrlContent).mockResolvedValueOnce({
      url: "https://example.com/ref",
      title: "Reference page",
      text: "Extracted reference text",
      ok: true,
      sourceType: "url",
    });
    const { POST } = await import("@/app/api/fetch-url-content/route");

    const response = await POST(
      new Request("http://localhost/api/fetch-url-content", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com/ref" }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetchUrlContent).toHaveBeenCalledWith("https://example.com/ref");
    expect(json).toMatchObject({
      ok: true,
      result: {
        url: "https://example.com/ref",
        title: "Reference page",
      },
    });
  });

  test("upload image route stores image files and rejects non-image uploads", async () => {
    const { storeAsset } = await import("@/lib/server/storage");
    vi.mocked(storeAsset).mockResolvedValueOnce({
      url: "https://assets.example.com/article/image.png",
      path: "article-inserts/image.png",
      mode: "local",
    });
    const { POST } = await import("@/app/api/upload-image/route");
    const formData = new FormData();
    formData.append("folder", "article-inserts");
    formData.append(
      "file",
      new File([Buffer.from("png")], "image.png", { type: "image/png" }),
    );

    const response = await POST(
      new Request("http://localhost/api/upload-image", {
        method: "POST",
        body: formData,
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(storeAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/png",
        filename: "image.png",
        folder: "article-inserts",
      }),
    );
    expect(json).toMatchObject({
      ok: true,
      url: "https://assets.example.com/article/image.png",
      path: "article-inserts/image.png",
      filename: "image.png",
      storageMode: "local",
    });

    const invalidFormData = new FormData();
    invalidFormData.append(
      "file",
      new File([Buffer.from("text")], "notes.txt", { type: "text/plain" }),
    );
    const invalidResponse = await POST(
      new Request("http://localhost/api/upload-image", {
        method: "POST",
        body: invalidFormData,
      }),
    );
    const invalidJson = await invalidResponse.json();
    expect(invalidResponse.status).toBe(400);
    expect(invalidJson.error).toBe("画像ファイルのみアップロードできます。");
  });

  test("upload image route returns Japanese validation errors for missing and oversized files", async () => {
    const { POST } = await import("@/app/api/upload-image/route");

    const missingResponse = await POST(
      new Request("http://localhost/api/upload-image", {
        method: "POST",
        body: new FormData(),
      }),
    );
    const missingJson = await missingResponse.json();
    expect(missingResponse.status).toBe(400);
    expect(missingJson.error).toBe("画像ファイルを選択してください。");

    const oversizedFormData = new FormData();
    oversizedFormData.append(
      "file",
      new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    );
    const oversizedResponse = await POST(
      new Request("http://localhost/api/upload-image", {
        method: "POST",
        body: oversizedFormData,
      }),
    );
    const oversizedJson = await oversizedResponse.json();
    expect(oversizedResponse.status).toBe(400);
    expect(oversizedJson.error).toBe("画像は8MB以下にしてください。");
  });

  test("generation jobs route creates a job and schedules background work", async () => {
    const { after } = await import("next/server");
    const { createGenerationJob } = await import("@/lib/server/generation-jobs");
    const { runArticleGenerationJob } = await import(
      "@/lib/server/article-generation-job-runner"
    );
    vi.mocked(createGenerationJob).mockResolvedValueOnce({
      kind: "article_generation_job",
      id: "job-created-1",
      status: "queued",
      steps: [],
      inputPayload: sampleFormPayload,
      competitorResearch: null,
      fetchedReferences: [],
      fetchedCompetitors: [],
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    });
    const { POST } = await import("@/app/api/generation-jobs/route");

    const response = await POST(
      new Request("http://localhost/api/generation-jobs", {
        method: "POST",
        body: JSON.stringify({
          form: sampleFormPayload,
          competitorResearch: null,
        }),
      }),
    );
    const json = await response.json();
    const scheduled = vi.mocked(after).mock.calls.at(-1)?.[0] as
      | (() => Promise<void> | void)
      | undefined;

    expect(response.status).toBe(202);
    expect(json.job.id).toBe("job-created-1");
    expect(createGenerationJob).toHaveBeenCalledWith({
      inputPayload: sampleFormPayload,
      competitorResearch: null,
    });
    expect(typeof scheduled).toBe("function");
    await scheduled?.();
    expect(runArticleGenerationJob).toHaveBeenCalledWith("job-created-1");
  });
});
