import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL_KEYS = [
  "OLLAMA_BASE_URL",
  "OLLAMA_URL",
  "OLLAMA_HOST",
  "CORTEXDX_OLLAMA_URL",
];

const MODEL_KEYS = ["LLM_MODEL", "OLLAMA_MODEL", "CORTEXDX_OLLAMA_MODEL"];
const API_KEY_KEYS = ["OLLAMA_API_KEY", "CORTEXDX_OLLAMA_API_KEY"];

const TIMEOUT_KEYS = ["OLLAMA_TIMEOUT_MS", "LLM_TIMEOUT_MS"];
const RETRY_KEYS = ["OLLAMA_MAX_RETRIES"];
const SEED_KEYS = [
  "LLM_SEED",
  "LLM_DETERMINISTIC_SEED",
  "CORTEXDX_DETERMINISTIC_SEED",
];
const TEMP_KEYS = ["LLM_TEMPERATURE", "OLLAMA_TEMPERATURE"];

const FALLBACK_BASE_URL = "http://127.0.0.1:11434";
const FALLBACK_MODEL = "gpt-oss-safeguard:20b";

const CLOUD_ENV_BASE_URL_KEYS = [
  "CORTEXDX_CLOUD_OLLAMA_BASE_URL",
  "OLLAMA_BASE_URL",
  "OLLAMA_URL",
  "CORTEXDX_OLLAMA_URL",
];
const CLOUD_ENV_MODEL_KEYS = [
  "CORTEXDX_CLOUD_LLM_MODEL",
  "LLM_MODEL",
  "OLLAMA_MODEL",
  "CORTEXDX_OLLAMA_MODEL",
];
const CLOUD_ENV_API_KEYS = [
  "CORTEXDX_CLOUD_OLLAMA_API_KEY",
  "OLLAMA_API_KEY",
  "CORTEXDX_OLLAMA_API_KEY",
];

type CloudConfigSource = "env" | "file";

export interface CloudOllamaConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  source: CloudConfigSource;
}

let cachedCloudEnvPath: string | null = null;
let cachedCloudEnv: Record<string, string> | null = null;
let cachedCloudEnvMtime = 0;

function pickEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function pickFromSource(
  keys: string[],
  source: Record<string, string | undefined>,
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function parseInteger(keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseFloatEnv(keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw) continue;
    const parsed = Number.parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export function getDefaultOllamaBaseUrl(): string {
  return pickEnv(BASE_URL_KEYS) ?? FALLBACK_BASE_URL;
}

export function getDefaultOllamaModel(): string {
  return pickEnv(MODEL_KEYS) ?? FALLBACK_MODEL;
}

export function getOllamaTimeoutMs(): number | undefined {
  return parseInteger(TIMEOUT_KEYS);
}

export function getOllamaMaxRetries(): number | undefined {
  return parseInteger(RETRY_KEYS);
}

export function getOllamaDeterministicSeed(): number | undefined {
  return parseInteger(SEED_KEYS);
}

export function getOllamaTemperature(): number | undefined {
  return parseFloatEnv(TEMP_KEYS);
}

export function getOllamaApiKey(): string | undefined {
  return pickEnv(API_KEY_KEYS);
}

export function getLlmPrioritySource(): string {
  if (process.env.CORTEXDX_LLM_PRIORITY) {
    const explicit = process.env.CORTEXDX_LLM_PRIORITY.trim();
    if (explicit.length > 0) {
      return explicit;
    }
  }
  if (process.env.LLM_PROVIDER) {
    const provider = process.env.LLM_PROVIDER.trim();
    if (provider.length > 0) {
      return provider;
    }
  }
  return "local,cloud";
}

export function isOllamaPreferred(): boolean {
  const provider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
  return provider === "ollama" || provider.length === 0;
}

function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = contents.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function readCloudEnvFromFile(): Record<string, string> | null {
  const envPath = process.env.CORTEXDX_CLOUD_ENV_FILE || ".env.cloud";
  const resolvedPath = resolve(envPath);
  try {
    if (!existsSync(resolvedPath)) {
      cachedCloudEnv = null;
      cachedCloudEnvPath = resolvedPath;
      cachedCloudEnvMtime = 0;
      return null;
    }
    const stats = statSync(resolvedPath);
    if (
      cachedCloudEnv &&
      cachedCloudEnvPath === resolvedPath &&
      cachedCloudEnvMtime === stats.mtimeMs
    ) {
      return cachedCloudEnv;
    }
    const fileContent = readFileSync(resolvedPath, "utf8");
    cachedCloudEnv = parseEnvFile(fileContent);
    cachedCloudEnvPath = resolvedPath;
    cachedCloudEnvMtime = stats.mtimeMs;
    return cachedCloudEnv;
  } catch {
    cachedCloudEnv = null;
    cachedCloudEnvPath = resolvedPath;
    cachedCloudEnvMtime = 0;
    return null;
  }
}

export function getCloudOllamaConfig(): CloudOllamaConfig | null {
  const envSource = {
    CORTEXDX_CLOUD_OLLAMA_BASE_URL: process.env.CORTEXDX_CLOUD_OLLAMA_BASE_URL,
    CORTEXDX_CLOUD_LLM_MODEL: process.env.CORTEXDX_CLOUD_LLM_MODEL,
    CORTEXDX_CLOUD_OLLAMA_API_KEY: process.env.CORTEXDX_CLOUD_OLLAMA_API_KEY,
  };

  const envBase = pickFromSource(CLOUD_ENV_BASE_URL_KEYS, envSource);
  const envModel = pickFromSource(CLOUD_ENV_MODEL_KEYS, envSource);
  const envApi = pickFromSource(CLOUD_ENV_API_KEYS, envSource);

  if (envBase || envModel || envApi) {
    if (!envBase || !envModel) {
      return null;
    }
    return { baseUrl: envBase, model: envModel, apiKey: envApi, source: "env" };
  }

  const fileSource = readCloudEnvFromFile();
  if (!fileSource) {
    return null;
  }

  const fileBase = pickFromSource(CLOUD_ENV_BASE_URL_KEYS, fileSource);
  const fileModel = pickFromSource(CLOUD_ENV_MODEL_KEYS, fileSource);
  const fileApi = pickFromSource(CLOUD_ENV_API_KEYS, fileSource);

  if (!fileBase || !fileModel) {
    return null;
  }

  return {
    baseUrl: fileBase,
    model: fileModel,
    apiKey: fileApi,
    source: "file",
  };
}

export {
  FALLBACK_BASE_URL as DEFAULT_OLLAMA_BASE_URL,
  FALLBACK_MODEL as DEFAULT_OLLAMA_MODEL,
};
