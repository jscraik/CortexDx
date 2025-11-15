export { runDiagnose } from "./orchestrator.js";
export type { EnhancedLlmAdapter, FilePlan, Finding, LlmAdapter } from "./types.js";

// ML and LLM exports
export {
    LlmOrchestrator, createLlmAdapter, createLlmOrchestrator, getEnhancedLlmAdapter, getLlmAdapter, hasOllama, pickLocalLLM
} from "./ml/index.js";

// Adapter exports
export { createOllamaAdapter } from "./adapters/index.js";

// Library ingestion
export {
    ingestMcpDocsSnapshot,
    type McpDocsIngestOptions,
    type McpDocsIngestResult,
} from "./library/mcp-docs-ingestion.js";
export type {
    McpDocsChunkRecord,
    McpDocsManifest,
    McpDocsSourceInfo,
} from "./library/mcp-docs.js";
