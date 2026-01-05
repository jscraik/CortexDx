import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/ml/router.ts",
    "src/ml/detect.ts",
    "src/ml/ollama-env.ts",
    "src/ml/conversational-adapter.ts",
    "src/adapters/ollama.ts",
    "src/llm/index.ts",
  ],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  target: "node20",
  external: [
    "@brainwav/cortexdx-core",
    "@brainwav/cortexdx-core/*",
    "@brainwav/cortexdx-server",
    "@brainwav/cortexdx-server/*",
    "@brainwav/cortexdx-plugins",
    "@brainwav/cortexdx-plugins/*",
  ],
  onSuccess: async () => {
    // Generate minimal d.ts files for exports
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");

    // Ensure directories exist
    await mkdir(join("dist", "ml"), { recursive: true });
    await mkdir(join("dist", "adapters"), { recursive: true });
    await mkdir(join("dist", "llm"), { recursive: true });

    // Generate index.d.ts with all public exports
    const indexDts = `// Auto-generated minimal type definitions
// Re-exports from ML module
export * from './ml/index.js';
// Re-exports from LLM module
export * from './llm/index.js';
`;

    // Generate ml/index.d.ts
    const mlIndexDts = `// Auto-generated minimal type definitions
export * from './conversational-adapter.js';
export { hasOllama } from './detect.js';
export * from './ollama-env.js';
export type { OrchestratorConfig } from './orchestrator.js';
export { LlmOrchestrator, createLlmOrchestrator, createOrchestratorEvidence } from './orchestrator.js';
export { createLlmAdapter, getEnhancedLlmAdapter, getLlmAdapter, pickLocalLLM } from './router.js';
`;

    // Generate llm/index.d.ts
    const llmIndexDts = `// Auto-generated minimal type definitions
export * from './base.js';
`;

    // Write all DTS files
    await Promise.all([
      writeFile("dist/index.d.ts", indexDts),
      writeFile("dist/ml/index.d.ts", mlIndexDts),
      writeFile("dist/llm/index.d.ts", llmIndexDts),
    ]);
  },
});
