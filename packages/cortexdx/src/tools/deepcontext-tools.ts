import type { DevelopmentContext, DiagnosticContext, McpTool, McpToolResult } from "../types.js";
import { DeepContextClient } from "../deepcontext/client.js";
import path from "node:path";

type AnyContext = DevelopmentContext | DiagnosticContext;

const descriptionPrefix =
  "Invoke the Wildcard DeepContext MCP server to index repositories and run semantic code search";

export const createDeepContextTools = (): McpTool[] => [
  {
    name: "cortexdx_deepcontext_index",
    description: `${descriptionPrefix}. Starts or forces an index run for a codebase path. Requires WILDCARD_API_KEY env var.`,
    inputSchema: {
      type: "object",
      properties: {
        codebasePath: { type: "string", description: "Absolute path to the codebase" },
        force: { type: "boolean", description: "Force a full reindex", default: false },
      },
      required: ["codebasePath"],
    },
  },
  {
    name: "cortexdx_deepcontext_search",
    description: `${descriptionPrefix}. Performs semantic search against an indexed codebase and returns ranked chunks.`,
    inputSchema: {
      type: "object",
      properties: {
        codebasePath: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number", default: 5 },
      },
      required: ["codebasePath", "query"],
    },
  },
  {
    name: "cortexdx_deepcontext_status",
    description: `${descriptionPrefix}. Reads the indexing status for a codebase (or all indexed codebases).`,
    inputSchema: {
      type: "object",
      properties: {
        codebasePath: { type: "string" },
      },
    },
  },
  {
    name: "cortexdx_deepcontext_clear",
    description: `${descriptionPrefix}. Clears stored index data for a codebase.`,
    inputSchema: {
      type: "object",
      properties: {
        codebasePath: { type: "string" },
      },
    },
  },
];

export async function executeDeepContextTool(
  tool: McpTool,
  args: unknown,
  ctx: AnyContext,
): Promise<McpToolResult> {
  const client = new DeepContextClient({ logger: ctx.logger });
  const payload = (typeof args === "object" && args) ? (args as Record<string, unknown>) : {};

  switch (tool.name) {
    case "cortexdx_deepcontext_index": {
      const codebase = ensureCodebasePath(payload);
      const text = await client.indexCodebase(codebase, Boolean(payload.force));
      return textResult(text);
    }
    case "cortexdx_deepcontext_search": {
      const codebase = ensureCodebasePath(payload);
      const query = String(payload.query ?? "").trim();
      if (!query) {
        throw new Error("query is required for cortexdx_deepcontext_search");
      }
      const maxResults = typeof payload.maxResults === "number" ? payload.maxResults : undefined;
      const result = await client.searchCodebase(codebase, query, maxResults);
      return {
        content: [
          {
            type: "text",
            text: result.text,
          },
        ],
        structuredContent: result.matches,
      };
    }
    case "cortexdx_deepcontext_status": {
      const codebase = payload.codebasePath ? ensureCodebasePath(payload) : undefined;
      const text = await client.getIndexingStatus(codebase);
      return textResult(text);
    }
    case "cortexdx_deepcontext_clear": {
      const codebase = payload.codebasePath ? ensureCodebasePath(payload) : undefined;
      const text = await client.clearIndex(codebase);
      return textResult(text);
    }
    default:
      throw new Error(`Unknown DeepContext tool: ${tool.name}`);
  }
}

function ensureCodebasePath(payload: Record<string, unknown>): string {
  const value = payload.codebasePath;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("codebasePath is required and must be a non-empty string");
  }
  return path.resolve(value.trim());
}

function textResult(text: string): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}
