import { Command } from "commander";
import { runDiagnose } from "./orchestrator.js";
import { runCompare } from "./commands/compare.js";

const program = new Command();
program
  .name("insula-mcp")
  .description("brAInwav • Insula MCP — Diagnostic Meta-Inspector (stateless, plugin-based)")
  .version("0.1.0");

program
  .command("diagnose")
  .argument("<endpoint>", "MCP base URL (e.g., https://mcp.example.com)")
  .option("--full", "run full suite")
  .option("--auth <scheme:value>", "bearer:XYZ | basic:u:p | header:Name:Value")
  .option("--suites <csv>", "subset, e.g. streaming,governance,cors,ratelimit")
  .option("--simulate-external", "probe as if remote client")
  .option("--out <dir>", "output dir", "reports")
  .option("--file-plan", "emit unified diffs")
  .option("--a11y", "screen-reader friendly output")
  .option("--no-color", "disable ANSI colors")
  .option("--deterministic", "stable timestamps and seeds")
  .option("--otel-exporter <url>", "OTLP/HTTP endpoint")
  .option("--har", "capture redacted HAR on failures")
  .option("--compare <files...>", "diff two JSON findings")
  .option("--budget-time <ms>", "per-plugin time budget", (v) => Number.parseInt(v, 10), 5000)
  .option("--budget-mem <mb>", "per-plugin memory (old space) in MB", (v) => Number.parseInt(v, 10), 96)
  .action(async (endpoint, opts) => {
    if (Array.isArray(opts.compare) && opts.compare.length >= 2) {
      const code = await runCompare(opts.compare[0], opts.compare[1]);
      process.exitCode = code;
      return;
    }
    const code = await runDiagnose({ endpoint, opts });
    process.exitCode = code;
  });

program
  .command("doctor")
  .description("environment checks (Node/Playwright/MLX/Ollama/DNS/proxy)")
  .action(async () => {
    console.log("[brAInwav] Doctor: Node", process.version);
    // Extend: WSL, CA store, proxy, playwright deps, MLX/Ollama checks…
  });

program
  .command("compare")
  .argument("<old>", "old findings JSON")
  .argument("<new>", "new findings JSON")
  .description("show added/removed findings")
  .action(async (oldFile, newFile) => {
    const code = await runCompare(oldFile, newFile);
    process.exitCode = code;
  });

program.parseAsync().catch((e) => {
  console.error("[brAInwav] fatal:", e?.stack || String(e));
  process.exit(1);
});
