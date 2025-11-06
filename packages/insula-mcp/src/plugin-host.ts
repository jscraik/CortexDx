import { Worker } from "node:worker_threads";
import { httpAdapter } from "./adapters/http.js";
import { jsonRpcClient } from "./adapters/jsonrpc.js";
import { sseProbe } from "./adapters/sse.js";
import { BUILTIN_PLUGINS, DEVELOPMENT_PLUGINS, getPluginById } from "./plugins/index.js";
import type { ConversationalPlugin, DevelopmentContext, DevelopmentPlugin, DiagnosticContext, DiagnosticPlugin, EvidencePointer, Finding } from "./types.js";

export interface SandboxBudgets {
  timeMs: number;
  memMb: number;
}

export async function runPlugins({
  endpoint,
  suites,
  full,
  deterministic,
  budgets
}: {
  endpoint: string;
  suites: string[];
  full: boolean;
  deterministic: boolean;
  budgets: SandboxBudgets;
}): Promise<{ findings: Finding[] }> {
  const plugins = pickPlugins(suites, full);
  const findings: Finding[] = [];
  const fallbackCtx = createFallbackCtx(endpoint, deterministic);

  for (const plugin of plugins) {
    try {
      const results = await runWithSandbox(plugin.id, endpoint, deterministic, budgets, fallbackCtx);
      findings.push(...results);
    } catch (error) {
      findings.push({
        id: `plugin.${plugin.id}.error`,
        area: "framework",
        severity: "major",
        title: `Plugin failed: ${plugin.title}`,
        description: String(error),
        evidence: [{ type: "log", ref: `plugin:${plugin.id}` }]
      });
    }
  }
  return { findings };
}

export async function runDevelopmentPlugins({
  endpoint,
  suites,
  full,
  deterministic,
  budgets,
  developmentContext
}: {
  endpoint: string;
  suites: string[];
  full: boolean;
  deterministic: boolean;
  budgets: SandboxBudgets;
  developmentContext: DevelopmentContext;
}): Promise<{ findings: Finding[] }> {
  const plugins = pickDevelopmentPlugins(suites, full);
  const findings: Finding[] = [];

  for (const plugin of plugins) {
    try {
      const results = await runDevelopmentPlugin(plugin, developmentContext, budgets);
      findings.push(...results);
    } catch (error) {
      findings.push({
        id: `dev-plugin.${plugin.id}.error`,
        area: "development",
        severity: "major",
        title: `Development plugin failed: ${plugin.title}`,
        description: String(error),
        evidence: [{ type: "log", ref: `dev-plugin:${plugin.id}` }]
      });
    }
  }
  return { findings };
}

function pickPlugins(suites: string[], full: boolean): DiagnosticPlugin[] {
  if (full) return [...BUILTIN_PLUGINS];
  if (suites.length === 0) {
    return BUILTIN_PLUGINS.filter((p) => ["devtool", "discovery", "protocol", "streaming"].includes(p.id));
  }
  const wanted = new Set(suites);
  return BUILTIN_PLUGINS.filter((p) => wanted.has(p.id));
}

function pickDevelopmentPlugins(suites: string[], full: boolean): DevelopmentPlugin[] {
  if (full) return [...DEVELOPMENT_PLUGINS];
  if (suites.length === 0) {
    return DEVELOPMENT_PLUGINS.filter((p) => ["conversational", "code-generation", "license-validation"].includes(p.id));
  }
  const wanted = new Set(suites);
  return DEVELOPMENT_PLUGINS.filter((p) => wanted.has(p.id));
}

function createFallbackCtx(endpoint: string, deterministic: boolean): DiagnosticContext {
  return {
    endpoint,
    logger: (...args: unknown[]) => console.log("[brAInwav]", ...args),
    request: httpAdapter,
    jsonrpc: jsonRpcClient(endpoint),
    sseProbe: (url: string, opts?: unknown) => sseProbe(url, opts as { timeoutMs?: number }),
    evidence: (ev: EvidencePointer) => console.log("[evidence]", ev),
    deterministic
  };
}

async function runWithSandbox(
  pluginId: string,
  endpoint: string,
  deterministic: boolean,
  budgets: SandboxBudgets,
  fallbackCtx: ReturnType<typeof createFallbackCtx>
): Promise<Finding[]> {
  const workerUrl = new URL("./workers/sandbox.js", import.meta.url);
  try {
    return await launchWorker(pluginId, endpoint, deterministic, budgets, workerUrl);
  } catch (error) {
    console.warn("[brAInwav] Sandbox boot failed; running in-process:", error);
    const plugin = getPluginById(pluginId);
    if (!plugin) throw new Error(`Unknown plugin: ${pluginId}`);
    return await plugin.run(fallbackCtx);
  }
}

function launchWorker(
  pluginId: string,
  endpoint: string,
  deterministic: boolean,
  budgets: SandboxBudgets,
  workerUrl: URL
): Promise<Finding[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: { pluginId, ctxInit: { endpoint, deterministic } },
      resourceLimits: { maxOldGenerationSizeMb: Math.max(32, Math.floor(budgets.memMb)) }
    });

    const state: { settled: boolean; findings: Finding[] } = { settled: false, findings: [] };
    const finish = (error?: Error) => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(state.findings);
    };

    const timer = setTimeout(() => {
      worker
        .terminate()
        .then(() => finish(new Error(`sandbox timeout for plugin ${pluginId} after ${budgets.timeMs}ms`)))
        .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
    }, Math.max(100, budgets.timeMs));

    worker.on("message", (msg) => handleWorkerMessage(msg, state, worker, finish));
    worker.on("error", (err) => finish(err as Error));
    worker.on("exit", (code) => {
      if (code === 0) finish();
      else finish(new Error(`sandbox exited with code ${code}`));
    });
  });
}

type WorkerMessage =
  | { type: "evidence"; ev: unknown }
  | { type: "log"; args?: unknown[] }
  | { type: "result"; findings?: Finding[] }
  | { type: "error"; error: unknown };

function handleWorkerMessage(
  raw: unknown,
  state: { settled: boolean; findings: Finding[] },
  worker: Worker,
  finish: (error?: Error) => void
) {
  if (!isWorkerMessage(raw)) return;
  const msg = raw;
  if (msg?.type === "evidence") {
    console.log("[evidence]", msg.ev);
    return;
  }
  if (msg?.type === "log") {
    console.log("[brAInwav]", ...(msg.args ?? []));
    return;
  }
  if (msg?.type === "result") {
    state.findings = msg.findings ?? [];
    return;
  }
  if (msg?.type === "error") {
    worker
      .terminate()
      .then(() => finish(new Error(String(msg.error))))
      .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
  }
}

function isWorkerMessage(value: unknown): value is WorkerMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { type?: unknown };
  return (
    candidate.type === "evidence" ||
    candidate.type === "log" ||
    candidate.type === "result" ||
    candidate.type === "error"
  );
}
async function runDevelopmentPlugin(
  plugin: DevelopmentPlugin,
  ctx: DevelopmentContext,
  budgets: SandboxBudgets
): Promise<Finding[]> {
  // For development plugins, we run them directly without sandbox for now
  // In production, we'd want to sandbox these as well
  try {
    return await plugin.run(ctx);
  } catch (error) {
    throw new Error(`Development plugin ${plugin.id} failed: ${error}`);
  }
}

export function getAllDevelopmentPlugins(): DevelopmentPlugin[] {
  return [...DEVELOPMENT_PLUGINS];
}

export function getDevelopmentPluginsByCategory(category: "diagnostic" | "development" | "conversational"): DevelopmentPlugin[] {
  return DEVELOPMENT_PLUGINS.filter(p => p.category === category);
}

export function getConversationalPlugins(): ConversationalPlugin[] {
  return DEVELOPMENT_PLUGINS.filter(p => p.category === "conversational") as ConversationalPlugin[];
}