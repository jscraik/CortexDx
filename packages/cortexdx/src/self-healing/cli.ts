#!/usr/bin/env tsx
import path from "node:path";
import { getSelfHealingDefaultModel } from "./ollama-config.js";
import { parseCliOptions } from "./options.js";
import { executeSelfHealingRun } from "./run.js";

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const timestamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] || "";
  const outputDir = path.join(
    process.cwd(),
    "reports",
    "self-healing",
    timestamp,
  );

  const model = options.model ?? getSelfHealingDefaultModel();

  try {
    const result = await executeSelfHealingRun({
      outputDir,
      deterministic: options.deterministic,
      model,
      plugins: options.plugins,
      timestamp,
      dryRun: options.dryRun,
      endpoint: options.endpoint,
    });
    console.log(`Self-healing suite wrote artifacts to ${outputDir}`);
    console.log(`Summary: ${result.summaryPath}`);
    console.log(`Markdown: ${result.markdownPath}`);
  } catch (error) {
    console.error(
      "Self-healing suite failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(3);
  }
}

main();
