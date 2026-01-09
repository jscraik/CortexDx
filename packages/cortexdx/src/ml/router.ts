import type { EnhancedLlmAdapter, LlmAdapter } from "@brainwav/cortexdx-core";
import { createOllamaAdapter } from "../../../ml/src/adapters/ollama.js";
import {
  getCloudOllamaConfig,
  getLlmPrioritySource,
} from "../../../ml/src/ml/ollama-env.js";

type RouterBackend = "ollama-local" | "ollama-cloud" | "none";

export interface LlmAdapterOptions {
  deterministicSeed?: number;
}

function localLlmEnabled(): boolean {
  return process.env.CORTEXDX_ENABLE_LOCAL_LLM !== "false";
}

function cloudLlmEnabled(): boolean {
  return process.env.CORTEXDX_ENABLE_CLOUD_LLM !== "false";
}

function priorityList(): string[] {
  return getLlmPrioritySource()
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

async function pickRouterBackend(): Promise<{
  id: RouterBackend;
  localBase?: string;
  cloud?: ReturnType<typeof getCloudOllamaConfig>;
}> {
  const { hasOllama, isOllamaReachable } = await import("./detect.js");
  const priorities = priorityList();
  for (const backend of priorities) {
    if (
      (backend === "ollama" ||
        backend === "local" ||
        backend === "ollama-local") &&
      localLlmEnabled()
    ) {
      const localBase =
        process.env.CORTEXDX_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
      if (hasOllama() && (await isOllamaReachable(localBase))) {
        return { id: "ollama-local", localBase };
      }
    }
    if (
      (backend === "cloud" || backend === "ollama-cloud") &&
      cloudLlmEnabled()
    ) {
      const cloudConfig = getCloudOllamaConfig();
      if (!cloudConfig) {
        continue;
      }
      if (await isOllamaReachable(cloudConfig.baseUrl, cloudConfig.apiKey)) {
        return { id: "ollama-cloud", cloud: cloudConfig };
      }
    }
  }
  return { id: "none" };
}

export async function pickLocalLLM(): Promise<"ollama" | "none"> {
  const selection = await pickRouterBackend();
  return selection.id === "none" ? "none" : "ollama";
}

export async function getLlmAdapter(
  options: LlmAdapterOptions = {},
): Promise<LlmAdapter | null> {
  const enhanced = await getEnhancedLlmAdapter(options);
  if (!enhanced) {
    return null;
  }
  return {
    complete: (prompt: string, maxTokens?: number) =>
      enhanced.complete(prompt, maxTokens),
  };
}

export async function getEnhancedLlmAdapter(
  options: LlmAdapterOptions = {},
): Promise<EnhancedLlmAdapter | null> {
  const selection = await pickRouterBackend();
  try {
    if (selection.id === "ollama-local") {
      return createOllamaAdapter({
        baseUrl: selection.localBase,
        deterministicSeed: options.deterministicSeed,
      });
    }
    if (selection.id === "ollama-cloud" && selection.cloud) {
      return createOllamaAdapter({
        baseUrl: selection.cloud.baseUrl,
        defaultModel: selection.cloud.model,
        apiKey: selection.cloud.apiKey,
        deterministicSeed: options.deterministicSeed,
      });
    }
    return null;
  } catch (error) {
    console.warn("Failed to create LLM adapter:", error);
    return null;
  }
}

export function createLlmAdapter(
  backend: "ollama",
  config?: import("../../../ml/src/adapters/ollama.js").OllamaConfig,
): EnhancedLlmAdapter {
  if (backend === "ollama") {
    return createOllamaAdapter(config);
  }
  throw new Error(`Unsupported LLM backend: ${backend}`);
}
