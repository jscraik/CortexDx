import type {
  ChatMessage,
  ChatOptions,
  ConversationalLlmAdapter,
  EnhancedLlmAdapter,
  ModelInfo,
} from "../types.js";

interface ConversationalAdapterOptions {
  modelId?: string;
  deterministic?: boolean;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are CortexDx's embedded MCP assistant. Provide concise, evidence-backed guidance without leaking secrets.";

/**
 * Wraps an EnhancedLlmAdapter to satisfy the ConversationalLlmAdapter contract.
 * Falls back to deterministic completions when chat endpoints are unavailable.
 */
export class ConversationalAdapter implements ConversationalLlmAdapter {
  private readonly enhanced: EnhancedLlmAdapter;
  private readonly modelId?: string;
  private readonly deterministic: boolean;

  constructor(
    enhanced: EnhancedLlmAdapter,
    options: ConversationalAdapterOptions = {},
  ) {
    this.enhanced = enhanced;
    this.modelId = options.modelId;
    this.deterministic = Boolean(options.deterministic);
  }

  async complete(prompt: string, maxTokens?: number): Promise<string> {
    return await this.enhanced.complete(prompt, maxTokens);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const prompt = renderMessages(messages, options);
    return await this.enhanced.complete(prompt, options?.maxTokens ?? 512);
  }

  async *stream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    yield await this.chat(messages, options);
  }

  async getModelInfo(): Promise<ModelInfo> {
    const targetModel = this.modelId ?? (await this.pickModelId());
    return await this.enhanced.getModelInfo(targetModel);
  }

  private async pickModelId(): Promise<string> {
    const models = await this.enhanced.getSupportedModels();
    if (models && models.length > 0 && models[0]) {
      return models[0] ?? "unknown";
    }
    return "unknown";
  }
}

function renderMessages(
  messages: ChatMessage[],
  options?: ChatOptions,
): string {
  const systemPrompt = options?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const history = messages
    .map((msg) => `[${msg.role.toUpperCase()}] ${msg.content}`)
    .join("\n\n");
  const deterministicNote =
    options?.temperature === 0 ? " (deterministic)" : "";
  return `${systemPrompt}${deterministicNote}

${history}

[ASSISTANT]`;
}

export function createConversationalAdapter(
  enhanced: EnhancedLlmAdapter,
  options?: ConversationalAdapterOptions,
): ConversationalLlmAdapter {
  return new ConversationalAdapter(enhanced, options);
}
