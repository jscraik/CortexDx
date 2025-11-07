import { parentPort, workerData } from "node:worker_threads";
import type { DiagnosticContext, DiagnosticPlugin, Finding } from "../types.js";
import { getPluginById } from "../plugins/index.js";
import { httpAdapter } from "../adapters/http.js";
import { createInspectorSession } from "../context/inspector-session.js";

type Inbound = {
  pluginId: string;
  ctxInit: { endpoint: string; headers?: Record<string, string>; deterministic?: boolean };
};

const data = workerData as Inbound;

async function main(): Promise<void> {
  const plugin: DiagnosticPlugin | undefined = getPluginById(data.pluginId);
  if (!plugin) throw new Error(`Unknown plugin id: ${data.pluginId}`);

  const session = createInspectorSession(data.ctxInit.endpoint, data.ctxInit.headers);

  const ctx: DiagnosticContext = {
    endpoint: data.ctxInit.endpoint,
    headers: data.ctxInit.headers,
    logger: (...args: unknown[]) => parentPort?.postMessage({ type: "log", args }),
    request: httpAdapter,
    jsonrpc: session.jsonrpc,
    sseProbe: session.sseProbe,
    governance: undefined,
    llm: null,
    evidence: (ev) => parentPort?.postMessage({ type: "evidence", ev }),
    deterministic: !!data.ctxInit.deterministic,
    transport: session.transport
  };

  let findings: Finding[] = await plugin.run(ctx);
  const transcript = ctx.transport?.transcript();
  if (transcript && transcript.exchanges.length > 0) {
    findings = [
      ...findings,
      {
        id: `transport.session.${data.pluginId}`,
        area: "framework",
        severity: "info",
        title: `Transport session (${data.pluginId})`,
        description: `session=${transcript.sessionId ?? "n/a"} exchanges=${transcript.exchanges.length}`,
        evidence: [
          {
            type: "log",
            ref: JSON.stringify(
              {
                initialize: transcript.initialize?.response ?? null,
                recent: transcript.exchanges.slice(-2),
              },
            ).slice(0, 600),
          },
        ],
        tags: ["transport", "evidence"],
      },
    ];
  }
  parentPort?.postMessage({ type: "result", findings });
}

main().catch((err) => {
  parentPort?.postMessage({ type: "error", error: String(err?.message ?? err) });
  process.exit(1);
});
