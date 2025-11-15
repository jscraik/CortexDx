import { safeParseJson } from "../utils/json.js";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ChatMessage,
  DevelopmentContext,
  Finding,
  ProjectContext,
} from "../types.js";
import { SelfImprovementPlugin } from "../plugins/development/self-improvement.js";
import { loadProjectContext } from "../context/project-context.js";
import {
  mergeHeaders,
  resolveInternalHeaders,
} from "../utils/internal-endpoint.js";

const DEFAULT_MEMORY_PATH = "/debug/memory";
const DEFAULT_MEMORY_THRESHOLD_MB = 512;

export interface SelfImprovementRunnerOptions {
  endpoint: string;
  projectRoot: string;
  workspaceRoot: string;
  projectType: ProjectContext["type"];
  language: string;
  historyPath?: string;
  outPath?: string;
  conversationHistory?: ChatMessage[];
  requireAcademicInsights?: boolean;
  memoryProbe?: MemoryProbeOptions;
}

export interface SelfImprovementRunnerResult {
  findings: Finding[];
  savedOutputPath?: string;
}

export interface MemoryProbeOptions {
  enabled?: boolean;
  path?: string;
  thresholdMb?: number;
}

export async function loadConversationHistory(
  workspaceRoot: string,
  historyPath?: string,
): Promise<ChatMessage[]> {
  if (!historyPath) return [];
  const absolutePath = resolve(workspaceRoot, historyPath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry) => entry && typeof entry.content === "string")
    .map((entry) => ({
      role: entry.role ?? "user",
      content: entry.content,
      timestamp: entry.timestamp ?? Date.now(),
    }));
}

export async function runSelfImprovementCli(
  options: SelfImprovementRunnerOptions,
): Promise<SelfImprovementRunnerResult> {
  const projectContext = await loadProjectContext({
    workspaceRoot: options.workspaceRoot,
    projectRoot: options.projectRoot,
    projectType: options.projectType,
    language: options.language,
  });

  if (!projectContext) {
    throw new Error(`Unable to load project context for ${options.projectRoot}`);
  }

  const history =
    options.conversationHistory ??
    (await loadConversationHistory(options.workspaceRoot, options.historyPath));
  const defaultHeaders = resolveInternalHeaders();

  const ctx: DevelopmentContext = {
    endpoint: options.endpoint,
    logger: (...args) => console.log("[self-improvement]", ...args),
    request: async (input, init) => {
      const mergedInit = mergeHeaders(init, defaultHeaders);
      const response = await fetch(input, mergedInit);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return text.length ? safeParseJson(text) : {};
    },
    jsonrpc: async () => ({}) as unknown,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: true,
    sessionId: `self-improvement-${Date.now()}`,
    userExpertiseLevel: "expert",
    conversationHistory: history,
    projectContext,
    headers: defaultHeaders,
    requireAcademicInsights: options.requireAcademicInsights ?? true,
    memoryCheck: resolveMemoryCheck(options.memoryProbe),
  };

  const findings = await SelfImprovementPlugin.run(ctx);

  let savedOutputPath: string | undefined;
  if (options.outPath) {
    const outputPath = resolve(options.workspaceRoot, options.outPath);
    await writeFile(outputPath, JSON.stringify(findings, null, 2), "utf8");
    savedOutputPath = outputPath;
  }

  return { findings, savedOutputPath };
}

function resolveMemoryCheck(
  probe?: MemoryProbeOptions,
): DevelopmentContext["memoryCheck"] {
  if (!probe || probe.enabled === false) {
    return undefined;
  }
  const path = probe.path && probe.path.length > 0 ? probe.path : DEFAULT_MEMORY_PATH;
  const threshold =
    probe.thresholdMb && probe.thresholdMb > 0
      ? probe.thresholdMb
      : DEFAULT_MEMORY_THRESHOLD_MB;
  return { path, thresholdMb: threshold };
}
