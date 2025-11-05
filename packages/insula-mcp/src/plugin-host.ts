import { Worker } from "node:worker_threads";
import type { DiagnosticPlugin, Finding } from "./types.js";
import { BUILTIN_PLUGINS, getPluginById } from "./plugins/index.js";
import { httpAdapter } from "./adapters/http.js";
import { jsonRpcClient } from "./adapters/jsonrpc.js";
import { sseProbe } from "./adapters/sse.js";

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

function pickPlugins(suites: string[], full: boolean): DiagnosticPlugin[] {
  if (full) return [...BUILTIN_PLUGINS];
  if (suites.length === 0) {
    return BUILTIN_PLUGINS.filter((p) => ["devtool", "discovery", "protocol", "streaming"].includes(p.id));
  }
  const wanted = new Set(suites);
  return BUILTIN_PLUGINS.filter((p) => wanted.has(p.id));
}

function createFallbackCtx(endpoint: string, deterministic: boolean) {
  return {
    endpoint,
    logger: (...args: unknown[]) => console.log("[brAInwav]", ...args),
    request: httpAdapter,
    jsonrpc: jsonRpcClient(endpoint),
    sseProbe,
    evidence: (ev: unknown) => console.log("[evidence]", ev),
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
      type: "module",
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
