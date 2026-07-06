import { describe, expect, test, vi } from "vitest";
import { sampleArticleResult, sampleFormPayload } from "../fixtures/article";

vi.mock("@/lib/server/openai", () => ({
  generateImageBase64: vi.fn(async () => Buffer.from("image").toString("base64")),
}));

vi.mock("@/lib/server/storage", () => ({
  storeAsset: vi.fn(async ({ filename }: { filename: string }) => ({
    url: `https://assets.example.com/${filename}`,
    path: `generated/${filename}`,
  })),
}));

describe("article image helpers", () => {
  test("buildProductionImagePrompt adds strict visual quality constraints", async () => {
    const { buildProductionImagePrompt } = await import("@/lib/server/article-images");

    const prompt = buildProductionImagePrompt("Base concept", "featured");

    expect(prompt).toContain("Base concept");
    expect(prompt).toContain("premium Japanese B2B");
    expect(prompt).toContain("Do not include readable text");
  });

  test("returns uploaded image directly without calling generation", async () => {
    const { generateImageBase64 } = await import("@/lib/server/openai");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");

    const images = await createArticleImagesForDraft(sampleArticleResult, {
      ...sampleFormPayload,
      visualTone: {
        mode: "upload",
        uploadedImageUrl: "https://example.com/uploaded.png",
        uploadedImagePath: "uploads/uploaded.png",
        uploadedImageName: "uploaded.png",
      },
      imageCount: 2,
    });

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      slot: "featured",
      url: "https://example.com/uploaded.png",
      source: "uploaded",
    });
    expect(generateImageBase64).not.toHaveBeenCalled();
  });

  test("generates and stores requested image prompts", async () => {
    const { generateImageBase64 } = await import("@/lib/server/openai");
    const { storeAsset } = await import("@/lib/server/storage");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");

    const images = await createArticleImagesForDraft(sampleArticleResult, {
      ...sampleFormPayload,
      imageCount: 1,
    });

    expect(images).toHaveLength(1);
    expect(images[0].url).toBe("https://assets.example.com/featured.png");
    expect(storeAsset).toHaveBeenCalledWith(expect.objectContaining({ filename: "featured.png" }));
    expect(generateImageBase64).toHaveBeenCalledWith(
      expect.stringContaining("Article summary anchor"),
    );
    expect(generateImageBase64).toHaveBeenCalledWith(
      expect.stringContaining(sampleArticleResult.article_summary),
    );
    expect(generateImageBase64).toHaveBeenCalledWith(
      expect.stringContaining("Key takeaways to visualize"),
    );
    expect(generateImageBase64).toHaveBeenCalledWith(expect.stringContaining("Relevant headings"));
  });

  test("keeps the article draft usable when one generated image fails", async () => {
    const { generateImageBase64 } = await import("@/lib/server/openai");
    const { createArticleImagesForDraft } = await import("@/lib/server/article-images");
    const failures: string[] = [];
    const failedPrompts: string[] = [];
    vi.mocked(generateImageBase64)
      .mockRejectedValueOnce(new Error("image timeout"))
      .mockResolvedValueOnce(Buffer.from("image").toString("base64"));

    const images = await createArticleImagesForDraft(
      {
        ...sampleArticleResult,
        image_prompts: [
          ...sampleArticleResult.image_prompts,
          {
            slot: "inline-1",
            purpose: "Inline image",
            prompt: "Clean inline explanatory visual",
            alt_text: "Inline AIO workflow image",
          },
        ],
      },
      {
        ...sampleFormPayload,
        imageCount: 2,
      },
      {
        onImageFailure: (failure) => {
          failures.push(
            `${failure.slot}:${
              failure.error instanceof Error ? failure.error.message : "unknown"
            }`,
          );
          failedPrompts.push(failure.prompt);
        },
      },
    );

    expect(images).toHaveLength(1);
    expect(images[0].slot).toBe("inline-1");
    expect(failures).toEqual(["featured:image timeout"]);
    expect(failedPrompts[0]).toContain("Article summary anchor");
    expect(failedPrompts[0]).toContain(sampleArticleResult.article_summary);
  });
});
