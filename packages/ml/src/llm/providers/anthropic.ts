import { randomUUID } from "node:crypto";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "../types.js";

const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

function buildHeaders(context: LLMPluginContext): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (context.env.ANTHROPIC_API_KEY) {
    headers["x-api-key"] = context.env.ANTHROPIC_API_KEY;
  } else if (context.env.ANTHROPIC_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${context.env.ANTHROPIC_AUTH_TOKEN}`;
  }
  return headers;
}

function buildRequestBody(request: LLMGenerateRequest, model: string, options: LLMGenerateRequest["options"]): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.2,
    messages: [{ role: "user", content: request.prompt }],
  };
  if (request.systemPrompt) {
    body.system = request.systemPrompt;
  }
  return body;
}

async function sendAnthropicRequest(
  baseUrl: string,
  context: LLMPluginContext,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: buildHeaders(context),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter || "unknown"}`);
    }
    throw new Error(`Anthropic API error: ${response.status}`);
  }
  return response;
}

function toUsage(usage?: { input_tokens?: number; output_tokens?: number }): ProviderResponse["usage"] {
  if (!usage) return undefined;
  const promptTokens = usage.input_tokens ?? 0;
  const completionTokens = usage.output_tokens ?? 0;
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}

export class AnthropicPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "anthropic",
    displayName: "Anthropic Claude",
    description: "Anthropic Messages API",
    defaultModel: DEFAULT_MODEL,
  };

  supports(context: LLMPluginContext): boolean {
    return Boolean(context.env.ANTHROPIC_API_KEY || context.env.ANTHROPIC_AUTH_TOKEN);
  }

  private generateRequestId(): string {
    return `anthropic_${Date.now()}_${randomUUID()}`;
  }

  async initialize(): Promise<void> {}

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext,
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const options = request.options ?? {};
    const startTime = Date.now();
    const apiKey = context.env.ANTHROPIC_API_KEY;
    const authToken = context.env.ANTHROPIC_AUTH_TOKEN;
    const baseUrl = context.env.ANTHROPIC_API_URL || "https://api.anthropic.com";
    if (!apiKey && !authToken) {
      throw new Error("ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required");
    }
    const model = options.model || context.defaults?.model || DEFAULT_MODEL;
    const body = buildRequestBody(request, model, options);
    const response = await sendAnthropicRequest(baseUrl, context, body, options.timeout ?? 120000);
    const data = await response.json() as { content?: Array<{ text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = data.content?.[0]?.text ?? "";
    context.logger.info(
      "AnthropicPlugin",
      "Response generated",
      { model, responseTime: Date.now() - startTime },
      requestId,
    );
    return { text, model, usage: toUsage(data.usage) };
  }
}

export const anthropicPlugin: LLMProviderPlugin = new AnthropicPlugin();
