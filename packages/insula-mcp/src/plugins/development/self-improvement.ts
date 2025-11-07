import type {
  ChatMessage,
  DevelopmentContext,
  DevelopmentPlugin,
  Finding,
  ProjectContext,
} from "../../types.js";

const HANDSHAKE_FILES = [
  "packages/insula-mcp/src/adapters/jsonrpc.ts",
  "packages/insula-mcp/src/adapters/sse.ts",
];

const REQUIRED_DEPENDENCIES = [
  "@modelcontextprotocol/sdk",
  "eventsource-parser",
];

const SIGNAL_KEYWORDS = [
  { key: "sse", pattern: /sse/i, label: "SSE streaming issues" },
  { key: "batch", pattern: /batch/i, label: "JSON-RPC batch issues" },
  { key: "handshake", pattern: /handshake|initialize/i, label: "Handshake gaps" },
];

function evaluateHandshake(project?: ProjectContext): Finding | null {
  const files = project?.sourceFiles ?? [];
  if (files.length === 0) return null;
  const missing = HANDSHAKE_FILES.filter((file) => !files.includes(file));
  if (missing.length === 0) return null;
  return {
    id: "self_improvement.handshake_gaps",
    area: "development",
    severity: "major",
    title: "Handshake instrumentation incomplete",
    description: `Missing critical adapter files: ${missing.join(", ")}`,
    evidence: missing.map((ref) => ({ type: "file" as const, ref })),
    recommendation:
      "Wire initialize/session tracking through the JSON-RPC and SSE adapters before re-running diagnostics.",
    tags: ["self-improvement", "handshake"],
  };
}

function evaluateDependencies(project?: ProjectContext): Finding | null {
  const deps = project?.dependencies ?? [];
  if (deps.length === 0) return null;
  const missing = REQUIRED_DEPENDENCIES.filter((dep) => !deps.includes(dep));
  if (missing.length === 0) return null;
  return {
    id: "self_improvement.dependency_gaps",
    area: "development",
    severity: "minor",
    title: "Missing inspector dependencies",
    description: `Recommended packages not detected: ${missing.join(", ")}`,
    evidence: [{ type: "log", ref: JSON.stringify(deps.slice(0, 10)) }],
    recommendation: "Install the missing packages to enable protocol replay hooks.",
    tags: ["self-improvement", "dependencies"],
  };
}

function summarizeSignals(history: ChatMessage[]): Finding | null {
  if (history.length === 0) return null;
  const counters: Record<string, number> = {};
  for (const entry of history) {
    for (const keyword of SIGNAL_KEYWORDS) {
      if (keyword.pattern.test(entry.content)) {
        counters[keyword.key] = (counters[keyword.key] ?? 0) + 1;
      }
    }
  }
  const flagged = Object.entries(counters);
  if (flagged.length === 0) return null;
  const summary = flagged
    .map(([key, count]) => {
      const label = SIGNAL_KEYWORDS.find((item) => item.key === key)?.label ?? key;
      return `${label}: ${count}`;
    })
    .join("; ");
  return {
    id: "self_improvement.signal_digest",
    area: "development",
    severity: "info",
    title: "Repeated inspector signals detected",
    description: summary,
    evidence: history.slice(-5).map((msg) => ({
      type: "log" as const,
      ref: `${msg.role}: ${msg.content.slice(0, 140)}`,
    })),
    tags: ["self-improvement", "signals"],
  };
}

async function probeHealth(
  ctx: DevelopmentContext,
): Promise<Finding | null> {
  if (!ctx.endpoint) return null;
  const base = ctx.endpoint.replace(/\/$/, "");
  try {
    const health = await ctx.request(`${base}/health`, { method: "GET" });
    return {
      id: "self_improvement.health",
      area: "development",
      severity: "info",
      title: "Inspector health probe",
      description: JSON.stringify(health),
      evidence: [{ type: "url", ref: `${base}/health` }],
      tags: ["self-improvement", "health"],
    };
  } catch (error) {
    return {
      id: "self_improvement.health_unreachable",
      area: "development",
      severity: "minor",
      title: "Inspector health probe failed",
      description: `Unable to query ${base}/health: ${String(error)}`,
      evidence: [{ type: "url", ref: `${base}/health` }],
      tags: ["self-improvement", "health"],
    };
  }
}

export const SelfImprovementPlugin: DevelopmentPlugin = {
  id: "self-improvement",
  title: "Internal Self-Improvement Diagnostics",
  category: "development",
  order: 15,
  requiresLlm: false,
  async run(ctx) {
    const findings: Finding[] = [];

    const handshake = evaluateHandshake(ctx.projectContext);
    if (handshake) findings.push(handshake);

    const deps = evaluateDependencies(ctx.projectContext);
    if (deps) findings.push(deps);

    const signalSummary = summarizeSignals(ctx.conversationHistory || []);
    if (signalSummary) findings.push(signalSummary);

    const health = await probeHealth(ctx);
    if (health) findings.push(health);

    const transport = summarizeTransport(ctx);
    if (transport) findings.push(transport);

    if (findings.length === 0) {
      findings.push({
        id: "self_improvement.ok",
        area: "development",
        severity: "info",
        title: "Internal diagnostics baseline satisfied",
        description:
          "All tracked adapters and dependencies are present; no repeated failure signals detected.",
        tags: ["self-improvement"],
      });
    }

    return findings;
  },
};

function summarizeTransport(ctx: DevelopmentContext): Finding | null {
  const transcript = ctx.transport?.transcript();
  if (!transcript) return null;
  const exchangeCount = transcript.exchanges.length;
  const initializeSummary = transcript.initialize
    ? `Initialize -> status ${transcript.initialize.status ?? "unknown"}`
    : "Initialize missing";
  return {
    id: "self_improvement.transport_transcript",
    area: "development",
    severity: "info",
    title: "Inspector transport transcript captured",
    description: `${initializeSummary}; ${exchangeCount} follow-up exchanges.`,
    evidence: [
      {
        type: "log",
        ref: JSON.stringify(
          {
            sessionId: transcript.sessionId,
            initialize: transcript.initialize?.response?.result ?? null,
            exchanges: transcript.exchanges.slice(-3),
          },
          null,
          2,
        ).slice(0, 500),
      },
    ],
    tags: ["self-improvement", "transport"],
  };
}
