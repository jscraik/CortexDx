/**
 * MLX Embedding Adapter
 * Provides embedding generation through MLX with Apple Silicon optimization
 * Requirements: 12.5, 10.2
 */

import type {
  EmbeddingAdapter,
  EmbeddingBatchRequest,
  EmbeddingModelInfo,
  EmbeddingRequest,
  EmbeddingVector,
} from "./embedding.js";
import { normalizeVector } from "./embedding.js";

export interface MlxEmbeddingConfig {
  modelsPath?: string;
  defaultModel?: string;
  batchSize?: number;
}

export class MlxEmbeddingAdapter implements EmbeddingAdapter {
  public readonly backend = "mlx" as const;
  private readonly config: Required<MlxEmbeddingConfig>;
  private currentModel: string;

  constructor(config: MlxEmbeddingConfig = {}) {
    this.config = {
      modelsPath: config.modelsPath || "~/.mlx/models",
      defaultModel: config.defaultModel || "qwen3-4b",
      batchSize: config.batchSize || 8,
    };
    this.currentModel = this.config.defaultModel;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingVector> {
    const model = request.model || this.currentModel;

    // In a real implementation, this would call MLX Python bindings
    // For now, we'll simulate the interface
    const embedding = await this.generateEmbedding(request.text, model);

    let values = embedding;
    if (request.normalize) {
      values = normalizeVector(values);
    }

    return {
      values,
      dimensions: values.length,
      model,
      timestamp: Date.now(),
    };
  }

  async embedBatch(request: EmbeddingBatchRequest): Promise<EmbeddingVector[]> {
    const model = request.model || this.currentModel;
    const embeddings: EmbeddingVector[] = [];

    // Process in batches optimized for MLX
    for (let i = 0; i < request.texts.length; i += this.config.batchSize) {
      const batch = request.texts.slice(i, i + this.config.batchSize);
      const batchEmbeddings = await this.generateBatchEmbeddings(batch, model);

      for (const embedding of batchEmbeddings) {
        let values = embedding;
        if (request.normalize) {
          values = normalizeVector(values);
        }

        embeddings.push({
          values,
          dimensions: values.length,
          model,
          timestamp: Date.now(),
        });
      }
    }

    return embeddings;
  }

  async getAvailableModels(): Promise<EmbeddingModelInfo[]> {
    // Based on config/mlx-models.json
    return [
      {
        name: "qwen3-0.6b",
        dimensions: 768,
        maxTokens: 8192,
        memoryGb: 1.0,
        backend: "mlx" as const,
        loaded: this.currentModel === "qwen3-0.6b",
      },
      {
        name: "qwen3-4b",
        dimensions: 768,
        maxTokens: 8192,
        memoryGb: 4.0,
        backend: "mlx" as const,
        loaded: this.currentModel === "qwen3-4b",
      },
      {
        name: "qwen3-8b",
        dimensions: 768,
        maxTokens: 8192,
        memoryGb: 8.0,
        backend: "mlx" as const,
        loaded: this.currentModel === "qwen3-8b",
      },
    ];
  }

  async loadModel(modelName: string): Promise<void> {
    const availableModels = await this.getAvailableModels();
    const model = availableModels.find((m) => m.name === modelName);

    if (!model) {
      throw new Error(`Model ${modelName} not found in available MLX models`);
    }

    this.currentModel = modelName;
  }

  async unloadModel(_modelName: string): Promise<void> {
    // MLX manages model lifecycle automatically
    // No explicit unload needed
  }

  async getCurrentModel(): Promise<EmbeddingModelInfo | null> {
    const availableModels = await this.getAvailableModels();
    return availableModels.find((m) => m.name === this.currentModel) || null;
  }

  /**
   * Generate embedding using MLX
   * In production, this would use Python bindings to MLX
   */
  private async generateEmbedding(
    text: string,
    model: string,
  ): Promise<number[]> {
    // Placeholder implementation
    // In production, this would call MLX Python bindings via child_process or FFI
    const dimensions = this.getModelDimensions(model);

    // Generate deterministic embedding based on text hash for testing
    const hash = this.simpleHash(text);
    const embedding = new Array(dimensions).fill(0).map((_, i) => {
      return Math.sin(hash + i) * 0.5 + 0.5;
    });

    return embedding;
  }

  /**
   * Generate batch embeddings using MLX
   */
  private async generateBatchEmbeddings(
    texts: string[],
    model: string,
  ): Promise<number[][]> {
    // In production, this would use MLX batch processing
    return Promise.all(
      texts.map((text) => this.generateEmbedding(text, model)),
    );
  }

  private getModelDimensions(modelName: string): number {
    // All Qwen3 embedding models use 768 dimensions
    return 768;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export const createMlxEmbeddingAdapter = (
  config?: MlxEmbeddingConfig,
): MlxEmbeddingAdapter => {
  return new MlxEmbeddingAdapter(config);
};
