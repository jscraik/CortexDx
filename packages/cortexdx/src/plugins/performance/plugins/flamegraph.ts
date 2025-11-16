/**
 * Unified Flame Graph Generator Plugin
 * Generates flame graphs in multiple formats with interactive features
 */

import { FlameGraphGenerator } from "../../../report/flamegraph.js";
import type { DiagnosticPlugin, Finding } from "../../../types.js";

export const UnifiedFlameGraphPlugin: DiagnosticPlugin = {
  id: "unified-flamegraph-generator",
  title: "Unified Flame Graph Generator",
  order: 504,
  async run(ctx) {
    const startTime = performance.now();
    const findings: Finding[] = [];

    try {
      const generator = new FlameGraphGenerator();

      // Add information about unified flame graph capabilities
      findings.push({
        id: "flamegraph.unified.available",
        area: "performance-profiling",
        severity: "info",
        title: "Unified flame graph generator available",
        description:
          "Generates flame graphs in multiple formats (SVG, HTML, JSON) with interactive features and metadata support",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use the unified flame graph generator to visualize profiling data from Clinic.js or py-spy",
      });

      findings.push({
        id: "flamegraph.formats",
        area: "performance-profiling",
        severity: "info",
        title: "Flame graph format support",
        description:
          "Supports SVG (static), HTML (interactive), and JSON (data) formats for flame graph generation",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use HTML format for interactive exploration, SVG for static reports, and JSON for programmatic access",
      });

      findings.push({
        id: "flamegraph.interactive",
        area: "performance-profiling",
        severity: "info",
        title: "Interactive flame graph features",
        description:
          "HTML flame graphs include zoom, search, reset, and download capabilities for enhanced analysis",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use interactive features to explore function call hierarchies and identify performance hotspots",
      });

      findings.push({
        id: "flamegraph.metadata",
        area: "performance-profiling",
        severity: "info",
        title: "Flame graph metadata support",
        description:
          "Includes comprehensive metadata: total samples, duration, timestamp, source tool, PID, and command",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Review metadata to understand profiling context and compare results across different runs",
      });

      findings.push({
        id: "flamegraph.color_schemes",
        area: "performance-profiling",
        severity: "info",
        title: "Flame graph color schemes",
        description:
          "Supports multiple color schemes: hot, cold, aqua, green, and red for different visualization preferences",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Choose color schemes based on your preference and the type of analysis being performed",
      });

      findings.push({
        id: "flamegraph.clinic_integration",
        area: "performance-profiling",
        severity: "info",
        title: "Clinic.js flame graph integration",
        description:
          "Parses and converts Clinic.js Flame output to unified flame graph format for consistent visualization",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use with Clinic.js Flame profiling results to generate enhanced interactive flame graphs",
      });

      findings.push({
        id: "flamegraph.pyspy_integration",
        area: "performance-profiling",
        severity: "info",
        title: "py-spy flame graph integration",
        description:
          "Parses and converts py-spy flame graph output to unified format with enhanced metadata and interactivity",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use with py-spy profiling results to generate enhanced interactive flame graphs for Python code",
      });

      findings.push({
        id: "flamegraph.speedscope_support",
        area: "performance-profiling",
        severity: "info",
        title: "Speedscope JSON format support",
        description:
          "Converts speedscope JSON format to unified flame graph format for cross-tool compatibility",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
        recommendation:
          "Use speedscope format for compatibility with other profiling tools and visualization platforms",
      });

      const analysisTime = performance.now() - startTime;
      findings.push({
        id: "flamegraph.analysis.complete",
        area: "performance-profiling",
        severity: "info",
        title: `Unified flame graph generator initialized in ${analysisTime.toFixed(2)}ms`,
        description:
          "Flame graph generator is ready for profiling data visualization",
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 1.0,
      });
    } catch (error) {
      findings.push({
        id: "flamegraph.error",
        area: "performance-profiling",
        severity: "major",
        title: "Unified flame graph generator initialization failed",
        description: `Error: ${String(error)}`,
        evidence: [{ type: "log", ref: "UnifiedFlameGraphPlugin" }],
        confidence: 0.9,
      });
    }

    return findings;
  },
};
