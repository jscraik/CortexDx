/**
 * HTTP performance measurement
 */

import type { DiagnosticContext } from "@brainwav/cortexdx-core";
import type { HttpMetrics, PerformanceHarness } from "@brainwav/cortexdx-core";

/**
 * Measure HTTP request performance
 */
export async function measureHttp(
  ctx: DiagnosticContext,
  harness: PerformanceHarness
): Promise<HttpMetrics> {
  const start = harness.now();

  try {
    const response = await ctx.request(ctx.endpoint, {
      method: "GET",
      headers: harness.headers(),
    });

    const latencyMs = harness.now() - start;

    return {
      latencyMs,
      status: typeof response === "object" && response && "status" in response
        ? (response as { status: number }).status
        : undefined,
    };
  } catch (error) {
    const latencyMs = harness.now() - start;

    return {
      latencyMs,
      status: error instanceof Error && error.message.includes("404") ? 404 :
              error instanceof Error && error.message.includes("500") ? 500 :
              undefined,
    };
  }
}

/**
 * Build HTTP-specific performance findings
 */
export function buildHttpFindings(
  metrics: HttpMetrics,
  endpoint: string
): Array<import("../../../types.js").Finding> {
  const findings: Array<import("../../../types.js").Finding> = [];

  // Basic latency finding
  findings.push({
    id: "perf.http.latency",
    area: "performance",
    severity: metrics.latencyMs > 1000 ? "major" : "info",
    title: `HTTP latency: ${metrics.latencyMs.toFixed(2)}ms`,
    description: `HTTP request to ${endpoint} took ${metrics.latencyMs.toFixed(2)}ms`,
    evidence: [
      { type: "log", ref: `HTTP latency: ${metrics.latencyMs}ms` },
      { type: "url", ref: endpoint },
    ],
    confidence: 1.0,
  });

  // Status code findings
  if (metrics.status) {
    if (metrics.status >= 500) {
      findings.push({
        id: "perf.http.server-error",
        area: "performance",
        severity: "major",
        title: `Server error: HTTP ${metrics.status}`,
        description: `Server returned error status ${metrics.status}`,
        evidence: [{ type: "log", ref: `Status: ${metrics.status}` }],
        confidence: 1.0,
      });
    } else if (metrics.status >= 400) {
      findings.push({
        id: "perf.http.client-error",
        area: "performance",
        severity: "minor",
        title: `Client error: HTTP ${metrics.status}`,
        description: `Request failed with status ${metrics.status}`,
        evidence: [{ type: "log", ref: `Status: ${metrics.status}` }],
        confidence: 1.0,
      });
    }
  } else {
    findings.push({
      id: "perf.http.failure",
      area: "performance",
      severity: "major",
      title: "HTTP request failed",
      description: `Failed to connect to ${endpoint}`,
      evidence: [{ type: "url", ref: endpoint }],
      confidence: 1.0,
    });
  }

  return findings;
}
