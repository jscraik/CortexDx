import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { EmbeddingAdapter } from "../adapters/embedding.js";
import { createOllamaEmbeddingAdapter } from "../adapters/ollama-embedding.js";
import {
  type IVectorStorage,
  type VectorDocument,
  createVectorStorage,
} from "../storage/vector-storage.js";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import {
  MCP_DOCS_LIBRARY_ROOT,
  MCP_DOCS_STAGING_DIR,
  MCP_DOCS_VECTOR_PATH,
} from "./mcp-docs-paths.js";
import type { McpDocsManifest } from "./mcp-docs.js";

const searchMatchSchema = z.object({
  chunkId: z.string(),
  version: z.string(),
  url: z.string(),
  sourceId: z.string(),
  title: z.string().optional(),
  text: z.string(),
  similarity: z.number(),
  sourceType: z.string().optional(),
  artifact: z.string().optional(),
  commit: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type McpDocsSearchMatch = z.infer<typeof searchMatchSchema>;

export interface McpDocsSearchOptions {
  query: string;
  topK?: number;
  minSimilarity?: number;
  version?: string;
  scope?: "staging" | "promoted";
  storagePath?: string;
  embeddingAdapter?: EmbeddingAdapter;
  vectorStorage?: IVectorStorage;
  rootDir?: string;
  stagingDir?: string;
}

export interface McpDocsLookupOptions {
  chunkId?: string;
  url?: string;
  sourceId?: string;
  order?: number;
  version?: string;
  scope?: "staging" | "promoted";
  storagePath?: string;
}

export interface McpDocsVersionInfo {
  version: string;
  scope: "staging" | "promoted";
  manifestPath: string;
  chunkCount: number;
  createdAt: string;
}

export async function searchMcpDocs(
  options: McpDocsSearchOptions,
): Promise<{ version: string; matches: McpDocsSearchMatch[] }> {
  const query = options.query?.trim();
  if (!query) {
    throw new Error("query is required for cortexdx_mcp_docs_search");
  }

  const storage = await hydrateVectorStorage(
    options.vectorStorage,
    options.storagePath,
  );
  const adapter =
    options.embeddingAdapter ?? createOllamaEmbeddingAdapter(undefined);
  const embedding = await adapter.embed({ text: query, normalize: true });
  const searchResults = await storage.search(embedding, {
    topK: options.topK ?? 5,
    minSimilarity: options.minSimilarity ?? 0.6,
    filterType: "reference",
  });

  const matches = searchResults.map((result) =>
    searchMatchSchema.parse(
      convertDocumentToMatch(result.document, result.similarity),
    ),
  );

  const version =
    options.version ??
    matches[0]?.version ??
    (await resolveActiveVersion(options.version, options.scope, {
      rootDir: options.rootDir,
      stagingDir: options.stagingDir,
    }));

  return { version, matches };
}

export async function lookupMcpDoc(
  options: McpDocsLookupOptions,
): Promise<McpDocsSearchMatch> {
  const docs = await loadReferenceDocuments(options.storagePath);
  let target: VectorDocument | undefined;

  if (options.chunkId) {
    const id = options.chunkId.startsWith("reference_")
      ? options.chunkId
      : `reference_${options.chunkId}`;
    target = docs.find((doc) => doc.id === id);
  } else if (options.url) {
    target = docs.find(
      (doc) => (doc.metadata.context.url as string | undefined) === options.url,
    );
  } else if (options.sourceId && typeof options.order === "number") {
    target = docs.find(
      (doc) =>
        doc.metadata.context.sourceId === options.sourceId &&
        doc.metadata.context.order === options.order,
    );
  } else {
    throw new Error("Provide chunkId, url, or sourceId+order for lookup");
  }

  if (!target) {
    throw new Error("Requested MCP docs chunk was not found");
  }

  return searchMatchSchema.parse(convertDocumentToMatch(target, 1));
}

export interface McpDocsVersionOptions {
  rootDir?: string;
  stagingDir?: string;
}

export async function listMcpDocsVersions(
  options: McpDocsVersionOptions = {},
): Promise<McpDocsVersionInfo[]> {
  const stagingRoot = options.stagingDir ?? MCP_DOCS_STAGING_DIR;
  const promotedRoot = options.rootDir ?? MCP_DOCS_LIBRARY_ROOT;
  const stagingVersions = await listVersionsInDir(stagingRoot, "staging");
  const promotedVersions = await listVersionsInDir(promotedRoot, "promoted", [
    "_staging",
  ]);
  return [...stagingVersions, ...promotedVersions].sort((a, b) =>
    b.version.localeCompare(a.version),
  );
}

export async function readMcpDocsManifest(
  version: string,
  scope: "staging" | "promoted" = "staging",
  options: McpDocsVersionOptions = {},
): Promise<{ manifest: McpDocsManifest; path: string }> {
  const dir =
    scope === "staging"
      ? path.join(options.stagingDir ?? MCP_DOCS_STAGING_DIR, version)
      : path.join(options.rootDir ?? MCP_DOCS_LIBRARY_ROOT, version);
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = safeParseJson(
    await readFile(manifestPath, "utf8"),
  ) as McpDocsManifest;
  return { manifest, path: manifestPath };
}

async function hydrateVectorStorage(
  existing: IVectorStorage | undefined,
  customPath?: string,
): Promise<IVectorStorage> {
  if (existing) {
    return existing;
  }
  const dbPath = (customPath ?? MCP_DOCS_VECTOR_PATH).replace(".json", ".db");
  const storage = await createVectorStorage(dbPath);
  await storage.restoreFromDisk();
  return storage;
}

async function loadReferenceDocuments(
  storagePath?: string,
): Promise<VectorDocument[]> {
  const storage = await hydrateVectorStorage(undefined, storagePath);
  return storage.getDocumentsByType("reference");
}

function convertDocumentToMatch(
  doc: VectorDocument,
  similarity: number,
): McpDocsSearchMatch {
  const context = doc.metadata.context as Record<string, unknown>;
  const rawId = doc.id.replace(/^reference_/, "");
  return {
    chunkId: rawId,
    version: String(context.version ?? ""),
    url: String(context.url ?? ""),
    sourceId: String(context.sourceId ?? ""),
    title: typeof context.title === "string" ? context.title : undefined,
    text: doc.metadata.text,
    similarity,
    sourceType:
      typeof context.sourceType === "string" ? context.sourceType : undefined,
    artifact:
      typeof context.artifact === "string" ? context.artifact : undefined,
    commit: typeof context.commit === "string" ? context.commit : undefined,
    metadata: context.metadata as Record<string, unknown> | undefined,
  };
}

async function listVersionsInDir(
  dir: string,
  scope: "staging" | "promoted",
  exclude: string[] = [],
): Promise<McpDocsVersionInfo[]> {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const versions: McpDocsVersionInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || exclude.includes(entry.name)) {
      continue;
    }
    const candidateDir = path.join(dir, entry.name);
    const manifestPath = path.join(candidateDir, "manifest.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = safeParseJson(
      await readFile(manifestPath, "utf8"),
    ) as McpDocsManifest;
    versions.push({
      version: manifest.version,
      scope,
      manifestPath,
      chunkCount: manifest.chunkCount,
      createdAt: manifest.createdAt,
    });
  }
  return versions;
}

async function resolveActiveVersion(
  preferred?: string,
  scope: "staging" | "promoted" = "staging",
  options: McpDocsVersionOptions = {},
): Promise<string> {
  if (preferred) {
    return preferred;
  }
  const dir =
    scope === "staging"
      ? (options.stagingDir ?? MCP_DOCS_STAGING_DIR)
      : (options.rootDir ?? MCP_DOCS_LIBRARY_ROOT);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const versions = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "_staging")
    .map((entry) => entry.name)
    .sort()
    .reverse();
  if (versions.length === 0) {
    throw new Error(
      `No MCP docs snapshots found under ${scope === "staging" ? MCP_DOCS_STAGING_DIR : MCP_DOCS_LIBRARY_ROOT}`,
    );
  }
  // We know versions[0] exists because we checked length > 0 above
  const firstVersion = versions[0];
  return firstVersion as string;
}
