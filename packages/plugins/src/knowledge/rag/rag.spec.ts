import type { SpecContent } from "@brainwav/cortexdx-core";
import { describe, expect, it, vi } from "vitest";
import type { EmbeddingAdapter } from "../../adapters/embedding.js";
import type {
  VectorStorage,
  VectorDocument,
} from "../../storage/vector-storage.js";
import { KnowledgeRagImpl } from "./rag.js";

describe("KnowledgeRAG", () => {
  const mockStorage = {
    addDocuments: vi.fn(),
    search: vi.fn(),
  } as unknown as VectorStorage;

  const mockEmbedding = {
    embed: vi.fn(),
    embedBatch: vi.fn(),
  } as unknown as EmbeddingAdapter;

  it("indexes spec content by chunking and storing embeddings", async () => {
    const rag = new KnowledgeRagImpl({
      storage: mockStorage,
      embedding: mockEmbedding,
    });

    const spec: SpecContent = {
      section: "test-section",
      version: "1.0",
      content: "# Header 1\nContent 1\n## Header 2\nContent 2",
      metadata: { url: "url", fetchedAt: 0 },
    };

    const mockEmbeddings = [
      { values: [0.1], dimensions: 1, model: "test", timestamp: 0 },
      { values: [0.2], dimensions: 1, model: "test", timestamp: 0 },
    ];

    (mockEmbedding.embedBatch as any).mockResolvedValue(mockEmbeddings);

    await rag.indexSpec(spec);

    expect(mockEmbedding.embedBatch).toHaveBeenCalledWith({
      texts: ["# Header 1\nContent 1", "## Header 2\nContent 2"],
      normalize: true,
    });

    expect(mockStorage.addDocuments).toHaveBeenCalledTimes(1);
    const storedDocs = (mockStorage.addDocuments as any).mock
      .calls[0][0] as VectorDocument[];
    if (!storedDocs || !storedDocs[0] || !storedDocs[1])
      throw new Error("Docs not stored");
    expect(storedDocs).toHaveLength(2);
    expect(storedDocs[0].metadata.text).toBe("# Header 1\nContent 1");
    expect(storedDocs[1].metadata.text).toBe("## Header 2\nContent 2");
  });

  it("searches for content using embeddings", async () => {
    const rag = new KnowledgeRagImpl({
      storage: mockStorage,
      embedding: mockEmbedding,
    });

    const query = "search query";
    const mockQueryEmbedding = {
      values: [0.5],
      dimensions: 1,
      model: "test",
      timestamp: 0,
    };
    (mockEmbedding.embed as any).mockResolvedValue(mockQueryEmbedding);

    const mockResults = [
      {
        document: {
          id: "reference_123",
          metadata: {
            text: "result text",
            context: {
              sourceId: "section-1",
              version: "1.0",
              metadata: {},
            },
          },
        },
        similarity: 0.9,
        rank: 1,
      },
    ];
    (mockStorage.search as any).mockResolvedValue(mockResults);

    const results = await rag.search(query);

    expect(mockEmbedding.embed).toHaveBeenCalledWith({
      text: query,
      normalize: true,
    });
    expect(mockStorage.search).toHaveBeenCalledWith(mockQueryEmbedding, {
      topK: 5,
      filterType: "reference",
    });
    expect(results).toHaveLength(1);
    if (!results[0]) throw new Error("No results");
    expect(results[0].chunk.content).toBe("result text");
    expect(results[0].chunk.section).toBe("section-1");
  });
});
