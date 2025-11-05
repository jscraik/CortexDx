import type { LlmAdapter } from "../types.js";
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
    complete: async (prompt: string) => `/* local-${kind} disabled in starter; prompt len=${prompt.length} */`
  };
}
