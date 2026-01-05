import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { safeParseJson } from "../utils/json.js";

interface ChatModelEntry {
  ollama_model?: string;
  model_tag?: string;
}

interface OllamaModelsConfig {
  endpoint?: string;
  chat_models?: Record<string, ChatModelEntry>;
  default_models?: Record<string, string>;
}

const CONFIG_PATH = fileURLToPath(
  new URL("../../../../config/ollama-models.json", import.meta.url),
);

let cachedConfig: OllamaModelsConfig | null = null;

function loadConfig(): OllamaModelsConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = safeParseJson(raw) as OllamaModelsConfig;
    return cachedConfig;
  } catch {
    cachedConfig = {};
    return cachedConfig;
  }
}

export function getOllamaEndpoint(): string {
  const config = loadConfig();
  return config.endpoint ?? "http://127.0.0.1:11434";
}

export function resolveModelTag(modelId?: string): { alias: string; tag: string } {
  const config = loadConfig();
  const alias = modelId ?? config.default_models?.self_healing ?? config.default_models?.reasoning ?? "gpt-oss-safeguard";
  const candidate = lookupChatModel(config, alias);
  const tag = candidate?.ollama_model ?? candidate?.model_tag ?? alias;
  return { alias, tag };
}

function lookupChatModel(config: OllamaModelsConfig, candidate: string): ChatModelEntry | undefined {
  if (!config.chat_models) return undefined;
  if (config.chat_models[candidate]) return config.chat_models[candidate];
  const shortName = candidate.split(":")[0] ?? candidate;
  return config.chat_models[shortName];
}

export function getSelfHealingDefaultModel(): string {
  return resolveModelTag().tag;
}
