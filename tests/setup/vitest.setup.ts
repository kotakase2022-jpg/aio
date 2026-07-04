import { afterEach, beforeEach, vi } from "vitest";

const cleanEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_GATEWAY_URL: "",
  SUPABASE_GATEWAY_TOKEN: "",
  OPENAI_API_KEY: "test-openai-key",
  WORDPRESS_ENCRYPTION_KEY: "test-wordpress-encryption-key-32-bytes",
  DEMO_ACCESS_CODE: "202607",
  VERCEL: "",
};

beforeEach(() => {
  Object.assign(process.env, cleanEnv);
});

afterEach(() => {
  vi.restoreAllMocks();
});
