/**
 * Type definitions for performance measurement and profiling
 */

import type { DiagnosticContext, TransportTranscript } from "@brainwav/cortexdx-core";

export interface HttpMetrics {
  latencyMs: number;
  status?: number;
}

export interface SseMetrics {
  firstEventMs?: number;
  heartbeatMs?: number;
  jitterMs?: number;
}

export interface WebSocketMetrics {
  messageCount: number;
  maxGapMs?: number;
  reconnects: number;
}

export interface PerformanceSummary {
  http?: HttpMetrics;
  sse?: SseMetrics;
  websocket?: WebSocketMetrics;
}

export interface PerformanceMeasurementOptions {
  harness?: PerformanceHarness;
}

export interface PerformanceHarness {
  now: () => number;
  fetch: typeof fetch;
  sseProbe: DiagnosticContext["sseProbe"];
  transcript: () => TransportTranscript | null;
  headers: () => Record<string, string>;
}
