/**
 * Vector Storage for Embeddings
 * Provides persistent storage and semantic search for resolution patterns
 * Requirements: 12.5, 10.2
 */

import { safeParseJson } from "../utils/json.js";
import type { EmbeddingVector } from "../adapters/embedding.js";
import { cosineSimilarity } from "../adapters/embedding.js";
import type { Problem, Solution } from "../types.js";

export interface VectorDocument {
  id: string;
  embedding: EmbeddingVector;
  metadata: DocumentMetadata;
  timestamp: number;
}

export interface DocumentMetadata {
  type: "problem" | "solution" | "pattern" | "reference";
  problemType?: string;
  problemSignature?: string;
  solutionId?: string;
  successCount?: number;
  confidence?: number;
  text: string;
  context: Record<string, unknown>;
}

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  rank: number;
}

export interface SearchOptions {
  topK?: number;
  minSimilarity?: number;
  filterType?: "problem" | "solution" | "pattern" | "reference";
  filterProblemType?: string;
}

export interface VectorStorageStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  oldestDocument: number | null;
  newestDocument: number | null;
  averageEmbeddingDimensions: number;
}

/**
 * In-memory vector storage with optional persistence
 */
export class VectorStorage {
  private documents = new Map<string, VectorDocument>();
  private persistencePath?: string;

  constructor(persistencePath?: string) {
    this.persistencePath = persistencePath;
  }

  /**
   * Add a document with its embedding to the storage
   */
  async addDocument(document: VectorDocument): Promise<void> {
    this.documents.set(document.id, document);

    if (this.persistencePath) {
      await this.persistToDisk();
    }
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(documents: VectorDocument[]): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, doc);
    }

    if (this.persistencePath) {
      await this.persistToDisk();
    }
  }

  /**
   * Search for similar documents using semantic similarity
   */
  async search(
    queryEmbedding: EmbeddingVector,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const {
      topK = 10,
      minSimilarity = 0.6,
      filterType,
      filterProblemType,
    } = options;

    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      // Apply filters
      if (filterType && doc.metadata.type !== filterType) {
        continue;
      }
      if (filterProblemType && doc.metadata.problemType !== filterProblemType) {
        continue;
      }

      // Calculate similarity
      const similarity = cosineSimilarity(
        queryEmbedding.values,
        doc.embedding.values,
      );

      if (similarity >= minSimilarity) {
        results.push({
          document: doc,
          similarity,
          rank: 0, // Will be set after sorting
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // Limit to topK and set ranks
    const topResults = results.slice(0, topK);
    topResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    return topResults;
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<VectorDocument | null> {
    return this.documents.get(id) || null;
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    const deleted = this.documents.delete(id);

    if (deleted && this.persistencePath) {
      await this.persistToDisk();
    }

    return deleted;
  }

  /**
   * Get all documents matching a filter
   */
  async getDocumentsByType(
    type: "problem" | "solution" | "pattern" | "reference",
  ): Promise<VectorDocument[]> {
    return Array.from(this.documents.values()).filter(
      (doc) => doc.metadata.type === type,
    );
  }

  /**
   * Get storage statistics
   */
  getStats(): VectorStorageStats {
    const docs = Array.from(this.documents.values());

    if (docs.length === 0) {
      return {
        totalDocuments: 0,
        documentsByType: {},
        oldestDocument: null,
        newestDocument: null,
        averageEmbeddingDimensions: 0,
      };
    }

    const documentsByType: Record<string, number> = {};
    let totalDimensions = 0;

    for (const doc of docs) {
      documentsByType[doc.metadata.type] =
        (documentsByType[doc.metadata.type] || 0) + 1;
      totalDimensions += doc.embedding.dimensions;
    }

    const timestamps = docs.map((d) => d.timestamp);

    return {
      totalDocuments: docs.length,
      documentsByType,
      oldestDocument: Math.min(...timestamps),
      newestDocument: Math.max(...timestamps),
      averageEmbeddingDimensions: totalDimensions / docs.length,
    };
  }

  /**
   * Clean up old documents
   */
  async cleanupOldDocuments(maxAgeMs: number): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, doc] of this.documents.entries()) {
      if (now - doc.timestamp > maxAgeMs) {
        this.documents.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0 && this.persistencePath) {
      await this.persistToDisk();
    }

    return cleaned;
  }

  /**
   * Restore from disk on startup
   */
  async restoreFromDisk(): Promise<number> {
    if (!this.persistencePath) {
      return 0;
    }

    try {
      const fs = await import("node:fs/promises");
      const data = await fs.readFile(this.persistencePath, "utf-8");
      const stored: VectorDocument[] = safeParseJson(data);

      for (const doc of stored) {
        this.documents.set(doc.id, doc);
      }

      return stored.length;
    } catch (error) {
      // File doesn't exist or is invalid - that's okay on first run
      return 0;
    }
  }

  /**
   * Persist current state to disk
   */
  private async persistToDisk(): Promise<void> {
    if (!this.persistencePath) {
      return;
    }

    const documents = Array.from(this.documents.values());
    const fs = await import("node:fs/promises");
    await fs.writeFile(
      this.persistencePath,
      JSON.stringify(documents, null, 2),
      "utf-8",
    );
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    this.documents.clear();

    if (this.persistencePath) {
      await this.persistToDisk();
    }
  }
}

/**
 * Create a vector storage instance
 */
export const createVectorStorage = (
  persistencePath?: string,
): VectorStorage => {
  return new VectorStorage(persistencePath);
};

/**
 * Helper to create a vector document from a problem
 */
export const createProblemDocument = (
  problem: Problem,
  embedding: EmbeddingVector,
): VectorDocument => {
  return {
    id: `problem_${problem.id}`,
    embedding,
    metadata: {
      type: "problem",
      problemType: problem.type,
      problemSignature: problem.description,
      text: problem.description,
      context: {
        severity: problem.severity,
        affectedComponents: problem.affectedComponents,
        userLevel: problem.userLevel,
      },
    },
    timestamp: Date.now(),
  };
};

/**
 * Helper to create a vector document from a solution
 */
export const createSolutionDocument = (
  solution: Solution,
  problem: Problem,
  embedding: EmbeddingVector,
): VectorDocument => {
  return {
    id: `solution_${solution.id}`,
    embedding,
    metadata: {
      type: "solution",
      problemType: problem.type,
      solutionId: solution.id,
      confidence: solution.confidence,
      text: solution.description,
      context: {
        problemId: problem.id,
        solutionType: solution.type,
        steps: solution.steps.length,
      },
    },
    timestamp: Date.now(),
  };
};

/**
 * Helper to create a vector document from a resolution pattern
 */
export const createPatternDocument = (
  patternId: string,
  problemSignature: string,
  solution: Solution,
  embedding: EmbeddingVector,
  successCount: number,
  confidence: number,
): VectorDocument => {
  return {
    id: `pattern_${patternId}`,
    embedding,
    metadata: {
      type: "pattern",
      problemSignature,
      solutionId: solution.id,
      successCount,
      confidence,
      text: `${problemSignature} -> ${solution.description}`,
      context: {
        solutionType: solution.type,
        averageResolutionTime: 0,
      },
    },
    timestamp: Date.now(),
  };
};

export interface ReferenceDocumentInput {
  id: string;
  text: string;
  version: string;
  url: string;
  sourceId: string;
  order: number;
  sha256: string;
  title?: string;
  sourceType?: string;
  sourceUrl?: string;
  artifact?: string;
  commit?: string;
  metadata?: Record<string, unknown>;
}

export const createReferenceDocument = (
  input: ReferenceDocumentInput,
  embedding: EmbeddingVector,
): VectorDocument => {
  const context: Record<string, unknown> = {
    version: input.version,
    url: input.url,
    sourceId: input.sourceId,
    order: input.order,
    sha256: input.sha256,
  };

  if (input.title) {
    context.title = input.title;
  }
  if (input.sourceType) {
    context.sourceType = input.sourceType;
  }
  if (input.sourceUrl) {
    context.sourceUrl = input.sourceUrl;
  }
  if (input.artifact) {
    context.artifact = input.artifact;
  }
  if (input.commit) {
    context.commit = input.commit;
  }
  if (input.metadata) {
    context.metadata = input.metadata;
  }

  return {
    id: `reference_${input.id}`,
    embedding,
    metadata: {
      type: "reference",
      text: input.text,
      context,
    },
    timestamp: Date.now(),
  };
};
