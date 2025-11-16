/**
 * Utility functions for performance measurement and analysis
 */

/**
 * Get current memory usage in bytes
 */
export function getMemoryUsage(): number {
  if (typeof process !== "undefined" && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  // Fallback for browser environments
  if (
    typeof performance !== "undefined" &&
    "memory" in performance &&
    typeof (performance as { memory?: { usedJSHeapSize?: number } }).memory ===
      "object"
  ) {
    const memory = (performance as { memory: { usedJSHeapSize: number } })
      .memory;
    return memory.usedJSHeapSize;
  }
  return 0;
}

/**
 * Calculate variance of a numeric array
 */
export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return variance;
}

/**
 * Calculate percentile value from array
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error("Percentile must be between 0 and 100");
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}min`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Create a performance harness from diagnostic context
 */
export function createHarness(ctx: import("../../types.js").DiagnosticContext): import("./types.js").PerformanceHarness {
  return {
    now: () => performance.now(),
    fetch: fetch,
    sseProbe: ctx.sseProbe,
    transcript: () => null,
    headers: () => ctx.headers || {},
  };
}
