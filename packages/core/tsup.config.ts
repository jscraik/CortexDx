import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/utils/index.ts",
    "src/logging/index.ts",
    "src/config/index.ts",
    "src/di/index.ts",
    "src/utils/deterministic.ts",
    "src/utils/json.ts",
    "src/utils/type-helpers.ts",
    "src/utils/lru-cache.ts",
    // Add other specific files if needed for direct import
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
});
