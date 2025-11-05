import type { DiagnosticPlugin, Finding } from "../types.js";

export const PerformancePlugin: DiagnosticPlugin = {
  id: "performance",
  title: "Baseline Latency / Timeouts",
  order: 500,
  async run(ctx) {
    const t0 = Date.now();
    await fetch(ctx.endpoint, { method: "POST", body: "{}" }).catch(() => undefined);
    const duration = Date.now() - t0;
    const finding: Finding = {
      id: "perf.sample",
      area: "performance",
      severity: "info",
      title: "Sample latency",
      description: `${duration}ms (single POST)`,
      evidence: [{ type: "url", ref: ctx.endpoint }]
    };
    return [finding];
  }
};
