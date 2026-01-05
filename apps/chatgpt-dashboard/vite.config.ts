import react from "@vitejs/plugin-react";
import * as path from "node:path";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  // @ts-ignore - Tailwind 4 uses .mts which isn't fully resolved by TypeScript yet
  const tailwindcss = (await import("@tailwindcss/vite")).default;

  return {
    plugins: [react(), tailwindcss()],
    root: "src/client",
    build: {
      outDir: "../../dist/client",
      emptyOutDir: true,
    },
    resolve: {
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "src/client") },
      ],
    },
  };
});
