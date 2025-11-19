/**
 * Server-Sent Events (SSE) performance measurement
 */

import type { DiagnosticContext, Finding } from "@brainwav/cortexdx-core";
import type { PerformanceHarness, SseMetrics } from "@brainwav/cortexdx-core";

/**
 * Measure SSE performance
 */
export async function measureSse(
  ctx: DiagnosticContext,
  harness: PerformanceHarness,
): Promise<SseMetrics> {
  try {
    const result = await harness.sseProbe(ctx.endpoint);

    if (!result || !result.ok) {
      return {};
    }

    return {
      firstEventMs: result.firstEventMs,
      heartbeatMs: result.heartbeatMs,
      // jitterMs is calculated separately, not part of SseResult
    };
  } catch (_error) {
    return {};
  }
}

/**
 * Calculate SSE jitter from event timings
 */
export function calculateSseJitter(eventTimings: number[]): number | undefined {
  if (eventTimings.length < 2) return undefined;

  const intervals: number[] = [];
  for (let i = 1; i < eventTimings.length; i++) {
    const current = eventTimings[i];
    const previous = eventTimings[i - 1];
    if (current !== undefined && previous !== undefined) {
      intervals.push(current - previous);
    }
  }

  // Calculate standard deviation as jitter
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const squaredDiffs = intervals.map((val) => (val - mean) ** 2);
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  return stdDev;
}

/**
 * Build SSE description from metrics
 */
export function buildSseDescription(metrics: SseMetrics): string {
  const parts: string[] = [];

  if (metrics.firstEventMs !== undefined) {
    parts.push(`First event: ${metrics.firstEventMs.toFixed(2)}ms`);
  }
  if (metrics.heartbeatMs !== undefined) {
    parts.push(`Heartbeat interval: ${metrics.heartbeatMs.toFixed(2)}ms`);
  }
  if (metrics.jitterMs !== undefined) {
    parts.push(`Jitter: ${metrics.jitterMs.toFixed(2)}ms`);
  }

  return parts.join(", ") || "No SSE metrics available";
}

/**
 * Build SSE-specific performance findings
 */
export function buildSseFindings(
  metrics: SseMetrics,
  endpoint: string,
): Finding[] {
  const findings: Finding[] = [];

  if (!metrics.firstEventMs) {
    return findings; // No SSE data available
  }

  // First event latency
  findings.push({
    id: "perf.sse.first-event",
    area: "performance",
    severity: metrics.firstEventMs > 500 ? "minor" : "info",
    title: `SSE first event: ${metrics.firstEventMs.toFixed(2)}ms`,
    description: buildSseDescription(metrics),
    evidence: [
      { type: "log", ref: `SSE first event: ${metrics.firstEventMs}ms` },
      { type: "url", ref: endpoint },
    ],
    confidence: 1.0,
  });

  // Jitter quality
  if (metrics.jitterMs !== undefined && metrics.jitterMs > 100) {
    findings.push({
      id: "perf.sse.jitter",
      area: "performance",
      severity: "minor",
      title: `High SSE jitter: ${metrics.jitterMs.toFixed(2)}ms`,
      description: `SSE stream has high timing variability (jitter: ${metrics.jitterMs.toFixed(2)}ms)`,
      evidence: [{ type: "log", ref: `Jitter: ${metrics.jitterMs}ms` }],
      confidence: 0.8,
    });
  }

  return findings;
}
