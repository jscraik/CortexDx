import { Command } from "commander";
import { runCompare } from "./commands/compare.js";
import {
  runBestPractices,
  runCreateTutorial,
  runExplainConcept,
  runGenerateConnector,
  runGenerateDocumentation,
  runGenerateTemplate,
  runInteractiveMode,
  runInterpretError,
  runStartDebugging,
} from "./commands/interactive-cli.js";
import { runDiagnose } from "./orchestrator.js";

const program = new Command();
program
  .name("insula-mcp")
  .description(
    "brAInwav • Insula MCP — Diagnostic Meta-Inspector (stateless, plugin-based)",
  )
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
  .option(
    "--budget-time <ms>",
    "per-plugin time budget",
    (v) => Number.parseInt(v, 10),
    5000,
  )
  .option(
    "--budget-mem <mb>",
    "per-plugin memory (old space) in MB",
    (v) => Number.parseInt(v, 10),
    96,
  )
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
  .command("interactive")
  .alias("i")
  .description("start interactive mode with conversational assistance")
  .option(
    "--expertise <level>",
    "expertise level: beginner, intermediate, expert",
    "intermediate",
  )
  .option("--no-color", "disable ANSI colors")
  .action(async (opts) => {
    const code = await runInteractiveMode(opts);
    process.exitCode = code;
  });

program
  .command("generate")
  .description("code generation commands")
  .addCommand(
    new Command("template")
      .description("generate MCP server template")
      .argument("<name>", "server name")
      .option(
        "--lang <language>",
        "programming language (typescript, javascript, python, go)",
        "typescript",
      )
      .option(
        "--features <csv>",
        "features: tools, resources, prompts, authentication, streaming",
      )
      .option(
        "--transport <csv>",
        "transport protocols: http, sse, websocket, stdio",
        "http",
      )
      .option("--no-tests", "skip test generation")
      .option("--no-docs", "skip documentation generation")
      .option("--out <dir>", "output directory", ".")
      .action(async (name, opts) => {
        const code = await runGenerateTemplate(name, opts);
        process.exitCode = code;
      }),
  )
  .addCommand(
    new Command("connector")
      .description("generate MCP connector from API specification")
      .argument("<name>", "connector name")
      .argument(
        "<spec>",
        "API specification (OpenAPI/Swagger URL or file path)",
      )
      .option(
        "--auth <type>",
        "authentication type: none, api-key, oauth2, bearer, basic",
        "none",
      )
      .option(
        "--lang <language>",
        "programming language (typescript, javascript, python)",
        "typescript",
      )
      .option("--no-tests", "skip test generation")
      .option("--out <dir>", "output directory", ".")
      .action(async (name, spec, opts) => {
        const code = await runGenerateConnector(name, spec, opts);
        process.exitCode = code;
      }),
  )
  .addCommand(
    new Command("docs")
      .description("generate documentation for MCP implementation")
      .argument(
        "<target>",
        "documentation target: server, connector, tool, api, deployment",
      )
      .argument("<source>", "source code path or MCP endpoint")
      .option(
        "--format <fmt>",
        "output format: markdown, html, pdf",
        "markdown",
      )
      .option("--no-examples", "skip usage examples")
      .option("--out <file>", "output file path")
      .action(async (target, source, opts) => {
        const code = await runGenerateDocumentation(target, source, opts);
        process.exitCode = code;
      }),
  );

program
  .command("debug")
  .description("start interactive debugging session")
  .argument("<problem>", "problem description or error message")
  .option("--errors <files...>", "error log files to analyze")
  .option("--configs <files...>", "configuration files for context")
  .option("--code <files...>", "relevant code files")
  .option(
    "--expertise <level>",
    "expertise level: beginner, intermediate, expert",
    "intermediate",
  )
  .action(async (problem, opts) => {
    const code = await runStartDebugging(problem, opts);
    process.exitCode = code;
  });

program
  .command("explain")
  .description("explain errors or MCP concepts")
  .addCommand(
    new Command("error")
      .description("interpret and explain an error message")
      .argument("<error>", "error message or stack trace")
      .option("--context <file>", "context file (JSON/YAML)")
      .option(
        "--expertise <level>",
        "expertise level: beginner, intermediate, expert",
        "intermediate",
      )
      .option("--technical", "include technical details")
      .action(async (error, opts) => {
        const code = await runInterpretError(error, opts);
        process.exitCode = code;
      }),
  )
  .addCommand(
    new Command("concept")
      .description("explain MCP concept or pattern")
      .argument(
        "<concept>",
        "concept to explain (e.g., tools, resources, prompts)",
      )
      .option(
        "--expertise <level>",
        "expertise level: beginner, intermediate, expert",
        "intermediate",
      )
      .option("--no-examples", "skip code examples")
      .option("--no-usecases", "skip use case examples")
      .action(async (concept, opts) => {
        const code = await runExplainConcept(concept, opts);
        process.exitCode = code;
      }),
  );

program
  .command("best-practices")
  .alias("bp")
  .description(
    "analyze implementation and provide best practices recommendations",
  )
  .argument("[endpoint]", "MCP server endpoint to analyze")
  .option("--code <path>", "codebase path to analyze")
  .option(
    "--focus <csv>",
    "focus areas: protocol, security, performance, maintainability, testing, documentation",
  )
  .option("--standards <file>", "organization standards file (JSON)")
  .option("--no-samples", "skip code samples")
  .action(async (endpoint, opts) => {
    const code = await runBestPractices(endpoint, opts);
    process.exitCode = code;
  });

program
  .command("tutorial")
  .description("create interactive tutorial for MCP development")
  .argument("<topic>", "tutorial topic (e.g., 'creating first MCP server')")
  .option(
    "--expertise <level>",
    "expertise level: beginner, intermediate, expert",
    "beginner",
  )
  .option(
    "--lang <language>",
    "programming language (typescript, javascript, python, go)",
    "typescript",
  )
  .option("--no-exercises", "skip hands-on exercises")
  .action(async (topic, opts) => {
    const code = await runCreateTutorial(topic, opts);
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
