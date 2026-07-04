import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4310);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DEMO_ACCESS_CODE: "202607",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_GATEWAY_TOKEN: "",
      OPENAI_API_KEY: "test-openai-key-not-used-in-e2e",
      WORDPRESS_ENCRYPTION_KEY: "test-wordpress-key-for-e2e-only",
    },
  },
  projects: [
    {
      name: "chromium-pc",
      use: { browserName: "chromium" },
    },
  ],
  outputDir: "test-results",
});
