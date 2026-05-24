import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: [
      "src/**/*.{test,spec}.ts",
      "tests/unit/**/*.{test,spec}.ts",
      "tests/integrations/**/*.{test,spec}.ts",
    ],
    exclude: ["e2e/**", "node_modules/**", "playwright-report/**", "test-results/**"],
    setupFiles: ["./tests/mocks/server.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/lib/schemas/**",
        "src/lib/repositories/**",
        "src/lib/crypto/**",
        "src/lib/utils/logger.ts",
        // Sprint 2 — capa de integraciones CRM (acceptance criterion ≥80%).
        "src/lib/integrations/crm/**",
      ],
      exclude: ["**/*.d.ts", "**/index.ts", "src/lib/integrations/crm/**/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
