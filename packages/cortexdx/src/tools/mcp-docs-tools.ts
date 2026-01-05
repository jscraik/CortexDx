import type { DevelopmentContext, McpTool, McpToolResult } from "../types";
import {
  listMcpDocsVersions,
  lookupMcpDoc,
  searchMcpDocs,
} from "../library/mcp-docs-service";
import {
  recordMcpDocsChunkResource,
  recordMcpDocsSearchResource,
} from "../resources/mcp-docs-store";

export const createMcpDocsTools = (): McpTool[] => [
  {
    name: "cortexdx_mcp_docs_search",
    description: "Semantic search across normalized MCP spec/about resources",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query text" },
        topK: {
          type: "number",
          description: "Maximum number of chunks to return",
          minimum: 1,
          maximum: 20,
          default: 5,
        },
        minSimilarity: {
          type: "number",
          description: "Minimum cosine similarity (0-1)",
          minimum: 0,
          maximum: 1,
          default: 0.6,
        },
        version: {
          type: "string",
          description: "Specific snapshot version (defaults to latest)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "cortexdx_mcp_docs_lookup",
    description: "Lookup a normalized MCP spec chunk by chunk id or URL",
    inputSchema: {
      type: "object",
      properties: {
        chunkId: {
          type: "string",
          description: "Chunk id (e.g., spec-basic-0001)",
        },
        url: {
          type: "string",
          description: "Exact source URL captured in the manifest",
        },
        sourceId: {
          type: "string",
          description: "Manifest source id (pair with order)",
        },
        order: {
          type: "number",
          description: "Chunk order number for the source",
        },
      },
    },
  },
  {
    name: "cortexdx_mcp_docs_versions",
    description: "List available MCP spec snapshot versions and metadata",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export async function executeMcpDocsTool(
  tool: McpTool,
  args: unknown,
  _ctx: DevelopmentContext,
): Promise<McpToolResult> {
  switch (tool.name) {
    case "cortexdx_mcp_docs_search":
      return handleSearch(args);
    case "cortexdx_mcp_docs_lookup":
      return handleLookup(args);
    case "cortexdx_mcp_docs_versions":
      return handleVersions();
    default:
      throw new Error(`Unknown MCP docs tool: ${tool.name}`);
  }
}

async function handleSearch(args: unknown): Promise<McpToolResult> {
  const { query, topK, minSimilarity, version } = (args ?? {}) as {
    query?: string;
    topK?: number;
    minSimilarity?: number;
    version?: string;
  };
  if (!query || query.trim().length === 0) {
    throw new Error("query is required for cortexdx_mcp_docs_search");
  }
  const result = await searchMcpDocs({
    query: query.trim(),
    topK,
    minSimilarity,
    version,
  });
  const resource = recordMcpDocsSearchResource({
    query: query.trim(),
    version: result.version,
    matches: result.matches,
  });
  const resourceUri = `cortexdx://mcp-docs/${resource.id}`;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ resourceUri, matches: result.matches }, null, 2),
      },
    ],
    // Wrap array in object to conform to outputSchema (type: "object")
    structuredContent: { resourceUri, matches: result.matches },
  };
}

async function handleLookup(args: unknown): Promise<McpToolResult> {
  const { chunkId, url, sourceId, order } = (args ?? {}) as {
    chunkId?: string;
    url?: string;
    sourceId?: string;
    order?: number;
  };
  const match = await lookupMcpDoc({ chunkId, url, sourceId, order });
  const resource = recordMcpDocsChunkResource(match);
  const resourceUri = `cortexdx://mcp-docs/${resource.id}`;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ resourceUri, chunk: match }, null, 2),
      },
    ],
    // Wrap single result in object to conform to outputSchema (type: "object")
    structuredContent: { resourceUri, chunk: match },
  };
}

async function handleVersions(): Promise<McpToolResult> {
  const versions = await listMcpDocsVersions();
  return {
    content: [
      { type: "text", text: JSON.stringify({ versions }, null, 2) },
    ],
    // Wrap array in object to conform to outputSchema (type: "object")
    structuredContent: { versions },
  };
}
