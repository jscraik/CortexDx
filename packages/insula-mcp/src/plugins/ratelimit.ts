import type { DiagnosticPlugin, Finding } from "../types.js";

export const RateLimitPlugin: DiagnosticPlugin = {
  id: "ratelimit",
  title: "Rate-limit Semantics",
  order: 220,
  async run(ctx) {
    const findings: Finding[] = [];
    try {
      const res = await fetch(ctx.endpoint, { method: "POST", body: "{}" });
      if (res.status === 429) {
        const retry = res.headers.get("retry-after");
        if (!retry) {
          findings.push({
            id: "rl.429.no_retry_after",
            area: "reliability",
            severity: "minor",
            title: "429 without Retry-After",
            description: "Consider setting Retry-After and documenting backoff.",
            evidence: [{ type: "url", ref: ctx.endpoint }]
          });
        }
      }
    } catch {
      // network failures ignored for starter implementation
    }
    return findings;
  }
};
