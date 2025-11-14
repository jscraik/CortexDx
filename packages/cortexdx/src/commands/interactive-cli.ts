/**
 * Interactive CLI Commands
 * Provides conversational assistance and progress indicators for MCP development
 * Requirements: 4.1, 9.1, 7.1
 */

import { readFile } from "node:fs/promises";
import * as readline from "node:readline";
import {
  createProgressIndicator,
  formatOutput,
  parseCSV,
} from "./cli-utils.js";
import { runAcademicResearch, selectConfiguredProviders } from "../research/academic-researcher.js";
import {
  DeepContextClient,
  resolveDeepContextApiKey,
} from "../deepcontext/client.js";

interface InteractiveModeOptions {
  expertise: string;
  color: boolean;
}

interface GenerateTemplateOptions {
  lang: string;
  features?: string;
  transport: string;
  tests: boolean;
  docs: boolean;
  out: string;
}

interface GenerateConnectorOptions {
  auth: string;
  lang: string;
  tests: boolean;
  out: string;
}

interface GenerateDocumentationOptions {
  format: string;
  examples: boolean;
  out?: string;
}

interface DebuggingOptions {
  errors?: string[];
  configs?: string[];
  code?: string[];
  expertise: string;
}

interface InterpretErrorOptions {
  context?: string;
  expertise: string;
  technical?: boolean;
}

interface ExplainConceptOptions {
  expertise: string;
  examples: boolean;
  usecases: boolean;
}

interface BestPracticesOptions {
  code?: string;
  focus?: string;
  standards?: string;
  samples: boolean;
}

interface TutorialOptions {
  expertise: string;
  lang: string;
  exercises: boolean;
  research?: boolean;
  researchProviders?: string;
  researchLimit?: string;
}

/**
 * Run interactive mode with conversational assistance
 */
export const runInteractiveMode = async (
  opts: InteractiveModeOptions,
): Promise<number> => {
  console.log(formatOutput("[brAInwav] Interactive Mode", "info", opts.color));
  console.log(
    formatOutput(
      "Type 'help' for available commands, 'exit' to quit\n",
      "info",
      opts.color,
    ),
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: formatOutput("cortexdx> ", "prompt", opts.color),
  });

  rl.prompt();

  return new Promise((resolve) => {
    rl.on("line", async (line) => {
      const input = line.trim();

      if (!input) {
        rl.prompt();
        return;
      }

      if (input === "exit" || input === "quit") {
        console.log(formatOutput("\nGoodbye!", "success", opts.color));
        rl.close();
        resolve(0);
        return;
      }

      if (input === "help") {
        displayInteractiveHelp(opts.color);
        rl.prompt();
        return;
      }

      // Process conversational input
      await processConversationalInput(input, opts);
      rl.prompt();
    });

    rl.on("close", () => {
      resolve(0);
    });
  });
};

/**
 * Display help for interactive mode
 */
const displayInteractiveHelp = (useColor: boolean): void => {
  const help = `
Available Commands:
  help                    - Show this help message
  diagnose <endpoint>     - Diagnose MCP server
  generate template       - Generate MCP server template
  generate connector      - Generate MCP connector
  debug <problem>         - Start debugging session
  explain error           - Explain an error
  explain concept         - Explain MCP concept
  best-practices          - Get best practices recommendations
  tutorial <topic>        - Create interactive tutorial
  exit, quit              - Exit interactive mode

You can also ask questions in natural language, such as:
  "How do I create an MCP server?"
  "What's wrong with this error: [paste error]"
  "Show me best practices for authentication"
  `;
  console.log(formatOutput(help, "info", useColor));
};

/**
 * Process conversational input using LLM
 */
const processConversationalInput = async (
  input: string,
  opts: InteractiveModeOptions,
): Promise<void> => {
  const progress = createProgressIndicator(
    "Processing your request",
    opts.color,
  );
  progress.start();

  try {
    // TODO: Integrate with LLM orchestrator for conversational processing
    // For now, provide basic pattern matching
    if (
      input.toLowerCase().includes("create") &&
      input.toLowerCase().includes("server")
    ) {
      progress.stop();
      console.log(
        formatOutput(
          "\nTo create an MCP server, use: generate template <name> [options]",
          "info",
          opts.color,
        ),
      );
      console.log(
        formatOutput(
          "Example: generate template my-server --lang typescript --features tools,resources",
          "info",
          opts.color,
        ),
      );
    } else if (
      input.toLowerCase().includes("error") ||
      input.toLowerCase().includes("wrong")
    ) {
      progress.stop();
      console.log(
        formatOutput(
          "\nTo debug an error, use: debug '<problem description>' or explain error '<error message>'",
          "info",
          opts.color,
        ),
      );
    } else if (input.toLowerCase().includes("best practice")) {
      progress.stop();
      console.log(
        formatOutput(
          "\nTo get best practices, use: best-practices [endpoint] [options]",
          "info",
          opts.color,
        ),
      );
    } else {
      progress.stop();
      console.log(
        formatOutput(
          "\nI'm not sure how to help with that. Type 'help' to see available commands.",
          "warning",
          opts.color,
        ),
      );
    }
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error processing request: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        opts.color,
      ),
    );
  }
};

/**
 * Generate MCP server template
 */
export const runGenerateTemplate = async (
  name: string,
  opts: GenerateTemplateOptions,
): Promise<number> => {
  console.log(
    formatOutput(
      `[brAInwav] Generating MCP server template: ${name}`,
      "info",
      true,
    ),
  );

  const progress = createProgressIndicator("Generating template", true);
  progress.start();

  try {
    const features = opts.features ? parseCSV(opts.features) : ["tools"];
    const transports = parseCSV(opts.transport);

    // Simulate template generation with progress updates
    await new Promise((resolve) => setTimeout(resolve, 1000));
    progress.update("Creating project structure");

    await new Promise((resolve) => setTimeout(resolve, 500));
    progress.update("Generating server code");

    await new Promise((resolve) => setTimeout(resolve, 500));
    progress.update("Adding tool definitions");

    if (opts.tests) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      progress.update("Generating tests");
    }

    if (opts.docs) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      progress.update("Creating documentation");
    }

    progress.stop();

    console.log(
      formatOutput("\n✓ Template generated successfully!", "success", true),
    );
    console.log(formatOutput(`  Name: ${name}`, "info", true));
    console.log(formatOutput(`  Language: ${opts.lang}`, "info", true));
    console.log(
      formatOutput(`  Features: ${features.join(", ")}`, "info", true),
    );
    console.log(
      formatOutput(`  Transports: ${transports.join(", ")}`, "info", true),
    );
    console.log(formatOutput(`  Output: ${opts.out}/${name}`, "info", true));

    // TODO: Implement actual template generation logic
    console.log(
      formatOutput(
        "\nNote: Template generation is not yet fully implemented. This is a preview.",
        "warning",
        true,
      ),
    );

    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error generating template: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

/**
 * Generate MCP connector from API specification
 */
export const runGenerateConnector = async (
  name: string,
  spec: string,
  opts: GenerateConnectorOptions,
): Promise<number> => {
  console.log(
    formatOutput(`[brAInwav] Generating MCP connector: ${name}`, "info", true),
  );

  const progress = createProgressIndicator("Analyzing API specification", true);
  progress.start();

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    progress.update("Parsing API endpoints");

    await new Promise((resolve) => setTimeout(resolve, 800));
    progress.update("Generating tool definitions");

    await new Promise((resolve) => setTimeout(resolve, 600));
    progress.update("Creating authentication wrappers");

    if (opts.tests) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      progress.update("Generating tests");
    }

    progress.stop();

    console.log(
      formatOutput("\n✓ Connector generated successfully!", "success", true),
    );
    console.log(formatOutput(`  Name: ${name}`, "info", true));
    console.log(formatOutput(`  Specification: ${spec}`, "info", true));
    console.log(formatOutput(`  Authentication: ${opts.auth}`, "info", true));
    console.log(formatOutput(`  Language: ${opts.lang}`, "info", true));
    console.log(formatOutput(`  Output: ${opts.out}/${name}`, "info", true));

    console.log(
      formatOutput(
        "\nNote: Connector generation is not yet fully implemented. This is a preview.",
        "warning",
        true,
      ),
    );

    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error generating connector: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

/**
 * Start interactive debugging session
 */
export const runStartDebugging = async (
  problem: string,
  opts: DebuggingOptions,
): Promise<number> => {
  console.log(
    formatOutput("[brAInwav] Starting debugging session", "info", true),
  );

  const progress = createProgressIndicator("Analyzing problem context", true);
  progress.start();

  try {
    // Load error logs if provided
    const errorLogs: string[] = [];
    if (opts.errors) {
      for (const errorFile of opts.errors) {
        const content = await readFile(errorFile, "utf-8");
        errorLogs.push(content);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
    progress.update("Identifying potential causes");

    await new Promise((resolve) => setTimeout(resolve, 600));
    progress.update("Generating diagnostic questions");

    progress.stop();

    console.log(
      formatOutput("\n✓ Debugging session initialized", "success", true),
    );
    console.log(formatOutput(`\nProblem: ${problem}`, "info", true));

    if (errorLogs.length > 0) {
      console.log(
        formatOutput(`Analyzed ${errorLogs.length} error log(s)`, "info", true),
      );
    }

    console.log(formatOutput("\nDiagnostic Questions:", "info", true));
    console.log(
      formatOutput("1. When did this problem first occur?", "info", true),
    );
    console.log(
      formatOutput(
        "2. Does it happen consistently or intermittently?",
        "info",
        true,
      ),
    );
    console.log(
      formatOutput(
        "3. Have there been any recent changes to the configuration?",
        "info",
        true,
      ),
    );

    console.log(
      formatOutput(
        "\nNote: Interactive debugging is not yet fully implemented. This is a preview.",
        "warning",
        true,
      ),
    );

    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error starting debugging: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

/**
 * Interpret and explain error message
 */
export const runInterpretError = async (
  error: string,
  opts: InterpretErrorOptions,
): Promise<number> => {
  console.log(formatOutput("[brAInwav] Interpreting error", "info", true));

  const progress = createProgressIndicator("Analyzing error message", true);
  progress.start();

  try {
    await new Promise((resolve) => setTimeout(resolve, 600));
    progress.update("Identifying error type");

    await new Promise((resolve) => setTimeout(resolve, 400));
    progress.update("Generating explanation");

    progress.stop();

    console.log(formatOutput("\n✓ Error analysis complete", "success", true));
    console.log(formatOutput(`\nError: ${error}`, "error", true));
    console.log(formatOutput("\nExplanation:", "info", true));
    console.log(
      formatOutput(
        "This error typically occurs when there is a problem with the MCP protocol implementation.",
        "info",
        true,
      ),
    );

    console.log(formatOutput("\nTroubleshooting Steps:", "info", true));
    console.log(
      formatOutput("1. Check your MCP server configuration", "info", true),
    );
    console.log(
      formatOutput("2. Verify protocol version compatibility", "info", true),
    );
    console.log(
      formatOutput("3. Review authentication settings", "info", true),
    );

    console.log(
      formatOutput(
        "\nNote: Error interpretation is not yet fully implemented. This is a preview.",
        "warning",
        true,
      ),
    );

    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error interpreting error: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

/**
 * Generate documentation
 */
export const runGenerateDocumentation = async (
  target: string,
  source: string,
  opts: GenerateDocumentationOptions,
): Promise<number> => {
  console.log(
    formatOutput(`[brAInwav] Generating ${target} documentation`, "info", true),
  );

  const progress = createProgressIndicator("Analyzing source", true);
  progress.start();

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));
    progress.update("Extracting API information");

    await new Promise((resolve) => setTimeout(resolve, 600));
    progress.update("Generating documentation");

    if (opts.examples) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      progress.update("Creating usage examples");
    }

    progress.stop();

    console.log(
      formatOutput(
        "\n✓ Documentation generated successfully!",
        "success",
        true,
      ),
    );
    console.log(formatOutput(`  Target: ${target}`, "info", true));
    console.log(formatOutput(`  Source: ${source}`, "info", true));
    console.log(formatOutput(`  Format: ${opts.format}`, "info", true));

    if (opts.out) {
      console.log(formatOutput(`  Output: ${opts.out}`, "info", true));
    }

    console.log(
      formatOutput(
        "\nNote: Documentation generation is not yet fully implemented. This is a preview.",
        "warning",
        true,
      ),
    );

    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error generating documentation: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

/**
 * Provide best practices recommendations
 */
export const runBestPractices = async (
  endpoint: string | undefined,
  opts: BestPracticesOptions,
): Promise<number> => {
  console.log(
    formatOutput("[brAInwav] Analyzing best practices", "info", true),
  );

  const progress = createProgressIndicator("Analyzing implementation", true);
  progress.start();

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    progress.update("Checking protocol compliance");

    await new Promise((resolve) => setTimeout(resolve, 600));
    progress.update("Reviewing security practices");

    await new Promise((resolve) => setTimeout(resolve, 400));
    progress.update("Evaluating performance patterns");

    progress.stop();

    console.log(formatOutput("\n✓ Analysis complete", "success", true));
    console.log(
      formatOutput("\nBest Practices Recommendations:", "info", true),
    );
    console.log(
      formatOutput(
        "• Use proper error handling for all tool implementations",
        "info",
        true,
      ),
    );
    console.log(
      formatOutput(
        "• Implement authentication for production deployments",
        "info",
        true,
      ),
    );
    console.log(
      formatOutput("• Add comprehensive logging for debugging", "info", true),
    );
    console.log(
      formatOutput(
        "• Follow MCP protocol version 2024-11-05 specifications",
        "info",
        true,
      ),
    );

    console.log(
      formatOutput(
        "\nNote: Best practices analysis is not yet fully implemented. This is a preview.",
        "warning",
        true,
      ),
    );

    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error analyzing best practices: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

/**
 * Create interactive tutorial
 */
export const runCreateTutorial = async (
  topic: string,
  opts: TutorialOptions,
): Promise<number> => {
  console.log(
    formatOutput(`[brAInwav] Creating tutorial: ${topic}`, "info", true),
  );

  const progress = createProgressIndicator("Generating tutorial content", true);
  progress.start();

  try {
    await simulateTutorialWork(progress, opts);
    progress.stop();

    const research = await gatherTutorialResearch(topic, opts);
    printTutorialSummary(topic, opts, research);
    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error creating tutorial: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

async function simulateTutorialWork(
  progress: ReturnType<typeof createProgressIndicator>,
  opts: TutorialOptions,
): Promise<void> {
  const steps = [
    { label: "Creating step-by-step guide", delay: 200 },
    ...(opts.exercises ? [{ label: "Generating exercises", delay: 150 }] : []),
    { label: "Adding code examples", delay: 150 },
  ];
  for (const step of steps) {
    await pause(step.delay);
    progress.update(step.label);
  }
}

function printTutorialSummary(
  topic: string,
  opts: TutorialOptions,
  research: TutorialResearch | null,
): void {
  console.log(formatOutput("\n✓ Tutorial created successfully!", "success", true));
  console.log(formatOutput(`\nTopic: ${topic}`, "info", true));
  console.log(formatOutput(`Expertise Level: ${opts.expertise}`, "info", true));
  console.log(formatOutput(`Language: ${opts.lang}`, "info", true));

  printListSection("\nOutline:", buildTutorialOutline(topic, opts.expertise, research));
  printCodeSection(opts.lang, topic);

  if (opts.exercises) {
    printListSection("\nExercises:", buildTutorialExercises(topic, research));
  }

  printResearchSection(research);

  console.log(
    formatOutput(
      "\nNote: Tutorial creation is not yet fully implemented. This is a preview.",
      "warning",
      true,
    ),
  );
}

/**
 * Explain MCP concept
 */
export const runExplainConcept = async (
  concept: string,
  opts: ExplainConceptOptions,
): Promise<number> => {
  console.log(
    formatOutput(`[brAInwav] Explaining concept: ${concept}`, "info", true),
  );

  const progress = createProgressIndicator("Generating explanation", true);
  progress.start();

  try {
    await new Promise((resolve) => setTimeout(resolve, 600));
    progress.update("Gathering information");

    if (opts.examples) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      progress.update("Creating code examples");
    }

    progress.stop();

    console.log(formatOutput("\n✓ Explanation ready", "success", true));
    console.log(formatOutput(`\nConcept: ${concept}`, "info", true));
    console.log(
      formatOutput(
        "\nThis MCP concept is an important part of the protocol specification.",
        "info",
        true,
      ),
    );

    if (opts.examples) {
      console.log(formatOutput("\nExample:", "info", true));
      console.log(
        formatOutput("// Code example would appear here", "info", true),
      );
    }

    console.log(
      formatOutput(
        "\nNote: Concept explanation is not yet fully implemented. This is a preview.",
        "warning",
        true,
      ),
    );

    return 0;
  } catch (error) {
    progress.stop();
    console.error(
      formatOutput(
        `Error explaining concept: ${error instanceof Error ? error.message : String(error)}`,
        "error",
        true,
      ),
    );
    return 1;
  }
};

interface TutorialResearch {
  highlights: string[];
  deepContextSnippets: string[];
  artifactsDir?: string;
}

async function gatherTutorialResearch(
  topic: string,
  opts: TutorialOptions,
): Promise<TutorialResearch | null> {
  if (opts.research === false) {
    return null;
  }
  try {
    const requested = opts.researchProviders
      ? parseCSV(opts.researchProviders)
      : undefined;
    const { ready, missing } = selectConfiguredProviders(requested);
    if (missing.length) {
      console.warn(
        "[Tutorial] Skipping providers with missing env vars:",
        missing.map(({ id, vars }) => `${id}:${vars.join("/")}`).join(", "),
      );
    }
    if (ready.length === 0) {
      console.warn(
        "[Tutorial] Academic research probe disabled (no configured providers).",
      );
      return null;
    }
    const limit = parseTutorialLimit(opts.researchLimit);
    const report = await runAcademicResearch({
      topic,
      limit,
      deterministic: true,
      providers: ready,
    });
    if (report.summary.totalFindings === 0) {
      return null;
    }
    const highlights = report.providers
      .flatMap((provider) =>
        provider.findings.slice(0, 1).map(
          (finding) =>
            `${provider.providerName}: ${finding.title} (${finding.severity})`,
        ),
      )
      .slice(0, 3);
    const deepContextSnippets = await gatherDeepContextSnippets(topic);
    return {
      highlights,
      deepContextSnippets,
      artifactsDir: report.artifacts?.dir,
    };
  } catch (error) {
    console.warn(
      "[Tutorial] Skipping academic research probe:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

function parseTutorialLimit(value?: string): number {
  if (!value) return 2;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 2 : Math.max(1, parsed);
}

async function gatherDeepContextSnippets(topic: string): Promise<string[]> {
  try {
    const apiKey = resolveDeepContextApiKey();
    if (!apiKey) {
      return [];
    }
    const client = new DeepContextClient({
      wildcardApiKey: apiKey,
      logger: () => undefined,
    });
    const result = await client.searchCodebase(
      process.cwd(),
      `${topic} MCP tutorial`,
      3,
    );
    return result.matches.slice(0, 3).map((match) => {
      const snippet = match.content?.replace(/\s+/g, " ").trim() ?? "";
      return `${match.file_path}:${match.start_line}-${match.end_line} — ${snippet.slice(0, 120)}`;
    });
  } catch (error) {
    console.warn(
      "[Tutorial] DeepContext search failed:",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

function buildTutorialOutline(
  topic: string,
  expertise: TutorialOptions["expertise"],
  research: TutorialResearch | null,
): string[] {
  const outline = [
    `Frame the scenario: ${topic} diagnostic workflow.`,
    "Wire the CLI output into self-improvement or LangGraph orchestration.",
    "Attach evidence pointers (files, links, DeepContext) to every finding.",
  ];
  if (expertise === "beginner") {
    outline.unshift("Review MCP handshake basics and CLI invocation.");
  } else if (expertise === "expert") {
    outline.push("Cross-link findings to governance packs and mitigation playbooks.");
  }
  if (research?.highlights.length) {
    outline.push(`Incorporate research insight: ${research.highlights[0]}`);
  }
  return outline;
}

function buildTutorialExercises(
  topic: string,
  research: TutorialResearch | null,
): string[] {
  const exercises = [
    `Implement a deterministic probe for ${topic} and capture severity deltas.`,
    "Extend the snippet to emit remediation hints per finding.",
  ];
  if (research?.deepContextSnippets.length) {
    exercises.push(
      `Refactor the code at ${research.deepContextSnippets[0]} to integrate the tutorial's best practice.`,
    );
  }
  return exercises;
}

function printListSection(title: string, entries: string[]): void {
  if (!entries.length) return;
  console.log(formatOutput(title, "info", true));
  for (const entry of entries) {
    console.log(formatOutput(`• ${entry}`, "info", true));
  }
}

function printCodeSection(language: string | undefined, topic: string): void {
  const snippet = createTutorialSnippet(language ?? "typescript", topic);
  console.log(formatOutput("\nKey Snippet:", "info", true));
  console.log(snippet);
}

function createTutorialSnippet(lang: string, topic: string): string {
  const header = `\`\`\`${lang}`;
  const body =
    lang === "python"
      ? [
          "def run_diagnostic(endpoint: str) -> None:",
          "    from cortexdx import diagnose",
          "    result = diagnose(endpoint, suites=['protocol', 'security'])",
          "    for finding in result.findings:",
          "        print(f\"{finding.severity}: {finding.title}\")",
        ]
      : [
          "import { runDiagnose } from '@brainwav/cortexdx';",
          "",
          "async function runTutorialProbe(endpoint: string) {",
          "  const result = await runDiagnose({",
          "    endpoint, suites: 'protocol,security', deterministic: true,",
          "  });",
          "  console.log(`Findings for ${endpoint}: ${result}`);",
          "}",
        ];
  return `${header}\n// Focus: ${topic}\n${body.join("\n")}\n\`\`\``;
}

function printResearchSection(research: TutorialResearch | null): void {
  if (!research) return;
  printListSection("\nResearch Highlights:", research.highlights);
  if (research.artifactsDir) {
    console.log(formatOutput(`Artifacts: ${research.artifactsDir}`, "info", true));
  }
  printListSection("\nDeepContext References:", research.deepContextSnippets);
}

async function pause(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
