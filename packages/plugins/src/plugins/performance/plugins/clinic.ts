/**
 * Clinic.js Performance Profiler Plugin
 * Provides Node.js performance profiling using the Clinic.js suite
 */

import { ClinicAdapter } from "../../../adapters/clinic-adapter.js";
import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

export const ClinicJsPerformanceProfilerPlugin: DiagnosticPlugin = {
  id: "clinic-js-performance-profiler",
  title: "Clinic.js Performance Profiler (Node.js)",
  order: 502,
  async run(ctx) {
    const startTime = performance.now();
    const findings: Finding[] = [];

    // Check if we're running in a Node.js environment
    if (typeof process === "undefined" || !process.versions?.node) {
      findings.push({
        id: "clinic.not_nodejs",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic.js profiling skipped",
        description:
          "Clinic.js profiling is only available for Node.js MCP servers",
        evidence: [{ type: "log", ref: "ClinicJsPerformanceProfilerPlugin" }],
        confidence: 1.0,
      });
      return findings;
    }

    try {
      const clinicAdapter = new ClinicAdapter();
      await clinicAdapter.initialize();

      // Note: Clinic.js requires profiling a running Node.js script
      // For MCP server diagnostics, we would need the server script path
      // This is a placeholder implementation that documents the capability

      findings.push({
        id: "clinic.available",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic.js profiling available",
        description:
          "Clinic.js suite (Doctor, Flame, Bubbleprof) is installed and ready for Node.js profiling",
        evidence: [{ type: "log", ref: "ClinicJsPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "To profile a Node.js MCP server, use: clinic doctor -- node server.js",
      });

      // Add information about each Clinic.js tool
      findings.push({
        id: "clinic.doctor.info",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic Doctor: Event-loop health monitoring",
        description:
          "Monitors event-loop delay, CPU usage, memory usage, and active handles to identify performance issues",
        evidence: [{ type: "log", ref: "ClinicJsPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use Clinic Doctor to detect event-loop blocking and resource exhaustion",
      });

      findings.push({
        id: "clinic.flame.info",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic Flame: CPU profiling and flame graphs",
        description:
          "Generates flame graphs showing CPU hotspots and function call hierarchies for performance optimization",
        evidence: [{ type: "log", ref: "ClinicJsPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use Clinic Flame to identify CPU-intensive functions and optimize hot code paths",
      });

      findings.push({
        id: "clinic.bubbleprof.info",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic Bubbleprof: Async operation analysis",
        description:
          "Visualizes async operations and identifies async bottlenecks in the application",
        evidence: [{ type: "log", ref: "ClinicJsPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use Clinic Bubbleprof to detect async bottlenecks and optimize promise chains",
      });

      const analysisTime = performance.now() - startTime;
      findings.push({
        id: "clinic.analysis.complete",
        area: "performance-profiling",
        severity: "info",
        title: `Clinic.js capability check completed in ${analysisTime.toFixed(2)}ms`,
        description:
          "Clinic.js integration is ready for Node.js MCP server profiling",
        evidence: [{ type: "log", ref: "ClinicJsPerformanceProfilerPlugin" }],
        confidence: 1.0,
      });
    } catch (error) {
      findings.push({
        id: "clinic.error",
        area: "performance-profiling",
        severity: "major",
        title: "Clinic.js profiling check failed",
        description: `Error: ${String(error)}`,
        evidence: [{ type: "log", ref: "ClinicJsPerformanceProfilerPlugin" }],
        confidence: 0.9,
        recommendation:
          "Ensure Clinic.js is properly installed: pnpm add clinic @clinic/doctor @clinic/flame @clinic/bubbleprof",
      });
    }

    return findings;
  },
};
