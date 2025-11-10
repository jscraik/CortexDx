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
  .name("cortexdx")
  .description(
    "brAInwav • CortexDx — Diagnostic Meta-Inspector (stateless, plugin-based)",
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

// Self-healing commands
program
  .command("self-diagnose")
  .description("run comprehensive self-diagnosis and auto-fixing")
  .option("--auto-fix", "automatically apply fixes for identified issues")
  .option("--dry-run", "show what would be fixed without making changes")
  .option("--severity <level>", "minimum severity level to auto-fix (blocker,major,minor,info)", "major")
  .option("--no-backup", "skip creating backups before applying fixes")
  .option("--validate", "run post-fix validation to verify fixes")
  .option("--out <file>", "save report to JSON file")
  .action(async (opts) => {
    const { runSelfDiagnose } = await import("./commands/self-healing.js");
    const code = await runSelfDiagnose(opts);
    process.exitCode = code;
  });

program
  .command("heal")
  .description("diagnose and attempt to fix issues with an MCP endpoint")
  .argument("<endpoint>", "MCP endpoint URL to diagnose and heal")
  .option("--auto-fix", "automatically apply fixes (default: false for external endpoints)")
  .option("--dry-run", "show what would be fixed without making changes")
  .option("--severity <level>", "minimum severity level to auto-fix", "major")
  .option("--probes <list>", "comma-separated list of probes to run", "all")
  .option("--webhook <url>", "send results to webhook URL")
  .option("--out <file>", "save report to JSON file")
  .action(async (endpoint, opts) => {
    const { runHealEndpoint } = await import("./commands/self-healing.js");
    const code = await runHealEndpoint(endpoint, opts);
    process.exitCode = code;
  });

program
  .command("monitor")
  .description("start background monitoring with auto-healing")
  .option("--start", "start the monitoring scheduler")
  .option("--stop", "stop the monitoring scheduler")
  .option("--status", "show monitoring status")
  .option("--interval <seconds>", "check interval in seconds", "300")
  .option("--auto-heal", "enable automatic healing for issues")
  .option("--webhook <url>", "send notifications to webhook URL")
  .option("--config <file>", "load monitoring configuration from file")
  .option("--export <file>", "export current configuration to file")
  .action(async (opts) => {
    const { runMonitoring } = await import("./commands/self-healing.js");
    const code = await runMonitoring(opts);
    process.exitCode = code;
  });

program
  .command("templates")
  .description("manage fix templates")
  .addCommand(
    new Command("list")
      .description("list available fix templates")
      .option("--area <type>", "filter by area (security,performance,protocol,development)")
      .option("--severity <level>", "filter by severity (blocker,major,minor,info)")
      .action(async (opts) => {
        const { runTemplatesList } = await import("./commands/templates.js");
        const code = await runTemplatesList(opts);
        process.exitCode = code;
      })
  )
  .addCommand(
    new Command("apply")
      .description("apply a fix template")
      .argument("<template-id>", "template identifier")
      .option("--dry-run", "show what would be changed without applying")
      .option("--no-backup", "skip creating backups")
      .option("--validate", "run validation after applying")
      .action(async (templateId, opts) => {
        const { runTemplateApply } = await import("./commands/templates.js");
        const code = await runTemplateApply(templateId, opts);
        process.exitCode = code;
      })
  )
  .addCommand(
    new Command("show")
      .description("show template details")
      .argument("<template-id>", "template identifier")
      .action(async (templateId) => {
        const { runTemplateShow } = await import("./commands/templates.js");
        const code = await runTemplateShow(templateId);
        process.exitCode = code;
      })
  );

program
  .command("health")
  .description("quick health check")
  .option("--endpoint <url>", "check specific endpoint (default: self)")
  .option("--webhook <url>", "send health status to webhook")
  .option("--json", "output in JSON format")
  .action(async (opts) => {
    const { runHealthCheck } = await import("./commands/health.js");
    const code = await runHealthCheck(opts);
    process.exitCode = code;
  });

program.parseAsync().catch((e) => {
  console.error("[brAInwav] fatal:", e?.stack || String(e));
  process.exit(1);
});
