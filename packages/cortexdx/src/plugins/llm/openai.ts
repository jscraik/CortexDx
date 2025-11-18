/**
 * OpenAI Provider Plugin
 * Provides GPT model access through the OpenAI Chat Completions API
 */

import { randomUUID } from "node:crypto";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "./types.js";

const DEFAULT_MODEL = "gpt-4o-mini";

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
  };
}

class OpenAIPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "openai",
    displayName: "OpenAI",
    description: "OpenAI Chat Completions API",
    defaultModel: DEFAULT_MODEL,
    supportedModels: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
      "o1-preview",
      "o1-mini",
    ],
    requiredEnv: ["OPENAI_API_KEY"],
  };

  supports(context: LLMPluginContext): boolean {
    return Boolean(context.env.OPENAI_API_KEY);
  }

  private generateRequestId(): string {
    return `openai_${Date.now()}_${randomUUID()}`;
  }

  async initialize(context: LLMPluginContext): Promise<void> {
    if (!this.supports(context)) {
      return;
    }
    context.logger.info("OpenAIPlugin", "API client initialized", {
      hasApiKey: true,
    });
  }

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const options = request.options ?? {};

    context.logger.debug(
      "OpenAIPlugin",
      "Starting response generation",
      { model: options.model },
      requestId
    );

    const apiKey = context.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required to use the OpenAI provider");
    }

    const baseUrl = context.env.OPENAI_API_URL || "https://api.openai.com/v1";
    const model =
      options.model ||
      context.defaults?.model ||
      this.metadata.defaultModel ||
      DEFAULT_MODEL;

    const messages: ChatCompletionMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeout ?? 120000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorBody) as OpenAIResponse;
          if (errorJson.error?.message) {
            errorMessage = `OpenAI API error: ${errorJson.error.message}`;
          }
        } catch {
          // Use default error message
        }

        if (response.status === 429) {
          throw new Error("OpenAI rate limit exceeded. Please retry later.");
        }

        if (response.status === 401) {
          throw new Error(
            "OpenAI authentication failed. Check your API key."
          );
        }

        throw new Error(errorMessage);
      }

      const data = (await response.json()) as OpenAIResponse;

      context.logger.info(
        "OpenAIPlugin",
        "Response generated successfully",
        { model, responseTime: Date.now() - startTime },
        requestId
      );

      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined;

      return {
        text: data.choices?.[0]?.message?.content ?? "",
        model,
        usage,
      };
    } catch (error) {
      context.logger.error(
        "OpenAIPlugin",
        "API request failed",
        error instanceof Error ? error : undefined,
        { model, responseTime: Date.now() - startTime },
        requestId
      );

      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `OpenAI request timed out after ${options.timeout ?? 120000}ms`
        );
      }

      throw error;
    }
  }
}

export const openaiPlugin: LLMProviderPlugin = new OpenAIPlugin();
export default openaiPlugin;
