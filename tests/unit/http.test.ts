import { describe, expect, test } from "vitest";
import { ApiError, errorJson, okJson } from "@/lib/server/http";

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

  test("errorJson turns unknown errors into 500 responses", async () => {
    const response = errorJson(new Error("Unexpected failure"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unexpected failure",
    });
  });
});
