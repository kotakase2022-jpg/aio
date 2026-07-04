import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createStructuredResponse,
  generateImageBase64,
  getImageModel,
  getTextModel,
} from "@/lib/server/openai";

describe("OpenAI server wrapper", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_TEXT_MODEL = " gpt-5.5 ";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2";
  });

  test("normalizes configured model names", () => {
    expect(getTextModel()).toBe("gpt-5.5");
    expect(getImageModel()).toBe("gpt-image-2");

    process.env.OPENAI_IMAGE_MODEL = "not-an-image-model";
    expect(getImageModel()).toBe("gpt-image-2");
  });

  test("parses structured response output_text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          output_text: JSON.stringify({ value: "ok" }),
        }),
      ),
    );

    await expect(
      createStructuredResponse<{ value: string }>({
        instructions: "Return JSON.",
        input: "{}",
        schemaName: "test_schema",
        schema: { type: "object" },
      }),
    ).resolves.toEqual({ value: "ok" });
  });

  test("fails clearly when OpenAI returns invalid JSON or API errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ output_text: "not-json" })));

    await expect(
      createStructuredResponse({
        instructions: "Return JSON.",
        input: "{}",
        schemaName: "test_schema",
        schema: { type: "object" },
      }),
    ).rejects.toMatchObject({ status: 502 });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { message: "quota exceeded", code: "rate_limit" } }, { status: 429 }),
      ),
    );

    await expect(generateImageBase64("prompt")).rejects.toMatchObject({
      status: 429,
      detail: "rate_limit",
    });
  });

  test("returns generated image base64 when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ b64_json: "aW1hZ2U=" }] })),
    );

    await expect(generateImageBase64("prompt")).resolves.toBe("aW1hZ2U=");
  });
});
