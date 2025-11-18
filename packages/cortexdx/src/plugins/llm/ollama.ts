/**
 * Ollama Provider Plugin
 * Wraps the existing OllamaAdapter for use with the LLM plugin registry
 */

import { randomUUID } from "node:crypto";
import {
  getDefaultOllamaBaseUrl,
  getDefaultOllamaModel,
  getOllamaApiKey,
  getOllamaTimeoutMs,
} from "../../ml/ollama-env.js";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "./types.js";

const DEFAULT_MODEL = "deepseek-coder:6.7b";
const DEFAULT_ENDPOINT = "http://localhost:11434";

interface OllamaGenerateResponse {
  model: string;
  response?: string;
  message?: {
    content?: string;
  };
  error?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

class OllamaPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "ollama",
    displayName: "Ollama",
    description: "Local and cloud models served via the Ollama HTTP API",
    defaultModel: DEFAULT_MODEL,
    supportedModels: [
      "deepseek-coder:6.7b",
      "qwen3-coder:30b",
      "gpt-oss:20b",
      "phi4-mini-reasoning:latest",
      "gemma3n:e4b",
      "llama3.2:3b",
      "codellama:7b",
    ],
  };

  private generateRequestId(): string {
    return `ollama-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private resolveEndpoint(env: NodeJS.ProcessEnv): string {
    // Check for explicit environment variables first
    const localEndpoint = env.OLLAMA_LOCAL_ENDPOINT?.trim();
    if (localEndpoint && localEndpoint !== "undefined" && localEndpoint !== "null") {
      return localEndpoint;
    }

    const cloudEndpoint = env.OLLAMA_CLOUD_ENDPOINT?.trim();
    if (cloudEndpoint && cloudEndpoint !== "undefined" && cloudEndpoint !== "null") {
      return cloudEndpoint;
    }

    // Fall back to the standard env helpers
    return getDefaultOllamaBaseUrl() || DEFAULT_ENDPOINT;
  }

  supports(context: LLMPluginContext): boolean {
    const endpoint = this.resolveEndpoint(context.env);
    if (!endpoint) {
      return false;
    }
    return true;
  }

  async initialize(context: LLMPluginContext): Promise<void> {
    if (!this.supports(context)) {
      return;
    }

    const endpoint = this.resolveEndpoint(context.env);

    try {
      const response = await fetch(`${endpoint}/api/version`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        context.logger.info("OllamaPlugin", "Initialization complete", {
          endpoint,
          healthy: true,
        });
      } else {
        context.logger.warn("OllamaPlugin", "Health check returned non-OK status", {
          endpoint,
          status: response.status,
        });
      }
    } catch (error) {
      context.logger.warn(
        "OllamaPlugin",
        "Initialization health check failed - Ollama may not be running",
        {
          endpoint,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      );
      // Don't throw - allow plugin to be used, it will fail on generate if Ollama is down
    }
  }

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const options = request.options ?? {};

    context.logger.debug(
      "OllamaPlugin",
      "Starting response generation",
      { model: options.model },
      requestId
    );

    const endpoint = this.resolveEndpoint(context.env);
    const apiKey = getOllamaApiKey() || context.env.OLLAMA_API_KEY;
    const timeout = getOllamaTimeoutMs() || options.timeout || 30000;

    const model =
      options.model ||
      context.defaults?.model ||
      getDefaultOllamaModel() ||
      this.metadata.defaultModel ||
      DEFAULT_MODEL;

    // Build request body
    const requestBody: Record<string, unknown> = {
      model,
      prompt: request.prompt,
      stream: false,
      options: {},
    };

    if (options.temperature !== undefined) {
      (requestBody.options as Record<string, unknown>).temperature =
        options.temperature;
    }
    if (options.maxTokens !== undefined) {
      (requestBody.options as Record<string, unknown>).num_predict =
        options.maxTokens;
    }

    // If we have an API key, use chat endpoint instead of generate
    let targetEndpoint = `${endpoint}/api/generate`;
    if (apiKey) {
      targetEndpoint = `${endpoint}/api/chat`;
      requestBody.messages = [
        {
          role: "user",
          content: request.prompt,
        },
      ];
      delete requestBody.prompt;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      const data = (await response.json()) as OllamaGenerateResponse;

      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }

      // Extract text from response (handle both generate and chat formats)
      let text = "";
      if (data.response) {
        text = data.response;
      } else if (data.message?.content) {
        text = data.message.content;
      }

      context.logger.info(
        "OllamaPlugin",
        "Response generated successfully",
        { model, responseTime: Date.now() - startTime },
        requestId
      );

      return {
        text,
        model: data.model || model,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      context.logger.error(
        "OllamaPlugin",
        "Generation failed",
        error instanceof Error ? error : undefined,
        { model, responseTime: Date.now() - startTime },
        requestId
      );

      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`Ollama request timed out after ${timeout}ms`);
      }

      throw error;
    }
  }
}

export const ollamaPlugin: LLMProviderPlugin = new OllamaPlugin();
export default ollamaPlugin;
