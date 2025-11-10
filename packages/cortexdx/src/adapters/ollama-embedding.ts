/**
 * Ollama Embedding Adapter
 * Provides embedding generation through Ollama with configured models
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

export interface OllamaEmbeddingConfig {
  baseUrl?: string;
  timeout?: number;
  defaultModel?: string;
  maxRetries?: number;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
  model: string;
}

export class OllamaEmbeddingAdapter implements EmbeddingAdapter {
  public readonly backend = "ollama" as const;
  private readonly config: Required<OllamaEmbeddingConfig>;
  private currentModel: string;

  constructor(config: OllamaEmbeddingConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || "http://localhost:11434",
      timeout: config.timeout || 30000,
      defaultModel: config.defaultModel || "qwen3-embedding:latest",
      maxRetries: config.maxRetries || 3,
    };
    this.currentModel = this.config.defaultModel;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingVector> {
    const model = request.model || this.currentModel;

    const response = await this.makeRequest<OllamaEmbeddingResponse>(
      "/api/embeddings",
      {
        model,
        prompt: request.text,
      },
    );

    let values = response.embedding;
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

    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < request.texts.length; i += batchSize) {
      const batch = request.texts.slice(i, i + batchSize);
      const batchPromises = batch.map((text) =>
        this.embed({ text, model, normalize: request.normalize }),
      );
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
    }

    return embeddings;
  }

  async getAvailableModels(): Promise<EmbeddingModelInfo[]> {
    try {
      const response = await this.makeRequest<{
        models: Array<{ name: string; size: number }>;
      }>("/api/tags", undefined, "GET");

      // Filter for embedding models based on naming convention
      const embeddingModels = response.models.filter(
        (m) =>
          m.name.includes("embed") ||
          m.name.includes("nomic") ||
          m.name.includes("granite-embedding"),
      );

      return embeddingModels.map((model) => ({
        name: model.name,
        dimensions: this.getModelDimensions(model.name),
        maxTokens: this.getModelMaxTokens(model.name),
        memoryGb: model.size / (1024 * 1024 * 1024),
        backend: "ollama" as const,
        loaded: true,
      }));
    } catch (error) {
      console.warn("Failed to fetch available models:", error);
      return [];
    }
  }

  async loadModel(modelName: string): Promise<void> {
    // Ollama loads models on-demand, so we just verify it exists
    try {
      await this.makeRequest("/api/show", { name: modelName });
      this.currentModel = modelName;
    } catch (error) {
      throw new Error(
        `Failed to load model ${modelName}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async unloadModel(_modelName: string): Promise<void> {
    // Ollama manages model lifecycle automatically
    // No explicit unload needed
  }

  async getCurrentModel(): Promise<EmbeddingModelInfo | null> {
    try {
      const response = await this.makeRequest<{
        modelfile: string;
        parameters: string;
      }>("/api/show", { name: this.currentModel });

      return {
        name: this.currentModel,
        dimensions: this.getModelDimensions(this.currentModel),
        maxTokens: this.getModelMaxTokens(this.currentModel),
        memoryGb: 2.0, // Default estimate
        backend: "ollama" as const,
        loaded: true,
      };
    } catch (error) {
      return null;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    body?: unknown,
    method = "POST",
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getModelDimensions(modelName: string): number {
    // Based on config/ollama-models.json
    if (modelName.includes("qwen3-embed")) return 768;
    if (modelName.includes("nomic-embed")) return 768;
    if (modelName.includes("granite-embedding")) return 384;
    return 768; // Default
  }

  private getModelMaxTokens(modelName: string): number {
    // Based on config/ollama-models.json
    if (modelName.includes("qwen3-embed")) return 8192;
    if (modelName.includes("nomic-embed")) return 8192;
    if (modelName.includes("granite-embedding")) return 512;
    return 8192; // Default
  }
}

export const createOllamaEmbeddingAdapter = (
  config?: OllamaEmbeddingConfig,
): OllamaEmbeddingAdapter => {
  return new OllamaEmbeddingAdapter(config);
};
