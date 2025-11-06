import { withSpan } from "../observability/otel.js";
import type { DiagnosticPlugin, Finding, PerformanceMetrics } from "../types.js";

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

// Enhanced Performance Profiler Plugin with millisecond precision timing
export const EnhancedPerformanceProfilerPlugin: DiagnosticPlugin = {
  id: "enhanced-performance-profiler",
  title: "Enhanced MCP Performance Profiler",
  order: 501,
  async run(ctx) {
    const startTime = performance.now();
    const findings: Finding[] = [];

    try {
      // Real-time monitoring with 1-second intervals
      const monitoringResults = await performRealTimeMonitoring(ctx);
      findings.push(...monitoringResults);

      // Millisecond precision timing analysis
      const timingResults = await performTimingAnalysis(ctx);
      findings.push(...timingResults);

      // Bottleneck identification with <20s analysis time
      const bottleneckResults = await identifyBottlenecks(ctx);
      findings.push(...bottleneckResults);

      // Memory and resource usage profiling
      const resourceResults = await profileResourceUsage(ctx);
      findings.push(...resourceResults);

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
          confidence: 1.0
        });
      } else {
        findings.push({
          id: "perf.profiler.performance",
          area: "performance-profiling",
          severity: "info",
          title: `Performance profiling completed in ${analysisTime.toFixed(2)}ms`,
          description: "Analysis completed within performance requirements",
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 1.0
        });
      }

    } catch (error) {
      findings.push({
        id: "perf.profiler.error",
        area: "performance-profiling",
        severity: "major",
        title: "Enhanced performance profiling failed",
        description: `Profiling error: ${String(error)}`,
        evidence: [{ type: "log", ref: "EnhancedPerformanceProfilerPlugin" }],
        confidence: 0.9
      });
    }

    return findings;
  }
};

async function performRealTimeMonitoring(ctx: import("../types.js").DiagnosticContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  return withSpan("performance.real_time_monitoring", { endpoint: ctx.endpoint }, async () => {
    try {
      const monitoringDuration = 5000; // 5 seconds of monitoring
      const intervalMs = 1000; // 1-second intervals
      const measurements: PerformanceMetrics[] = [];

      const startTime = performance.now();

      // Perform monitoring at 1-second intervals
      for (let i = 0; i < monitoringDuration / intervalMs; i++) {
        const measurementStart = performance.now();

        try {
          // Test basic connectivity and response time
          const response = await Promise.race([
            ctx.jsonrpc<unknown>("tools/list").catch(() => null),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))
          ]);

          const responseTime = performance.now() - measurementStart;

          const metrics: PerformanceMetrics = {
            responseTimeMs: responseTime,
            memoryUsageMb: getMemoryUsage(),
            cpuUsagePercent: 0, // CPU usage would require system-level monitoring
            diagnosticTimeMs: responseTime,
            timestamp: Date.now()
          };

          measurements.push(metrics);

          // Wait for next interval
          if (i < (monitoringDuration / intervalMs) - 1) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }

        } catch (error) {
          const responseTime = performance.now() - measurementStart;

          const metrics: PerformanceMetrics = {
            responseTimeMs: responseTime,
            memoryUsageMb: getMemoryUsage(),
            cpuUsagePercent: 0,
            diagnosticTimeMs: responseTime,
            timestamp: Date.now()
          };

          measurements.push(metrics);
        }
      }

      // Analyze measurements
      if (measurements.length > 0) {
        const avgResponseTime = measurements.reduce((sum, m) => sum + m.responseTimeMs, 0) / measurements.length;
        const maxResponseTime = Math.max(...measurements.map(m => m.responseTimeMs));
        const minResponseTime = Math.min(...measurements.map(m => m.responseTimeMs));
        const responseTimeVariance = calculateVariance(measurements.map(m => m.responseTimeMs));

        findings.push({
          id: "perf.monitoring.response_times",
          area: "performance-monitoring",
          severity: avgResponseTime > 2000 ? "major" : avgResponseTime > 1000 ? "minor" : "info",
          title: `Response time analysis: ${avgResponseTime.toFixed(2)}ms avg`,
          description: `Min: ${minResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms, Variance: ${responseTimeVariance.toFixed(2)}ms²`,
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.95
        });

        // Check for performance degradation patterns
        const firstHalf = measurements.slice(0, Math.floor(measurements.length / 2));
        const secondHalf = measurements.slice(Math.floor(measurements.length / 2));

        if (firstHalf.length > 0 && secondHalf.length > 0) {
          const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.responseTimeMs, 0) / firstHalf.length;
          const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.responseTimeMs, 0) / secondHalf.length;
          const degradation = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

          if (Math.abs(degradation) > 20) {
            findings.push({
              id: "perf.monitoring.degradation",
              area: "performance-monitoring",
              severity: degradation > 0 ? "minor" : "info",
              title: `Performance ${degradation > 0 ? "degradation" : "improvement"}: ${Math.abs(degradation).toFixed(1)}%`,
              description: `Response times ${degradation > 0 ? "increased" : "decreased"} during monitoring period`,
              evidence: [{ type: "url", ref: ctx.endpoint }],
              confidence: 0.8
            });
          }
        }
      }

    } catch (error) {
      findings.push({
        id: "perf.monitoring.error",
        area: "performance-monitoring",
        severity: "major",
        title: "Real-time monitoring failed",
        description: `Monitoring error: ${String(error)}`,
        evidence: [{ type: "log", ref: "performRealTimeMonitoring" }],
        confidence: 0.9
      });
    }

    return findings;
  });
}

async function performTimingAnalysis(ctx: import("../types.js").DiagnosticContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  return withSpan("performance.timing_analysis", { endpoint: ctx.endpoint }, async () => {
    try {
      const timingTests = [
        {
          name: "Initialize",
          operation: () => ctx.jsonrpc<unknown>("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "perf-test", version: "1.0.0" }
          })
        },
        {
          name: "Tools List",
          operation: () => ctx.jsonrpc<unknown>("tools/list")
        },
        {
          name: "Resources List",
          operation: () => ctx.jsonrpc<unknown>("resources/list").catch(() => null)
        },
        {
          name: "Prompts List",
          operation: () => ctx.jsonrpc<unknown>("prompts/list").catch(() => null)
        }
      ];

      for (const test of timingTests) {
        const measurements: number[] = [];
        const iterations = 5; // Multiple measurements for accuracy

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          try {
            await test.operation();
            const duration = performance.now() - start;
            measurements.push(duration);
          } catch (error) {
            const duration = performance.now() - start;
            measurements.push(duration);
          }

          // Small delay between iterations
          if (i < iterations - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (measurements.length > 0) {
          const avgTime = measurements.reduce((sum, t) => sum + t, 0) / measurements.length;
          const minTime = Math.min(...measurements);
          const maxTime = Math.max(...measurements);
          const variance = calculateVariance(measurements);

          findings.push({
            id: `perf.timing.${test.name.toLowerCase().replace(/\s+/g, '_')}`,
            area: "performance-timing",
            severity: avgTime > 5000 ? "major" : avgTime > 2000 ? "minor" : "info",
            title: `${test.name}: ${avgTime.toFixed(2)}ms avg (${iterations} samples)`,
            description: `Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, Std Dev: ${Math.sqrt(variance).toFixed(2)}ms`,
            evidence: [{ type: "url", ref: ctx.endpoint }],
            confidence: 0.95
          });
        }
      }

    } catch (error) {
      findings.push({
        id: "perf.timing.error",
        area: "performance-timing",
        severity: "major",
        title: "Timing analysis failed",
        description: `Timing analysis error: ${String(error)}`,
        evidence: [{ type: "log", ref: "performTimingAnalysis" }],
        confidence: 0.9
      });
    }

    return findings;
  });
}

async function identifyBottlenecks(ctx: import("../types.js").DiagnosticContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  return withSpan("performance.bottleneck_analysis", { endpoint: ctx.endpoint }, async () => {
    try {
      const bottleneckTests = [
        {
          name: "Connection Establishment",
          test: async () => {
            const start = performance.now();
            try {
              await fetch(ctx.endpoint, { method: "HEAD" });
              return performance.now() - start;
            } catch {
              return performance.now() - start;
            }
          }
        },
        {
          name: "JSON-RPC Processing",
          test: async () => {
            const start = performance.now();
            try {
              await ctx.jsonrpc<unknown>("tools/list");
              return performance.now() - start;
            } catch {
              return performance.now() - start;
            }
          }
        },
        {
          name: "Large Payload Handling",
          test: async () => {
            const start = performance.now();
            try {
              // Test with a larger payload
              const largeParams = {
                protocolVersion: "2024-11-05",
                capabilities: {
                  tools: { listChanged: true },
                  resources: { subscribe: true, listChanged: true },
                  prompts: { listChanged: true },
                  logging: {}
                },
                clientInfo: {
                  name: "performance-test-client-with-long-name",
                  version: "1.0.0-performance-testing-version"
                }
              };
              await ctx.jsonrpc<unknown>("initialize", largeParams);
              return performance.now() - start;
            } catch {
              return performance.now() - start;
            }
          }
        }
      ];

      const results: { name: string; duration: number }[] = [];

      for (const test of bottleneckTests) {
        const duration = await test.test();
        results.push({ name: test.name, duration });
      }

      // Identify the slowest operations
      results.sort((a, b) => b.duration - a.duration);
      const slowestOperation = results[0];
      const fastestOperation = results[results.length - 1];

      if (slowestOperation.duration > 1000) {
        findings.push({
          id: "perf.bottleneck.identified",
          area: "performance-bottlenecks",
          severity: slowestOperation.duration > 5000 ? "major" : "minor",
          title: `Performance bottleneck: ${slowestOperation.name}`,
          description: `${slowestOperation.name} took ${slowestOperation.duration.toFixed(2)}ms, significantly slower than other operations`,
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.9,
          recommendation: getBottleneckRecommendation(slowestOperation.name)
        });
      }

      // Overall bottleneck analysis summary
      findings.push({
        id: "perf.bottleneck.summary",
        area: "performance-bottlenecks",
        severity: "info",
        title: `Bottleneck analysis: ${slowestOperation.name} slowest (${slowestOperation.duration.toFixed(2)}ms)`,
        description: `Performance range: ${fastestOperation.duration.toFixed(2)}ms - ${slowestOperation.duration.toFixed(2)}ms`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.95
      });

    } catch (error) {
      findings.push({
        id: "perf.bottleneck.error",
        area: "performance-bottlenecks",
        severity: "major",
        title: "Bottleneck identification failed",
        description: `Bottleneck analysis error: ${String(error)}`,
        evidence: [{ type: "log", ref: "identifyBottlenecks" }],
        confidence: 0.9
      });
    }

    return findings;
  });
}

async function profileResourceUsage(ctx: import("../types.js").DiagnosticContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const initialMemory = getMemoryUsage();
    const startTime = performance.now();

    // Perform a series of operations to measure resource usage
    const operations = [
      () => ctx.jsonrpc<unknown>("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }),
      () => ctx.jsonrpc<unknown>("tools/list"),
      () => ctx.jsonrpc<unknown>("resources/list").catch(() => null),
      () => ctx.jsonrpc<unknown>("prompts/list").catch(() => null)
    ];

    for (const operation of operations) {
      try {
        await operation();
      } catch {
        // Continue with resource profiling even if operations fail
      }
    }

    const finalMemory = getMemoryUsage();
    const totalTime = performance.now() - startTime;
    const memoryDelta = finalMemory - initialMemory;

    findings.push({
      id: "perf.resources.memory",
      area: "performance-resources",
      severity: memoryDelta > 50 ? "minor" : "info",
      title: `Memory usage: ${memoryDelta.toFixed(2)}MB delta`,
      description: `Initial: ${initialMemory.toFixed(2)}MB, Final: ${finalMemory.toFixed(2)}MB, Operations took ${totalTime.toFixed(2)}ms`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.8
    });

    // Check for memory leaks (simplified detection)
    if (memoryDelta > 10) {
      findings.push({
        id: "perf.resources.potential_leak",
        area: "performance-resources",
        severity: "minor",
        title: "Potential memory usage increase",
        description: `Memory usage increased by ${memoryDelta.toFixed(2)}MB during testing`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.6,
        recommendation: "Monitor memory usage over longer periods to confirm if this is a leak"
      });
    }

  } catch (error) {
    findings.push({
      id: "perf.resources.error",
      area: "performance-resources",
      severity: "major",
      title: "Resource profiling failed",
      description: `Resource profiling error: ${String(error)}`,
      evidence: [{ type: "log", ref: "profileResourceUsage" }],
      confidence: 0.9
    });
  }

  return findings;
}

function getMemoryUsage(): number {
  // In Node.js environment, use process.memoryUsage()
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024; // Convert to MB
  }

  // In browser environment, use performance.memory if available
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? memory.usedJSHeapSize / 1024 / 1024 : 0; // Convert to MB
  }

  // Fallback if memory monitoring is not available
  return 0;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDifferences = values.map(val => (val - mean) ** 2);
  return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
}

function getBottleneckRecommendation(operationName: string): string {
  switch (operationName) {
    case "Connection Establishment":
      return "Consider optimizing network configuration, checking for DNS resolution issues, or implementing connection pooling";
    case "JSON-RPC Processing":
      return "Review server-side JSON-RPC processing logic, consider caching frequently requested data, or optimize database queries";
    case "Large Payload Handling":
      return "Implement payload compression, optimize data serialization, or consider pagination for large responses";
    default:
      return "Investigate server-side processing for this operation and consider performance optimizations";
  }
}
