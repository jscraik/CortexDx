import { createHash } from "node:crypto";
import type { McpDocsSearchMatch } from "../library/mcp-docs-service.js";

export type McpDocsResourceType = "search" | "chunk";

export interface McpDocsResource {
  id: string;
  type: McpDocsResourceType;
  createdAt: number;
  payload:
    | {
        query: string;
        version: string;
        matches: McpDocsSearchMatch[];
      }
    | {
        chunk: McpDocsSearchMatch;
      };
}

const MAX_RESOURCES = 15;
const resources: McpDocsResource[] = [];

export function recordMcpDocsSearchResource(data: {
  query: string;
  version: string;
  matches: McpDocsSearchMatch[];
}): McpDocsResource {
  const resource: McpDocsResource = {
    id: createResourceId(data.query, data.version),
    type: "search",
    createdAt: Date.now(),
    payload: data,
  };
  recordResource(resource);
  return resource;
}

export function recordMcpDocsChunkResource(
  chunk: McpDocsSearchMatch,
): McpDocsResource {
  const resource: McpDocsResource = {
    id: createResourceId(chunk.chunkId, chunk.version),
    type: "chunk",
    createdAt: Date.now(),
    payload: { chunk },
  };
  recordResource(resource);
  return resource;
}

export function listMcpDocsResources(): McpDocsResource[] {
  return [...resources];
}

export function getMcpDocsResource(id: string): McpDocsResource | undefined {
  return resources.find((resource) => resource.id === id);
}

function recordResource(resource: McpDocsResource): void {
  resources.unshift(resource);
  if (resources.length > MAX_RESOURCES) {
    resources.length = MAX_RESOURCES;
  }
}

function createResourceId(seed: string, version: string): string {
  return createHash("sha256")
    .update(version)
    .update(seed)
    .digest("hex")
    .slice(0, 12);
}
