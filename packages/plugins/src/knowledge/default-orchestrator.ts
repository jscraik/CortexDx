import path from "node:path";
import { createKnowledgeOrchestrator } from "./orchestrator.js";

const DEFAULT_VERSION = process.env.MCP_DOCS_VERSION ?? "2025-06-18";
const BASE_URL =
  process.env.MCP_DOCS_BASE_URL ?? "https://modelcontextprotocol.io";

export function createDefaultKnowledgeOrchestrator() {
  const cacheDir =
    process.env.MCP_KNOWLEDGE_CACHE_DIR ??
    path.resolve(process.cwd(), ".cortexdx/knowledge");

  return createKnowledgeOrchestrator({
    baseUrl: BASE_URL,
    defaultVersion: DEFAULT_VERSION,
    cacheDir,
  });
}
