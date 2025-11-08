/**
 * Embedding Adapter Interface
 * Provides unified interface for embedding models across different backends
 * Requirements: 12.5, 10.2
 */

export interface EmbeddingVector {
  values: number[];
  dimensions: number;
  model: string;
  timestamp: number;
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
  normalize?: boolean;
}

export interface EmbeddingBatchRequest {
  texts: string[];
  model?: string;
  normalize?: boolean;
}

export interface EmbeddingModelInfo {
  name: string;
  dimensions: number;
  maxTokens: number;
  memoryGb: number;
  backend: "ollama" | "mlx";
  loaded: boolean;
}

export interface EmbeddingAdapter {
  backend: "ollama" | "mlx";

  /**
   * Generate embedding for a single text
   */
  embed: (request: EmbeddingRequest) => Promise<EmbeddingVector>;

  /**
   * Generate embeddings for multiple texts in batch
   */
  embedBatch: (request: EmbeddingBatchRequest) => Promise<EmbeddingVector[]>;

  /**
   * Get available embedding models
   */
  getAvailableModels: () => Promise<EmbeddingModelInfo[]>;

  /**
   * Load a specific embedding model
   */
  loadModel: (modelName: string) => Promise<void>;

  /**
   * Unload a specific embedding model
   */
  unloadModel: (modelName: string) => Promise<void>;

  /**
   * Get currently loaded model info
   */
  getCurrentModel: () => Promise<EmbeddingModelInfo | null>;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal !== undefined && bVal !== undefined) {
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map((val) => val / norm);
}
