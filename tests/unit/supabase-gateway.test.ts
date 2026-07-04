import { describe, expect, test, vi } from "vitest";
import {
  callSupabaseGateway,
  getSupabaseGatewayUrl,
  isSupabaseGatewayConfigured,
} from "@/lib/server/supabase-gateway";

describe("Supabase gateway client", () => {
  test("detects missing configuration and derives gateway URL safely", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_GATEWAY_TOKEN = "";

    expect(isSupabaseGatewayConfigured()).toBe(false);
    expect(getSupabaseGatewayUrl()).toBe("");

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co/";
    process.env.SUPABASE_GATEWAY_TOKEN = "token";
    expect(isSupabaseGatewayConfigured()).toBe(true);
    expect(getSupabaseGatewayUrl()).toBe("https://project.supabase.co/functions/v1/aio-store");
  });

  test("raises ApiError with detail when gateway returns an error", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_GATEWAY_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { ok: false, error: "gateway failed", detail: "bad payload" },
          { status: 500 },
        ),
      ),
    );

    await expect(callSupabaseGateway("upsert_job", { value: "\u0000bad" })).rejects.toMatchObject({
      status: 500,
      detail: "bad payload",
    });
  });
});
