import { createOllamaAdapter } from "../adapters/ollama.js";
import type { EnhancedLlmAdapter, LlmAdapter } from "../types.js";
import { hasOllama, isOllamaReachable } from "./detect.js";

const ENABLE_LOCAL_LLM = process.env.INSULA_ENABLE_LOCAL_LLM === "true";

export async function pickLocalLLM(): Promise<"ollama" | "none"> {
  if (!ENABLE_LOCAL_LLM) return "none";
  if (hasOllama() && (await isOllamaReachable())) return "ollama";
  return "none";
}

export async function getLlmAdapter(): Promise<LlmAdapter | null> {
  const kind = await pickLocalLLM();
  if (kind === "none") return null;
  return {
    complete: async (prompt: string) =>
      `/* local-${kind} disabled in starter; prompt len=${prompt.length} */`,
  };
}

// Enhanced adapter factory function
export async function getEnhancedLlmAdapter(): Promise<EnhancedLlmAdapter | null> {
  const kind = await pickLocalLLM();
  if (kind !== "ollama") {
    return null;
  }
  try {
    return createOllamaAdapter();
  } catch (error) {
    console.warn("Failed to create Ollama adapter:", error);
    return null;
  }
}

// Factory function with specific backend selection
export function createLlmAdapter(
  backend: "ollama",
  config?: import("../adapters/ollama.js").OllamaConfig,
): EnhancedLlmAdapter {
  if (backend !== "ollama") {
    throw new Error(`Unsupported LLM backend: ${backend}`);
  }
  return createOllamaAdapter(
    config as import("../adapters/ollama.js").OllamaConfig,
  );
}
