import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
    "plugins/index": "src/plugins/index.ts",
    "adapters/stdio-wrapper": "src/adapters/stdio-wrapper.ts",
  },
  format: ["esm"],
  splitting: true,
  treeshake: true,
  sourcemap: true,
  dts: true,
  clean: true,
  target: "node20",
  minify: process.env.NODE_ENV === "production",
  banner: { js: "#!/usr/bin/env node" },
  onSuccess: async () => {
    // Copy web assets to dist
    const webFiles = ['index.html', 'styles.css', 'app.js'];
    mkdirSync('dist/web', { recursive: true });

    for (const file of webFiles) {
      copyFileSync(
        join('src/web', file),
        join('dist/web', file)
      );
    }

    console.log('✓ Web assets copied to dist/web');
  }
});
