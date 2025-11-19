/**
 * Model Manager Plugin
 * Implements dynamic model loading/unloading with automatic selection and warm-up strategies
 * Requirements: 12.4, 5.3
 */

import { createOllamaAdapter } from "../../adapters/ollama.js";
import { hasOllama } from "@brainwav/cortexdx-ml/ml/detect.js";
import type {
  DiagnosticContext,
  DiagnosticPlugin,
  EnhancedLlmAdapter,
  Finding,
  ModelInfo,
} from "@brainwav/cortexdx-core";

export interface ModelManagerConfig {
  autoLoadModels?: boolean;
  warmUpOnStart?: boolean;
  memoryThresholdMb?: number;
  maxLoadedModels?: number;
  preferredBackend?: "ollama" | "auto";
  modelPreferences?: ModelPreferences;
}

export interface ModelPreferences {
  development?: string;
  debugging?: string;
  codeAnalysis?: string;
  documentation?: string;
  conversation?: string;
}

export interface LoadedModel {
  id: string;
  backend: "ollama";
  info: ModelInfo;
  loadedAt: number;
  lastUsed: number;
  usageCount: number;
  memoryUsageMb: number;
  warmUpTimeMs: number;
}

export interface ModelSelectionCriteria {
  taskType:
    | "development"
    | "debugging"
    | "code-analysis"
    | "documentation"
    | "conversation";
  availableMemoryMb: number;
  responseTimeRequirement: number;
  preferredCapabilities: string[];
}

export class ModelManager implements DiagnosticPlugin {
  public readonly id = "model-manager";
  public readonly title = "Model Manager";
  public readonly order = 1;

  private readonly config: Required<ModelManagerConfig>;
  private readonly adapters = new Map<string, EnhancedLlmAdapter>();
  private readonly loadedModels = new Map<string, LoadedModel>();
  private readonly modelCache = new Map<string, ModelInfo>();
  private warmUpPromises = new Map<string, Promise<void>>();

  constructor(config: ModelManagerConfig = {}) {
    this.config = {
      autoLoadModels: config.autoLoadModels ?? true,
      warmUpOnStart: config.warmUpOnStart ?? true,
      memoryThresholdMb: config.memoryThresholdMb || 8192,
      maxLoadedModels: config.maxLoadedModels || 3,
      preferredBackend: config.preferredBackend || "auto",
      modelPreferences: config.modelPreferences || {
        development: "codellama:7b",
        debugging: "llama3.2:3b",
        codeAnalysis: "codellama:7b",
        documentation: "llama3.2:3b",
        conversation: "llama3.2:3b",
      },
    };

    this.initializeAdapters();
  }

  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check available backends
      const backends = await this.getAvailableBackends();
      if (backends.length === 0) {
      findings.push({
        id: "model-manager-no-backends",
        area: "Model Management",
        severity: "blocker",
        title: "No LLM Backends Available",
        description: "No local LLM backend (Ollama) is available",
        evidence: [{ type: "log", ref: "model-manager-backends-check" }],
        confidence: 1.0,
        recommendation: "Install and start Ollama to enable local LLM features",
      });
        return findings;
      }

      // Report available models
      const availableModels = await this.getAvailableModels();
      findings.push({
        id: "model-manager-available",
        area: "Model Management",
        severity: "info",
        title: `${availableModels.length} Models Available`,
        description: `Found ${availableModels.length} models across ${backends.length} backend(s)`,
        evidence: [
          {
            type: "log",
            ref: `model-manager-models-${availableModels.length}`,
          },
        ],
        confidence: 1.0,
        tags: ["model-management", "llm"],
      });

      // Report loaded models
      const loaded = Array.from(this.loadedModels.values());
      if (loaded.length > 0) {
        findings.push({
          id: "model-manager-loaded",
          area: "Model Management",
          severity: "info",
          title: `${loaded.length} Models Loaded`,
          description: `Currently loaded: ${loaded.map((m) => m.id).join(", ")}`,
          evidence: [
            { type: "log", ref: `model-manager-loaded-${loaded.length}` },
          ],
          confidence: 1.0,
          tags: ["model-management", "performance"],
        });
      }

      // Check memory usage
      const totalMemory = loaded.reduce((sum, m) => sum + m.memoryUsageMb, 0);
      if (totalMemory > this.config.memoryThresholdMb) {
        findings.push({
          id: "model-manager-memory-high",
          area: "Model Management",
          severity: "major",
          title: "High Memory Usage",
          description: `Loaded models using ${totalMemory}MB (threshold: ${this.config.memoryThresholdMb}MB)`,
          evidence: [
            { type: "log", ref: `model-manager-memory-${totalMemory}` },
          ],
          confidence: 1.0,
          recommendation: "Consider unloading unused models to free memory",
        });
      }

      ctx.evidence({ type: "log", ref: "model-manager-diagnostic-complete" });
    } catch (error) {
      findings.push({
        id: "model-manager-error",
        area: "Model Management",
        severity: "major",
        title: "Model Manager Error",
        description: `Failed to run model manager: ${error instanceof Error ? error.message : "Unknown error"}`,
        evidence: [{ type: "log", ref: "model-manager-error" }],
        confidence: 1.0,
      });
    }

    return findings;
  }

  // Model loading and unloading
  async loadModel(
    modelId: string,
    backend?: "ollama",
  ): Promise<LoadedModel> {
    // Check if already loaded
    const existingModel = this.loadedModels.get(modelId);
    if (existingModel) {
      existingModel.lastUsed = Date.now();
      existingModel.usageCount++;
      return existingModel;
    }

    // Check memory constraints
    await this.ensureMemoryAvailable();

    // Select backend
    const selectedBackend =
      backend || (await this.selectBackendForModel(modelId));
    const adapter = this.adapters.get(selectedBackend);
    if (!adapter) {
      throw new Error(`Backend ${selectedBackend} not available`);
    }

    // Load the model
    const startTime = Date.now();
    await adapter.loadModel(modelId);
    const warmUpTime = Date.now() - startTime;

    // Get model info
    const info = await adapter.getModelInfo(modelId);

    // Estimate memory usage
    const memoryUsage = this.estimateMemoryUsage(info);

    const loadedModel: LoadedModel = {
      id: modelId,
      backend: selectedBackend,
      info,
      loadedAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
      memoryUsageMb: memoryUsage,
      warmUpTimeMs: warmUpTime,
    };

    this.loadedModels.set(modelId, loadedModel);
    return loadedModel;
  }

  async unloadModel(modelId: string): Promise<void> {
    const model = this.loadedModels.get(modelId);
    if (!model) {
      return;
    }

    const adapter = this.adapters.get(model.backend);
    if (adapter) {
      await adapter.unloadModel(modelId);
    }

    this.loadedModels.delete(modelId);
  }

  // Automatic model selection
  async selectModel(criteria: ModelSelectionCriteria): Promise<string> {
    // Check preferences first
    const taskKey =
      criteria.taskType === "code-analysis"
        ? "codeAnalysis"
        : criteria.taskType;
    const preferred =
      this.config.modelPreferences[taskKey as keyof ModelPreferences];
    if (preferred && (await this.isModelAvailable(preferred))) {
      return preferred;
    }

    // Get available models
    const available = await this.getAvailableModels();

    // Filter by capabilities
    const suitable = available.filter((modelId) => {
      const info = this.modelCache.get(modelId);
      if (!info) return false;

      // Check capabilities
      const hasRequiredCapabilities = criteria.preferredCapabilities.every(
        (cap) => info.capabilities.includes(cap),
      );
      if (!hasRequiredCapabilities) return false;

      // Check memory constraints
      const estimatedMemory = this.estimateMemoryUsage(info);
      if (estimatedMemory > criteria.availableMemoryMb) return false;

      return true;
    });

    if (suitable.length === 0) {
      throw new Error("No suitable models found for criteria");
    }

    // Select best model based on response time and capabilities
    const selected = suitable[0];
    if (!selected) {
      throw new Error("No suitable models found");
    }
    return selected;
  }

  // Warm-up strategies
  async warmUpModel(modelId: string): Promise<void> {
    // Check if already warming up
    const existingPromise = this.warmUpPromises.get(modelId);
    if (existingPromise) {
      return existingPromise;
    }

    const warmUpPromise = this.performWarmUp(modelId);
    this.warmUpPromises.set(modelId, warmUpPromise);

    try {
      await warmUpPromise;
    } finally {
      this.warmUpPromises.delete(modelId);
    }
  }

  async warmUpModels(modelIds: string[]): Promise<void> {
    await Promise.all(modelIds.map((id) => this.warmUpModel(id)));
  }

  // Model information and status
  getLoadedModels(): LoadedModel[] {
    return Array.from(this.loadedModels.values());
  }

  getModelStatus(modelId: string): LoadedModel | null {
    return this.loadedModels.get(modelId) || null;
  }

  async getAvailableModels(): Promise<string[]> {
    const models = new Set<string>();

    for (const adapter of this.adapters.values()) {
      try {
        const supported = await adapter.getSupportedModels();
        for (const model of supported) {
          models.add(model);
          // Cache model info
          if (!this.modelCache.has(model)) {
            const info = await adapter.getModelInfo(model);
            this.modelCache.set(model, info);
          }
        }
      } catch (error) {
        console.warn(`Failed to get models from ${adapter.backend}:`, error);
      }
    }

    return Array.from(models);
  }

  getMemoryUsage(): number {
    return Array.from(this.loadedModels.values()).reduce(
      (sum, m) => sum + m.memoryUsageMb,
      0,
    );
  }

  // Private helper methods
  private initializeAdapters(): void {
    try {
      if (hasOllama()) {
        const ollamaAdapter = createOllamaAdapter();
        this.adapters.set("ollama", ollamaAdapter);
      }
    } catch (error) {
      console.warn("Failed to initialize Ollama adapter:", error);
    }

  }

  private async getAvailableBackends(): Promise<string[]> {
    return Array.from(this.adapters.keys());
  }

  private async selectBackendForModel(
    modelId: string,
  ): Promise<"ollama"> {
    if (!this.adapters.has("ollama")) {
      throw new Error("Ollama backend is not available");
    }
    return "ollama";
  }

  private async isModelAvailable(modelId: string): Promise<boolean> {
    const available = await this.getAvailableModels();
    return available.includes(modelId);
  }

  private estimateMemoryUsage(info: ModelInfo): number {
    // Rough estimation based on model name
    const name = info.name.toLowerCase();

    if (name.includes("70b")) return 40000;
    if (name.includes("34b")) return 20000;
    if (name.includes("13b")) return 8000;
    if (name.includes("7b")) return 4000;
    if (name.includes("3b")) return 2000;
    if (name.includes("1b")) return 1000;

    return 4000; // Default estimate
  }

  private async ensureMemoryAvailable(): Promise<void> {
    const currentUsage = this.getMemoryUsage();

    // If we're over threshold, unload least recently used models
    while (
      currentUsage > this.config.memoryThresholdMb &&
      this.loadedModels.size > 0
    ) {
      const lru = this.findLeastRecentlyUsed();
      if (lru) {
        await this.unloadModel(lru.id);
      } else {
        break;
      }
    }

    // If we're at max loaded models, unload one
    if (this.loadedModels.size >= this.config.maxLoadedModels) {
      const lru = this.findLeastRecentlyUsed();
      if (lru) {
        await this.unloadModel(lru.id);
      }
    }
  }

  private findLeastRecentlyUsed(): LoadedModel | null {
    let lru: LoadedModel | null = null;
    let oldestTime: number = Number.POSITIVE_INFINITY;

    for (const model of this.loadedModels.values()) {
      if (model.lastUsed < oldestTime) {
        oldestTime = model.lastUsed;
        lru = model;
      }
    }

    return lru;
  }

  private async performWarmUp(modelId: string): Promise<void> {
    // Load the model if not already loaded
    const model = await this.loadModel(modelId);

    // Perform a small inference to warm up the model
    const adapter = this.adapters.get(model.backend);
    if (adapter) {
      try {
        await adapter.complete("Hello", 1);
      } catch (error) {
        console.warn(`Warm-up failed for ${modelId}:`, error);
      }
    }
  }
}

// Factory function
export const createModelManager = (
  config?: ModelManagerConfig,
): ModelManager => {
  return new ModelManager(config);
};
