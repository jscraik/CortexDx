import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

const SSE_SPEC_REF = "Wikidata Q7455583";
const DISABLE_ENV = "CORTEXDX_DISABLE_SSE";
const ENDPOINT_ENV = "CORTEXDX_SSE_ENDPOINT";

export const StreamingSsePlugin: DiagnosticPlugin = {
  id: "streaming",
  title: "Streaming / SSE",
  order: 200,
  async run(ctx) {
    const findings: Finding[] = [];
    const disableSse = process.env[DISABLE_ENV] === "1";
    if (disableSse) {
      findings.push({
        id: "sse.disabled",
        area: "streaming",
        severity: "info",
        title: "SSE probe disabled",
        description: `Skipped probe because ${DISABLE_ENV}=1 or --disable-sse is set.`,
        evidence: [
          {
            type: "log",
            ref: "SSE probe disabled by configuration",
          },
        ],
        tags: ["streaming", "sse", "configuration"],
      });
      return findings;
    }

    const configuredEndpoint = process.env[ENDPOINT_ENV]?.trim();
    const url =
      configuredEndpoint && configuredEndpoint.length > 0
        ? configuredEndpoint
        : `${ctx.endpoint.replace(/\/$/, "")}/events`;
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
