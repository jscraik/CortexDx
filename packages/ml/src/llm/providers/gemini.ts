import { randomUUID } from "node:crypto";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "../types.js";

const DEFAULT_MODEL = "gemini-2.0-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";

interface GenerativeAI {
  getGenerativeModel: (params: { model: string }) => {
    generateContent: (prompt: string) => Promise<{
      response?: {
        text?: () => string;
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
    }>;
  };
}

async function getClient(apiKey?: string): Promise<GenerativeAI> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }
  const genAIModule = await import("@google/generative-ai");
  return new genAIModule.GoogleGenerativeAI(apiKey);
}

function extractText(response: { response?: { text?: () => string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } }): string {
  if (typeof response.response?.text === "function") {
    try {
      return response.response.text();
    } catch {
      // fallthrough to candidates
    }
  }
  return response.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export class GeminiPlugin implements LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata = {
    id: "gemini",
    displayName: "Google Gemini",
    description: "Google Generative AI",
    defaultModel: DEFAULT_MODEL,
    supportedModels: [DEFAULT_MODEL, FALLBACK_MODEL],
    requiredEnv: ["GEMINI_API_KEY"],
  };

  private client: GenerativeAI | null = null;

  supports(context: LLMPluginContext): boolean {
    return Boolean(context.env.GEMINI_API_KEY);
  }

  private generateRequestId(): string {
    return `gemini_${Date.now()}_${randomUUID()}`;
  }

  async initialize(context: LLMPluginContext): Promise<void> {
    if (!this.supports(context)) return;
    this.client = await getClient(context.env.GEMINI_API_KEY?.trim());
  }

  private async ensureClient(context: LLMPluginContext): Promise<void> {
    if (this.client) return;
    this.client = await getClient(context.env.GEMINI_API_KEY?.trim());
  }

  private async execute(
    prompt: LLMGenerateRequest,
    targetModel: string,
    options: LLMGenerateRequest["options"],
  ): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error("Gemini client not initialized");
    }
    const modelInstance = this.client.getGenerativeModel({ model: targetModel });
    const timeoutMs = options?.timeout ?? 120000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    });
    const result = await Promise.race([modelInstance.generateContent(prompt.prompt), timeoutPromise]);
    // Gemini API does not currently provide token usage statistics in the response.
    // This is a known limitation: usage fields are hardcoded to zero.
    // If future versions of the API provide usage metadata, extract it here.
    // Example (if available): const usage = result.response?.usageMetadata || {};
    return {
      text: extractText(result),
      model: targetModel,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    };
  }

  async generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext,
  ): Promise<ProviderResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const options = request.options ?? {};
    await this.ensureClient(context);
    const model = options.model || context.defaults?.model || DEFAULT_MODEL;
    try {
      const response = await this.execute(request, model, options);
      context.logger.info(
        "GeminiPlugin",
        "Response generated",
        { model, responseTime: Date.now() - startTime },
        requestId,
      );
      return response;
    } catch (primaryError) {
      context.logger.warn(
        "GeminiPlugin",
        "Primary model failed, trying fallback",
        { primaryModel: model, fallbackModel: FALLBACK_MODEL },
        requestId,
      );
      const response = await this.execute(request, FALLBACK_MODEL, options);
      context.logger.info(
        "GeminiPlugin",
        "Fallback response generated",
        { model: FALLBACK_MODEL, responseTime: Date.now() - startTime },
        requestId,
      );
      return response;
    }
  }
}

export const geminiPlugin: LLMProviderPlugin = new GeminiPlugin();
