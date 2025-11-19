import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  EmbeddingAdapter,
  EmbeddingModelInfo,
  EmbeddingRequest,
  EmbeddingVector,
} from "../src/adapters/embedding.js";
import {
  listMcpDocsVersions,
  lookupMcpDoc,
  readMcpDocsManifest,
  searchMcpDocs,
} from "../src/library/mcp-docs-service.js";
import type { McpDocsManifest } from "../src/library/mcp-docs.js";
import { createVectorStorage } from "../src/storage/vector-storage.js";

class MockEmbeddingAdapter implements EmbeddingAdapter {
  public readonly backend = "ollama" as const;

  async embed(request: EmbeddingRequest): Promise<EmbeddingVector> {
    const magnitude = Math.max(1, request.text.length);
    const normalized = [magnitude, 0];
    return {
      values: normalized,
      dimensions: normalized.length,
      model: "mock",
      timestamp: Date.now(),
    };
  }

  async embedBatch(): Promise<EmbeddingVector[]> {
    throw new Error("embedBatch not implemented in tests");
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

describe("MCP docs service", () => {
  let tmpRoot: string;
  let stagingDir: string;
  let vectorPath: string;
  const adapter = new MockEmbeddingAdapter();

  beforeEach(async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-docs-service-"));
    stagingDir = path.join(tmpRoot, "_staging");
    vectorPath = path.join(tmpRoot, "vector.json");
    await prepareVersionSnapshot("2025-06-18", stagingDir);
    await seedVectorStorage(vectorPath);
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("searches reference chunks and returns similarity metadata", async () => {
    const result = await searchMcpDocs({
      query: "Spec chunk",
      vectorStorage: undefined,
      storagePath: vectorPath,
      embeddingAdapter: adapter,
      stagingDir,
      rootDir: tmpRoot,
    });

    expect(result.version).toBe("2025-06-18");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.url).toContain("/basic");
  });

  it("looks up chunks by chunkId", async () => {
    const match = await lookupMcpDoc({
      chunkId: "spec-basic-0000",
      storagePath: vectorPath,
    });
    expect(match.text).toContain("Protocol overview");
    expect(match.sourceId).toBe("spec-basic");
  });

  it("lists available versions with manifest metadata", async () => {
    const versions = await listMcpDocsVersions({
      rootDir: tmpRoot,
      stagingDir,
    });
    expect(versions[0]?.version).toBe("2025-06-18");
    const manifest = await readMcpDocsManifest("2025-06-18", "staging", {
      rootDir: tmpRoot,
      stagingDir,
    });
    expect(manifest.manifest.chunkCount).toBe(1);
  });
});

async function prepareVersionSnapshot(
  version: string,
  stagingDir: string,
): Promise<void> {
  const versionDir = path.join(stagingDir, version);
  await mkdir(versionDir, { recursive: true });
  await writeFile(
    path.join(versionDir, "manifest.json"),
    JSON.stringify(buildManifest(version), null, 2),
    "utf8",
  );
}

async function seedVectorStorage(storagePath: string): Promise<void> {
  await mkdir(path.dirname(storagePath), { recursive: true });
  const storage = createVectorStorage(storagePath);
  await storage.addDocument({
    id: "reference_spec-basic-0000",
    embedding: {
      values: [10, 0],
      dimensions: 2,
      model: "mock",
      timestamp: Date.now(),
    },
    metadata: {
      type: "reference",
      text: "Protocol overview chunk text",
      context: {
        version: "2025-06-18",
        url: "https://modelcontextprotocol.io/specification/2025-06-18/basic",
        sourceId: "spec-basic",
        order: 0,
        title: "Protocol overview",
      },
    },
    timestamp: Date.now(),
  });
  await storage.flushPendingWrites();
}

function buildManifest(version: string): McpDocsManifest {
  return {
    version,
    createdAt: new Date().toISOString(),
    sources: [],
    chunkCount: 1,
  };
}
