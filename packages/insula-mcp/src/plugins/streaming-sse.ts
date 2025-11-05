import type { DiagnosticPlugin, Finding } from "../types.js";

export const StreamingSsePlugin: DiagnosticPlugin = {
  id: "streaming",
  title: "Streaming / SSE",
  order: 200,
  async run(ctx) {
    const findings: Finding[] = [];
    const url = `${ctx.endpoint.replace(/\/$/, "")}/events`;
    const result = await ctx.sseProbe(url, { timeoutMs: 10000 });
    if (!result.ok) {
      findings.push({
        id: "sse.missing",
        area: "streaming",
        severity: "major",
        title: "SSE endpoint not streaming",
        description: `Probe failed: ${result.reason}`,
        evidence: [{ type: "url", ref: url }]
      });
    } else {
      findings.push({
        id: "sse.ok",
        area: "streaming",
        severity: "info",
        title: "SSE responded",
        description: `firstEventMs=${result.firstEventMs ?? -1}`,
        evidence: [{ type: "url", ref: url }]
      });
    }
    return findings;
  }
};
