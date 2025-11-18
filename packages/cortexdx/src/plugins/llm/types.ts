/**
 * LLM Provider Plugin Types
 * Defines interfaces for the plugin-based LLM provider system
 */

import type { SecureLogger } from "../../utils/security/secure-logger.js";
import type { LLMBackend } from "../../types.js";

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
  id: LLMBackend;
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
    context: LLMPluginContext
  ): Promise<ProviderResponse>;
}

// Request types for higher-level APIs
export interface QuestionInput {
  goal: string;
  plan: string;
  modelOverride?: {
    provider?: string;
    model?: string;
  };
  userPrompt?: string;
  progress?: string;
  uncertainties?: string[];
  taskContext?: string;
  sessionId?: string;
  historySummary?: string;
  organizationalLearnings?: string;
}

export interface QuestionOutput {
  questions: string;
}
