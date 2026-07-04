import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/server/http";
import { isSupabaseGatewayConfigured } from "@/lib/server/supabase-gateway";

let adminClient: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isDurableStorageConfigured() {
  return isSupabaseConfigured() || isSupabaseGatewayConfigured();
}

export function assertDurableStorageConfigured(operation = "この処理") {
  if (process.env.VERCEL && !isDurableStorageConfigured()) {
    throw new ApiError(
      "本番環境の永続化DBが未設定です。",
      503,
      `${operation}にはSupabaseの永続保存が必要です。Vercel Environment VariablesにNEXT_PUBLIC_SUPABASE_URLとSUPABASE_GATEWAY_TOKEN、またはSUPABASE_SERVICE_ROLE_KEYを設定し、再デプロイしてください。`,
    );
  }
}

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return adminClient;
}
