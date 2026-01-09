import type { SecureLogger } from "./secure-logger.js";

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  authToken?: string;
  version?: string;
  timeout?: number;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  text: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMPluginContext {
  env: NodeJS.ProcessEnv;
  logger: SecureLogger;
  defaults?: {
    model?: string;
  };
}

export interface LLMGenerateRequest {
  prompt: string;
  options?: LLMProviderConfig;
  systemPrompt?: string;
}

export interface LLMProviderMetadata {
  id: string;
  displayName: string;
  description?: string;
  defaultModel?: string;
  supportedModels?: string[];
  requiredEnv?: string[];
  promptFormat?: "compiled" | "full";
}

export interface LLMProviderPlugin {
  readonly metadata: LLMProviderMetadata;
  supports(context: LLMPluginContext): boolean;
  initialize?(context: LLMPluginContext): Promise<void>;
  generate(
    request: LLMGenerateRequest,
    context: LLMPluginContext,
  ): Promise<ProviderResponse>;
}

export interface GenerateInput {
  prompt: string;
  systemPrompt?: string;
  modelOverride?: {
    provider?: string;
    model?: string;
  };
  context?: Record<string, unknown>;
}

export interface GenerateOutput {
  text: string;
  model?: string;
  provider?: string;
  usage?: ProviderResponse["usage"];
}
