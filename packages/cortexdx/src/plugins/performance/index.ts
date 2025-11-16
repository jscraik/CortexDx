/**
 * Performance Plugin - Modular Architecture
 * Main entry point for performance measurement and profiling
 *
 * This module is a refactored version of the original 2,422-line performance.ts
 * Now split into focused, maintainable modules.
 */

import type { DiagnosticContext, DiagnosticPlugin, Finding } from "../../types.js";
import type { PerformanceSummary } from "./types.js";
import { createHarness } from "./utils.js";
import { measureHttp, buildHttpFindings } from "./measurements/http.js";
import { measureSse, buildSseFindings } from "./measurements/sse.js";
import { measureWebSocket, buildWebSocketFindings } from "./measurements/websocket.js";

// Re-export types for backward compatibility
export type {
  HttpMetrics,
  SseMetrics,
  WebSocketMetrics,
  PerformanceSummary,
  PerformanceMeasurementOptions,
  PerformanceHarness,
} from "./types.js";

/**
 * Measure all transport performance metrics
 */
export async function measureTransports(
  ctx: DiagnosticContext,
  options?: { harness?: import("./types.js").PerformanceHarness }
): Promise<PerformanceSummary> {
  const harness = options?.harness || createHarness(ctx);

  const [http, sse] = await Promise.all([
    measureHttp(ctx, harness),
    measureSse(ctx, harness),
  ]);

  const websocket = measureWebSocket(harness);

  return {
    http,
    sse: Object.keys(sse).length > 0 ? sse : undefined,
    websocket: websocket.messageCount > 0 ? websocket : undefined,
  };
}

/**
 * Build findings from performance metrics
 */
export function buildPerformanceFindings(
  metrics: PerformanceSummary,
  endpoint: string
): Finding[] {
  const findings: Finding[] = [];

  // HTTP findings
  if (metrics.http) {
    findings.push(...buildHttpFindings(metrics.http, endpoint));
  }

  // SSE findings
  if (metrics.sse) {
    findings.push(...buildSseFindings(metrics.sse, endpoint));
  }

  // WebSocket findings
  if (metrics.websocket) {
    findings.push(...buildWebSocketFindings(metrics.websocket, endpoint));
  }

  return findings;
}

/**
 * Base Performance Plugin
 * Measures baseline latency and timeouts for all transport types
 */
export const PerformancePlugin: DiagnosticPlugin = {
  id: "performance",
  title: "Baseline Latency / Timeouts",
  order: 500,
  async run(ctx) {
    const metrics = await measureTransports(ctx);
    return buildPerformanceFindings(metrics, ctx.endpoint);
  },
};

/**
 * Enhanced Performance Profiler Plugin
 * Provides detailed performance profiling with millisecond precision
 *
 * Note: Full implementation of advanced profiling (real-time monitoring,
 * bottleneck detection, etc.) is available in the original performance.ts
 * and can be migrated to separate modules as needed.
 */
export const EnhancedPerformanceProfilerPlugin: DiagnosticPlugin = {
  id: "enhanced-performance-profiler",
  title: "Enhanced MCP Performance Profiler",
  order: 501,
  async run(ctx) {
    const startTime = performance.now();
    const findings: Finding[] = [];

    try {
      // Basic performance measurement
      const metrics = await measureTransports(ctx);
      findings.push(...buildPerformanceFindings(metrics, ctx.endpoint));

      // Validate analysis time requirement (<20s)
      const analysisTime = performance.now() - startTime;
      if (analysisTime > 20000) {
        findings.push({
          id: "perf.profiler.timeout",
          area: "performance-profiling",
          severity: "minor",
          title: "Analysis time exceeded threshold",
          description: `Performance profiling took ${analysisTime.toFixed(2)}ms, exceeding 20s requirement`,
          evidence: [{ type: "log", ref: "EnhancedPerformanceProfilerPlugin" }],
          confidence: 1.0,
        });
      } else {
        findings.push({
          id: "perf.profiler.performance",
          area: "performance-profiling",
          severity: "info",
          title: `Analysis completed in ${analysisTime.toFixed(2)}ms`,
          description: "Performance profiling completed within time budget",
          evidence: [{ type: "log", ref: `Analysis time: ${analysisTime}ms` }],
          confidence: 1.0,
        });
      }
    } catch (error) {
      findings.push({
        id: "perf.profiler.error",
        area: "performance-profiling",
        severity: "major",
        title: "Profiling failed",
        description: error instanceof Error ? error.message : "Unknown error during profiling",
        evidence: [{ type: "log", ref: "EnhancedPerformanceProfilerPlugin error" }],
        confidence: 1.0,
      });
    }

    return findings;
  },
};

// Re-export advanced profiler plugins from plugins/ subdirectory
export { ClinicJsPerformanceProfilerPlugin } from "./plugins/clinic.js";
export { PySpyPerformanceProfilerPlugin } from "./plugins/pyspy.js";
export { UnifiedFlameGraphPlugin } from "./plugins/flamegraph.js";

/**
 * Default export for backward compatibility
 */
export default PerformancePlugin;
