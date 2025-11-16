/**
 * Ollama Adapter Implementation
 * Provides local LLM capabilities through Ollama with model management and conversation support
 */

import { randomUUID } from "node:crypto";
import { safeParseJson } from "../utils/json.js";
import {
  getDefaultOllamaBaseUrl,
  getDefaultOllamaModel,
  getOllamaApiKey,
  getOllamaDeterministicSeed,
  getOllamaMaxRetries,
  getOllamaTemperature,
  getOllamaTimeoutMs,
} from "../ml/ollama-env.js";
import type {
  CodeAnalysis,
  Constraints,
  Context,
  ConversationContext,
  ConversationId,
  EnhancedLlmAdapter,
  EvidencePointer,
  Explanation,
  ModelInfo,
  Problem,
  Solution,
} from "../types.js";

export interface OllamaConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
  deterministicSeed?: number;
  temperature?: number;
  apiKey?: string;
}

export interface OllamaModel {
  name: string;
  size: string;
  digest: string;
  modified_at: string;
  details?: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaApiResponse {
  models?: OllamaModel[];
  response?: string;
  message?: {
    role?: string;
    content?: string;
  };
  context?: number[];
  details?: {
    family?: string;
    parameter_size?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ConversationSession {
  id: ConversationId;
  context: ConversationContext;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  model: string;
  ollamaContext?: number[];
  startTime: number;
  lastActivity: number;
  seed?: number;
}

export class OllamaAdapter implements EnhancedLlmAdapter {
  public readonly backend = "ollama" as const;
  private readonly config: Required<
    Omit<OllamaConfig, "deterministicSeed" | "apiKey">
  > & {
    deterministicSeed?: number;
    apiKey?: string;
  };
  private readonly conversations = new Map<
    ConversationId,
    ConversationSession
  >();
  private loadedModels = new Set<string>();

  constructor(config: OllamaConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || "http://localhost:11434",
      timeout: config.timeout || 30000,
      defaultModel: config.defaultModel || "llama3.2:3b",
      maxRetries: config.maxRetries || 3,
      deterministicSeed: config.deterministicSeed,
      temperature: config.temperature ?? (config.deterministicSeed ? 0 : 0.7),
      apiKey: config.apiKey,
    };
  }

  // Basic LlmAdapter interface implementation
  async complete(prompt: string, maxTokens?: number): Promise<string> {
    const response = await this.makeRequest("/api/generate", {
      model: this.config.defaultModel,
      prompt,
      stream: false,
      options: {
        num_predict: maxTokens || 2048,
        temperature: this.config.temperature,
        seed: this.config.deterministicSeed,
      },
    });

    return extractResponseText(response);
  }

  // Enhanced adapter methods
  async loadModel(modelId: string): Promise<void> {
    try {
      // Check if model exists locally
      const models = await this.getSupportedModels();
      if (!models.includes(modelId)) {
        // Pull the model if not available
        await this.pullModel(modelId);
      }

      // Load the model by making a small request
      await this.makeRequest("/api/generate", {
        model: modelId,
        prompt: "Hello",
        stream: false,
        options: { num_predict: 1 },
      });

      this.loadedModels.add(modelId);
    } catch (error) {
      throw new Error(
        `Failed to load model ${modelId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    // Ollama doesn't have explicit unload, but we can track loaded models
    this.loadedModels.delete(modelId);
  }

  async getSupportedModels(): Promise<string[]> {
    try {
      const response = await this.makeRequest("/api/tags");
      return response.models?.map((model: OllamaModel) => model.name) || [];
    } catch (error) {
      throw new Error(
        `Failed to get supported models: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    try {
      const response = await this.makeRequest("/api/show", { name: modelId });

      return {
        name: response.details?.family || modelId,
        version: response.details?.parameter_size || "unknown",
        capabilities: this.inferCapabilities(modelId),
        contextWindow: this.inferContextWindow(modelId),
        responseTimeMs: undefined, // Will be measured during actual usage
      };
    } catch (error) {
      throw new Error(
        `Failed to get model info for ${modelId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Conversation management
  async startConversation(
    context: ConversationContext,
  ): Promise<ConversationId> {
    const conversationId = `ollama-${randomUUID()}`;
    const model = this.selectModelForContext(context);

    const session: ConversationSession = {
      id: conversationId,
      context,
      messages: [],
      model,
      startTime: Date.now(),
      lastActivity: Date.now(),
      seed: context.deterministicSeed ?? this.config.deterministicSeed,
    };

    // Add system message based on context
    const systemMessage = this.createSystemMessage(context);
    if (systemMessage) {
      session.messages.push({
        role: "system",
        content: systemMessage,
        timestamp: Date.now(),
      });
    }

    this.conversations.set(conversationId, session);
    return conversationId;
  }

  async continueConversation(
    id: ConversationId,
    message: string,
  ): Promise<string> {
    const session = this.conversations.get(id);
    if (!session) {
      throw new Error(`Conversation ${id} not found`);
    }

    // Add user message
    session.messages.push({
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    // Prepare conversation context for Ollama
    const conversationPrompt = this.buildConversationPrompt(session);

    try {
      const response = await this.makeRequest("/api/generate", {
        model: session.model,
        prompt: conversationPrompt,
        stream: false,
        context: session.ollamaContext,
        options: {
          temperature: session.seed ? 0 : this.config.temperature,
          num_predict: 2048,
          seed: session.seed ?? this.config.deterministicSeed,
        },
      });

      // Update session with response
      const reply = extractResponseText(response);
      session.messages.push({
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      });
      session.ollamaContext = response.context;
      session.lastActivity = Date.now();

      return reply;
    } catch (error) {
      throw new Error(
        `Failed to continue conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async endConversation(id: ConversationId): Promise<void> {
    this.conversations.delete(id);
  }

  // Specialized completion methods
  async analyzeCode(code: string, context: string): Promise<CodeAnalysis> {
    const prompt = `Analyze the following code for issues, suggestions, and metrics:

Context: ${context}

Code:
\`\`\`
${code}
\`\`\`

Please provide a detailed analysis including:
1. Issues (errors, warnings, info)
2. Suggestions for improvement
3. Code metrics (complexity, maintainability, testability, performance)
4. Confidence level (0-1)

Respond in JSON format.`;

    const response = await this.complete(prompt, 1024);

    try {
      return safeParseJson<CodeAnalysis>(response, "ollama code analysis");
    } catch {
      // Fallback if JSON parsing fails
      return {
        issues: [],
        suggestions: [],
        metrics: {
          complexity: 0.5,
          maintainability: 0.5,
          testability: 0.5,
          performance: 0.5,
        },
        confidence: 0.3,
      };
    }
  }

  async generateSolution(
    problem: Problem,
    constraints: Constraints,
  ): Promise<Solution> {
    const prompt = `Generate a solution for the following problem:

Problem: ${problem.description}
User Level: ${problem.userLevel}
Severity: ${problem.severity}
Context: ${JSON.stringify(problem.context, null, 2)}

Constraints:
- Time Limit: ${constraints.timeLimit || "none"}
- Memory Limit: ${constraints.memoryLimit || "none"}
- Complexity: ${constraints.complexity}
- Security: ${JSON.stringify(constraints.security)}
- Performance: ${JSON.stringify(constraints.performance)}

Please provide a comprehensive solution including:
1. Solution description (technical and user-friendly)
2. Step-by-step implementation
3. Code changes if needed
4. Configuration changes if needed
5. Testing strategy
6. Rollback plan
7. Risk assessment

Respond in JSON format.`;

    const response = await this.complete(prompt, 2048);

    try {
      return safeParseJson<Solution>(response, "ollama solution");
    } catch {
      // Fallback solution
      return {
        id: `solution-${Date.now()}`,
        type: "manual",
        confidence: 0.5,
        description: "Manual investigation required",
        userFriendlyDescription:
          "This issue requires manual investigation and resolution",
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
          backupRequired: true,
          riskLevel: "medium",
        },
      };
    }
  }

  async explainError(error: Error, context: Context): Promise<Explanation> {
    const prompt = `Explain the following error in a clear, helpful way:

Error: ${error.message}
Stack: ${error.stack || "No stack trace available"}
Context: ${JSON.stringify(context, null, 2)}

Please provide:
1. A brief summary
2. Detailed explanation
3. User-friendly explanation (non-technical)
4. Technical details for developers
5. Related concepts
6. Next steps to resolve
7. Confidence level (0-1)

Respond in JSON format.`;

    const response = await this.complete(prompt, 1024);

    try {
      return safeParseJson<Explanation>(response, "ollama error explanation");
    } catch {
      // Fallback explanation
      return {
        summary: "An error occurred",
        details: error.message,
        userFriendlyExplanation:
          "Something went wrong. Please check the error message for more details.",
        technicalDetails:
          error.stack || "No additional technical details available",
        relatedConcepts: [],
        nextSteps: [
          "Check the error message",
          "Review the configuration",
          "Consult documentation",
        ],
        confidence: 0.3,
      };
    }
  }

  // Private helper methods
  private async makeRequest(
    endpoint: string,
    data?: Record<string, unknown>,
  ): Promise<OllamaApiResponse> {
    let targetEndpoint = endpoint;
    let payload: Record<string, unknown> | undefined = data;

    if (this.config.apiKey && endpoint === "/api/generate" && data) {
      targetEndpoint = "/api/chat";
      const prompt = typeof data.prompt === "string" ? data.prompt : "";
      payload = {
        model: data.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: data.stream ?? false,
        options: data.options,
      };
    }

    const url = this.buildUrl(targetEndpoint);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout,
        );

        const response = await fetch(url, {
          method: payload ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey
              ? { Authorization: `Bearer ${this.config.apiKey}` }
              : {}),
          },
          body: payload ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          throw error;
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error("Maximum retries exceeded");
  }

  private async pullModel(modelId: string): Promise<void> {
    // This would implement model pulling, but for now we'll assume models are available
    console.log(`Would pull model: ${modelId}`);
  }

  private selectModelForContext(context: ConversationContext): string {
    // Select appropriate model based on context
    switch (context.sessionType) {
      case "development":
        return "codellama:7b"; // Prefer code-focused models
      case "debugging":
        return "llama3.2:3b"; // Good reasoning capabilities
      case "learning":
        return "llama3.2:3b"; // Good for explanations
      default:
        return this.config.defaultModel;
    }
  }

  private createSystemMessage(context: ConversationContext): string | null {
    const basePrompt =
      "You are an AI assistant specialized in MCP (Model Context Protocol) development and debugging.";

    switch (context.sessionType) {
      case "development":
        return `${basePrompt} Help users build MCP servers and connectors. Provide clear, actionable guidance and code examples.`;
      case "debugging":
        return `${basePrompt} Help users diagnose and fix MCP-related issues. Ask clarifying questions and provide step-by-step solutions.`;
      case "learning":
        return `${basePrompt} Explain MCP concepts clearly and help users understand the protocol and best practices.`;
      default:
        return basePrompt;
    }
  }

  private buildConversationPrompt(session: ConversationSession): string {
    return session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n\n");
  }

  private inferCapabilities(modelId: string): string[] {
    const capabilities = ["text-generation", "conversation"];

    if (modelId.includes("code") || modelId.includes("llama")) {
      capabilities.push("code-analysis", "code-generation");
    }

    if (modelId.includes("instruct")) {
      capabilities.push("instruction-following", "problem-solving");
    }

    return capabilities;
  }

  private inferContextWindow(modelId: string): number {
    // Default context windows for common models
    if (modelId.includes("llama3.2")) return 128000;
    if (modelId.includes("codellama")) return 16384;
    if (modelId.includes("mistral")) return 32768;
    return 4096; // Conservative default
  }

  private buildUrl(endpoint: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (base.endsWith("/api") && path.startsWith("/api/")) {
      path = path.slice(4);
    } else if (/\/v\d+$/.test(base) && path.startsWith("/api/")) {
      path = path.slice(4);
    }
    return `${base}${path}`;
  }
}

// Factory function for creating Ollama adapter
export const createOllamaAdapter = (config?: OllamaConfig): OllamaAdapter => {
  const mergedConfig: OllamaConfig = {
    baseUrl: config?.baseUrl ?? getDefaultOllamaBaseUrl(),
    defaultModel: config?.defaultModel ?? getDefaultOllamaModel(),
    timeout: config?.timeout ?? getOllamaTimeoutMs(),
    maxRetries: config?.maxRetries ?? getOllamaMaxRetries(),
    deterministicSeed:
      config?.deterministicSeed ?? getOllamaDeterministicSeed(),
    temperature: config?.temperature ?? getOllamaTemperature(),
    apiKey: config?.apiKey ?? getOllamaApiKey(),
  };

  return new OllamaAdapter(mergedConfig);
};

function extractResponseText(response: OllamaApiResponse): string {
  if (response.response && response.response.trim().length > 0) {
    return response.response;
  }
  const messageContent = response.message?.content;
  if (messageContent && messageContent.trim().length > 0) {
    return messageContent;
  }
  const messages = (response as { messages?: Array<{ content?: string }> })
    .messages;
  if (Array.isArray(messages)) {
    for (const item of messages) {
      if (item?.content && item.content.trim().length > 0) {
        return item.content;
      }
    }
  }
  return "";
}

// Integration with existing evidence system
export const createOllamaEvidence = (
  operation: string,
  model: string,
  duration: number,
  success: boolean,
): EvidencePointer => ({
  type: "log",
  ref: `ollama-${operation}-${model}-${Date.now()}`,
  lines: undefined,
});
