import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  sampleArticleResult,
  sampleFormPayload,
} from "../fixtures/article";
import type { ArticleDraft, FetchResult } from "@/types/aio";

vi.mock("@/lib/server/content", () => ({
  fetchUrlContent: vi.fn(),
}));

vi.mock("@/lib/server/article-generation", () => ({
  generateAioArticle: vi.fn(),
}));

vi.mock("@/lib/server/article-images", () => ({
  createArticleImagesForDraft: vi.fn(),
}));

vi.mock("@/lib/server/drafts", () => ({
  saveDraft: vi.fn(),
}));

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-runner-tests-"));
  process.env.AIO_LOCAL_DATA_DIR = tempDir;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.SUPABASE_GATEWAY_TOKEN = "";
  process.env.VERCEL = "";
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  delete process.env.AIO_LOCAL_DATA_DIR;
});

describe("article generation job runner", () => {
  test("completes a job with fetched URLs, manual text, file inputs, images, and saved draft", async () => {
    const { fetchUrlContent } = await import("@/lib/server/content");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");
    const { saveDraft } = await import("@/lib/server/drafts");
    const { createGenerationJob, getGenerationJob } = await import(
      "@/lib/server/generation-jobs"
    );
    const { runArticleGenerationJob } = await import(
      "@/lib/server/article-generation-job-runner"
    );

    const urlFetches: FetchResult[] = [
      {
        url: "https://example.com/reference",
        title: "Fetched reference",
        text: "Fetched reference text",
        ok: true,
        sourceType: "url",
      },
      {
        url: "https://example.com/competitor",
        title: "Fetched competitor",
        text: "Fetched competitor text",
        ok: true,
        sourceType: "url",
      },
    ];
    vi.mocked(fetchUrlContent)
      .mockResolvedValueOnce(urlFetches[0])
      .mockResolvedValueOnce(urlFetches[1]);
    vi.mocked(generateAioArticle).mockResolvedValueOnce(sampleArticleResult);
    const images: Awaited<ReturnType<typeof createArticleImagesForDraft>> = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        slot: "featured",
        url: "https://assets.example.com/featured.png",
        path: "generated/featured.png",
        prompt: "Generated featured image",
        altText: "AIO workflow hero image",
        source: "generated",
      },
    ];
    vi.mocked(createArticleImagesForDraft).mockResolvedValueOnce(images);
    vi.mocked(saveDraft).mockImplementationOnce(async (draft) => ({
      draft,
      storageMode: "local" as const,
    }));

    const inputPayload = {
      ...sampleFormPayload,
      references: [
        {
          id: "ref-url-and-text",
          url: "https://example.com/reference",
          text: "Manual reference text",
        },
      ],
      competitors: [
        {
          id: "comp-url-and-text",
          url: "https://example.com/competitor",
          text: "Manual competitor text",
        },
      ],
      referenceFiles: [
        {
          id: "reference-file-1",
          name: "field-notes.txt",
          type: "text/plain",
          size: 120,
          ok: true,
          text: "Uploaded field note text",
          textLength: 24,
          extractedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      competitorFiles: [
        {
          id: "competitor-file-1",
          name: "locked.pdf",
          type: "application/pdf",
          size: 120,
          ok: false,
          textLength: 0,
          error: "PDF text could not be extracted.",
          extractedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      regenerationInstruction: "runtime-only rewrite direction",
    };
    const job = await createGenerationJob({ inputPayload });

    await runArticleGenerationJob(job.id);

    const completed = await getGenerationJob(job.id);
    const savedDraft = vi.mocked(saveDraft).mock.calls.at(-1)?.[0] as ArticleDraft;
    const articleCall = vi.mocked(generateAioArticle).mock.calls.at(-1)?.[0];

    expect(completed?.status).toBe("completed");
    expect(completed?.draft?.editedTitle).toBe(sampleArticleResult.selected_title);
    expect(completed?.draft?.editedBodyHtml).toContain(
      'data-image-slot="featured"',
    );
    expect(completed?.draft?.inputPayload.regenerationInstruction).toBeUndefined();
    expect(completed?.fetchedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/reference" }),
        expect.objectContaining({ url: "manual-text", text: "Manual reference text" }),
        expect.objectContaining({ url: "file:field-notes.txt", sourceType: "file" }),
      ]),
    );
    expect(completed?.fetchedCompetitors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/competitor" }),
        expect.objectContaining({ url: "manual-text", text: "Manual competitor text" }),
        expect.objectContaining({
          url: "file:locked.pdf",
          ok: false,
          reason: "PDF text could not be extracted.",
        }),
      ]),
    );
    expect(articleCall?.fetchedReferences).toEqual(completed?.fetchedReferences);
    expect(createArticleImagesForDraft).toHaveBeenCalledWith(
      sampleArticleResult,
      expect.objectContaining({ theme: sampleFormPayload.theme }),
      expect.objectContaining({ onImageFailure: expect.any(Function) }),
    );
    expect(savedDraft.status).toBe("draft");
    expect(savedDraft.images).toEqual(images);
    expect(savedDraft.editedBodyHtml).toContain(
      "https://assets.example.com/featured.png",
    );
    expect(completed?.steps.every((step) => step.status === "done")).toBe(true);
  });

  test("marks the running generation steps as failed when article generation fails", async () => {
    const { fetchUrlContent } = await import("@/lib/server/content");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const { saveDraft } = await import("@/lib/server/drafts");
    const { createGenerationJob, getGenerationJob } = await import(
      "@/lib/server/generation-jobs"
    );
    const { runArticleGenerationJob } = await import(
      "@/lib/server/article-generation-job-runner"
    );

    vi.mocked(fetchUrlContent).mockResolvedValueOnce({
      url: "https://example.com/reference",
      title: "Fetched reference",
      text: "Fetched reference text",
      ok: true,
      sourceType: "url",
    });
    vi.mocked(generateAioArticle).mockRejectedValueOnce(new Error("OpenAI timeout"));
    const job = await createGenerationJob({ inputPayload: sampleFormPayload });

    await runArticleGenerationJob(job.id);

    const failed = await getGenerationJob(job.id);
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("OpenAI timeout");
    expect(failed?.draft).toBeUndefined();
    expect(saveDraft).not.toHaveBeenCalled();
    expect(failed?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fetch_refs", status: "done" }),
        expect.objectContaining({ id: "generate_outline", status: "error", detail: "OpenAI timeout" }),
        expect.objectContaining({ id: "generate_body", status: "error", detail: "OpenAI timeout" }),
        expect.objectContaining({ id: "generate_meta", status: "error", detail: "OpenAI timeout" }),
        expect.objectContaining({ id: "image_prompts", status: "error", detail: "OpenAI timeout" }),
      ]),
    );
  });

  test("continues saving a draft when image generation fails but records the image failure detail", async () => {
    const { fetchUrlContent } = await import("@/lib/server/content");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");
    const { saveDraft } = await import("@/lib/server/drafts");
    const { createGenerationJob, getGenerationJob } = await import(
      "@/lib/server/generation-jobs"
    );
    const { runArticleGenerationJob } = await import(
      "@/lib/server/article-generation-job-runner"
    );

    vi.mocked(fetchUrlContent).mockResolvedValueOnce({
      url: "https://example.com/reference",
      title: "Fetched reference",
      text: "Fetched reference text",
      ok: true,
      sourceType: "url",
    });
    vi.mocked(generateAioArticle).mockResolvedValueOnce(sampleArticleResult);
    vi.mocked(createArticleImagesForDraft).mockImplementationOnce(async (_article, _form, options) => {
      const error = new Error("Image API timeout");
      options?.onImageFailure?.("featured", error, {
        slot: "featured",
        prompt: "Failed featured prompt",
        altText: "Failed featured image",
        error,
      });
      return [];
    });
    vi.mocked(saveDraft).mockImplementationOnce(async (draft) => ({
      draft,
      storageMode: "local" as const,
    }));
    const job = await createGenerationJob({ inputPayload: sampleFormPayload });

    await runArticleGenerationJob(job.id);

    const completed = await getGenerationJob(job.id);
    const savedDraft = vi.mocked(saveDraft).mock.calls.at(-1)?.[0] as ArticleDraft;
    const imageStep = completed?.steps.find((step) => step.id === "images");

    expect(completed?.status).toBe("completed");
    expect(imageStep).toMatchObject({
      status: "done",
    });
    expect(imageStep?.detail).toContain("画像生成は全て失敗しました");
    expect(imageStep?.detail).toContain("featured: Image API timeout");
    expect(imageStep?.detail).toContain("画像のみ再作成");
    expect(savedDraft.images).toEqual([]);
    expect(savedDraft.editedBodyHtml).not.toContain("data-image-slot");
  });

  test("saves a text-only draft without injected figures when imageCount is zero", async () => {
    const { fetchUrlContent } = await import("@/lib/server/content");
    const { generateAioArticle } = await import("@/lib/server/article-generation");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");
    const { saveDraft } = await import("@/lib/server/drafts");
    const { createGenerationJob, getGenerationJob } = await import(
      "@/lib/server/generation-jobs"
    );
    const { runArticleGenerationJob } = await import(
      "@/lib/server/article-generation-job-runner"
    );

    vi.mocked(fetchUrlContent).mockResolvedValueOnce({
      url: "https://example.com/reference",
      title: "Fetched reference",
      text: "Fetched reference text",
      ok: true,
      sourceType: "url",
    });
    vi.mocked(generateAioArticle).mockResolvedValueOnce({
      ...sampleArticleResult,
      image_prompts: [],
    });
    vi.mocked(createArticleImagesForDraft).mockResolvedValueOnce([]);
    vi.mocked(saveDraft).mockImplementationOnce(async (draft) => ({
      draft,
      storageMode: "local" as const,
    }));
    const job = await createGenerationJob({
      inputPayload: {
        ...sampleFormPayload,
        imageCount: 0,
      },
    });

    await runArticleGenerationJob(job.id);

    const completed = await getGenerationJob(job.id);
    const savedDraft = vi.mocked(saveDraft).mock.calls.at(-1)?.[0] as ArticleDraft;
    const imageStep = completed?.steps.find((step) => step.id === "images");

    expect(completed?.status).toBe("completed");
    expect(createArticleImagesForDraft).toHaveBeenCalledWith(
      expect.objectContaining({ image_prompts: [] }),
      expect.objectContaining({ imageCount: 0 }),
      expect.objectContaining({ onImageFailure: expect.any(Function) }),
    );
    expect(imageStep).toMatchObject({ status: "done" });
    expect(savedDraft.images).toEqual([]);
    expect(savedDraft.editedBodyHtml).toBe(sampleArticleResult.body_html);
    expect(savedDraft.editedBodyHtml).not.toContain("<figure");
  });
});
