import { randomUUID } from "node:crypto";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "../types.js";

const DEFAULT_MODEL = "gpt-4o-mini";

type OpenAIClient = import("openai").OpenAI;

function buildMessages(prompt: LLMGenerateRequest): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];
  if (prompt.systemPrompt) {
    messages.push({ role: "system", content: prompt.systemPrompt });
  }
  messages.push({ role: "user", content: prompt.prompt });
  return messages;
}

export class OpenAIPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "openai",
    displayName: "OpenAI",
    description: "OpenAI Chat Completions via official SDK",
    defaultModel: DEFAULT_MODEL,
    requiredEnv: ["OPENAI_API_KEY"],
  };

  private client: OpenAIClient | null = null;

  supports(context: LLMPluginContext): boolean {
    return Boolean(context.env.OPENAI_API_KEY);
  }

  private generateRequestId(): string {
    return `openai_${Date.now()}_${randomUUID()}`;
  }

  private async ensureClient(context: LLMPluginContext): Promise<void> {
    if (this.client) return;
    const apiKey = context.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }
    const openaiModule = await import("openai");
    this.client = new openaiModule.OpenAI({ apiKey });
    context.logger.info("OpenAIPlugin", "Client initialized");
  }

  async initialize(context: LLMPluginContext): Promise<void> {
    if (!this.supports(context)) return;
    await this.ensureClient(context);
  }

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext,
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const options = request.options ?? {};
    await this.ensureClient(context);
    if (!this.client) throw new Error("OpenAI client not initialized");
    const model = options.model || context.defaults?.model || DEFAULT_MODEL;
    const messages = buildMessages(request);
    const response = await this.client.chat.completions.create(
      {
        model,
        messages,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
      },
      { timeout: options.timeout ?? 120000 },
    );
    context.logger.info(
      "OpenAIPlugin",
      "Response generated",
      { model, responseTime: Date.now() - startTime },
      requestId,
    );
    return {
      text: response.choices[0]?.message?.content ?? "",
      model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}

export const openaiPlugin: LLMProviderPlugin = new OpenAIPlugin();
