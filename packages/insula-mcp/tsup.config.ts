import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts", "src/workers/sandbox.ts", "src/plugins/index.ts"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  dts: true,
  clean: true,
  target: "node20",
  banner: { js: "#!/usr/bin/env node" }
});
