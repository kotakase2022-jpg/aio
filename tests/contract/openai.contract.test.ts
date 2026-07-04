import { describe, expect, test, vi } from "vitest";
import { createMockHttpServer, sendJson } from "../helpers/mock-http-server";

describe("OpenAI API contract", () => {
  test("Responses API requests use structured JSON schema output", async () => {
    const server = await createMockHttpServer((request, response) => {
      expect(request.pathname).toBe("/responses");
      expect(request.method).toBe("POST");
      expect(request.headers.authorization).toBe("Bearer test-openai-key");
      const body = request.json as Record<string, unknown>;
      expect(body.store).toBe(false);
      expect(body.model).toBe("gpt-contract");
      expect(body.instructions).toContain("Return JSON");
      expect(body.input).toContain("AIO");
      expect(body.text).toMatchObject({
        format: {
          type: "json_schema",
          name: "contract_schema",
          strict: true,
        },
      });
      sendJson(response, {
        output_text: JSON.stringify({ title: "AIO contract title", score: 91 }),
      });
    });

    try {
      process.env.OPENAI_BASE_URL = server.origin;
      process.env.OPENAI_TEXT_MODEL = "gpt-contract";
      vi.resetModules();
      const { createStructuredResponse } = await import("@/lib/server/openai");

      const result = await createStructuredResponse<{ title: string; score: number }>({
        instructions: "Return JSON only.",
        input: "AIO article contract check",
        schemaName: "contract_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            score: { type: "number" },
          },
          required: ["title", "score"],
        },
      });

      expect(result).toEqual({ title: "AIO contract title", score: 91 });
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  test("Responses API rate limit errors are returned with Japanese recovery guidance", async () => {
    const server = await createMockHttpServer((_request, response) => {
      sendJson(
        response,
        {
          error: {
            message: "quota exceeded",
            code: "rate_limit_exceeded",
          },
        },
        429,
      );
    });

    try {
      process.env.OPENAI_BASE_URL = server.origin;
      vi.resetModules();
      const { createStructuredResponse } = await import("@/lib/server/openai");

      await expect(
        createStructuredResponse({
          instructions: "Return JSON only.",
          input: "AIO article contract check",
          schemaName: "contract_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
            },
            required: ["title"],
          },
        }),
      ).rejects.toMatchObject({
        status: 429,
        message:
          "OpenAIの利用上限またはレート制限に達しました。少し時間をおくか、画像枚数・入力量を減らして再実行してください。",
        detail: "rate_limit_exceeded / quota exceeded",
      });
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  test("Image API requests use the configured image model and returns base64 data", async () => {
    const expectedImage = Buffer.from("contract-image").toString("base64");
    const server = await createMockHttpServer((request, response) => {
      expect(request.pathname).toBe("/images/generations");
      expect(request.method).toBe("POST");
      expect(request.headers.authorization).toBe("Bearer test-openai-key");
      const body = request.json as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "gpt-image-contract",
        n: 1,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
        background: "opaque",
      });
      expect(String(body.prompt)).toContain("premium B2B article image");
      sendJson(response, { data: [{ b64_json: expectedImage }] });
    });

    try {
      process.env.OPENAI_BASE_URL = server.origin;
      process.env.OPENAI_IMAGE_MODEL = "gpt-image-contract";
      process.env.OPENAI_IMAGE_SIZE = "1024x1024";
      process.env.OPENAI_IMAGE_QUALITY = "medium";
      vi.resetModules();
      const { generateImageBase64 } = await import("@/lib/server/openai");

      const result = await generateImageBase64("premium B2B article image");

      expect(result).toBe(expectedImage);
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });
});
