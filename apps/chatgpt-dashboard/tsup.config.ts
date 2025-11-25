import { defineConfig } from 'tsup';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  splitting: false,
  sourcemap: true,
  treeshake: true,
  minify: false,
  onSuccess: async () => {
    // Copy static web assets to dist/components
    const srcComponents = join(__dirname, 'src/components');
    const distComponents = join(__dirname, 'dist/components');
    
    if (!existsSync(distComponents)) {
      mkdirSync(distComponents, { recursive: true });
    }
    
    // Copy HTML, CSS, and JS files
    for (const file of ['dashboard.html', 'styles.css', 'app.js']) {
      const src = join(srcComponents, file);
      const dest = join(distComponents, file);
      if (existsSync(src)) {
        cpSync(src, dest);
      }
    }
    
    console.log('✓ Web assets copied to dist/components');
  },
});
