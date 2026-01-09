import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "../types.js";

const DEFAULT_MODEL = "llama3.2";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_ENDPOINT = "http://localhost:11434";

interface OllamaResponse {
  model: string;
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

function normalizeEnvValue(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function resolveEndpoint(env: NodeJS.ProcessEnv): string | undefined {
  return (
    normalizeEnvValue(env.OLLAMA_LOCAL_ENDPOINT) ||
    normalizeEnvValue(env.OLLAMA_CLOUD_ENDPOINT)
  );
}

function buildHeaders(env: NodeJS.ProcessEnv): Record<string, string> {
  const apiKey = normalizeEnvValue(env.OLLAMA_API_KEY);
  return {
    "Content-Type": "application/json",
    ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
  };
}

function buildRequestBody(
  request: LLMGenerateRequest,
  model: string,
  options: LLMGenerateRequest["options"],
): Record<string, unknown> {
  return {
    model,
    prompt: request.prompt,
    stream: false,
    options: {
      ...(options?.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options?.maxTokens !== undefined && {
        num_predict: options.maxTokens,
      }),
    },
  };
}

function toUsage(data: OllamaResponse): ProviderResponse["usage"] {
  const promptTokens = data.prompt_eval_count || 0;
  const completionTokens = data.eval_count || 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export class OllamaPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "ollama",
    displayName: "Ollama",
    description: "Local models via Ollama HTTP API",
    defaultModel: DEFAULT_MODEL,
    supportedModels: ["llama3.2", "deepseek-coder", "codellama", "mistral"],
  };

  private generateRequestId(): string {
    return `ollama-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  supports(context: LLMPluginContext): boolean {
    return Boolean(resolveEndpoint(context.env));
  }

  async initialize(context: LLMPluginContext): Promise<void> {
    if (!this.supports(context)) return;
    const endpoint = resolveEndpoint(context.env) ?? DEFAULT_ENDPOINT;
    const response = await fetch(`${endpoint}/api/version`, {
      signal: AbortSignal.timeout(5000),
    });
    context.logger.info("OllamaPlugin", "Initialization complete", {
      healthy: response.ok,
    });
  }

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext,
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const options = request.options ?? {};
    const endpoint = resolveEndpoint(context.env) ?? DEFAULT_ENDPOINT;
    const model = options.model || context.defaults?.model || DEFAULT_MODEL;
    const response = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: buildHeaders(context.env),
      body: JSON.stringify(buildRequestBody(request, model, options)),
      signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    const data: OllamaResponse = await response.json();
    context.logger.info(
      "OllamaPlugin",
      "Response generated",
      { model, responseTime: Date.now() - startTime },
      requestId,
    );
    return {
      text: data.response || "",
      model: data.model,
      usage: toUsage(data),
    };
  }
}

export const ollamaPlugin: LLMProviderPlugin = new OllamaPlugin();
