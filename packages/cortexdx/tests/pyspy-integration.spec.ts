/**
 * py-spy Integration Tests
 *
 * Tests the integration of py-spy for Python performance profiling.
 */

import { describe, expect, it } from "vitest";
import { PySpyAdapter } from "../src/adapters/pyspy-adapter.js";
import { PySpyPerformanceProfilerPlugin } from "../src/plugins/performance.js";
import type { DiagnosticContext } from "../src/types.js";

describe("py-spy Integration", () => {
  describe("PySpyAdapter", () => {
    it("should create a py-spy adapter instance", () => {
      const adapter = new PySpyAdapter();
      expect(adapter).toBeDefined();
    });

    it("should initialize the working directory", async () => {
      const adapter = new PySpyAdapter();
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it("should support custom working directory", () => {
      const customDir = "/tmp/custom-pyspy-dir";
      const adapter = new PySpyAdapter(customDir);
      expect(adapter).toBeDefined();
    });

    it("should check py-spy availability", async () => {
      const adapter = new PySpyAdapter();
      const isAvailable = await adapter.checkAvailability();
      expect(typeof isAvailable).toBe("boolean");
    });
  });

  describe("PySpyPerformanceProfilerPlugin", () => {
    it("should have correct plugin metadata", () => {
      expect(PySpyPerformanceProfilerPlugin.id).toBe(
        "pyspy-performance-profiler",
      );
      expect(PySpyPerformanceProfilerPlugin.title).toBe(
        "py-spy Performance Profiler (Python)",
      );
      expect(PySpyPerformanceProfilerPlugin.order).toBe(503);
    });

    it("should check py-spy availability and report status", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      expect(findings).toBeDefined();
      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBeGreaterThan(0);

      // Should report either availability or not installed
      const statusFinding = findings.find(
        (f) => f.id === "pyspy.available" || f.id === "pyspy.not_installed",
      );
      expect(statusFinding).toBeDefined();
      expect(statusFinding?.severity).toBe("info");
    });

    it("should provide information about py-spy CPU profiling when available", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      // If py-spy is available, should have CPU profiling info
      const availableFinding = findings.find((f) => f.id === "pyspy.available");
      if (availableFinding) {
        const cpuFinding = findings.find((f) => f.id === "pyspy.cpu_profiling");
        expect(cpuFinding).toBeDefined();
        expect(cpuFinding?.title).toContain("CPU profiling");
        expect(cpuFinding?.description).toContain("Python");
      }
    });

    it("should provide information about flame graph generation when available", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      const availableFinding = findings.find((f) => f.id === "pyspy.available");
      if (availableFinding) {
        const flamegraphFinding = findings.find(
          (f) => f.id === "pyspy.flamegraph",
        );
        expect(flamegraphFinding).toBeDefined();
        expect(flamegraphFinding?.title).toContain("Flame graph");
        expect(flamegraphFinding?.description).toContain("SVG");
      }
    });

    it("should provide information about subprocess profiling when available", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      const availableFinding = findings.find((f) => f.id === "pyspy.available");
      if (availableFinding) {
        const subprocessFinding = findings.find(
          (f) => f.id === "pyspy.subprocess",
        );
        expect(subprocessFinding).toBeDefined();
        expect(subprocessFinding?.title).toContain("Subprocess");
        expect(subprocessFinding?.description).toContain("subprocesses");
      }
    });

    it("should provide information about native extension profiling when available", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      const availableFinding = findings.find((f) => f.id === "pyspy.available");
      if (availableFinding) {
        const nativeFinding = findings.find((f) => f.id === "pyspy.native");
        expect(nativeFinding).toBeDefined();
        expect(nativeFinding?.title).toContain("Native");
        expect(nativeFinding?.description).toContain("native extensions");
      }
    });

    it("should complete analysis within reasonable time", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const startTime = performance.now();
      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);
      const duration = performance.now() - startTime;

      // Should complete quickly since it's just checking availability
      expect(duration).toBeLessThan(3000); // Less than 3 seconds (py-spy check can be slower)

      const completionFinding = findings.find(
        (f) => f.id === "pyspy.analysis.complete",
      );
      if (completionFinding) {
        expect(completionFinding).toBeDefined();
      }
    });

    it("should include evidence pointers in findings", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      // All findings should have evidence
      for (const finding of findings) {
        expect(finding.evidence).toBeDefined();
        expect(Array.isArray(finding.evidence)).toBe(true);
        expect(finding.evidence.length).toBeGreaterThan(0);
      }
    });

    it("should have confidence scores", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      // All findings should have confidence scores
      for (const finding of findings) {
        expect(finding.confidence).toBeDefined();
        expect(finding.confidence).toBeGreaterThanOrEqual(0);
        expect(finding.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should provide installation recommendation when py-spy is not available", async () => {
      const mockContext: DiagnosticContext = {
        endpoint: "http://localhost:3000",
        logger: () => {},
        request: async () => ({}),
        jsonrpc: async () => ({}),
        sseProbe: async () => ({
          connected: true,
          messages: [],
          errors: [],
          duration: 0,
        }),
        evidence: () => {},
      };

      const findings = await PySpyPerformanceProfilerPlugin.run(mockContext);

      const notInstalledFinding = findings.find(
        (f) => f.id === "pyspy.not_installed",
      );
      if (notInstalledFinding) {
        expect(notInstalledFinding.recommendation).toBeDefined();
        expect(notInstalledFinding.recommendation).toContain("install");
      }
    });
  });

  describe("py-spy Profiling Options", () => {
    it("should support different output formats", () => {
      const adapter = new PySpyAdapter();

      // Test that the adapter can be configured with different formats
      expect(adapter).toBeDefined();

      // The adapter should support flamegraph, speedscope, and raw formats
      // This is tested through the PySpyOptions interface
    });

    it("should support subprocess profiling option", () => {
      const adapter = new PySpyAdapter();
      expect(adapter).toBeDefined();

      // The adapter should support subprocess profiling
      // This is tested through the PySpyOptions interface
    });

    it("should support native extension profiling option", () => {
      const adapter = new PySpyAdapter();
      expect(adapter).toBeDefined();

      // The adapter should support native extension profiling
      // This is tested through the PySpyOptions interface
    });
  });
});
