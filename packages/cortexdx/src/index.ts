export { runDiagnose } from "./orchestrator.js";
export type {
  EnhancedLlmAdapter,
  FilePlan,
  Finding,
  LlmAdapter,
} from "./types.js";

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
