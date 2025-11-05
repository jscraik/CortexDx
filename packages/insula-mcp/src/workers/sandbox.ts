import { parentPort, workerData } from "node:worker_threads";
import type { DiagnosticContext, DiagnosticPlugin, Finding } from "../types.js";
import { getPluginById } from "../plugins/index.js";
import { httpAdapter } from "../adapters/http.js";
import { jsonRpcClient } from "../adapters/jsonrpc.js";
import { sseProbe } from "../adapters/sse.js";

type Inbound = {
  pluginId: string;
  ctxInit: { endpoint: string; headers?: Record<string, string>; deterministic?: boolean };
};

const data = workerData as Inbound;

async function main(): Promise<void> {
  const plugin: DiagnosticPlugin | undefined = getPluginById(data.pluginId);
  if (!plugin) throw new Error(`Unknown plugin id: ${data.pluginId}`);

  const ctx: DiagnosticContext = {
    endpoint: data.ctxInit.endpoint,
    headers: data.ctxInit.headers,
    logger: (...args: unknown[]) => parentPort?.postMessage({ type: "log", args }),
    request: httpAdapter,
    jsonrpc: jsonRpcClient(data.ctxInit.endpoint),
    sseProbe: (url, opts) => {
      if (opts && typeof opts === "object") {
        const candidate = opts as { timeoutMs?: unknown };
        const timeoutMs =
          typeof candidate.timeoutMs === "number" ? candidate.timeoutMs : undefined;
        return sseProbe(url, timeoutMs ? { timeoutMs } : undefined);
      }
      return sseProbe(url);
    },
    governance: undefined,
    llm: null,
    evidence: (ev) => parentPort?.postMessage({ type: "evidence", ev }),
    deterministic: !!data.ctxInit.deterministic
  };

  const findings: Finding[] = await plugin.run(ctx);
  parentPort?.postMessage({ type: "result", findings });
}

main().catch((err) => {
  parentPort?.postMessage({ type: "error", error: String(err?.message ?? err) });
  process.exit(1);
});
