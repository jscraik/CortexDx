import { createMlxAdapter } from "../adapters/mlx.js";
import { createOllamaAdapter } from "../adapters/ollama.js";
import type { EnhancedLlmAdapter, LlmAdapter } from "../types.js";
import { hasMlx, hasOllama } from "./detect.js";

export async function pickLocalLLM(): Promise<"mlx" | "ollama" | "none"> {
  if (hasMlx()) return "mlx";
  if (hasOllama()) return "ollama";
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

  switch (kind) {
    case "mlx":
      try {
        return createMlxAdapter();
      } catch (error) {
        console.warn("Failed to create MLX adapter:", error);
        // Fallback to Ollama if available
        if (hasOllama()) {
          return createOllamaAdapter();
        }
        return null;
      }
    case "ollama":
      try {
        return createOllamaAdapter();
      } catch (error) {
        console.warn("Failed to create Ollama adapter:", error);
        return null;
      }
    default:
      return null;
  }
}

// Factory function with specific backend selection
export function createLlmAdapter(
  backend: "ollama",
  config?: import("../adapters/ollama.js").OllamaConfig,
): EnhancedLlmAdapter;
export function createLlmAdapter(
  backend: "mlx",
  config?: import("../adapters/mlx.js").MlxConfig,
): EnhancedLlmAdapter;
export function createLlmAdapter(
  backend: "ollama" | "mlx",
  config?: unknown,
): EnhancedLlmAdapter {
  switch (backend) {
    case "ollama":
      return createOllamaAdapter(
        config as import("../adapters/ollama.js").OllamaConfig,
      );
    case "mlx":
      return createMlxAdapter(config as import("../adapters/mlx.js").MlxConfig);
    default:
      throw new Error(`Unsupported LLM backend: ${backend}`);
  }
}
