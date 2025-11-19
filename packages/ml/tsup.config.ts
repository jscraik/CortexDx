import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/ml/router.ts",
    "src/ml/detect.ts",
    "src/ml/ollama-env.ts",
    "src/adapters/ollama.ts"
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
});
