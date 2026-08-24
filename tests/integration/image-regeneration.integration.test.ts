import { beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";

vi.mock("@/lib/server/openai", () => ({
  generateImageBase64: vi.fn(async (prompt: string) => {
    expect(prompt).toContain("Make the visual more concrete and premium");
    return Buffer.from("regenerated-image").toString("base64");
  }),
}));

vi.mock("@/lib/server/storage", () => ({
  storeAsset: vi.fn(async ({ filename }: { filename: string }) => ({
    url: `https://assets.example.com/regenerated/${filename}`,
    path: `generated/new-${filename}`,
  })),
  deleteStoredAssets: vi.fn(async () => undefined),
}));

vi.mock("@/lib/server/drafts", () => ({
  getDraft: vi.fn(async () => null),
  saveDraft: vi.fn(async (draft) => ({ draft, storageMode: "supabase" })),
}));

vi.mock("@/lib/server/generation-jobs", () => ({
  syncGenerationJobDraft: vi.fn(async () => null),
}));

describe("image regeneration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("regenerates, attaches, and saves an image before returning it", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { getDraft, saveDraft } = await import("@/lib/server/drafts");
    const { syncGenerationJobDraft } = await import("@/lib/server/generation-jobs");
    const { deleteStoredAssets, storeAsset } = await import("@/lib/server/storage");
    const draft = createSampleDraft({
      status: "approved",
      editedBodyHtml:
        '<figure><img src="https://assets.example.com/original.png" /></figure>',
      images: [
        {
          ...createSampleDraft().images[0],
          url: "https://assets.example.com/original.png",
          path: "generated/original-featured.png",
        },
      ],
    });
    vi.mocked(getDraft).mockResolvedValueOnce(draft);

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        body: JSON.stringify({
          draft,
          requests: [
            {
              prompt:
                "AIO workflow hero image. Make the visual more concrete and premium for B2B readers.",
              slot: "featured",
              altText: "Regenerated AIO hero image",
              replaceImageId: "img-1",
            },
          ],
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.images).toHaveLength(1);
    expect(json.images[0]).toMatchObject({
      slot: "featured",
      url: "https://assets.example.com/regenerated/featured.png",
      path: "generated/new-featured.png",
      altText: "Regenerated AIO hero image",
      source: "generated",
    });
    expect(json.images[0].prompt).toContain("Production quality requirements");
    expect(json.draft).toMatchObject({
      id: draft.id,
      status: "draft",
      images: [expect.objectContaining({ path: "generated/new-featured.png" })],
    });
    expect(json.draft.editedBodyHtml).toContain(
      "https://assets.example.com/regenerated/featured.png",
    );
    expect(json.failures).toEqual([]);
    expect(json.warnings).toEqual([]);
    expect(storeAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/png",
        filename: "featured.png",
        folder: "generated",
      }),
    );
    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: draft.id,
        status: "draft",
        images: [expect.objectContaining({ path: "generated/new-featured.png" })],
      }),
    );
    expect(syncGenerationJobDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: draft.id }),
    );
    expect(deleteStoredAssets).toHaveBeenCalledWith(["generated/original-featured.png"]);
  });

  test("does not store an image when a propagated request signal is aborted", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { generateImageBase64 } = await import("@/lib/server/openai");
    const { getDraft, saveDraft } = await import("@/lib/server/drafts");
    const { storeAsset } = await import("@/lib/server/storage");
    const controller = new AbortController();
    vi.mocked(generateImageBase64).mockImplementationOnce(async () => {
      controller.abort();
      return Buffer.from("aborted-image").toString("base64");
    });
    vi.mocked(getDraft).mockResolvedValueOnce(createSampleDraft());

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          draft: createSampleDraft(),
          requests: [
            {
              prompt: "AIO workflow image request. Make the visual more concrete and premium.",
              slot: "featured",
              altText: "Aborted AIO image",
              replaceImageId: "img-1",
            },
          ],
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(499);
    expect(json.error).toContain("画像生成が中断されました");
    expect(storeAsset).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  test("deletes a newly stored image when saving the updated draft fails", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { getDraft, saveDraft } = await import("@/lib/server/drafts");
    const { deleteStoredAssets } = await import("@/lib/server/storage");
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error("draft write failed"));
    vi.mocked(getDraft).mockResolvedValueOnce(createSampleDraft());

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        body: JSON.stringify({
          draft: createSampleDraft(),
          requests: [
            {
              prompt: "AIO rollback image. Make the visual more concrete and premium.",
              slot: "featured",
              altText: "Rollback image",
              replaceImageId: "img-1",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(deleteStoredAssets).toHaveBeenCalledWith(["generated/new-featured.png"]);
  });

  test("uses the persisted image path for cleanup instead of a client-controlled path", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const { deleteStoredAssets } = await import("@/lib/server/storage");
    const persistedDraft = createSampleDraft({
      images: [
        {
          ...createSampleDraft().images[0],
          path: "generated/persisted-featured.png",
        },
      ],
    });
    const submittedDraft = {
      ...persistedDraft,
      images: [
        {
          ...persistedDraft.images[0],
          path: "generated/unrelated-user-image.png",
        },
      ],
    };
    vi.mocked(getDraft).mockResolvedValueOnce(persistedDraft);

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        body: JSON.stringify({
          draft: submittedDraft,
          requests: [
            {
              prompt: "AIO secure cleanup image. Make the visual more concrete and premium.",
              slot: "featured",
              replaceImageId: "img-1",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(deleteStoredAssets).toHaveBeenCalledWith(["generated/persisted-featured.png"]);
    expect(deleteStoredAssets).not.toHaveBeenCalledWith([
      "generated/unrelated-user-image.png",
    ]);
  });

  test("rejects regeneration when the persisted draft does not exist", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { getDraft } = await import("@/lib/server/drafts");
    const { storeAsset } = await import("@/lib/server/storage");
    vi.mocked(getDraft).mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        body: JSON.stringify({
          draft: createSampleDraft(),
          requests: [
            {
              prompt: "AIO missing draft image. Make the visual more concrete and premium.",
              slot: "featured",
              replaceImageId: "img-1",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(storeAsset).not.toHaveBeenCalled();
  });

  test("rejects image generation without a draft attachment target", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { storeAsset } = await import("@/lib/server/storage");

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              prompt: "AIO unattached image. Make the visual more concrete and premium.",
              slot: "featured",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(storeAsset).not.toHaveBeenCalled();
  });
});
