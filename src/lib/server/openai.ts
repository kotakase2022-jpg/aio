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
const DEFAULT_OPENAI_MAX_RETRIES = 2;
const DEFAULT_OPENAI_RETRY_BASE_DELAY_MS = 750;

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
  const timeoutMs = options.timeoutMs ?? DEFAULT_OPENAI_TIMEOUT_MS;
  const maxRetries = getRetryCount();

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
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
      if (attempt < maxRetries) {
        await wait(getRetryDelayMs(attempt));
        continue;
      }

      const openAIError = formatOpenAITransportError(error);
      throw new ApiError(openAIError.message, openAIError.status, openAIError.detail);
    } finally {
      clearTimeout(timer);
    }

    const json = (await response.json().catch(() => ({}))) as T;

    if (!response.ok) {
      if (isRetryableOpenAIStatus(response.status, json.error) && attempt < maxRetries) {
        await wait(getRetryDelayMs(attempt, response.headers.get("retry-after")));
        continue;
      }

      const openAIError = formatOpenAIError(response.status, json.error);
      throw new ApiError(
        openAIError.message,
        response.status,
        openAIError.detail,
      );
    }

    return json;
  }

  throw new ApiError("OpenAI API request failed.", 502);
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

function formatOpenAIError(
  status: number,
  error: { message?: string; code?: string } | undefined,
) {
  const code = cleanEnvValue(error?.code);
  const rawMessage = cleanEnvValue(error?.message);
  const combined = `${code} ${rawMessage}`;
  const detail = [code, rawMessage].filter(Boolean).join(" / ") || undefined;

  if (status === 401 || /invalid.*key|incorrect.*api.*key|unauthorized/i.test(combined)) {
    return {
      message:
        "OpenAI APIキーが無効、または未承認です。Vercel Environment Variablesまたは.env.localのOPENAI_API_KEYを確認してください。",
      detail,
    };
  }

  if (status === 429 || /rate|quota|limit/i.test(combined)) {
    return {
      message:
        "OpenAIの利用上限またはレート制限に達しました。少し時間をおくか、画像枚数・入力量を減らして再実行してください。",
      detail,
    };
  }

  if (status >= 500) {
    return {
      message:
        "OpenAI側で一時的なエラーが発生しました。数分後に再実行してください。繰り返す場合は入力量を減らしてください。",
      detail,
    };
  }

  if (status === 400) {
    return {
      message:
        "OpenAIへのリクエスト内容が不正です。入力テキスト、添付ファイル、画像生成指示を短くして再実行してください。",
      detail,
    };
  }

  return {
    message: "OpenAI API request failed.",
    detail,
  };
}

function formatOpenAITransportError(error: unknown) {
  const rawMessage =
    error instanceof Error ? cleanEnvValue(error.message) : cleanEnvValue(String(error));
  const detail = rawMessage || undefined;

  if (error instanceof Error && error.name === "AbortError") {
    return {
      status: 504,
      message:
        "OpenAI APIの応答がタイムアウトしました。入力量を減らすか、時間をおいて再実行してください。",
      detail,
    };
  }

  return {
    status: 502,
    message:
      "OpenAI APIへの接続に失敗しました。ネットワーク状態を確認し、時間をおいて再実行してください。",
    detail,
  };
}

function isRetryableOpenAIStatus(
  status: number,
  error: { message?: string; code?: string } | undefined,
) {
  const code = cleanEnvValue(error?.code);
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") {
    return false;
  }

  return status === 408 || status === 429 || status >= 500;
}

function getRetryCount() {
  const configured = Number(cleanEnvValue(process.env.OPENAI_MAX_RETRIES));
  if (Number.isFinite(configured) && configured >= 0) {
    return Math.min(Math.floor(configured), 4);
  }

  return DEFAULT_OPENAI_MAX_RETRIES;
}

function getRetryDelayMs(attempt: number, retryAfterHeader?: string | null) {
  const retryAfterValue = cleanEnvValue(retryAfterHeader ?? undefined);
  const retryAfter = retryAfterValue ? Number(retryAfterValue) : Number.NaN;
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, 10_000);
  }

  const configured = Number(cleanEnvValue(process.env.OPENAI_RETRY_BASE_DELAY_MS));
  const baseDelay =
    Number.isFinite(configured) && configured >= 0
      ? configured
      : DEFAULT_OPENAI_RETRY_BASE_DELAY_MS;

  return Math.min(baseDelay * (attempt + 1), 10_000);
}

function wait(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
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
