/**
 * Anthropic Provider Plugin
 * Provides Claude model access through the Anthropic Messages API
 */

import { randomUUID } from "node:crypto";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "./types.js";

const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

class AnthropicPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "anthropic",
    displayName: "Anthropic Claude",
    description:
      "Anthropic Messages API (requires either ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN)",
    defaultModel: DEFAULT_MODEL,
    supportedModels: [
      "claude-3-5-sonnet-20241022",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
      "claude-3-5-haiku-20241022",
    ],
    requiredEnv: ["ANTHROPIC_API_KEY"],
  };

  supports(context: LLMPluginContext): boolean {
    const apiKey = context.env.ANTHROPIC_API_KEY;
    const authToken = context.env.ANTHROPIC_AUTH_TOKEN;
    return Boolean(apiKey || authToken);
  }

  private generateRequestId(): string {
    return `anthropic_${Date.now()}_${randomUUID()}`;
  }

  async initialize(): Promise<void> {
    // No-op: Anthropic uses fetch per request
  }

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const options = request.options ?? {};
    const startTime = Date.now();

    context.logger.debug(
      "AnthropicPlugin",
      "Starting response generation",
      { model: options.model },
      requestId
    );

    const apiKey = context.env.ANTHROPIC_API_KEY;
    const authToken = context.env.ANTHROPIC_AUTH_TOKEN;
    const baseUrl =
      context.env.ANTHROPIC_API_URL || "https://api.anthropic.com";

    if (!apiKey && !authToken) {
      throw new Error(
        "Anthropic configuration missing. Ensure API key or auth token is set."
      );
    }

    const model =
      options.model ||
      context.defaults?.model ||
      this.metadata.defaultModel ||
      DEFAULT_MODEL;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
    } else if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const url = `${baseUrl}/v1/messages`;
    const maxTokens = options.maxTokens ?? 4096;
    const temperature = options.temperature ?? 0.7;

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeout ?? 120000),
      });

      if (!response.ok) {
        const errorBody = await response.text();

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          throw new Error(
            `Anthropic rate limit exceeded. Retry after ${retryAfter || "unknown"}.`
          );
        }

        if (response.status === 401) {
          throw new Error(
            "Anthropic authentication failed. Check your API key or auth token."
          );
        }

        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      type AnthropicResponse = {
        content?: Array<{ text?: string }>;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
        };
      };

      const data = (await response.json()) as AnthropicResponse;

      let text = "";
      if (Array.isArray(data.content) && typeof data.content[0]?.text === "string") {
        text = data.content[0].text;
      }

      context.logger.info(
        "AnthropicPlugin",
        "Response generated successfully",
        { model, responseTime: Date.now() - startTime },
        requestId
      );

      const usage = data.usage
        ? {
            promptTokens: data.usage.input_tokens ?? 0,
            completionTokens: data.usage.output_tokens ?? 0,
            totalTokens:
              (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined;

      return {
        text,
        model,
        usage,
      };
    } catch (error) {
      context.logger.error(
        "AnthropicPlugin",
        "Generation failed",
        error instanceof Error ? error : undefined,
        { model, responseTime: Date.now() - startTime },
        requestId
      );

      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `Anthropic request timed out after ${options.timeout ?? 120000}ms`
        );
      }

      throw error;
    }
  }
}

export const anthropicPlugin: LLMProviderPlugin = new AnthropicPlugin();
export default anthropicPlugin;
