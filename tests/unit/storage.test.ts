import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/server/supabase-gateway", () => ({
  callSupabaseGateway: vi.fn(),
  isSupabaseGatewayConfigured: vi.fn(),
}));

let tempDir = "";
let originalCwd = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-storage-tests-"));
  originalCwd = process.cwd();
  process.chdir(tempDir);
  process.env.SUPABASE_STORAGE_BUCKET = "";
  process.env.VERCEL = "";
  vi.spyOn(Date, "now").mockReturnValue(1_789_000_000_000);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
  delete process.env.SUPABASE_STORAGE_BUCKET;
  delete process.env.VERCEL;
  vi.restoreAllMocks();
});

describe("storeAsset", () => {
  test("stores files locally with sanitized filenames when durable storage is unavailable", async () => {
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    const { isSupabaseGatewayConfigured } = await import("@/lib/server/supabase-gateway");
    const { storeAsset } = await import("@/lib/server/storage");

    vi.mocked(getSupabaseAdmin).mockReturnValue(null);
    vi.mocked(isSupabaseGatewayConfigured).mockReturnValue(false);

    const result = await storeAsset({
      buffer: Buffer.from("image bytes"),
      contentType: "image/png",
      filename: "執筆者 image?.png",
      folder: "authors",
    });

    expect(result).toEqual(
      expect.objectContaining({
        mode: "local",
        url: "/uploads/authors/1789000000000-----image-.png",
      }),
    );
    expect(path.basename(result.path)).toBe("1789000000000-----image-.png");
    await expect(readFile(result.path, "utf8")).resolves.toBe("image bytes");
  });

  test("falls back to the default Supabase bucket when the env bucket name is invalid", async () => {
    const from = vi.fn((bucket: string) => ({
      upload: vi.fn(async () => ({ error: null })),
      getPublicUrl: vi.fn((objectPath: string) => ({
        data: { publicUrl: `https://cdn.example.com/${bucket}/${objectPath}` },
      })),
    }));
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    const { isSupabaseGatewayConfigured } = await import("@/lib/server/supabase-gateway");
    const { storeAsset } = await import("@/lib/server/storage");

    process.env.SUPABASE_STORAGE_BUCKET = "\uFEFFInvalid Bucket";
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    vi.mocked(isSupabaseGatewayConfigured).mockReturnValue(false);

    const result = await storeAsset({
      buffer: Buffer.from("image bytes"),
      contentType: "image/png",
      filename: "featured.png",
      folder: "generated",
    });

    expect(from).toHaveBeenCalledWith("article-assets");
    expect(result).toEqual(
      expect.objectContaining({
        mode: "supabase",
        path: "generated/1789000000000-featured.png",
        url: "https://cdn.example.com/article-assets/generated/1789000000000-featured.png",
      }),
    );
  });

  test("fails closed on Vercel when durable storage upload fails", async () => {
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    const { isSupabaseGatewayConfigured } = await import("@/lib/server/supabase-gateway");
    const { storeAsset } = await import("@/lib/server/storage");
    process.env.VERCEL = "1";
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: { message: "bucket unavailable" } })),
        })),
      },
    } as unknown as ReturnType<typeof getSupabaseAdmin>);
    vi.mocked(isSupabaseGatewayConfigured).mockReturnValue(false);

    await expect(
      storeAsset({
        buffer: Buffer.from("image bytes"),
        contentType: "image/png",
        filename: "featured.png",
        folder: "generated",
      }),
    ).rejects.toMatchObject({
      status: 503,
      message: "画像の永続保存に失敗しました。",
      detail: "bucket unavailable",
    });
  });

  test("rejects path traversal in asset folders", async () => {
    const { storeAsset } = await import("@/lib/server/storage");

    await expect(
      storeAsset({
        buffer: Buffer.from("image bytes"),
        contentType: "image/png",
        filename: "escape.png",
        folder: "../../src",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "画像の保存先が正しくありません。",
    });
  });
});
