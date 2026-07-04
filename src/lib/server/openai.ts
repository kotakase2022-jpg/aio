import { ApiError } from "@/lib/server/http";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    result?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string; code?: string };
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>;
  error?: { message?: string; code?: string };
};

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const DEFAULT_OPENAI_TIMEOUT_MS = 105_000;

export function getTextModel() {
  return cleanEnvValue(process.env.OPENAI_TEXT_MODEL) || "gpt-5.5";
}

export function getImageModel() {
  const configured = cleanEnvValue(process.env.OPENAI_IMAGE_MODEL);
  if (/^gpt-image-/.test(configured)) {
    return configured;
  }

  return "gpt-image-2";
}

function getOpenAIKey() {
  const apiKey = cleanEnvValue(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new ApiError(
      "OPENAI_API_KEY is not configured on the server.",
      500,
      "Set OPENAI_API_KEY in .env.local or Vercel Environment Variables.",
    );
  }
  return apiKey;
}

function cleanEnvValue(value: string | undefined) {
  return (value ?? "")
    .replace(/\uFEFF/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

async function callResponsesApi(
  body: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
) {
  return callOpenAIJson<OpenAIResponse>("/responses", body, options);
}

async function callOpenAIJson<T extends { error?: { message?: string; code?: string } }>(
  path: string,
  body: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_OPENAI_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getOpenAIKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        "OpenAI API request timed out.",
        504,
        "入力量を減らすか、時間をおいて再実行してください。",
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }

  const json = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new ApiError(
      json.error?.message ?? "OpenAI API request failed.",
      response.status,
      json.error?.code,
    );
  }

  return json;
}

export async function createStructuredResponse<T>({
  model = getTextModel(),
  instructions,
  input,
  schemaName,
  schema,
  tools,
  timeoutMs,
  maxOutputTokens,
}: {
  model?: string;
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
  timeoutMs?: number;
  maxOutputTokens?: number;
}): Promise<T> {
  const json = await callResponsesApi({
    store: false,
    model,
    instructions,
    input,
    tools,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  }, { timeoutMs });

  const text = extractOutputText(json);
  if (!text) {
    throw new ApiError("OpenAI response did not include structured output.", 502);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("OpenAI returned invalid JSON.", 502, text.slice(0, 500));
  }
}

export async function generateImageBase64(prompt: string) {
  const json = await callOpenAIJson<OpenAIImageResponse>("/images/generations", {
    model: getImageModel(),
    prompt,
    n: 1,
    size: cleanEnvValue(process.env.OPENAI_IMAGE_SIZE) || "1536x1024",
    quality: cleanEnvValue(process.env.OPENAI_IMAGE_QUALITY) || "high",
    output_format: "png",
    background: "opaque",
  }, { timeoutMs: 150_000 });

  const image = json.data?.find((item) => item.b64_json);
  if (!image?.b64_json) {
    throw new ApiError("OpenAI image generation did not return image data.", 502);
  }

  return image.b64_json;
}

function extractOutputText(json: OpenAIResponse) {
  if (typeof json.output_text === "string") {
    return json.output_text;
  }

  for (const item of json.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}
