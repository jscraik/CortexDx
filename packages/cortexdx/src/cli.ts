import { Command } from "commander";

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
  .option("--async", "execute as async task with polling (MCP draft spec)")
  .option("--task-ttl <ms>", "task time-to-live in milliseconds", "300000")
  .option("--poll-interval <ms>", "polling interval in milliseconds", "5000")
  .option("--auth <scheme:value>", "bearer:XYZ | basic:u:p | header:Name:Value")
  .option("--suites <csv>", "subset, e.g. streaming,governance,cors,ratelimit")
  .option("--simulate-external", "probe as if remote client")
  .option("--out <dir>", "output dir", "reports")
  .option("--report-out <dir>", "store consolidated reports via ReportManager")
  .option("--a11y", "screen-reader friendly output")
  .option("--no-color", "disable ANSI colors")
  .option("--deterministic", "stable timestamps and seeds")
  .option("--otel-exporter <url>", "OTLP/HTTP endpoint")
  .option("--har", "capture redacted HAR on failures")
  .option("--compare <files...>", "diff two JSON findings")
  .option("--auth0-domain <domain>", "Auth0 domain used for MCP protection")
  .option(
    "--auth0-client-id <id>",
    "Auth0 client id for client-credential flow",
  )
  .option(
    "--auth0-client-secret <secret>",
    "Auth0 client secret (use env var when possible)",
  )
  .option("--auth0-audience <audience>", "Auth0 audience/API identifier")
  .option("--auth0-scope <scope>", "Optional Auth0 scopes (space-delimited)")
  .option(
    "--auth0-device-code",
    "Use Auth0 device code flow instead of client credentials",
  )
  .option(
    "--auth0-device-code-endpoint <url>",
    "Override Auth0 device authorization endpoint",
  )
  .option("--mcp-api-key <key>", "MCP API key for dual authentication")
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
      const { runCompare } = await import("./commands/compare.js");
      const code = await runCompare(opts.compare[0], opts.compare[1]);
      process.exitCode = code;
      return;
    }
    const { runDiagnose } = await import("./orchestrator.js");
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
    const { runInteractiveMode } = await loadInteractiveCli();
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
        const { runGenerateTemplate } = await loadInteractiveCli();
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
        const { runGenerateConnector } = await loadInteractiveCli();
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
        const { runGenerateDocumentation } = await loadInteractiveCli();
        const code = await runGenerateDocumentation(target, source, opts);
        process.exitCode = code;
      }),
  );

program
  .command("library")
  .description("manage CortexDx knowledge artifacts")
  .addCommand(
    new Command("ingest-docs")
      .description("ingest normalized MCP docs snapshot into vector storage")
      .option("--version <version>", "snapshot version to ingest")
      .option(
        "--root <dir>",
        "library root directory",
        ".cortexdx/library/mcp-docs",
      )
      .option("--storage <file>", "vector storage persistence path")
      .option("--limit <count>", "limit number of chunks ingested")
      .option("--promoted", "read from promoted snapshots instead of _staging")
      .option("--dry-run", "simulate ingestion without storing vectors")
      .action(async (opts) => {
        const { runLibraryIngestCommand } = await import(
          "./commands/library.js"
        );
        const code = await runLibraryIngestCommand(opts);
        process.exitCode = code;
      }),
  );

program
  .command("orchestrate")
  .description("orchestrate plugins or LangGraph workflows")
  .argument("[endpoint]", "MCP base URL (required unless --list)")
  .option("--workflow <id>", "workflow identifier to execute")
  .option("--plugin <id>", "run a single plugin by id")
  .option("--parallel <csv>", "comma-delimited plugin ids to run in parallel")
  .option("--list", "list available workflows")
  .option("--json", "emit findings as JSON")
  .option("--deterministic", "enable deterministic seeds and timestamps")
  .option("--auth <scheme:value>", "bearer:XYZ | basic:u:p | header:Name:Value")
  .option("--auth0-domain <domain>", "Auth0 domain used for MCP protection")
  .option(
    "--auth0-client-id <id>",
    "Auth0 client id for client-credential flow",
  )
  .option(
    "--auth0-client-secret <secret>",
    "Auth0 client secret (use env var when possible)",
  )
  .option("--auth0-audience <audience>", "Auth0 audience/API identifier")
  .option("--auth0-scope <scope>", "Optional Auth0 scopes (space-delimited)")
  .option(
    "--auth0-device-code",
    "Use Auth0 device code flow instead of client credentials",
  )
  .option(
    "--auth0-device-code-endpoint <url>",
    "Override Auth0 device authorization endpoint",
  )
  .option("--mcp-api-key <key>", "MCP API key for dual authentication")
  .option("--state-db <path>", "SQLite path for checkpoint persistence")
  .option("--thread-id <id>", "override thread identifier for checkpointing")
  .option("--checkpoint-id <id>", "custom checkpoint id for the current run")
  .option("--resume-checkpoint <id>", "resume from a saved checkpoint id")
  .option(
    "--resume-thread <id>",
    "resume from the latest checkpoint for a thread id",
  )
  .option("--mode <diagnostic|development>", "execution mode", "diagnostic")
  .option(
    "--expertise <level>",
    "expertise level for development mode: beginner, intermediate, expert",
    "intermediate",
  )
  .option("--stream", "stream workflow events to stdout")
  .option(
    "--research",
    "run an academic research probe before orchestrating (default on)",
    true,
  )
  .option("--no-research", "skip the academic research probe")
  .option("--research-topic <text>", "topic to send to the academic providers")
  .option(
    "--research-question <text>",
    "question/abstract for contextual providers",
  )
  .option(
    "--research-providers <csv>",
    "subset of academic providers to include",
  )
  .option(
    "--research-limit <number>",
    "maximum findings per provider for the research probe",
  )
  .option(
    "--research-out <dir>",
    "write research artifacts before orchestration",
  )
  .option("--report-out <dir>", "store consolidated reports via ReportManager")
  .option(
    "--disable-sse",
    "skip SSE streaming probes (sets CORTEXDX_DISABLE_SSE=1 during the run)",
  )
  .option(
    "--sse-endpoint <url>",
    "override the SSE endpoint used by streaming probes (CORTEXDX_SSE_ENDPOINT)",
  )
  .action(async (endpoint, opts) => {
    const { runOrchestrate } = await import("./commands/orchestrate.js");
    const code = await runOrchestrate(endpoint ?? null, opts);
    process.exitCode = code;
  });

const deepContext = program
  .command("deepcontext")
  .description("invoke DeepContext (semantic code search) helpers");

deepContext
  .command("index")
  .argument("<codebase>", "absolute or relative path to the codebase root")
  .option("--force", "force a complete reindex")
  .action(async (codebase, opts) => {
    const { ensureWildcardApiKey, runDeepContextIndex } =
      await loadDeepContextCommands();
    ensureWildcardApiKey();
    const code = await runDeepContextIndex(codebase, opts);
    process.exitCode = code;
  });

deepContext
  .command("search")
  .argument("<codebase>", "path to indexed codebase")
  .argument("<query>", "natural language or keyword search query")
  .option("--max-results <number>", "override default result limit (5)")
  .action(async (codebase, query, opts) => {
    const { ensureWildcardApiKey, runDeepContextSearch } =
      await loadDeepContextCommands();
    ensureWildcardApiKey();
    const code = await runDeepContextSearch(codebase, query, opts);
    process.exitCode = code;
  });

deepContext
  .command("status")
  .argument("[codebase]", "optional codebase path")
  .action(async (codebase) => {
    const { ensureWildcardApiKey, runDeepContextStatus } =
      await loadDeepContextCommands();
    ensureWildcardApiKey();
    const code = await runDeepContextStatus(codebase);
    process.exitCode = code;
  });

deepContext
  .command("clear")
  .argument("[codebase]", "optional codebase path to clear")
  .action(async (codebase) => {
    const { ensureWildcardApiKey, runDeepContextClear } =
      await loadDeepContextCommands();
    ensureWildcardApiKey();
    const code = await runDeepContextClear(codebase);
    process.exitCode = code;
  });

program
  .command("research")
  .description("run academic provider sweep and capture evidence")
  .argument("<topic>", "research topic or keyword")
  .option("--question <text>", "optional research question/abstract")
  .option("--providers <csv>", "comma-delimited provider ids")
  .option("--limit <number>", "maximum results per provider")
  .option("--no-license", "skip license metadata in results")
  .option("--out <dir>", "write JSON/Markdown artifacts")
  .option("--deterministic", "stable timestamps and seeds")
  .option("--json", "emit full JSON report")
  .option(
    "--credential <provider:value>",
    "override provider credential",
    collectRepeatableOption,
    [],
  )
  .option(
    "--header <name:value>",
    "inject custom HTTP header",
    collectRepeatableOption,
    [],
  )
  .action(async (topic, opts) => {
      const { runResearch } = await import("./commands/research.js");
      const code = await runResearch(topic, opts);
    process.exitCode = code;
  });

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
    const { runStartDebugging } = await loadInteractiveCli();
    const code = await runStartDebugging(problem, opts);
    process.exitCode = code;
  });

program
  .command("sbom")
  .description("generate SBOM artifacts (CycloneDX/SPDX)")
  .option(
    "--manifest <path>",
    "path to manifest (package.json, requirements.txt, pom.xml)",
  )
  .option("--type <npm|pip|maven>", "override manifest type")
  .option("--format <cyclonedx|spdx>", "SBOM format", "cyclonedx")
  .option("--out <dir>", "output directory (default: reports/sbom)")
  .option("--include-dev", "include dev dependencies")
  .option("--no-licenses", "omit license metadata")
  .option("--hashes", "include component hashes")
  .option("--xml", "emit XML output alongside JSON")
  .option(
    "--dt-url <url>",
    "Dependency Track base URL (e.g., https://dt.example.com)",
  )
  .option("--dt-api-key <key>", "Dependency Track API key")
  .option("--dt-project <name>", "Dependency Track project name")
  .option("--dt-version <version>", "Dependency Track project version")
  .option(
    "--dt-subscribe",
    "Subscribe Dependency Track notifications to a webhook",
  )
  .option("--dt-webhook <url>", "Webhook URL for Dependency Track alerts")
  .action(async (opts) => {
    const { runGenerateSbom } = await import("./commands/sbom.js");
    const code = await runGenerateSbom({
      manifest: opts.manifest,
      type: opts.type,
      format: opts.format,
      out: opts.out,
      includeDev: Boolean(opts.includeDev),
      includeLicenses: opts.licenses !== false,
      includeHashes: Boolean(opts.hashes),
      xml: Boolean(opts.xml),
      dtUrl: opts.dtUrl,
      dtApiKey: opts.dtApiKey,
      dtProject: opts.dtProject,
      dtVersion: opts.dtVersion,
      dtSubscribe: Boolean(opts.dtSubscribe),
      dtWebhook: opts.dtWebhook,
    });
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
        const { runInterpretError } = await loadInteractiveCli();
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
        const { runExplainConcept } = await loadInteractiveCli();
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
    const { runBestPractices } = await loadInteractiveCli();
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
  .option(
    "--research",
    "enrich tutorial output with academic research (default on)",
    true,
  )
  .option("--no-research", "skip academic research and DeepContext lookups")
  .option(
    "--research-providers <csv>",
    "override providers for tutorial research",
  )
  .option(
    "--research-limit <number>",
    "max findings per provider used in tutorials",
  )
  .action(async (topic, opts) => {
    const { runCreateTutorial } = await loadInteractiveCli();
    const code = await runCreateTutorial(topic, opts);
    process.exitCode = code;
  });

program
  .command("doctor")
  .description("environment checks (Node/Playwright/Ollama/DNS/proxy)")
  .option("--providers <csv>", "limit provider readiness check to ids")
  .option("--skip-providers", "skip provider readiness check")
  .option(
    "--research",
    "run academic research probe before diagnostics (default on)",
    true,
  )
  .option("--no-research", "skip academic research probe")
  .option("--research-topic <text>", "topic for academic research probe")
  .option(
    "--research-question <text>",
    "question/abstract to pass to providers",
  )
  .option("--research-providers <csv>", "providers to use for research probe")
  .option("--research-limit <number>", "max findings per provider")
  .option("--research-out <dir>", "write research artifacts to directory")
  .option("--deterministic", "stable seeds for research probe")
  .option("--json", "emit JSON doctor report")
  .action(async (opts) => {
    const { runDoctor } = await import("./commands/doctor.js");
    const code = await runDoctor(opts);
    process.exitCode = code;
  });

program
  .command("compare")
  .argument("<old>", "old findings JSON")
  .argument("<new>", "new findings JSON")
  .description("show added/removed findings")
  .action(async (oldFile, newFile) => {
    const { runCompare } = await import("./commands/compare.js");
    const code = await runCompare(oldFile, newFile);
    process.exitCode = code;
  });

// Self-healing commands
program
  .command("self-diagnose")
  .description("run comprehensive self-diagnosis and auto-fixing")
  .option("--auto-fix", "automatically apply fixes for identified issues")
  .option("--dry-run", "show what would be fixed without making changes")
  .option(
    "--severity <level>",
    "minimum severity level to auto-fix (blocker,major,minor,info)",
    "major",
  )
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
  .option(
    "--auto-fix",
    "automatically apply fixes (default: false for external endpoints)",
  )
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
  .option(
    "--state-file <file>",
    "persist monitoring scheduler status to JSON file",
  )
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
      .option(
        "--area <type>",
        "filter by area (security,performance,protocol,development)",
      )
      .option(
        "--severity <level>",
        "filter by severity (blocker,major,minor,info)",
      )
      .action(async (opts) => {
        const { runTemplatesList } = await import("./commands/templates.js");
        const code = await runTemplatesList(opts);
        process.exitCode = code;
      }),
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
      }),
  )
  .addCommand(
    new Command("show")
      .description("show template details")
      .argument("<template-id>", "template identifier")
      .action(async (templateId) => {
        const { runTemplateShow } = await import("./commands/templates.js");
        const code = await runTemplateShow(templateId);
        process.exitCode = code;
      }),
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

async function loadInteractiveCli() {
  return import("./commands/interactive-cli.js");
}

async function loadDeepContextCommands() {
  return import("./commands/deepcontext.js");
}

function collectRepeatableOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

program.parseAsync().catch((e) => {
  console.error("[brAInwav] fatal:", e?.stack || String(e));
  process.exit(1);
});
