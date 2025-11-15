/**
 * MCP Docs Adapter Contracts
 *
 * Type-safe schemas for search, lookup, and version tools
 */

import { z } from "zod";

// ============================================================================
// Search Tool Contracts
// ============================================================================

export const SearchInput = z.object({
  query: z.string().min(2, "Query must be at least 2 characters"),
  topK: z.number().int().min(1).max(20).default(5),
  version: z.string().optional(), // default: active version
});

export type SearchInput = z.infer<typeof SearchInput>;

export const Passage = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  score: z.number(),
  text: z.string(),
  anchor: z.string().optional(),
});

export type Passage = z.infer<typeof Passage>;

export const SearchOutput = z.object({
  version: z.string(),
  tookMs: z.number().int(),
  hits: z.array(Passage),
});

export type SearchOutput = z.infer<typeof SearchOutput>;

// ============================================================================
// Lookup Tool Contracts
// ============================================================================

export const LookupInput = z.object({
  id: z.string().min(1, "Chunk ID is required"),
});

export type LookupInput = z.infer<typeof LookupInput>;

export const LookupOutput = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  text: z.string(),
  outline: z.array(z.string()),
});

export type LookupOutput = z.infer<typeof LookupOutput>;

// ============================================================================
// Version Tool Contracts
// ============================================================================

export const VersionOutput = z.object({
  active: z.string(),
  available: z.array(z.string()),
  commit: z.string(),
});

export type VersionOutput = z.infer<typeof VersionOutput>;

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorCode {
  VERSION_MISMATCH = "VERSION_MISMATCH",
  NOT_FOUND = "NOT_FOUND",
  DATA_MISSING = "DATA_MISSING",
  INVALID_INPUT = "INVALID_INPUT",
}

export class McpDocsError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "McpDocsError";
  }
}

// ============================================================================
// Internal Types (for implementation)
// ============================================================================

export interface DocChunk {
  id: string;
  pageId: string;
  url: string;
  title: string;
  text: string;
  anchor?: string;
  headings: string[];
  // Reserved for future vector search functionality (e.g., semantic search using embeddings)
  embedding?: Float32Array;
}

export interface DocManifest {
  version: string;
  createdAt: string;
  commit: string;
  pages: {
    id: string;
    url: string;
    title: string;
    sha256: string;
    anchors: string[];
  }[];
}

// Zod schema for DocManifest
export const DocManifestSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  commit: z.string(),
  pages: z.array(
    z.object({
      id: z.string(),
      url: z.string().url(),
      title: z.string(),
      sha256: z.string(),
      anchors: z.array(z.string()),
    })
  ),
});

export type DocManifestType = z.infer<typeof DocManifestSchema>;
