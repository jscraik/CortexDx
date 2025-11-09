import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/story/**", "src/anomaly/**", "src/graph/**", "src/actions/**", "src/web/story-card.ts"],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 60,
        branches: 50,
      },
      reportsDirectory: "reports/coverage",
      reporter: ["text", "json", "lcov"],
    },
  },
});
