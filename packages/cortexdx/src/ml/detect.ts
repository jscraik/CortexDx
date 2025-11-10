import { spawnSync } from "node:child_process";

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export function hasOllama(): boolean {
  const result = spawnSync("ollama", ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

export async function isOllamaReachable(url: string = DEFAULT_OLLAMA_URL): Promise<boolean> {
  const target = `${url.replace(/\/$/, "")}/api/tags`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 750);
  try {
    const res = await fetch(target, { method: "GET", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
