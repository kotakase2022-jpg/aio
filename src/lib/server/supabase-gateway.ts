import { ApiError } from "@/lib/server/http";
import { sanitizeForPostgres } from "@/lib/server/postgres-sanitize";

type GatewayResponse<T> = T & {
  ok: boolean;
  error?: string;
  detail?: string;
};

export function isSupabaseGatewayConfigured() {
  return Boolean(
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      cleanEnvValue(process.env.SUPABASE_GATEWAY_TOKEN),
  );
}

export function getSupabaseGatewayUrl() {
  const configuredUrl = cleanEnvValue(process.env.SUPABASE_GATEWAY_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  const baseUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/functions/v1/aio-store` : "";
}

export async function callSupabaseGateway<T>(
  action: string,
  payload?: Record<string, unknown>,
) {
  if (!isSupabaseGatewayConfigured()) {
    throw new ApiError(
      "Supabase gateway is not configured.",
      503,
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_GATEWAY_TOKEN.",
    );
  }

  const response = await fetch(getSupabaseGatewayUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-aio-store-token": cleanEnvValue(process.env.SUPABASE_GATEWAY_TOKEN)!,
    },
    body: JSON.stringify(sanitizeForPostgres({ action, payload: payload ?? {} })),
  });

  const json = (await response.json().catch(() => ({}))) as GatewayResponse<T>;

  if (!response.ok || !json.ok) {
    throw new ApiError(
      json.error ?? "Supabase gateway request failed.",
      response.status || 500,
      json.detail,
    );
  }

  return json as T;
}

function cleanEnvValue(value?: string) {
  return value?.replace(/^\uFEFF/, "").trim();
}
