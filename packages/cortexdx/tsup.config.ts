import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts", "src/server.ts", "src/workers/sandbox.ts", "src/plugins/index.ts", "src/adapters/stdio-wrapper.ts"],
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  dts: true,
  clean: true,
  target: "node20",
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
