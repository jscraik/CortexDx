import type { DiagnosticPlugin, Finding } from "../types.js";

const SSE_SPEC_REF = "Wikidata Q7455583";

export const StreamingSsePlugin: DiagnosticPlugin = {
  id: "streaming",
  title: "Streaming / SSE",
  order: 200,
  async run(ctx) {
    const findings: Finding[] = [];
    const url = `${ctx.endpoint.replace(/\/$/, "")}/events`;
    const result = await ctx.sseProbe(url, {
      timeoutMs: 10000,
      headers: ctx.headers,
    });
    if (!result.ok) {
      findings.push({
        id: "sse.missing",
        area: "streaming",
        severity: "major",
        title: "SSE endpoint not streaming",
        description: `Probe failed: ${result.reason}. Spec reference: ${SSE_SPEC_REF}`,
        evidence: [
          { type: "url", ref: result.resolvedUrl ?? url },
          { type: "log", ref: `headers=${JSON.stringify(ctx.headers ?? {})}` },
        ]
      });
    } else {
      findings.push({
        id: "sse.ok",
        area: "streaming",
        severity: "info",
        title: "SSE responded",
        description: `firstEventMs=${result.firstEventMs ?? -1}; resolved=${result.resolvedUrl ?? url}`,
        evidence: [{ type: "url", ref: result.resolvedUrl ?? url }]
      });
    }
    return findings;
  }
};
