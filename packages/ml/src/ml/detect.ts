import { spawnSync } from "node:child_process";
import { getDefaultOllamaBaseUrl, getOllamaApiKey } from "./ollama-env.js";

export interface OllamaAvailabilityOptions {
  url?: string;
  apiKey?: string;
  treatRemoteAsAvailable?: boolean;
}

export function hasOllama(options: OllamaAvailabilityOptions = {}): boolean {
  const url = options.url ?? getDefaultOllamaBaseUrl();
  const apiKey = options.apiKey ?? getOllamaApiKey();
  if (process.env.CORTEXDX_FORCE_OLLAMA === "1") {
    return true;
  }
  if (apiKey) {
    return true;
  }
  const treatRemote = options.treatRemoteAsAvailable !== false;
  if (
    treatRemote &&
    url &&
    !url.startsWith("http://127.0.0.1") &&
    !url.startsWith("http://localhost")
  ) {
    // Treat remote hosts as available even without the local binary
    return true;
  }
  const result = spawnSync("ollama", ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

export async function isOllamaReachable(
  url: string = getDefaultOllamaBaseUrl(),
  apiKey: string | undefined = getOllamaApiKey(),
): Promise<boolean> {
  const target = `${url.replace(/\/$/, "")}/api/tags`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 750);
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const res = await fetch(target, { method: "GET", signal: controller.signal, headers });
    return res.ok;
  } catch {
    return Boolean(apiKey);
  } finally {
    clearTimeout(timer);
  }
}
