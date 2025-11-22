import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { EmbeddingAdapter } from "../adapters/embedding.js";
import { createOllamaEmbeddingAdapter } from "../adapters/ollama-embedding.js";
import {
  type VectorStorage,
  type ReferenceDocumentInput,
  type VectorDocument,
  createReferenceDocument,
  createVectorStorage,
} from "../storage/vector-storage.js";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import {
  MCP_DOCS_LIBRARY_ROOT,
  MCP_DOCS_STAGING_DIR,
  MCP_DOCS_VECTOR_PATH,
} from "./mcp-docs-paths.js";
import type {
  McpDocsChunkRecord,
  McpDocsManifest,
  McpDocsSourceInfo,
} from "./mcp-docs.js";

export interface McpDocsIngestOptions {
  rootDir?: string;
  version?: string;
  staging?: boolean;
  vectorStorage?: VectorStorage;
  vectorStoragePath?: string;
  embeddingAdapter?: EmbeddingAdapter;
  chunkLimit?: number;
  dryRun?: boolean;
}

export interface McpDocsIngestResult {
  version: string;
  chunksProcessed: number;
  documentsInserted: number;
  manifestPath: string;
  chunksPath: string;
  storagePath?: string;
}

export async function ingestMcpDocsSnapshot(
  options: McpDocsIngestOptions = {},
): Promise<McpDocsIngestResult> {
  const snapshot = await loadSnapshotContext(options);
  if (snapshot.chunks.length === 0) {
    return {
      version: snapshot.version,
      chunksProcessed: 0,
      documentsInserted: 0,
      manifestPath: snapshot.manifestPath,
      chunksPath: snapshot.chunksPath,
      storagePath: options.vectorStoragePath,
    };
  }

  const storageDetails = await prepareVectorStorage(
    options.vectorStorage,
    options.vectorStoragePath,
  );
  const userProvidedStorage = Boolean(options.vectorStorage);
  const adapter = options.embeddingAdapter ?? createOllamaEmbeddingAdapter();
  const documents = await embedChunks(
    snapshot.chunks,
    snapshot.sourceIndex,
    adapter,
  );

  if (!options.dryRun) {
    await storageDetails.storage.addDocuments(documents);
    if (!userProvidedStorage) {
      await storageDetails.storage.close(); // Ensure writes are persisted
    }
  }

  return {
    version: snapshot.version,
    chunksProcessed: snapshot.chunks.length,
    documentsInserted: options.dryRun ? 0 : documents.length,
    manifestPath: snapshot.manifestPath,
    chunksPath: snapshot.chunksPath,
    storagePath: storageDetails.path,
  };
}

type SnapshotContext = {
  version: string;
  manifest: McpDocsManifest;
  chunks: McpDocsChunkRecord[];
  manifestPath: string;
  chunksPath: string;
  sourceIndex: Map<string, McpDocsSourceInfo>;
};

async function loadSnapshotContext(
  options: McpDocsIngestOptions,
): Promise<SnapshotContext> {
  const rootDir = options.rootDir
    ? path.resolve(options.rootDir)
    : MCP_DOCS_LIBRARY_ROOT;
  const stagingRoot =
    options.rootDir && options.rootDir !== MCP_DOCS_LIBRARY_ROOT
      ? path.join(rootDir, "_staging")
      : MCP_DOCS_STAGING_DIR;
  const scopeDir = options.staging === false ? rootDir : stagingRoot;
  const version = await resolveSnapshotVersion(scopeDir, options.version);
  const versionDir = path.join(scopeDir, version);
  const manifestPath = path.join(versionDir, "manifest.json");
  const chunksPath = path.join(versionDir, "chunks.jsonl");
  const manifest = await readManifest(manifestPath);
  const chunks = await readChunkFile(chunksPath, options.chunkLimit);
  return {
    version,
    manifest,
    chunks,
    manifestPath,
    chunksPath,
    sourceIndex: buildSourceIndex(manifest),
  };
}

async function resolveSnapshotVersion(
  scopeDir: string,
  explicit?: string,
): Promise<string> {
  if (explicit) {
    await assertDirectory(path.join(scopeDir, explicit));
    return explicit;
  }

  const entries = await readdir(scopeDir, { withFileTypes: true }).catch(() => {
    throw new Error(`No snapshots found under ${scopeDir}`);
  });
  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  if (candidates.length === 0) {
    throw new Error(`No snapshots found under ${scopeDir}`);
  }
  const latest = candidates[0];
  if (!latest) {
    throw new Error(`Unable to resolve snapshot in ${scopeDir}`);
  }
  return latest;
}

async function assertDirectory(target: string): Promise<void> {
  const stats = await stat(target).catch(() => null);
  if (!stats?.isDirectory()) {
    throw new Error(`Snapshot directory missing: ${target}`);
  }
}

async function readManifest(filePath: string): Promise<McpDocsManifest> {
  const raw = await readFile(filePath, "utf8");
  return safeParseJson(raw) as McpDocsManifest;
}

async function readChunkFile(
  filePath: string,
  limit?: number,
): Promise<McpDocsChunkRecord[]> {
  const raw = await readFile(filePath, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const records = lines.map(
    (line) => safeParseJson(line) as McpDocsChunkRecord,
  );
  if (typeof limit === "number" && limit >= 0) {
    return records.slice(0, limit);
  }
  return records;
}

function buildSourceIndex(
  manifest: McpDocsManifest,
): Map<string, McpDocsSourceInfo> {
  const index = new Map<string, McpDocsSourceInfo>();
  for (const source of manifest.sources) {
    index.set(source.id, source);
  }
  for (const repo of manifest.git ?? []) {
    index.set(repo.id, repo);
  }
  return index;
}

async function prepareVectorStorage(
  provided: VectorStorage | undefined,
  customPath?: string,
): Promise<{ storage: VectorStorage; path?: string }> {
  if (provided) {
    return { storage: provided, path: customPath };
  }
  const storagePath =
    customPath ?? MCP_DOCS_VECTOR_PATH.replace(".json", ".db");
  await mkdir(path.dirname(storagePath), { recursive: true });
  const storage = await createVectorStorage(storagePath);
  await storage.restoreFromDisk();
  return { storage, path: storagePath };
}

async function embedChunks(
  chunks: McpDocsChunkRecord[],
  sourceIndex: Map<string, McpDocsSourceInfo>,
  adapter: EmbeddingAdapter,
): Promise<VectorDocument[]> {
  const embeddings = await adapter.embedBatch({
    texts: chunks.map((chunk) => chunk.text),
    normalize: true,
  });
  return chunks.map((chunk, index) => {
    const embedding = embeddings[index];
    if (!embedding) {
      throw new Error(`Missing embedding for chunk ${chunk.id}`);
    }
    return createReferenceDocument(
      buildReferenceInput(chunk, sourceIndex),
      embedding,
    );
  });
}

function buildReferenceInput(
  chunk: McpDocsChunkRecord,
  sourceIndex: Map<string, McpDocsSourceInfo>,
): ReferenceDocumentInput {
  const source = sourceIndex.get(chunk.sourceId);
  return {
    id: chunk.id,
    text: chunk.text,
    version: chunk.version,
    url: chunk.url,
    sourceId: chunk.sourceId,
    order: chunk.order,
    sha256: chunk.sha256,
    title: chunk.title,
    sourceType: source?.type,
    sourceUrl: source?.url,
    artifact: source?.artifact,
    commit:
      "commit" in (source ?? {})
        ? (source as { commit: string }).commit
        : undefined,
    metadata: source?.metadata,
  };
}
