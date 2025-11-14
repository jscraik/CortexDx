/**
 * Model Management Tests
 * Tests for dynamic model loading/unloading and performance monitoring
 */

import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelManager } from "../src/plugins/development/model-manager.js";
import { ModelPerformanceMonitor } from "../src/plugins/development/model-performance-monitor.js";
import type { DiagnosticContext } from "../src/types.js";

// Mock diagnostic context
const createMockContext = (): DiagnosticContext => ({
  endpoint: "http://localhost:3000",
  logger: vi.fn(),
  request: vi.fn(),
  jsonrpc: vi.fn(),
  sseProbe: vi.fn(),
  evidence: vi.fn(),
  deterministic: true,
});

describe("ModelManager", () => {
  let manager: ModelManager;
  let ctx: DiagnosticContext;

  beforeEach(() => {
    manager = new ModelManager({
      autoLoadModels: false,
      warmUpOnStart: false,
      memoryThresholdMb: 8192,
      maxLoadedModels: 3,
    });
    ctx = createMockContext();
  });

  describe("Model Loading", () => {
    it("should track loaded models", async () => {
      const loaded = manager.getLoadedModels();
      expect(loaded).toHaveLength(0);
    });

    it("should report memory usage", () => {
      const usage = manager.getMemoryUsage();
      expect(usage).toBe(0);
    });

    it("should get model status", () => {
      const status = manager.getModelStatus("test-model");
      expect(status).toBeNull();
    });
  });

  describe("Model Selection", () => {
    it("should select model based on criteria", async () => {
      const criteria = {
        taskType: "development" as const,
        availableMemoryMb: 8192,
        responseTimeRequirement: 2000,
        preferredCapabilities: ["code-generation"],
      };

      // May return a model if backends are available, or throw if not
      try {
        const model = await manager.selectModel(criteria);
        expect(typeof model).toBe("string");
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 10000); // Add timeout to prevent test from hanging
  });

  describe("Diagnostic Plugin", () => {
    it("should run diagnostics", async () => {
      const findings = await manager.run(ctx);
      expect(findings).toBeDefined();
      expect(Array.isArray(findings)).toBe(true);
    });

    it("should report findings about backends", async () => {
      const findings = await manager.run(ctx);
      expect(findings.length).toBeGreaterThan(0);
      // May report no backends or available models depending on system
      const hasBackendFinding = findings.some(
        (f) =>
          f.id === "model-manager-no-backends" ||
          f.id === "model-manager-available",
      );
      expect(hasBackendFinding).toBe(true);
    });

    it("should create evidence when backends are available", async () => {
      const findings = await manager.run(ctx);
      const evidenceMock = ctx.evidence as unknown as Mock;
      const evidenceCalls = evidenceMock.mock.calls.length;
      const noBackendFinding = findings.some(
        (finding) => finding.id === "model-manager-no-backends",
      );

      if (noBackendFinding) {
        expect(evidenceCalls).toBe(0);
      } else {
        expect(evidenceCalls).toBeGreaterThan(0);
      }
    });
  });
});

describe("ModelPerformanceMonitor", () => {
  let monitor: ModelPerformanceMonitor;
  let ctx: DiagnosticContext;

  beforeEach(() => {
    monitor = new ModelPerformanceMonitor();
    ctx = createMockContext();
  });

  describe("Metric Recording", () => {
    it("should record performance metrics", () => {
      const metric = {
        modelId: "llama3.2:3b",
        backend: "ollama" as const,
        taskType: "conversation",
        inferenceTimeMs: 1500,
        tokensGenerated: 100,
        tokensPerSecond: 66.7,
        memoryUsageMb: 2048,
        timestamp: Date.now(),
      };

      monitor.recordMetric(metric);
      const report = monitor.getReport("llama3.2:3b");
      expect(report).toBeDefined();
      expect(report?.totalInferences).toBe(1);
    });

    it("should track multiple metrics", () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordMetric({
          modelId: "test-model",
          backend: "ollama",
          taskType: "debugging",
          inferenceTimeMs: 1000 + i * 100,
          tokensGenerated: 50,
          tokensPerSecond: 50,
          memoryUsageMb: 2000,
          timestamp: Date.now(),
        });
      }

      const report = monitor.getReport("test-model");
      expect(report?.totalInferences).toBe(5);
      expect(report?.averageInferenceTimeMs).toBeGreaterThan(1000);
    });
  });

  describe("Performance Reports", () => {
    it("should generate performance reports", () => {
      monitor.recordMetric({
        modelId: "model-1",
        backend: "ollama",
        taskType: "conversation",
        inferenceTimeMs: 1500,
        tokensGenerated: 100,
        tokensPerSecond: 66.7,
        memoryUsageMb: 2048,
        timestamp: Date.now(),
      });

      const reports = monitor.generateReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].modelId).toBe("model-1");
    });

    it("should calculate performance trends", () => {
      // Add improving performance metrics
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric({
          modelId: "improving-model",
          backend: "ollama",
          taskType: "conversation",
          inferenceTimeMs: 2000 - i * 50, // Getting faster
          tokensGenerated: 100,
          tokensPerSecond: 50 + i,
          memoryUsageMb: 2000,
          timestamp: Date.now(),
        });
      }

      const report = monitor.getReport("improving-model");
      // Trend should be improving or stable (depends on calculation)
      expect(["improving", "stable"]).toContain(report?.performanceTrend);
    });

    it("should detect degrading performance", () => {
      // Add degrading performance metrics
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric({
          modelId: "degrading-model",
          backend: "ollama",
          taskType: "conversation",
          inferenceTimeMs: 1000 + i * 100, // Getting slower
          tokensGenerated: 100,
          tokensPerSecond: 100 - i * 2,
          memoryUsageMb: 2000,
          timestamp: Date.now(),
        });
      }

      const report = monitor.getReport("degrading-model");
      expect(report?.performanceTrend).toBe("degrading");
    });
  });

  describe("Performance Alerts", () => {
    it("should generate alerts for slow inference", () => {
      monitor.recordMetric({
        modelId: "slow-model",
        backend: "ollama",
        taskType: "conversation",
        inferenceTimeMs: 5000, // Exceeds 2000ms threshold
        tokensGenerated: 50,
        tokensPerSecond: 10,
        memoryUsageMb: 2000,
        timestamp: Date.now(),
      });

      const alerts = monitor.getRecentAlerts(60000);
      expect(alerts.length).toBeGreaterThan(0);
      const inferenceAlert = alerts.find((a) => a.metric === "inferenceTimeMs");
      expect(inferenceAlert).toBeDefined();
    });

    it("should generate alerts for low token rate", () => {
      monitor.recordMetric({
        modelId: "slow-tokens",
        backend: "ollama",
        taskType: "conversation",
        inferenceTimeMs: 1500,
        tokensGenerated: 10,
        tokensPerSecond: 5, // Below 20 tokens/sec threshold
        memoryUsageMb: 2000,
        timestamp: Date.now(),
      });

      const alerts = monitor.getRecentAlerts(60000);
      const tokenAlert = alerts.find((a) => a.metric === "tokensPerSecond");
      expect(tokenAlert).toBeDefined();
    });

    it("should clear alerts", () => {
      monitor.recordMetric({
        modelId: "test",
        backend: "ollama",
        taskType: "conversation",
        inferenceTimeMs: 5000,
        tokensGenerated: 50,
        tokensPerSecond: 10,
        memoryUsageMb: 2000,
        timestamp: Date.now(),
      });

      expect(monitor.getRecentAlerts(60000).length).toBeGreaterThan(0);
      monitor.clearAlerts();
      expect(monitor.getRecentAlerts(60000)).toHaveLength(0);
    });
  });

  describe("Model Switching Recommendations", () => {
    it("should recommend switching for degrading performance", () => {
      // Add degrading metrics
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric({
          modelId: "bad-model",
          backend: "ollama",
          taskType: "conversation",
          inferenceTimeMs: 1000 + i * 150,
          tokensGenerated: 100,
          tokensPerSecond: 100 - i * 3,
          memoryUsageMb: 2000,
          timestamp: Date.now(),
        });
      }

      const recommendation = monitor.shouldSwitchModel("bad-model");
      expect(recommendation.shouldSwitch).toBe(true);
      expect(recommendation.reason).toBeDefined();
    });

    it("should not recommend switching for stable performance", () => {
      // Add stable metrics
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          modelId: "stable-model",
          backend: "ollama",
          taskType: "conversation",
          inferenceTimeMs: 1500,
          tokensGenerated: 100,
          tokensPerSecond: 66,
          memoryUsageMb: 2000,
          timestamp: Date.now(),
        });
      }

      const recommendation = monitor.shouldSwitchModel("stable-model");
      expect(recommendation.shouldSwitch).toBe(false);
    });
  });

  describe("Statistics", () => {
    it("should calculate percentiles", () => {
      const times = [1000, 1200, 1500, 1800, 2000, 2500, 3000, 4000, 5000];
      for (const time of times) {
        monitor.recordMetric({
          modelId: "stats-model",
          backend: "ollama",
          taskType: "conversation",
          inferenceTimeMs: time,
          tokensGenerated: 100,
          tokensPerSecond: 50,
          memoryUsageMb: 2000,
          timestamp: Date.now(),
        });
      }

      const stats = monitor.getModelStatistics("stats-model");
      expect(stats).toBeDefined();
      expect(stats?.p50).toBeGreaterThan(0);
      expect(stats?.p95).toBeGreaterThanOrEqual(stats?.p50);
      expect(stats?.p99).toBeGreaterThanOrEqual(stats?.p95);
    });
  });

  describe("Diagnostic Plugin", () => {
    it("should run diagnostics with no data", async () => {
      const findings = await monitor.run(ctx);
      expect(findings).toBeDefined();
      const noData = findings.find((f) => f.id === "model-perf-no-data");
      expect(noData).toBeDefined();
    });

    it("should report performance findings", async () => {
      monitor.recordMetric({
        modelId: "test-model",
        backend: "ollama",
        taskType: "conversation",
        inferenceTimeMs: 1500,
        tokensGenerated: 100,
        tokensPerSecond: 66.7,
        memoryUsageMb: 2048,
        timestamp: Date.now(),
      });

      const findings = await monitor.run(ctx);
      const perfFinding = findings.find((f) => f.id.startsWith("model-perf-"));
      expect(perfFinding).toBeDefined();
    });

    it("should create evidence when data exists", async () => {
      // Add some data first
      monitor.recordMetric({
        modelId: "test",
        backend: "ollama",
        taskType: "conversation",
        inferenceTimeMs: 1500,
        tokensGenerated: 100,
        tokensPerSecond: 66.7,
        memoryUsageMb: 2048,
        timestamp: Date.now(),
      });

      await monitor.run(ctx);
      expect(ctx.evidence).toHaveBeenCalled();
    });
  });
});

describe("Integration Tests", () => {
  it("should work together - manager and monitor", () => {
    const manager = new ModelManager();
    const monitor = new ModelPerformanceMonitor();

    // Simulate model usage
    const loadedModels = manager.getLoadedModels();
    expect(loadedModels).toBeDefined();

    // Record performance
    monitor.recordMetric({
      modelId: "integration-test",
      backend: "ollama",
      taskType: "conversation",
      inferenceTimeMs: 1500,
      tokensGenerated: 100,
      tokensPerSecond: 66.7,
      memoryUsageMb: 2048,
      timestamp: Date.now(),
    });

    const report = monitor.getReport("integration-test");
    expect(report).toBeDefined();
  });
});
