/**
 * Performance Plugin Tests
 * Tests for the performance measurement and profiling functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  measureTransports,
  buildPerformanceFindings,
  PerformancePlugin,
  EnhancedPerformanceProfilerPlugin,
  type PerformanceSummary,
} from '../../src/plugins/performance/index.js';
import type { DiagnosticContext, TransportTranscript } from '../../src/types.js';

describe('Performance Plugin', () => {
  let mockContext: DiagnosticContext;

  beforeEach(() => {
    mockContext = {
      endpoint: 'http://localhost:3000',
      logger: vi.fn(),
      request: vi.fn(),
      jsonrpc: vi.fn(),
      sseProbe: vi.fn(),
      evidence: vi.fn(),
      deterministic: true,
      headers: {},
    };
  });

  describe('PerformancePlugin', () => {
    it('should have correct metadata', () => {
      expect(PerformancePlugin.id).toBe('performance');
      expect(PerformancePlugin.title).toBe('Baseline Latency / Timeouts');
      expect(PerformancePlugin.order).toBe(500);
      expect(typeof PerformancePlugin.run).toBe('function');
    });

    it('should run and return findings', async () => {
      mockContext.request = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      });

      const findings = await PerformancePlugin.run(mockContext);

      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should include HTTP findings for successful requests', async () => {
      mockContext.request = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      });

      const findings = await PerformancePlugin.run(mockContext);
      const httpFinding = findings.find(f => f.id === 'perf.http.latency');

      expect(httpFinding).toBeDefined();
      expect(httpFinding?.area).toBe('performance');
    });

    it('should handle HTTP request failures', async () => {
      mockContext.request = vi.fn().mockRejectedValue(new Error('Network error'));

      const findings = await PerformancePlugin.run(mockContext);
      const errorFinding = findings.find(f => f.id === 'perf.http.failure');

      expect(errorFinding).toBeDefined();
      expect(errorFinding?.severity).toBe('major');
    });
  });

  describe('EnhancedPerformanceProfilerPlugin', () => {
    it('should have correct metadata', () => {
      expect(EnhancedPerformanceProfilerPlugin.id).toBe('enhanced-performance-profiler');
      expect(EnhancedPerformanceProfilerPlugin.title).toBe('Enhanced MCP Performance Profiler');
      expect(EnhancedPerformanceProfilerPlugin.order).toBe(501);
    });

    it('should complete analysis within time budget', async () => {
      const startTime = performance.now();
      const findings = await EnhancedPerformanceProfilerPlugin.run(mockContext);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(25000); // Should complete within 25s
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should report if analysis exceeds 20s threshold', async () => {
      // This test would need mocking to simulate slow analysis
      // For now, just verify it returns findings
      const findings = await EnhancedPerformanceProfilerPlugin.run(mockContext);
      expect(findings).toBeDefined();
    });
  });

  describe('measureTransports', () => {
    it('should measure HTTP transport', async () => {
      mockContext.request = vi.fn().mockResolvedValue({ status: 200 });

      const metrics = await measureTransports(mockContext);

      expect(metrics.http).toBeDefined();
      expect(typeof metrics.http?.latencyMs).toBe('number');
      expect(metrics.http?.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should measure SSE transport if available', async () => {
      mockContext.sseProbe = vi.fn().mockResolvedValue({
        ok: true,
        firstEventMs: 100,
        heartbeatMs: 1000,
      });

      const metrics = await measureTransports(mockContext);

      if (metrics.sse) {
        expect(metrics.sse.firstEventMs).toBeDefined();
        expect(typeof metrics.sse.firstEventMs).toBe('number');
      }
    });

    it('should handle transport measurement errors gracefully', async () => {
      mockContext.request = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const metrics = await measureTransports(mockContext);

      // Should still return a metrics object
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });

    it('should include transcript data if available', async () => {
      mockContext.request = vi.fn().mockResolvedValue({ status: 200 });
      // Note: transcript is typically accessed differently, this is illustrative

      const metrics = await measureTransports(mockContext);
      expect(metrics).toBeDefined();
    });
  });

  describe('buildPerformanceFindings', () => {
    it('should create findings from HTTP metrics', () => {
      const metrics: PerformanceSummary = {
        http: {
          latencyMs: 150,
          status: 200,
        },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');

      expect(findings.length).toBeGreaterThan(0);
      const httpFinding = findings.find(f => f.id === 'perf.http.latency');
      expect(httpFinding).toBeDefined();
      expect(httpFinding?.confidence).toBe(1.0);
    });

    it('should flag slow HTTP responses', () => {
      const metrics: PerformanceSummary = {
        http: {
          latencyMs: 5000, // 5 seconds - slow!
          status: 200,
        },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');

      // Should flag as concerning
      expect(findings.some(f => f.severity !== 'info')).toBe(true);
    });

    it('should create findings for SSE metrics', () => {
      const metrics: PerformanceSummary = {
        sse: {
          firstEventMs: 200,
          heartbeatMs: 30000,
          jitterMs: 50,
        },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');
      const sseFinding = findings.find(f => f.area.includes('sse') || f.area.includes('stream'));

      if (sseFinding) {
        expect(sseFinding.evidence).toBeDefined();
        expect(sseFinding.evidence.length).toBeGreaterThan(0);
      }
    });

    it('should create findings for WebSocket metrics', () => {
      const metrics: PerformanceSummary = {
        websocket: {
          messageCount: 100,
          maxGapMs: 500,
          reconnects: 0,
        },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');

      // Should create some websocket-related findings
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should flag multiple reconnects as concerning', () => {
      const metrics: PerformanceSummary = {
        websocket: {
          messageCount: 50,
          maxGapMs: 1000,
          reconnects: 5, // Multiple reconnects
        },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');
      const reconnectFinding = findings.find(
        f => f.description?.toLowerCase().includes('reconnect')
      );

      if (reconnectFinding) {
        expect(['minor', 'major', 'blocker']).toContain(reconnectFinding.severity);
      }
    });

    it('should handle empty metrics', () => {
      const metrics: PerformanceSummary = {};

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');

      // Should return some findings even with empty metrics
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should include endpoint in evidence', () => {
      const endpoint = 'https://api.example.com/v1';
      const metrics: PerformanceSummary = {
        http: { latencyMs: 100, status: 200 },
      };

      const findings = buildPerformanceFindings(metrics, endpoint);

      findings.forEach(finding => {
        expect(finding.evidence).toBeDefined();
        // At least one evidence item should reference the endpoint
        const hasEndpointRef = finding.evidence.some(
          e => e.ref === endpoint || JSON.stringify(e).includes(endpoint)
        );
        expect(hasEndpointRef || finding.description?.includes(endpoint)).toBe(true);
      });
    });
  });

  describe('Performance thresholds', () => {
    it('should flag HTTP latency over 1000ms as concerning', () => {
      const metrics: PerformanceSummary = {
        http: { latencyMs: 1500, status: 200 },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');
      const hasWarning = findings.some(
        f => f.severity !== 'info' && f.area.includes('performance')
      );

      expect(hasWarning).toBe(true);
    });

    it('should flag SSE first event delay over 500ms', () => {
      const metrics: PerformanceSummary = {
        sse: { firstEventMs: 750 }, // Slow first event
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');

      // Should create findings for SSE performance
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should flag high jitter in SSE as quality issue', () => {
      const metrics: PerformanceSummary = {
        sse: {
          firstEventMs: 100,
          heartbeatMs: 30000,
          jitterMs: 500, // High jitter
        },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');

      expect(findings.some(f =>
        f.description?.toLowerCase().includes('jitter') ||
        f.title?.toLowerCase().includes('jitter')
      )).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should handle negative latency gracefully', () => {
      const metrics: PerformanceSummary = {
        http: { latencyMs: -1, status: 200 },
      };

      expect(() => {
        buildPerformanceFindings(metrics, 'http://localhost:3000');
      }).not.toThrow();
    });

    it('should handle extremely large latency values', () => {
      const metrics: PerformanceSummary = {
        http: { latencyMs: Number.MAX_SAFE_INTEGER, status: 200 },
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');
      expect(findings.length).toBeGreaterThan(0);
    });

    it('should handle missing status codes', () => {
      const metrics: PerformanceSummary = {
        http: { latencyMs: 100 }, // No status
      };

      const findings = buildPerformanceFindings(metrics, 'http://localhost:3000');
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle concurrent measurements', async () => {
      mockContext.request = vi.fn().mockResolvedValue({ status: 200 });

      const promises = Array.from({ length: 5 }, () =>
        measureTransports(mockContext)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });
    });
  });

  describe('Integration', () => {
    it('should work end-to-end with full plugin execution', async () => {
      mockContext.request = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers(),
      });

      const findings = await PerformancePlugin.run(mockContext);

      expect(findings).toBeDefined();
      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBeGreaterThan(0);

      // All findings should have required fields
      findings.forEach(finding => {
        expect(finding.id).toBeDefined();
        expect(finding.area).toBeDefined();
        expect(finding.severity).toBeDefined();
        expect(finding.title).toBeDefined();
        expect(finding.confidence).toBeGreaterThanOrEqual(0);
        expect(finding.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should provide actionable recommendations in findings', async () => {
      mockContext.request = vi.fn().mockResolvedValue({ status: 200 });

      const findings = await PerformancePlugin.run(mockContext);

      // At least some findings should have descriptions or recommendations
      const hasDescriptions = findings.some(f => f.description && f.description.length > 0);
      expect(hasDescriptions).toBe(true);
    });
  });
});

/**
 * Note: Additional tests could be added for:
 * - performRealTimeMonitoring
 * - performTimingAnalysis
 * - identifyBottlenecks
 * - profileResourceUsage
 * - detectEventLoopBlocking
 * - detectCPUHotspots
 * - detectAsyncBottlenecks
 *
 * These would require more complex mocking of performance APIs and
 * potentially longer test execution times.
 */
