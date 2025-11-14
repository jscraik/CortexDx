import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import type { Finding, ProjectContext } from "../../src/types.js";
import {
  runSelfImprovementCli,
  type SelfImprovementRunnerOptions,
} from "../../src/self-improvement/runner.js";

const __filename = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(__filename), "..", "..");
const workspaceRoot = resolve(packageRoot, "..", "..");

type ProjectType = ProjectContext["type"];

const DEFAULT_MEMORY_PATH = "/debug/memory";
const DEFAULT_MEMORY_THRESHOLD_MB = 512;

interface CliOptions {
  endpoint: string;
  projectRoot: string;
  historyPath?: string;
  outPath?: string;
  projectType: ProjectType;
  language: string;
  requireAcademicInsights: boolean;
  memoryCheckEnabled: boolean;
  memoryCheckPath: string;
  memoryThresholdMb: number;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const state = initializeCliState();
  for (let i = 0; i < args.length; i += 1) {
    i = applyArg(args, i, state);
  }
  if (!state.endpoint) {
    throw new Error("Missing --endpoint");
  }
  return state;
}

function initializeCliState(): CliOptions {
  const threshold = normalizeThreshold(
    process.env.CORTEXDX_MEMORY_THRESHOLD_MB,
    DEFAULT_MEMORY_THRESHOLD_MB,
  );
  return {
    endpoint: process.env.CORTEXDX_INTERNAL_ENDPOINT ?? "http://127.0.0.1:5001",
    projectRoot: "packages/cortexdx",
    historyPath: process.env.CORTEXDX_HISTORY_PATH,
    outPath: undefined,
    projectType: "mcp-client",
    language: "typescript",
    requireAcademicInsights: process.env.CORTEXDX_REQUIRE_ACADEMIC === "0" ? false : true,
    memoryCheckEnabled: process.env.CORTEXDX_DISABLE_MEMORY_CHECK === "1" ? false : true,
    memoryCheckPath: process.env.CORTEXDX_MEMORY_PATH ?? DEFAULT_MEMORY_PATH,
    memoryThresholdMb: threshold,
  };
}

function applyArg(args: string[], index: number, state: CliOptions): number {
  const arg = args[index];
  switch (arg) {
    case "--endpoint":
      return consumeValue(args, index, (value) => {
        state.endpoint = value;
      });
    case "--project":
      return consumeValue(args, index, (value) => {
        state.projectRoot = value;
      });
    case "--history":
      return consumeValue(args, index, (value) => {
        state.historyPath = value;
      });
    case "--out":
      return consumeValue(args, index, (value) => {
        state.outPath = value;
      });
    case "--type":
      return consumeValue(args, index, (value) => {
        state.projectType = value as ProjectType;
      });
    case "--language":
      return consumeValue(args, index, (value) => {
        state.language = value;
      });
    case "--require-academic":
      state.requireAcademicInsights = true;
      return index;
    case "--allow-missing-academic":
      state.requireAcademicInsights = false;
      return index;
    case "--disable-memory-check":
      state.memoryCheckEnabled = false;
      return index;
    case "--enable-memory-check":
      state.memoryCheckEnabled = true;
      return index;
    case "--memory-path":
      return consumeValue(args, index, (value) => {
        state.memoryCheckPath = value;
      });
    case "--memory-threshold":
      return consumeValue(args, index, (value) => {
        state.memoryThresholdMb = normalizeThreshold(value, state.memoryThresholdMb);
      });
    default:
      return index;
  }
}

function consumeValue(
  args: string[],
  index: number,
  updater: (value: string) => void,
): number {
  const next = args[index + 1];
  if (next) {
    updater(next);
    return index + 1;
  }
  return index;
}

function normalizeThreshold(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function reportFindings(findings: Finding[]): void {
  if (findings.length === 0) {
    console.log("No findings produced by self-improvement plugin.");
    return;
  }
  console.log("\nSelf-Improvement Findings:\n");
  for (const finding of findings) {
    const severity = finding.severity?.toUpperCase() ?? "INFO";
    console.log(`- [${severity}] ${finding.title} (${finding.id})`);
    if (finding.description) {
      console.log(`  ${finding.description}`);
    }
  }
}

function buildRunnerOptions(options: CliOptions): SelfImprovementRunnerOptions {
  return {
    endpoint: options.endpoint,
    projectRoot: options.projectRoot,
    workspaceRoot,
    projectType: options.projectType,
    language: options.language,
    historyPath: options.historyPath,
    outPath: options.outPath,
    requireAcademicInsights: options.requireAcademicInsights,
    memoryProbe: {
      enabled: options.memoryCheckEnabled,
      path: options.memoryCheckPath,
      thresholdMb: options.memoryThresholdMb,
    },
  };
}

async function main(): Promise<void> {
  const options = parseArgs();
  process.env.CORTEXDX_INTERNAL_ENDPOINT = options.endpoint;
  const result = await runSelfImprovementCli(buildRunnerOptions(options));
  reportFindings(result.findings);

  if (result.savedOutputPath) {
    console.log(`\nSaved findings to ${result.savedOutputPath}`);
  }
}

if (process.env.VITEST !== "true") {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Self-improvement runner failed:", error);
      process.exit(1);
    });
}

export { parseArgs, reportFindings };
