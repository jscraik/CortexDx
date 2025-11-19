/**
 * py-spy Performance Profiler Plugin
 * Provides Python performance profiling using py-spy
 */

import { PySpyAdapter } from "../../../adapters/pyspy-adapter.js";
import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

export const PySpyPerformanceProfilerPlugin: DiagnosticPlugin = {
  id: "pyspy-performance-profiler",
  title: "py-spy Performance Profiler (Python)",
  order: 503,
  async run(ctx) {
    const startTime = performance.now();
    const findings: Finding[] = [];

    try {
      const pyspyAdapter = new PySpyAdapter();
      await pyspyAdapter.initialize();

      // Check if py-spy is available
      const isAvailable = await pyspyAdapter.checkAvailability();

      if (!isAvailable) {
        findings.push({
          id: "pyspy.not_installed",
          area: "performance-profiling",
          severity: "info",
          title: "py-spy not installed",
          description:
            "py-spy is not installed or not available in PATH. Install it to enable Python profiling.",
          evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
          confidence: 1.0,
          recommendation:
            "Install py-spy: pip install py-spy or cargo install py-spy",
        });
        return findings;
      }

      findings.push({
        id: "pyspy.available",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy profiling available",
        description:
          "py-spy is installed and ready for Python process profiling",
        evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "To profile a Python MCP server, use: py-spy record --pid <PID> --output profile.svg",
      });

      // Add information about py-spy capabilities
      findings.push({
        id: "pyspy.cpu_profiling",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy: CPU profiling for Python",
        description:
          "Samples Python process execution to identify CPU hotspots without modifying code or restarting the process",
        evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use py-spy to profile running Python MCP servers and identify performance bottlenecks",
      });

      findings.push({
        id: "pyspy.flamegraph",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy: Flame graph generation",
        description:
          "Generates interactive SVG flame graphs showing Python function call hierarchies and execution time",
        evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use --format flamegraph to generate visual flame graphs for analysis",
      });

      findings.push({
        id: "pyspy.subprocess",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy: Subprocess profiling support",
        description:
          "Can profile Python processes and their subprocesses simultaneously for comprehensive analysis",
        evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use --subprocesses flag to profile parent and child Python processes together",
      });

      findings.push({
        id: "pyspy.native",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy: Native extension profiling",
        description:
          "Supports profiling native extensions and C code called from Python",
        evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use --native flag to include native code in profiling results",
      });

      const analysisTime = performance.now() - startTime;
      findings.push({
        id: "pyspy.analysis.complete",
        area: "performance-profiling",
        severity: "info",
        title: `py-spy capability check completed in ${analysisTime.toFixed(2)}ms`,
        description:
          "py-spy integration is ready for Python MCP server profiling",
        evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
        confidence: 1.0,
      });
    } catch (error) {
      findings.push({
        id: "pyspy.error",
        area: "performance-profiling",
        severity: "major",
        title: "py-spy profiling check failed",
        description: `Error: ${String(error)}`,
        evidence: [{ type: "log", ref: "PySpyPerformanceProfilerPlugin" }],
        confidence: 0.9,
        recommendation:
          "Ensure py-spy is properly installed: pip install py-spy or cargo install py-spy",
      });
    }

    return findings;
  },
};
