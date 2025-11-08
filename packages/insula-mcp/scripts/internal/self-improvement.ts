import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import process from "node:process";
import type {
  ChatMessage,
  DevelopmentContext,
  Finding,
  ProjectContext,
} from "../../src/types.js";
import { SelfImprovementPlugin } from "../../src/plugins/development/self-improvement.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(__filename), "..", "..");
const workspaceRoot = resolve(packageRoot, "..", "..");

type ProjectType = ProjectContext["type"];

interface CliOptions {
  endpoint: string;
  projectRoot: string;
  historyPath?: string;
  outPath?: string;
  projectType: ProjectType;
  language: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let endpoint = process.env.INSULA_INTERNAL_ENDPOINT ?? "http://127.0.0.1:5001";
  let projectRoot = "packages/insula-mcp";
  let historyPath: string | undefined = process.env.INSULA_HISTORY_PATH;
  let outPath: string | undefined;
  let projectType: ProjectType = "mcp-client";
  let language = "typescript";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--endpoint" && args[i + 1]) {
      endpoint = args[++i];
    } else if (arg === "--project" && args[i + 1]) {
      projectRoot = args[++i];
    } else if (arg === "--history" && args[i + 1]) {
      historyPath = args[++i];
    } else if (arg === "--out" && args[i + 1]) {
      outPath = args[++i];
    } else if (arg === "--type" && args[i + 1]) {
      const candidate = args[++i] as ProjectType;
      projectType = candidate;
    } else if (arg === "--language" && args[i + 1]) {
      language = args[++i];
    }
  }

  if (!endpoint) {
    throw new Error("Missing --endpoint");
  }

  return { endpoint, projectRoot, historyPath, outPath, projectType, language };
}

async function loadHistory(historyPath?: string): Promise<ChatMessage[]> {
  if (!historyPath) return [];
  const abs = resolve(workspaceRoot, historyPath);
  const raw = await readFile(abs, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry) => entry && typeof entry.content === "string")
    .map((entry) => ({
      role: entry.role ?? "user",
      content: entry.content,
      timestamp: entry.timestamp ?? Date.now(),
    }));
}

async function gatherSourceFiles(projectRoot: string): Promise<string[]> {
  try {
    const target = `${projectRoot}/src`;
    const { stdout } = await execFileAsync("git", ["ls-files", "--", target], {
      cwd: workspaceRoot,
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function buildProjectContext(options: CliOptions): Promise<ProjectContext> {
  const absProjectRoot = resolve(workspaceRoot, options.projectRoot);
  const pkgRaw = await readFile(resolve(absProjectRoot, "package.json"), "utf8");
  const pkg = JSON.parse(pkgRaw) as { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const dependencies = Object.keys(deps).sort();
  const configCandidates = ["pnpm-lock.yaml", "tsconfig.json", "tsconfig.base.json"];
  const configFiles = configCandidates.filter((file) => existsSync(resolve(workspaceRoot, file)));
  const sourceFiles = await gatherSourceFiles(options.projectRoot);

  return {
    name: pkg.name ?? options.projectRoot,
    type: options.projectType,
    language: options.language,
    dependencies,
    configFiles,
    sourceFiles,
  };
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

async function main(): Promise<void> {
  const options = parseArgs();
  const projectContext = await buildProjectContext(options);
  const history = await loadHistory(options.historyPath);

  const ctx: DevelopmentContext = {
    endpoint: options.endpoint,
    logger: (...args) => console.log("[self-improvement]", ...args),
    request: async (input, init) => {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return text.length ? JSON.parse(text) : {};
    },
    jsonrpc: async () => ({}) as unknown,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: true,
    sessionId: `self-improvement-${Date.now()}`,
    userExpertiseLevel: "expert",
    conversationHistory: history,
    projectContext,
  };

  const findings = await SelfImprovementPlugin.run(ctx);
  reportFindings(findings);

  if (options.outPath) {
    const outputPath = resolve(workspaceRoot, options.outPath);
    await writeFile(outputPath, JSON.stringify(findings, null, 2), "utf8");
    console.log(`\nSaved findings to ${outputPath}`);
  }
}

main().catch((error) => {
  console.error("Self-improvement runner failed:", error);
  process.exitCode = 1;
});
