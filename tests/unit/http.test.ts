import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { ApiError, errorJson, okJson } from "@/lib/server/http";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";

const processEnvSnapshot = snapshotProcessEnv();

afterEach(() => {
  vi.unstubAllEnvs();
  restoreProcessEnv(processEnvSnapshot);
});

describe("HTTP response helpers", () => {
  test("okJson returns a stable success envelope", async () => {
    const response = okJson({ value: 1 }, { status: 201 });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, value: 1 });
  });

  test("errorJson preserves ApiError status and detail", async () => {
    const response = errorJson(new ApiError("Invalid input", 422, "field is required"));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid input",
      detail: "field is required",
    });
  });

  test("errorJson turns validation errors into recoverable 400 responses", async () => {
    const response = errorJson(z.object({ draftId: z.string().min(1) }).safeParse({}).error);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "入力内容が不正です。",
      detail: expect.stringContaining("Invalid input"),
    });
  });

  test("errorJson turns unknown errors into 500 responses", async () => {
    const response = errorJson(new Error("Unexpected failure"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unexpected failure",
    });
  });

  test("errorJson does not expose internal exception details in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = errorJson(new Error("C:\\internal\\secret-path"));

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "サーバー処理中にエラーが発生しました。時間をおいて再実行してください。",
    });
  });
});
