import { randomUUID } from "node:crypto";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "../types.js";

const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
const DEFAULT_BASE_URL = "https://api.z.ai/v1";

function buildRequestBody(request: LLMGenerateRequest, model: string, options: LLMGenerateRequest["options"]): Record<string, unknown> {
  return {
    model,
    messages: [{ role: "user", content: request.prompt }],
    ...(request.systemPrompt && { system: request.systemPrompt }),
    max_tokens: options?.maxTokens || 4096,
    temperature: options?.temperature ?? 0.7,
  };
}

function extractText(content?: Array<{ type: string; text?: string }>): string {
  if (!content) return "";
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

function toUsage(usage?: { input_tokens?: number; output_tokens?: number }): ProviderResponse["usage"] {
  if (!usage) return undefined;
  const promptTokens = usage.input_tokens ?? 0;
  const completionTokens = usage.output_tokens ?? 0;
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}

export class ZaiPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "zai",
    displayName: "Z.ai",
    description: "Z.ai API (Anthropic-compatible)",
    defaultModel: DEFAULT_MODEL,
  };

  supports(context: LLMPluginContext): boolean {
    return Boolean(context.env.ZAI_API_KEY);
  }

  private generateRequestId(): string {
    return `zai_${Date.now()}_${randomUUID()}`;
  }

  async initialize(): Promise<void> {}

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext,
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const options = request.options ?? {};
    const startTime = Date.now();
    const apiKey = context.env.ZAI_API_KEY;
    if (!apiKey) throw new Error("ZAI_API_KEY is required");
    const baseUrl = context.env.ZAI_BASE_URL || DEFAULT_BASE_URL;
    const version = context.env.ZAI_VERSION || "2023-06-01";
    const model = options.model || context.defaults?.model || DEFAULT_MODEL;
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": version,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(buildRequestBody(request, model, options)),
      signal: AbortSignal.timeout(options.timeout ?? 120000),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Z.ai API error (${response.status}): ${errorText}`);
    }
    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = extractText(data.content);
    context.logger.info(
      "ZaiPlugin",
      "Response generated",
      { model, responseTime: Date.now() - startTime },
      requestId,
    );
    return { text, model, usage: toUsage(data.usage) };
  }
}

export const zaiPlugin: LLMProviderPlugin = new ZaiPlugin();
