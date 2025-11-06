import { spawnSync } from "node:child_process";

export function hasOllama(): boolean {
  const result = spawnSync("ollama", ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

export function hasMlx(): boolean {
  if (process.platform !== "darwin") return false;
  const result = spawnSync("python3", ["-c", "import mlx.core"], {
    stdio: "ignore",
  });
  return result.status === 0;
}
