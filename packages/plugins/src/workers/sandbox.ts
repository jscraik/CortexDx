import { parentPort, workerData } from "node:worker_threads";
import type { DiagnosticContext, DiagnosticPlugin, Finding, TransportExchange } from "@brainwav/cortexdx-core";
import { getPluginById } from "../plugins/index.js";
import { httpAdapter } from "../adapters/http.js";
import { createInspectorSession, type SharedSessionState } from "../context/inspector-session.js";
import { createDefaultKnowledgeOrchestrator } from "../knowledge/default-orchestrator.js";

type Inbound = {
  pluginId: string;
  ctxInit: {
    endpoint: string;
    headers?: Record<string, string>;
    deterministic?: boolean;
    preinitialized?: boolean;
    sessionState?: { sessionId?: string; initialize?: TransportExchange };
  };
};

const data = workerData as Inbound;

async function main(): Promise<void> {
  const plugin: DiagnosticPlugin | undefined = getPluginById(data.pluginId);
  if (!plugin) throw new Error(`Unknown plugin id: ${data.pluginId}`);

  const workerSharedState: SharedSessionState | undefined = data.ctxInit.sessionState
    ? {
        sessionId: data.ctxInit.sessionState.sessionId,
        initialize: data.ctxInit.sessionState.initialize,
        initialized: Boolean(data.ctxInit.sessionState.sessionId),
      }
    : undefined;

  const session = createInspectorSession(data.ctxInit.endpoint, data.ctxInit.headers, {
    preinitialized: data.ctxInit.preinitialized,
    sharedState: workerSharedState,
  });
  const knowledge = createDefaultKnowledgeOrchestrator();

  const baseHeaders = data.ctxInit.headers ?? {};
  const ctx: DiagnosticContext = {
    endpoint: data.ctxInit.endpoint,
    headers: baseHeaders,
    logger: (...args: unknown[]) => parentPort?.postMessage({ type: "log", args }),
    request: (input, init) => {
      const merged =
        Object.keys(baseHeaders).length === 0 && !init?.headers
          ? init?.headers
          : { ...baseHeaders, ...(init?.headers as Record<string, string> | undefined) };
      const nextInit = merged ? { ...(init ?? {}), headers: merged } : init;
      return httpAdapter(input, nextInit);
    },
    jsonrpc: session.jsonrpc,
    sseProbe: session.sseProbe,
    governance: undefined,
    llm: null,
    evidence: (ev) => parentPort?.postMessage({ type: "evidence", ev }),
    deterministic: !!data.ctxInit.deterministic,
    transport: session.transport,
    knowledge,
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
