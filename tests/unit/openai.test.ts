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
    process.env.OPENAI_RETRY_BASE_DELAY_MS = "0";
    process.env.OPENAI_MAX_RETRIES = "2";
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
      message:
        "OpenAIの利用上限またはレート制限に達しました。少し時間をおくか、画像枚数・入力量を減らして再実行してください。",
      detail: "rate_limit / quota exceeded",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("retries transient OpenAI rate limits before returning a structured response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            { error: { message: "try again shortly", code: "rate_limit" } },
            { status: 429 },
          ),
        )
        .mockResolvedValueOnce(
          Response.json(
            { error: { message: "temporary overload", code: "server_error" } },
            { status: 500 },
          ),
        )
        .mockResolvedValueOnce(
          Response.json({ output_text: JSON.stringify({ value: "recovered" }) }),
        ),
    );

    await expect(
      createStructuredResponse<{ value: string }>({
        instructions: "Return JSON.",
        input: "{}",
        schemaName: "retry_schema",
        schema: { type: "object" },
      }),
    ).resolves.toEqual({ value: "recovered" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("does not retry OpenAI insufficient quota errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              message: "You exceeded your current quota.",
              code: "insufficient_quota",
            },
          },
          { status: 429 },
        ),
      ),
    );

    await expect(generateImageBase64("prompt")).rejects.toMatchObject({
      status: 429,
      message:
        "OpenAIの利用上限またはレート制限に達しました。少し時間をおくか、画像枚数・入力量を減らして再実行してください。",
      detail: "insufficient_quota / You exceeded your current quota.",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      401,
      "invalid_api_key",
      "Incorrect API key provided",
      "OpenAI APIキーが無効、または未承認です。",
    ],
    [
      400,
      "invalid_request_error",
      "Input is too long",
      "OpenAIへのリクエスト内容が不正です。",
    ],
    [
      500,
      "server_error",
      "Temporary upstream failure",
      "OpenAI側で一時的なエラーが発生しました。",
    ],
  ])(
    "maps OpenAI HTTP %i errors to Japanese recovery messages",
    async (status, code, message, expectedMessage) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ error: { message, code } }, { status }),
        ),
      );

      await expect(generateImageBase64("prompt")).rejects.toMatchObject({
        status,
        message: expect.stringContaining(expectedMessage),
        detail: `${code} / ${message}`,
      });
    },
  );

  test("returns generated image base64 when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: [{ b64_json: "aW1hZ2U=" }] })),
    );

    await expect(generateImageBase64("prompt")).resolves.toBe("aW1hZ2U=");
  });
});
