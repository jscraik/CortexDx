/**
 * Vector Storage for Embeddings
 * Provides persistent SQLite-backed storage and semantic search for resolution patterns
 * Requirements: 12.5, 10.2
 */

import type { EmbeddingVector } from "../adapters/embedding.js";
import type { Problem, Solution } from "@brainwav/cortexdx-core";

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
 * Vector storage interface - implemented by SQLiteVectorStorage
 */
export interface IVectorStorage {
  addDocument(document: VectorDocument): Promise<void>;
  addDocuments(documents: VectorDocument[]): Promise<void>;
  search(
    queryEmbedding: EmbeddingVector,
    options?: SearchOptions,
  ): Promise<SearchResult[]>;
  getDocument(id: string): Promise<VectorDocument | null>;
  deleteDocument(id: string): Promise<boolean>;
  getDocumentsByType(
    type: "problem" | "solution" | "pattern" | "reference",
  ): Promise<VectorDocument[]>;
  getStats(): VectorStorageStats;
  cleanupOldDocuments(maxAgeMs: number): Promise<number>;
  restoreFromDisk(): Promise<number>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

// Re-export SQLite implementation as the default
export { SQLiteVectorStorage } from "./vector-storage-sqlite.js";

/**
 * Create a SQLite-backed vector storage instance
 * @param dbPath Path to SQLite database file (default: .cortexdx/vector-storage.db)
 */
export const createVectorStorage = async (
  dbPath = ".cortexdx/vector-storage.db",
): Promise<IVectorStorage> => {
  const { SQLiteVectorStorage } = await import("./vector-storage-sqlite.js");
  return new SQLiteVectorStorage(dbPath);
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
