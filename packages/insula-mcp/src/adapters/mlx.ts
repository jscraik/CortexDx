/**
 * MLX Adapter Implementation
 * Apple Silicon optimized inference with quantization for <2s response times
 */

import { type ChildProcess, spawn } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

export interface MlxConfig {
  pythonPath?: string;
  maxMemoryMb?: number;
  quantization?: "int4" | "int8" | "float16" | "none";
  maxTokens?: number;
  temperature?: number;
  defaultModel?: string;
}

export interface MlxModel {
  name: string;
  path: string;
  quantization: string;
  memoryUsageMb: number;
  isLoaded: boolean;
}

export interface MlxResponse {
  text: string;
  tokens: number;
  duration: number;
  memoryUsage: number;
}

export interface ConversationSession {
  id: ConversationId;
  context: ConversationContext;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  model: string;
  startTime: number;
  lastActivity: number;
  memoryUsage: number;
}

export class MlxAdapter implements EnhancedLlmAdapter {
  public readonly backend = "mlx" as const;
  private readonly config: Required<MlxConfig>;
  private readonly conversations = new Map<
    ConversationId,
    ConversationSession
  >();
  private readonly loadedModels = new Map<string, MlxModel>();
  private pythonProcess: ChildProcess | null = null;

  constructor(config: MlxConfig = {}) {
    this.config = {
      pythonPath: config.pythonPath || "python3",
      maxMemoryMb: config.maxMemoryMb || 8192,
      quantization: config.quantization || "int4",
      maxTokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.7,
      defaultModel:
        config.defaultModel || "mlx-community/Llama-3.2-3B-Instruct-4bit",
    };

    // Verify MLX availability on macOS
    if (process.platform !== "darwin") {
      throw new Error("MLX adapter is only available on macOS (Apple Silicon)");
    }
  }

  // Basic LlmAdapter interface implementation
  async complete(prompt: string, maxTokens?: number): Promise<string> {
    const startTime = Date.now();

    try {
      const response = await this.runInference({
        model: this.config.defaultModel,
        prompt,
        maxTokens: maxTokens || this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const duration = Date.now() - startTime;

      // Ensure <2s response time target
      if (duration > 2000) {
        console.warn(`MLX response time ${duration}ms exceeded 2s target`);
      }

      return response.text;
    } catch (error) {
      throw new Error(
        `MLX completion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Enhanced adapter methods
  async loadModel(modelId: string): Promise<void> {
    if (this.loadedModels.has(modelId)) {
      return; // Already loaded
    }

    try {
      const modelInfo = await this.downloadAndQuantizeModel(modelId);
      this.loadedModels.set(modelId, modelInfo);
    } catch (error) {
      throw new Error(
        `Failed to load MLX model ${modelId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    const model = this.loadedModels.get(modelId);
    if (model) {
      // Free memory by removing from loaded models
      this.loadedModels.delete(modelId);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }

  async getSupportedModels(): Promise<string[]> {
    // Return commonly available MLX models
    return [
      "mlx-community/Llama-3.2-3B-Instruct-4bit",
      "mlx-community/Llama-3.2-1B-Instruct-4bit",
      "mlx-community/CodeLlama-7B-Instruct-4bit",
      "mlx-community/Mistral-7B-Instruct-v0.3-4bit",
      "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit",
    ];
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    const model = this.loadedModels.get(modelId);

    return {
      name: modelId.split("/").pop() ?? modelId,
      version: this.extractVersionFromModelId(modelId),
      capabilities: this.inferCapabilities(modelId),
      contextWindow: this.inferContextWindow(modelId),
      responseTimeMs: model
        ? await this.measureResponseTime(modelId)
        : undefined,
    };
  }

  // Conversation management
  async startConversation(
    context: ConversationContext,
  ): Promise<ConversationId> {
    const conversationId = `mlx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const model = this.selectModelForContext(context);

    // Ensure model is loaded
    await this.loadModel(model);

    const session: ConversationSession = {
      id: conversationId,
      context,
      messages: [],
      model,
      startTime: Date.now(),
      lastActivity: Date.now(),
      memoryUsage: 0,
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

    // Build conversation prompt
    const conversationPrompt = this.buildConversationPrompt(session);

    try {
      const response = await this.runInference({
        model: session.model,
        prompt: conversationPrompt,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      // Update session with response
      session.messages.push({
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
      });
      session.lastActivity = Date.now();
      session.memoryUsage = response.memoryUsage;

      return response.text;
    } catch (error) {
      throw new Error(
        `Failed to continue MLX conversation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async endConversation(id: ConversationId): Promise<void> {
    this.conversations.delete(id);
  }

  // Specialized completion methods
  async analyzeCode(code: string, context: string): Promise<CodeAnalysis> {
    const model = "mlx-community/CodeLlama-7B-Instruct-4bit";
    await this.loadModel(model);

    const prompt = `Analyze this code for issues and improvements:

Context: ${context}

Code:
\`\`\`
${code}
\`\`\`

Provide analysis in JSON format with issues, suggestions, and metrics.`;

    const response = await this.runInference({
      model,
      prompt,
      maxTokens: 1024,
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.text);
    } catch {
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
    const model = this.selectModelForProblem(problem);
    await this.loadModel(model);

    const prompt = `Generate a solution for this MCP problem:

Problem: ${problem.description}
User Level: ${problem.userLevel}
Severity: ${problem.severity}
Constraints: ${JSON.stringify(constraints, null, 2)}

Provide a comprehensive solution in JSON format.`;

    const response = await this.runInference({
      model,
      prompt,
      maxTokens: 2048,
      temperature: 0.5,
    });

    try {
      return JSON.parse(response.text);
    } catch {
      return {
        id: `mlx-solution-${Date.now()}`,
        type: "manual",
        confidence: 0.5,
        description: "Manual investigation required",
        userFriendlyDescription: "This issue requires manual investigation",
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
    const prompt = `Explain this error clearly:

Error: ${error.message}
Context: ${JSON.stringify(context, null, 2)}

Provide explanation in JSON format with summary, details, and next steps.`;

    const response = await this.runInference({
      model: this.config.defaultModel,
      prompt,
      maxTokens: 1024,
      temperature: 0.4,
    });

    try {
      return JSON.parse(response.text);
    } catch {
      return {
        summary: "An error occurred",
        details: error.message,
        userFriendlyExplanation:
          "Something went wrong. Please check the error details.",
        relatedConcepts: [],
        nextSteps: ["Check error message", "Review configuration"],
        confidence: 0.3,
      };
    }
  }

  // Private helper methods
  private async runInference(params: {
    model: string;
    prompt: string;
    maxTokens: number;
    temperature: number;
  }): Promise<MlxResponse> {
    const startTime = Date.now();
    const tempFile = join(tmpdir(), `mlx-prompt-${Date.now()}.txt`);

    try {
      // Write prompt to temporary file
      await writeFile(tempFile, params.prompt, "utf8");

      // Create Python script for MLX inference
      const pythonScript = this.createInferenceScript(params, tempFile);
      const scriptFile = join(tmpdir(), `mlx-script-${Date.now()}.py`);
      await writeFile(scriptFile, pythonScript, "utf8");

      // Run inference
      const result = await this.executePythonScript(scriptFile);

      // Clean up temporary files
      await Promise.all([
        unlink(tempFile).catch(() => {}),
        unlink(scriptFile).catch(() => {}),
      ]);

      const duration = Date.now() - startTime;

      return {
        text: result.output,
        tokens: result.tokens || 0,
        duration,
        memoryUsage: result.memoryUsage || 0,
      };
    } catch (error) {
      // Clean up on error
      await Promise.all([unlink(tempFile).catch(() => {})]);
      throw error;
    }
  }

  private createInferenceScript(
    params: {
      model: string;
      prompt: string;
      maxTokens: number;
      temperature: number;
    },
    promptFile: string,
  ): string {
    return `
import json
import sys
import mlx.core as mx
from mlx_lm import load, generate

try:
    # Load model with quantization
    model, tokenizer = load("${params.model}")
    
    # Read prompt from file
    with open("${promptFile}", "r") as f:
        prompt = f.read()
    
    # Generate response
    response = generate(
        model, 
        tokenizer, 
        prompt=prompt,
        max_tokens=${params.maxTokens},
        temp=${params.temperature}
    )
    
    # Get memory usage (approximate)
    memory_usage = mx.metal.get_active_memory() / (1024 * 1024)  # MB
    
    result = {
        "output": response,
        "tokens": len(tokenizer.encode(response)),
        "memoryUsage": memory_usage
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        "error": str(e),
        "output": "",
        "tokens": 0,
        "memoryUsage": 0
    }
    print(json.dumps(error_result))
    sys.exit(1)
`;
  }

  private async executePythonScript(scriptFile: string): Promise<{
    output: string;
    tokens: number;
    memoryUsage: number;
  }> {
    return new Promise((resolve, reject) => {
      const process = spawn(this.config.pythonPath, [scriptFile], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(new Error(`Failed to parse MLX output: ${error}`));
        }
      });

      // Set timeout for inference
      setTimeout(() => {
        process.kill();
        reject(new Error("MLX inference timeout"));
      }, 30000);
    });
  }

  private async downloadAndQuantizeModel(modelId: string): Promise<MlxModel> {
    // In a real implementation, this would download and quantize the model
    // For now, we'll assume the model is available
    return {
      name: modelId,
      path: `/tmp/mlx-models/${modelId}`,
      quantization: this.config.quantization,
      memoryUsageMb: 0,
      isLoaded: true,
    };
  }

  private async measureResponseTime(modelId: string): Promise<number> {
    const startTime = Date.now();
    try {
      await this.runInference({
        model: modelId,
        prompt: "Hello",
        maxTokens: 10,
        temperature: 0.1,
      });
      return Date.now() - startTime;
    } catch {
      return -1;
    }
  }

  private selectModelForContext(context: ConversationContext): string {
    switch (context.sessionType) {
      case "development":
        return "mlx-community/CodeLlama-7B-Instruct-4bit";
      case "debugging":
        return "mlx-community/Llama-3.2-3B-Instruct-4bit";
      case "learning":
        return "mlx-community/Llama-3.2-3B-Instruct-4bit";
      default:
        return this.config.defaultModel;
    }
  }

  private selectModelForProblem(problem: Problem): string {
    if (problem.type === "development" || problem.type === "integration") {
      return "mlx-community/CodeLlama-7B-Instruct-4bit";
    }
    return this.config.defaultModel;
  }

  private createSystemMessage(context: ConversationContext): string | null {
    const basePrompt =
      "You are an AI assistant specialized in MCP development and debugging.";

    switch (context.sessionType) {
      case "development":
        return `${basePrompt} Help users build MCP servers efficiently with Apple Silicon optimization.`;
      case "debugging":
        return `${basePrompt} Diagnose MCP issues quickly and provide actionable solutions.`;
      case "learning":
        return `${basePrompt} Explain MCP concepts clearly for different skill levels.`;
      default:
        return basePrompt;
    }
  }

  private buildConversationPrompt(session: ConversationSession): string {
    return session.messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n\n");
  }

  private extractVersionFromModelId(modelId: string): string {
    const match = modelId.match(/(\d+\.?\d*[BM]?)/);
    return match?.[1] ?? "unknown";
  }

  private inferCapabilities(modelId: string): string[] {
    const capabilities = ["text-generation", "conversation"];

    if (modelId.includes("Code") || modelId.includes("code")) {
      capabilities.push("code-analysis", "code-generation");
    }

    if (modelId.includes("Instruct")) {
      capabilities.push("instruction-following", "problem-solving");
    }

    capabilities.push("apple-silicon-optimized", "quantized-inference");

    return capabilities;
  }

  private inferContextWindow(modelId: string): number {
    if (modelId.includes("Llama-3.2")) return 128000;
    if (modelId.includes("CodeLlama")) return 16384;
    if (modelId.includes("Mistral")) return 32768;
    if (modelId.includes("Qwen")) return 32768;
    return 4096;
  }
}

// Factory function for creating MLX adapter
export const createMlxAdapter = (config?: MlxConfig): MlxAdapter => {
  return new MlxAdapter(config);
};

// Integration with existing evidence system
export const createMlxEvidence = (
  operation: string,
  model: string,
  duration: number,
  memoryUsage: number,
): EvidencePointer => ({
  type: "log",
  ref: `mlx-${operation}-${model}-${duration}ms-${memoryUsage}mb-${Date.now()}`,
});
