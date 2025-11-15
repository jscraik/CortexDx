import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  EmbeddingAdapter,
  EmbeddingBatchRequest,
  EmbeddingModelInfo,
  EmbeddingRequest,
  EmbeddingVector,
} from "../src/adapters/embedding.js";
import { ingestMcpDocsSnapshot } from "../src/library/mcp-docs-ingestion.js";
import type {
  McpDocsChunkRecord,
  McpDocsManifest,
} from "../src/library/mcp-docs.js";
import { createVectorStorage } from "../src/storage/vector-storage.js";

class MockEmbeddingAdapter implements EmbeddingAdapter {
  public readonly backend = "ollama" as const;

  async embed(request: EmbeddingRequest): Promise<EmbeddingVector> {
    const magnitude = Math.max(1, request.text.length);
    const values = [magnitude, magnitude / 2, magnitude / 4];
    return {
      values,
      dimensions: values.length,
      model: "mock-embed",
      timestamp: Date.now(),
    };
  }

  async embedBatch(request: EmbeddingBatchRequest): Promise<EmbeddingVector[]> {
    return Promise.all(
      request.texts.map((text) =>
        this.embed({ text, model: request.model, normalize: request.normalize }),
      ),
    );
  }

  async getAvailableModels(): Promise<EmbeddingModelInfo[]> {
    return [];
  }

  async loadModel(): Promise<void> {
    // noop
  }

  async unloadModel(): Promise<void> {
    // noop
  }

  async getCurrentModel(): Promise<EmbeddingModelInfo | null> {
    return null;
  }
}

describe("MCP docs ingestion", () => {
  let tmpRoot: string;
  const adapter = new MockEmbeddingAdapter();

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-docs-ingest-"));
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("ingests staged chunks into vector storage with reference metadata", async () => {
    const manifest = buildManifest("2025-06-18", 2);
    const chunks: McpDocsChunkRecord[] = [
      buildChunk("source-a", 0, "First chunk text", manifest.version),
      buildChunk("source-a", 1, "Second chunk text", manifest.version),
    ];
    await writeSnapshot(tmpRoot, manifest, chunks);

    const storage = createVectorStorage();
    const result = await ingestMcpDocsSnapshot({
      rootDir: tmpRoot,
      version: manifest.version,
      vectorStorage: storage,
      embeddingAdapter: adapter,
    });

    expect(result.version).toBe(manifest.version);
    expect(result.chunksProcessed).toBe(2);
    const docs = await storage.getDocumentsByType("reference");
    expect(docs).toHaveLength(2);
    expect(docs[0]?.metadata.context.version).toBe(manifest.version);
    expect(docs[0]?.metadata.context.url).toContain("source-a");
  });

  it("selects the latest snapshot when version is omitted", async () => {
    const older = buildManifest("2025-06-10", 1);
    const newer = buildManifest("2025-06-18", 1);
    await writeSnapshot(tmpRoot, older, [
      buildChunk("source-old", 0, "Old chunk", older.version),
    ]);
    await writeSnapshot(tmpRoot, newer, [
      buildChunk("source-new", 0, "New chunk", newer.version),
    ]);

    const storage = createVectorStorage();
    const result = await ingestMcpDocsSnapshot({
      rootDir: tmpRoot,
      vectorStorage: storage,
      embeddingAdapter: adapter,
    });

    expect(result.version).toBe(newer.version);
    const docs = await storage.getDocumentsByType("reference");
    expect(docs).toHaveLength(1);
    expect(docs[0]?.metadata.context.version).toBe(newer.version);
    expect(docs[0]?.metadata.context.url).toContain("source-new");
  });
});

function buildManifest(version: string, chunkCount: number): McpDocsManifest {
  return {
    version,
    createdAt: new Date().toISOString(),
    sources: [],
    chunkCount,
  };
}

function buildChunk(
  sourceId: string,
  order: number,
  text: string,
  version: string,
): McpDocsChunkRecord {
  return {
    id: `${sourceId}-${order.toString().padStart(4, "0")}`,
    version,
    sourceId,
    url: `https://example.com/${sourceId}#${order}`,
    order,
    title: `Chunk ${order}`,
    text,
    sha256: `${order}`.repeat(4),
  };
}

async function writeSnapshot(
  root: string,
  manifest: McpDocsManifest,
  chunks: McpDocsChunkRecord[],
): Promise<void> {
  const dir = path.join(root, "_staging", manifest.version);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  const payload = chunks
    .map((chunk) => JSON.stringify(chunk))
    .join("\n")
    .concat("\n");
  await writeFile(path.join(dir, "chunks.jsonl"), payload, "utf8");
}
