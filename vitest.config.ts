import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/contract/**/*.test.ts",
    ],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "src/lib/**/*.ts",
        "src/app/api/**/route.ts",
        "src/proxy.ts",
      ],
      thresholds: {
        lines: 75,
        branches: 55,
        functions: 80,
        statements: 75,
      },
    },
  },
});
