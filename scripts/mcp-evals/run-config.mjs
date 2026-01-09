#!/usr/bin/env node
import path from "node:path";
await import("tsx");
const { runAllEvals } = await import("mcp-evals");

async function main() {
  const [configPath, serverPath] = process.argv.slice(2);
  if (!configPath || !serverPath) {
    console.error(
      "Usage: node scripts/mcp-evals/run-config.mjs <config> <server.ts>",
    );
    process.exit(1);
  }

  const resolvedConfig = path.resolve(process.cwd(), configPath);
  const resolvedServer = path.resolve(process.cwd(), serverPath);

  const module = await import(resolvedConfig);
  const config = module.default;
  if (!config || !config.evals) {
    throw new Error(
      "Eval config must export default EvalConfig with 'evals' array",
    );
  }

  const results = await runAllEvals(config, resolvedServer);
  for (const [name, result] of results.entries()) {
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error("Failed to run eval config:", error);
  process.exit(1);
});
