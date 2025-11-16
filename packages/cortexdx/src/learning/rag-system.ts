/**
 * RAG (Retrieval-Augmented Generation) System
 * Integrates embeddings and vector search with pattern recognition for learning
 * Requirements: 12.5, 10.2
 */

import { randomUUID } from "node:crypto";
import type { EmbeddingAdapter } from "../adapters/embedding.js";
import { createOllamaEmbeddingAdapter } from "../adapters/ollama-embedding.js";
import type {
  PatternStorage,
  ResolutionPattern,
} from "../storage/pattern-storage.js";
import {
  type SearchOptions,
  type VectorDocument,
  type VectorStorage,
  createPatternDocument,
  createProblemDocument,
  createSolutionDocument,
} from "../storage/vector-storage.js";
import type {
  Problem,
  ProblemType,
  Severity,
  Solution,
  SolutionType,
} from "../types.js";
import type { PatternMatcher } from "./pattern-recognition.js";

export interface RagConfig {
  embeddingBackend?: "ollama" | "auto";
  embeddingModel?: string;
  vectorStoragePath?: string;
  minSimilarity?: number;
  topK?: number;
  enableHybridSearch?: boolean;
  embeddingAdapter?: EmbeddingAdapter;
}

type RagResolvedConfig = {
  embeddingBackend: "ollama" | "auto";
  embeddingModel: string;
  vectorStoragePath?: string;
  minSimilarity: number;
  topK: number;
  enableHybridSearch: boolean;
};

export interface RagSearchResult {
  problem?: Problem;
  solution?: Solution;
  pattern?: ResolutionPattern;
  similarity: number;
  rank: number;
  source: "vector" | "pattern" | "hybrid";
}

export interface RagStats {
  totalProblems: number;
  totalSolutions: number;
  totalPatterns: number;
  embeddingModel: string;
  embeddingBackend: string;
  vectorStorageStats: {
    totalDocuments: number;
    documentsByType: Record<string, number>;
  };
}

/**
 * RAG System for semantic search and learning
 */
export class RagSystem {
  private readonly config: RagResolvedConfig;
  private embeddingAdapter: EmbeddingAdapter | null = null;
  private vectorStorage: VectorStorage;
  private patternStorage: PatternStorage;
  private patternMatcher: PatternMatcher;
  private initialized = false;

  constructor(
    vectorStorage: VectorStorage,
    patternStorage: PatternStorage,
    patternMatcher: PatternMatcher,
    config: RagConfig = {},
  ) {
    this.config = {
      embeddingBackend: config.embeddingBackend || "ollama",
      embeddingModel: config.embeddingModel || "qwen3-embed",
      vectorStoragePath: config.vectorStoragePath,
      minSimilarity: config.minSimilarity || 0.6,
      topK: config.topK || 5,
      enableHybridSearch: config.enableHybridSearch ?? true,
    };

    this.embeddingAdapter = config.embeddingAdapter ?? null;
    this.vectorStorage = vectorStorage;
    this.patternStorage = patternStorage;
    this.patternMatcher = patternMatcher;
  }

  /**
   * Initialize the RAG system with embedding adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize embedding adapter
    if (!this.embeddingAdapter) {
      this.embeddingAdapter = await this.createEmbeddingAdapter();
    }

    if (!this.embeddingAdapter) {
      throw new Error("Failed to initialize embedding adapter");
    }

    // Restore vector storage from disk if configured
    if (this.config.vectorStoragePath) {
      await this.vectorStorage.restoreFromDisk();
    }

    this.initialized = true;
  }

  /**
   * Index a problem for semantic search
   */
  async indexProblem(problem: Problem): Promise<void> {
    this.ensureInitialized();

    const embedding = await this.embeddingAdapter?.embed({
      text: this.extractProblemText(problem),
      normalize: true,
    });

    const defaultEmbedding = {
      values: [],
      dimensions: 0,
      model: "default",
      timestamp: Date.now(),
    };

    const document = createProblemDocument(
      problem,
      embedding ?? defaultEmbedding,
    );
    await this.vectorStorage.addDocument(document);
  }

  /**
   * Index a solution for semantic search
   */
  async indexSolution(solution: Solution, problem: Problem): Promise<void> {
    this.ensureInitialized();

    const embedding = await this.embeddingAdapter?.embed({
      text: this.extractSolutionText(solution),
      normalize: true,
    });

    const defaultEmbedding = {
      values: [],
      dimensions: 0,
      model: "default",
      timestamp: Date.now(),
    };

    const document = createSolutionDocument(
      solution,
      problem,
      embedding ?? defaultEmbedding,
    );
    await this.vectorStorage.addDocument(document);
  }

  /**
   * Index a resolution pattern for semantic search
   */
  async indexPattern(pattern: ResolutionPattern): Promise<void> {
    this.ensureInitialized();

    const patternText = `${pattern.problemSignature} -> ${pattern.solution.description}`;
    const embedding = await this.embeddingAdapter?.embed({
      text: patternText,
      normalize: true,
    });

    const defaultEmbedding = {
      values: [],
      dimensions: 0,
      model: "default",
      timestamp: Date.now(),
    };

    const document = createPatternDocument(
      pattern.id,
      pattern.problemSignature,
      pattern.solution,
      embedding ?? defaultEmbedding,
      pattern.successCount,
      pattern.confidence,
    );

    await this.vectorStorage.addDocument(document);
  }

  /**
   * Find similar problems using semantic search
   */
  async findSimilarProblems(
    problem: Problem,
    options?: SearchOptions,
  ): Promise<RagSearchResult[]> {
    this.ensureInitialized();

    const queryEmbedding = await this.embeddingAdapter?.embed({
      text: this.extractProblemText(problem),
      normalize: true,
    });

    // If embedding failed, return empty results
    if (!queryEmbedding) {
      return [];
    }

    const searchOptions: SearchOptions = {
      topK: options?.topK || this.config.topK,
      minSimilarity: options?.minSimilarity || this.config.minSimilarity,
      filterType: "problem",
      ...options,
    };

    const results = await this.vectorStorage.search(
      queryEmbedding,
      searchOptions,
    );

    return results.map((result) => ({
      similarity: result.similarity,
      rank: result.rank,
      source: "vector" as const,
      problem: this.reconstructProblemFromDocument(result.document),
    }));
  }

  /**
   * Find similar solutions using semantic search
   */
  async findSimilarSolutions(
    problem: Problem,
    options?: SearchOptions,
  ): Promise<RagSearchResult[]> {
    this.ensureInitialized();

    const queryEmbedding = await this.embeddingAdapter?.embed({
      text: this.extractProblemText(problem),
      normalize: true,
    });

    // If embedding failed, return empty results
    if (!queryEmbedding) {
      return [];
    }

    const searchOptions: SearchOptions = {
      topK: options?.topK || this.config.topK,
      minSimilarity: options?.minSimilarity || this.config.minSimilarity,
      filterType: "solution",
      ...options,
    };

    const results = await this.vectorStorage.search(
      queryEmbedding,
      searchOptions,
    );

    return results.map((result) => ({
      similarity: result.similarity,
      rank: result.rank,
      source: "vector" as const,
      solution: this.reconstructSolutionFromDocument(result.document),
    }));
  }

  /**
   * Find similar patterns using hybrid search (vector + pattern matching)
   */
  async findSimilarPatterns(
    problem: Problem,
    options?: SearchOptions,
  ): Promise<RagSearchResult[]> {
    this.ensureInitialized();

    if (!this.config.enableHybridSearch) {
      return this.findSimilarPatternsVectorOnly(problem, options);
    }

    // Hybrid search: combine vector search with pattern matching
    const vectorResults = await this.findSimilarPatternsVectorOnly(
      problem,
      options,
    );
    const patternResults = await this.findSimilarPatternsPatternOnly(problem);

    // Merge and re-rank results
    return this.mergeAndRerankResults(vectorResults, patternResults);
  }

  /**
   * Get suggested solutions for a problem using RAG
   */
  async getSuggestedSolutions(problem: Problem): Promise<Solution[]> {
    this.ensureInitialized();

    // Find similar patterns
    const similarPatterns = await this.findSimilarPatterns(problem, {
      topK: this.config.topK,
      minSimilarity: this.config.minSimilarity,
    });

    // Extract solutions from patterns
    const solutions: Solution[] = [];
    for (const result of similarPatterns) {
      if (result.pattern) {
        solutions.push(result.pattern.solution);
      } else if (result.solution) {
        solutions.push(result.solution);
      }
    }

    return solutions;
  }

  /**
   * Learn from a successful resolution
   */
  async learnFromSuccess(
    problem: Problem,
    solution: Solution,
    resolutionTime: number,
  ): Promise<void> {
    this.ensureInitialized();

    // Index the problem and solution
    await this.indexProblem(problem);
    await this.indexSolution(solution, problem);

    // Create or update pattern
    const problemSignature =
      this.patternMatcher.extractProblemSignature(problem);
    const patterns = await this.patternStorage.loadAllPatterns();

    let existingPattern = patterns.find(
      (p) =>
        this.patternMatcher.calculateSimilarity(
          p.problemSignature,
          problemSignature,
        ) > 0.9,
    );

    if (existingPattern) {
      await this.patternStorage.updatePatternSuccess(
        existingPattern.id,
        resolutionTime,
      );
      const loadedPattern = await this.patternStorage.loadPattern(
        existingPattern.id,
      );
      existingPattern = loadedPattern ?? undefined;
      if (existingPattern) {
        await this.indexPattern(existingPattern);
      }
    } else {
      const newPattern: ResolutionPattern = {
        id: `pattern_${randomUUID()}`,
        problemType: problem.type,
        problemSignature,
        solution,
        successCount: 1,
        failureCount: 0,
        averageResolutionTime: resolutionTime,
        lastUsed: Date.now(),
        userFeedback: [],
        confidence: 1.0,
      };

      await this.patternStorage.savePattern(newPattern);
      await this.indexPattern(newPattern);
    }
  }

  /**
   * Get RAG system statistics
   */
  async getStats(): Promise<RagStats> {
    this.ensureInitialized();

    const vectorStats = this.vectorStorage.getStats();
    const currentModel = await this.embeddingAdapter?.getCurrentModel();

    return {
      totalProblems: vectorStats.documentsByType.problem || 0,
      totalSolutions: vectorStats.documentsByType.solution || 0,
      totalPatterns: vectorStats.documentsByType.pattern || 0,
      embeddingModel: currentModel?.name || "unknown",
      embeddingBackend: this.embeddingAdapter?.backend ?? "unknown",
      vectorStorageStats: {
        totalDocuments: vectorStats.totalDocuments,
        documentsByType: vectorStats.documentsByType,
      },
    };
  }

  // Private helper methods

  private async createEmbeddingAdapter(): Promise<EmbeddingAdapter> {
    return createOllamaEmbeddingAdapter({
      defaultModel: this.config.embeddingModel,
    });
  }

  private extractProblemText(problem: Problem): string {
    const parts = [
      problem.type,
      problem.description,
      problem.userFriendlyDescription || "",
      ...problem.affectedComponents,
    ];

    return parts.filter(Boolean).join(" ");
  }

  private extractSolutionText(solution: Solution): string {
    const parts = [
      solution.type,
      solution.description,
      solution.userFriendlyDescription || "",
      ...solution.steps.map((s) => s.description),
    ];

    return parts.filter(Boolean).join(" ");
  }

  private async findSimilarPatternsVectorOnly(
    problem: Problem,
    options?: SearchOptions,
  ): Promise<RagSearchResult[]> {
    const queryEmbedding = await this.embeddingAdapter?.embed({
      text: this.extractProblemText(problem),
      normalize: true,
    });

    // If embedding failed, return empty results
    if (!queryEmbedding) {
      return [];
    }

    const searchOptions: SearchOptions = {
      topK: options?.topK || this.config.topK,
      minSimilarity: options?.minSimilarity || this.config.minSimilarity,
      filterType: "pattern",
      ...options,
    };

    const results = await this.vectorStorage.search(
      queryEmbedding,
      searchOptions,
    );

    return results.map((result) => ({
      similarity: result.similarity,
      rank: result.rank,
      source: "vector" as const,
      pattern: this.reconstructPatternFromDocument(result.document),
    }));
  }

  private async findSimilarPatternsPatternOnly(
    problem: Problem,
  ): Promise<RagSearchResult[]> {
    const patterns = await this.patternStorage.loadAllPatterns();
    const similarPatterns = this.patternMatcher.findSimilarProblems(
      problem,
      patterns,
    );

    return similarPatterns.map((pattern, index) => ({
      pattern,
      similarity: pattern.confidence,
      rank: index + 1,
      source: "pattern" as const,
    }));
  }

  private mergeAndRerankResults(
    vectorResults: RagSearchResult[],
    patternResults: RagSearchResult[],
  ): RagSearchResult[] {
    const merged = new Map<string, RagSearchResult>();

    // Add vector results
    for (const result of vectorResults) {
      if (result.pattern) {
        merged.set(result.pattern.id, {
          ...result,
          source: "hybrid" as const,
        });
      }
    }

    // Merge pattern results
    for (const result of patternResults) {
      if (result.pattern) {
        const existing = merged.get(result.pattern.id);
        if (existing) {
          // Combine scores
          existing.similarity = (existing.similarity + result.similarity) / 2;
        } else {
          merged.set(result.pattern.id, {
            ...result,
            source: "hybrid" as const,
          });
        }
      }
    }

    // Sort by combined similarity
    const results = Array.from(merged.values());
    results.sort((a, b) => b.similarity - a.similarity);

    // Update ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    return results.slice(0, this.config.topK);
  }

  private reconstructProblemFromDocument(
    doc: VectorDocument,
  ): Problem | undefined {
    if (doc.metadata.type !== "problem") {
      return undefined;
    }

    // Reconstruct problem from metadata
    return {
      id: doc.id.replace("problem_", ""),
      type: (doc.metadata.problemType as ProblemType) || "code",
      severity: (doc.metadata.context.severity as Severity) || "major",
      description: doc.metadata.text,
      userFriendlyDescription: doc.metadata.text,
      context: doc.metadata.context as never,
      evidence: [],
      affectedComponents:
        (doc.metadata.context.affectedComponents as string[]) || [],
      suggestedSolutions: [],
      userLevel:
        (doc.metadata.context.userLevel as
          | "beginner"
          | "intermediate"
          | "expert") || "intermediate",
    };
  }

  private reconstructSolutionFromDocument(
    doc: VectorDocument,
  ): Solution | undefined {
    if (doc.metadata.type !== "solution") {
      return undefined;
    }

    // Reconstruct solution from metadata
    return {
      id: doc.metadata.solutionId || doc.id.replace("solution_", ""),
      type: (doc.metadata.context.solutionType as SolutionType) || "automated",
      confidence: doc.metadata.confidence || 0.5,
      description: doc.metadata.text,
      userFriendlyDescription: doc.metadata.text,
      steps: [],
      codeChanges: [],
      configChanges: [],
      testingStrategy: {
        type: "manual",
        tests: [],
        coverage: 0,
        automated: false,
      },
      rollbackPlan: {
        steps: [],
        automated: false,
        backupRequired: false,
        riskLevel: "low",
      },
    };
  }

  private reconstructPatternFromDocument(
    doc: VectorDocument,
  ): ResolutionPattern | undefined {
    if (doc.metadata.type !== "pattern") {
      return undefined;
    }

    // Reconstruct pattern from metadata
    return {
      id: doc.id.replace("pattern_", ""),
      problemType: doc.metadata.problemType || "unknown",
      problemSignature: doc.metadata.problemSignature || "",
      solution: {
        id: doc.metadata.solutionId || "",
        type: "automated",
        confidence: doc.metadata.confidence || 0.5,
        description: doc.metadata.text,
        userFriendlyDescription: doc.metadata.text,
        steps: [],
        codeChanges: [],
        configChanges: [],
        testingStrategy: {
          type: "manual",
          tests: [],
          coverage: 0,
          automated: false,
        },
        rollbackPlan: {
          steps: [],
          automated: false,
          backupRequired: false,
          riskLevel: "low",
        },
      },
      successCount: doc.metadata.successCount || 0,
      failureCount: 0,
      averageResolutionTime:
        (doc.metadata.context.averageResolutionTime as number) || 0,
      lastUsed: doc.timestamp,
      userFeedback: [],
      confidence: doc.metadata.confidence || 0.5,
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("RAG system not initialized. Call initialize() first.");
    }
  }
}

/**
 * Create a RAG system instance
 */
export const createRagSystem = (
  vectorStorage: VectorStorage,
  patternStorage: PatternStorage,
  patternMatcher: PatternMatcher,
  config?: RagConfig,
): RagSystem => {
  return new RagSystem(vectorStorage, patternStorage, patternMatcher, config);
};
