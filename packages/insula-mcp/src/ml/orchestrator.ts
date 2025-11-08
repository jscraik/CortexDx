/**
 * LLM Orchestrator Service
 * Manages conversation context, session handling, and prompt engineering with <2s response time requirement
 */

import { createMlxAdapter } from "../adapters/mlx.js";
import { createOllamaAdapter } from "../adapters/ollama.js";
import {
  type ModelManager,
  createModelManager,
} from "../plugins/development/model-manager.js";
import {
  type ModelPerformanceMetrics,
  type ModelPerformanceMonitor,
  createModelPerformanceMonitor,
} from "../plugins/development/model-performance-monitor.js";
import type {
  CodeAnalysis,
  Constraints,
  ConversationContext,
  ConversationId,
  DiagnosticContext,
  EnhancedLlmAdapter,
  EvidencePointer,
  Explanation,
  Problem,
  Solution,
} from "../types.js";
import { hasMlx, hasOllama } from "./detect.js";

export interface OrchestratorConfig {
  preferredBackend?: "ollama" | "mlx" | "auto";
  maxConcurrentSessions?: number;
  sessionTimeoutMs?: number;
  responseTimeoutMs?: number;
  enableCaching?: boolean;
  cacheSize?: number;
}

export interface SessionMetrics {
  sessionId: ConversationId;
  startTime: number;
  lastActivity: number;
  messageCount: number;
  averageResponseTime: number;
  totalTokens: number;
  backend: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  category: "diagnostic" | "development" | "explanation" | "solution";
}

export interface CacheEntry {
  key: string;
  response: string;
  timestamp: number;
  backend: string;
  expiresAt: number;
}

export class LlmOrchestrator {
  private readonly config: Required<OrchestratorConfig>;
  private readonly adapters = new Map<string, EnhancedLlmAdapter>();
  private readonly sessions = new Map<ConversationId, SessionMetrics>();
  private readonly responseCache = new Map<string, CacheEntry>();
  private readonly promptTemplates = new Map<string, PromptTemplate>();
  private readonly modelManager: ModelManager;
  private readonly performanceMonitor: ModelPerformanceMonitor;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      preferredBackend: config.preferredBackend || "auto",
      maxConcurrentSessions: config.maxConcurrentSessions || 10,
      sessionTimeoutMs: config.sessionTimeoutMs || 30 * 60 * 1000, // 30 minutes
      responseTimeoutMs: config.responseTimeoutMs || 2000, // 2 seconds target
      enableCaching: config.enableCaching ?? true,
      cacheSize: config.cacheSize || 100,
    };

    this.modelManager = createModelManager({
      autoLoadModels: true,
      warmUpOnStart: true,
      preferredBackend: this.config.preferredBackend,
    });
    this.performanceMonitor = createModelPerformanceMonitor();

    this.initializeAdapters();
    this.loadPromptTemplates();
    this.startCleanupTimer();
  }

  // Main orchestration methods
  async startDiagnosticSession(
    context: DiagnosticContext,
    sessionType: "development" | "debugging" | "learning" = "debugging",
  ): Promise<ConversationId> {
    const adapter = await this.selectBestAdapter();

    const conversationContext: ConversationContext = {
      userId: (context.headers?.["user-id"] as string) || undefined,
      sessionType,
      mcpContext: {
        serverEndpoint: context.endpoint,
        protocolVersion: "2024-11-05",
        capabilities: [],
        configuration: {},
      },
    };

    const sessionId = await adapter.startConversation(conversationContext);

    // Track session metrics
    this.sessions.set(sessionId, {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      averageResponseTime: 0,
      totalTokens: 0,
      backend: adapter.backend,
    });

    // Create evidence for session start
    context.evidence({
      type: "log",
      ref: `llm-session-start-${sessionId}-${adapter.backend}`,
    });

    return sessionId;
  }

  async analyzeAndExplain(
    sessionId: ConversationId,
    problem: Problem,
    context: DiagnosticContext,
  ): Promise<{ explanation: Explanation; suggestedActions: string[] }> {
    const adapter = this.getAdapterForSession(sessionId);
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(
        "explain",
        problem.id,
        problem.description,
      );
      if (this.config.enableCaching) {
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          return JSON.parse(cached.response);
        }
      }

      // Use prompt template for explanation
      const prompt = this.buildPromptFromTemplate("error-explanation", {
        error: problem.description,
        severity: problem.severity,
        context: JSON.stringify(problem.context, null, 2),
        userLevel: problem.userLevel,
      });

      const explanation = await adapter.explainError(
        new Error(problem.description),
        {
          type: "debugging",
          environment: problem.context.environment || "unknown",
          tools: [],
          history: [],
          metadata: problem.context as unknown as Record<string, unknown>,
        },
      );

      // Generate suggested actions based on explanation
      const suggestedActions = this.generateSuggestedActions(
        explanation,
        problem,
      );

      const result = { explanation, suggestedActions };

      // Cache the response
      if (this.config.enableCaching) {
        this.cacheResponse(cacheKey, JSON.stringify(result), adapter.backend);
      }

      // Update session metrics
      this.updateSessionMetrics(sessionId, Date.now() - startTime);

      // Create evidence
      context.evidence({
        type: "log",
        ref: `llm-explanation-${sessionId}-${Date.now()}`,
      });

      return result;
    } catch (error) {
      throw new Error(
        `Failed to analyze and explain: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async generateSolution(
    sessionId: ConversationId,
    problem: Problem,
    constraints: Constraints,
    context: DiagnosticContext,
  ): Promise<Solution> {
    const adapter = this.getAdapterForSession(sessionId);
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = this.generateCacheKey(
        "solution",
        problem.id,
        JSON.stringify(constraints),
      );
      if (this.config.enableCaching) {
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          return JSON.parse(cached.response);
        }
      }

      // Ensure response time constraint
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Solution generation timeout")),
          this.config.responseTimeoutMs,
        );
      });

      const solutionPromise = adapter.generateSolution(problem, constraints);
      const solution = await Promise.race([solutionPromise, timeoutPromise]);

      // Enhance solution with orchestrator-specific features
      const enhancedSolution = this.enhanceSolution(
        solution,
        problem,
        constraints,
      );

      // Cache the solution
      if (this.config.enableCaching) {
        this.cacheResponse(
          cacheKey,
          JSON.stringify(enhancedSolution),
          adapter.backend,
        );
      }

      // Update metrics
      this.updateSessionMetrics(sessionId, Date.now() - startTime);

      // Create evidence
      context.evidence({
        type: "log",
        ref: `llm-solution-${sessionId}-${solution.id}`,
      });

      return enhancedSolution;
    } catch (error) {
      throw new Error(
        `Failed to generate solution: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async continueConversation(
    sessionId: ConversationId,
    userMessage: string,
    context: DiagnosticContext,
  ): Promise<string> {
    const adapter = this.getAdapterForSession(sessionId);
    const metrics = this.sessions.get(sessionId);
    const startTime = Date.now();

    try {
      // Ensure response time target
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Conversation timeout")),
          this.config.responseTimeoutMs,
        );
      });

      const responsePromise = adapter.continueConversation(
        sessionId,
        userMessage,
      );
      const response = await Promise.race([responsePromise, timeoutPromise]);

      const inferenceTime = Date.now() - startTime;

      // Record performance metrics
      if (metrics) {
        const perfMetric: ModelPerformanceMetrics = {
          modelId: metrics.backend,
          backend: metrics.backend as "ollama" | "mlx",
          taskType: "conversation",
          inferenceTimeMs: inferenceTime,
          tokensGenerated: response.length / 4, // Rough estimate
          tokensPerSecond: response.length / 4 / (inferenceTime / 1000),
          memoryUsageMb: 0, // Would need system monitoring
          timestamp: Date.now(),
        };
        this.performanceMonitor.recordMetric(perfMetric);

        // Check if model should be switched
        const switchRecommendation = this.performanceMonitor.shouldSwitchModel(
          metrics.backend,
        );
        if (switchRecommendation.shouldSwitch) {
          context.logger(
            `Performance degradation detected for ${metrics.backend}: ${switchRecommendation.reason}`,
          );
        }
      }

      // Update session metrics
      this.updateSessionMetrics(sessionId, inferenceTime);

      // Create evidence
      context.evidence({
        type: "log",
        ref: `llm-conversation-${sessionId}-${Date.now()}`,
      });

      return response;
    } catch (error) {
      throw new Error(
        `Failed to continue conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async analyzeCode(
    code: string,
    language: string,
    context: DiagnosticContext,
  ): Promise<CodeAnalysis> {
    const adapter = await this.selectBestAdapter();
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = this.generateCacheKey(
        "code-analysis",
        code.substring(0, 100),
        language,
      );
      if (this.config.enableCaching) {
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          return JSON.parse(cached.response);
        }
      }

      const analysis = await adapter.analyzeCode(code, `Language: ${language}`);

      // Cache the analysis
      if (this.config.enableCaching) {
        this.cacheResponse(cacheKey, JSON.stringify(analysis), adapter.backend);
      }

      // Create evidence
      context.evidence({
        type: "log",
        ref: `llm-code-analysis-${Date.now()}-${language}`,
      });

      return analysis;
    } catch (error) {
      throw new Error(
        `Failed to analyze code: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async endSession(sessionId: ConversationId): Promise<SessionMetrics | null> {
    const metrics = this.sessions.get(sessionId);
    if (!metrics) {
      return null;
    }

    // End conversation with adapter
    const adapter = this.getAdapterForSession(sessionId);
    await adapter.endConversation(sessionId);

    // Remove from active sessions
    this.sessions.delete(sessionId);

    return metrics;
  }

  // Session and metrics management
  getSessionMetrics(sessionId: ConversationId): SessionMetrics | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessionMetrics(): SessionMetrics[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  // Private helper methods
  private async initializeAdapters(): Promise<void> {
    try {
      if (hasOllama()) {
        const ollamaAdapter = createOllamaAdapter();
        this.adapters.set("ollama", ollamaAdapter);
      }
    } catch (error) {
      console.warn("Failed to initialize Ollama adapter:", error);
    }

    try {
      if (hasMlx()) {
        const mlxAdapter = createMlxAdapter();
        this.adapters.set("mlx", mlxAdapter);
      }
    } catch (error) {
      console.warn("Failed to initialize MLX adapter:", error);
    }

    if (this.adapters.size === 0) {
      throw new Error("No LLM adapters available");
    }
  }

  private async selectBestAdapter(): Promise<EnhancedLlmAdapter> {
    if (this.config.preferredBackend !== "auto") {
      const adapter = this.adapters.get(this.config.preferredBackend);
      if (adapter) {
        return adapter;
      }
    }

    // Auto-select based on availability and performance
    if (this.adapters.has("mlx")) {
      const mlxAdapter = this.adapters.get("mlx");
      if (mlxAdapter) return mlxAdapter; // Prefer MLX on Apple Silicon for speed
    }

    if (this.adapters.has("ollama")) {
      const ollamaAdapter = this.adapters.get("ollama");
      if (ollamaAdapter) return ollamaAdapter;
    }

    throw new Error("No suitable LLM adapter available");
  }

  private getAdapterForSession(sessionId: ConversationId): EnhancedLlmAdapter {
    const metrics = this.sessions.get(sessionId);
    if (!metrics) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const adapter = this.adapters.get(metrics.backend);
    if (!adapter) {
      throw new Error(`Adapter ${metrics.backend} not available`);
    }

    return adapter;
  }

  private loadPromptTemplates(): void {
    const templates: PromptTemplate[] = [
      {
        id: "error-explanation",
        name: "Error Explanation",
        template: `Explain this MCP error clearly for a {{userLevel}} user:

Error: {{error}}
Severity: {{severity}}
Context: {{context}}

Provide a clear explanation with next steps.`,
        variables: ["userLevel", "error", "severity", "context"],
        category: "explanation",
      },
      {
        id: "solution-generation",
        name: "Solution Generation",
        template: `Generate a solution for this MCP problem:

Problem: {{problem}}
User Level: {{userLevel}}
Constraints: {{constraints}}

Provide a step-by-step solution with code examples if needed.`,
        variables: ["problem", "userLevel", "constraints"],
        category: "solution",
      },
      {
        id: "code-review",
        name: "Code Review",
        template: `Review this {{language}} code for MCP compliance:

Code:
{{code}}

Check for protocol compliance, security issues, and best practices.`,
        variables: ["language", "code"],
        category: "diagnostic",
      },
    ];

    for (const template of templates) {
      this.promptTemplates.set(template.id, template);
    }
  }

  private buildPromptFromTemplate(
    templateId: string,
    variables: Record<string, string>,
  ): string {
    const template = this.promptTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let prompt = template.template;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    return prompt;
  }

  private generateSuggestedActions(
    explanation: Explanation,
    problem: Problem,
  ): string[] {
    const actions: string[] = [];

    // Add actions based on problem type
    switch (problem.type) {
      case "protocol":
        actions.push("Verify MCP protocol compliance");
        actions.push("Check message format and structure");
        break;
      case "configuration":
        actions.push("Review server configuration");
        actions.push("Validate connection parameters");
        break;
      case "security":
        actions.push("Audit authentication settings");
        actions.push("Review permission configurations");
        break;
      case "performance":
        actions.push("Monitor response times");
        actions.push("Check resource usage");
        break;
    }

    // Add actions from explanation
    actions.push(...explanation.nextSteps);

    return [...new Set(actions)]; // Remove duplicates
  }

  private enhanceSolution(
    solution: Solution,
    problem: Problem,
    constraints: Constraints,
  ): Solution {
    // Add orchestrator-specific enhancements
    return {
      ...solution,
      id: `orchestrated-${solution.id}`,
      testingStrategy: {
        ...solution.testingStrategy,
        automated: true, // Enable automated testing through orchestrator
      },
      automatedFix: {
        canApplyAutomatically: solution.type === "automated",
        requiresUserConfirmation:
          problem.severity === "major" || problem.severity === "blocker",
        riskLevel: this.assessRiskLevel(solution, constraints),
        backupRequired: true,
        validationTests: [],
      },
    };
  }

  private assessRiskLevel(
    solution: Solution,
    constraints: Constraints,
  ): "low" | "medium" | "high" {
    if (solution.codeChanges.length > 5 || solution.configChanges.length > 3) {
      return "high";
    }
    if (
      constraints.security.allowFileSystem ||
      constraints.security.allowNetworking
    ) {
      return "medium";
    }
    return "low";
  }

  private updateSessionMetrics(
    sessionId: ConversationId,
    responseTime: number,
  ): void {
    const metrics = this.sessions.get(sessionId);
    if (metrics) {
      metrics.lastActivity = Date.now();
      metrics.messageCount++;
      metrics.averageResponseTime =
        (metrics.averageResponseTime * (metrics.messageCount - 1) +
          responseTime) /
        metrics.messageCount;
    }
  }

  private generateCacheKey(operation: string, ...params: string[]): string {
    return `${operation}:${params.join(":")}`;
  }

  private getCachedResponse(key: string): CacheEntry | null {
    const entry = this.responseCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry;
    }
    if (entry) {
      this.responseCache.delete(key); // Remove expired entry
    }
    return null;
  }

  private cacheResponse(key: string, response: string, backend: string): void {
    if (this.responseCache.size >= this.config.cacheSize) {
      // Remove oldest entry
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) {
        this.responseCache.delete(oldestKey);
      }
    }

    this.responseCache.set(key, {
      key,
      response,
      timestamp: Date.now(),
      backend,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupExpiredCache();
    }, 60000); // Run every minute
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, metrics] of this.sessions.entries()) {
      if (now - metrics.lastActivity > this.config.sessionTimeoutMs) {
        this.endSession(sessionId).catch(console.error);
      }
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.responseCache.entries()) {
      if (entry.expiresAt <= now) {
        this.responseCache.delete(key);
      }
    }
  }

  // Model management methods
  getModelManager(): ModelManager {
    return this.modelManager;
  }

  getPerformanceMonitor(): ModelPerformanceMonitor {
    return this.performanceMonitor;
  }

  async getPerformanceReport(modelId?: string) {
    if (modelId) {
      return this.performanceMonitor.getReport(modelId);
    }
    return this.performanceMonitor.generateReports();
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // End all active sessions
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map((id) => this.endSession(id)));

    // Clear caches
    this.responseCache.clear();
  }
}

// Factory function for creating orchestrator
export const createLlmOrchestrator = (
  config?: OrchestratorConfig,
): LlmOrchestrator => {
  return new LlmOrchestrator(config);
};

// Integration with existing evidence system
export const createOrchestratorEvidence = (
  operation: string,
  sessionId: string,
  backend: string,
  duration: number,
): EvidencePointer => ({
  type: "log",
  ref: `orchestrator-${operation}-${sessionId}-${backend}-${duration}ms-${Date.now()}`,
});
