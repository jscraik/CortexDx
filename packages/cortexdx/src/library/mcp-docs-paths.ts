import path from "node:path";

export const MCP_DOCS_LIBRARY_ROOT = path.resolve(".cortexdx/library/mcp-docs");
export const MCP_DOCS_STAGING_DIR = path.join(MCP_DOCS_LIBRARY_ROOT, "_staging");
export const MCP_DOCS_VECTOR_PATH = path.resolve(
  ".cortexdx/vector-storage/mcp-docs.json",
);
