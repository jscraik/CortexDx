/**
 * LLM Plugin System
 * Exports all LLM providers and the plugin registry
 */

// Types
export type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderConfig,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
  QuestionInput,
  QuestionOutput,
} from "./types.js";

// Registry
export {
  getLLMRegistry,
  LLMPluginRegistry,
  resetLLMRegistry,
} from "./registry.js";
export type { LLMRegistryOptions } from "./registry.js";

// Provider plugins
export { anthropicPlugin } from "./anthropic.js";
export { ollamaPlugin } from "./ollama.js";
export { openaiPlugin } from "./openai.js";

// Built-in plugins array for easy registration
import { anthropicPlugin } from "./anthropic.js";
import { ollamaPlugin } from "./ollama.js";
import { openaiPlugin } from "./openai.js";

export const BUILTIN_PLUGINS = [
  ollamaPlugin,
  anthropicPlugin,
  openaiPlugin,
];
