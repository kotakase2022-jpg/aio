import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/server/openai", () => ({
  generateImageBase64: vi.fn(async (prompt: string) => {
    expect(prompt).toContain("Make the visual more concrete and premium");
    return Buffer.from("regenerated-image").toString("base64");
  }),
}));

vi.mock("@/lib/server/storage", () => ({
  storeAsset: vi.fn(async ({ filename }: { filename: string }) => ({
    url: `https://assets.example.com/regenerated/${filename}`,
    path: `generated/${filename}`,
  })),
}));

describe("image regeneration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns a regenerated article image with the requested slot and prompt", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { storeAsset } = await import("@/lib/server/storage");

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        body: JSON.stringify({
          prompt:
            "AIO workflow hero image. Make the visual more concrete and premium for B2B readers.",
          slot: "featured",
          altText: "Regenerated AIO hero image",
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.image).toMatchObject({
      slot: "featured",
      url: "https://assets.example.com/regenerated/featured.png",
      path: "generated/featured.png",
      altText: "Regenerated AIO hero image",
      source: "generated",
    });
    expect(json.image.prompt).toContain("Production quality requirements");
    expect(storeAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/png",
        filename: "featured.png",
        folder: "generated",
      }),
    );
  });

  test("does not store a generated image after the client request is aborted", async () => {
    const { POST } = await import("@/app/api/generate-image/route");
    const { generateImageBase64 } = await import("@/lib/server/openai");
    const { storeAsset } = await import("@/lib/server/storage");
    const controller = new AbortController();
    vi.mocked(generateImageBase64).mockImplementationOnce(async () => {
      controller.abort();
      return Buffer.from("aborted-image").toString("base64");
    });

    const response = await POST(
      new Request("http://localhost/api/generate-image", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          prompt: "AIO workflow image request that is aborted before durable storage.",
          slot: "featured",
          altText: "Aborted AIO image",
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(499);
    expect(json.error).toContain("画像生成が中断されました");
    expect(storeAsset).not.toHaveBeenCalled();
  });
});
