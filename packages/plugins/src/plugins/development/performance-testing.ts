/**
 * Performance Testing Plugin
 * Load testing and performance validation for MCP servers
 * Requirements: 5.1, 5.4, 11.2
 * Performance: Detailed reporting with regression detection
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
  PerformanceThresholds,
} from "@brainwav/cortexdx-core";

export const PerformanceTestingPlugin: DevelopmentPlugin = {
  id: "performance-testing",
  title: "MCP Performance Testing",
  category: "development",
  order: 22,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "perftest.llm.missing",
        area: "development",
        severity: "minor",
        title: "Performance testing LLM not available",
        description:
          "No LLM adapter configured for performance test generation.",
        evidence: [{ type: "log", ref: "performance-testing" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered performance test generation.",
      });
      return findings;
    }

    if (ctx.projectContext) {
      const { type, language, sourceFiles, configFiles } = ctx.projectContext;

      // Check for performance test files
      const hasPerfTests = sourceFiles.some(
        (f) =>
          f.includes("perf") ||
          f.includes("load") ||
          f.includes("stress") ||
          f.includes("benchmark"),
      );

      if (!hasPerfTests && type === "mcp-server") {
        findings.push({
          id: "perftest.no_tests",
          area: "development",
          severity: "minor",
          title: "No performance tests found",
          description:
            "MCP server lacks load testing and performance validation.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate comprehensive performance tests including:\n" +
            "- Load testing for concurrent connections\n" +
            "- Stress testing for resource limits\n" +
            "- Latency benchmarks for tool execution\n" +
            "- Throughput testing for message handling\n" +
            "- Memory leak detection\n" +
            "- Performance regression detection",
          remediation: {
            filePlan: generatePerfTestFilePlan(language),
            steps: [
              "Create load testing framework",
              "Generate concurrent connection tests",
              "Add stress testing scenarios",
              "Implement latency benchmarks",
              "Create throughput measurement tests",
              "Add memory profiling tests",
              "Set up performance regression detection",
            ],
          },
        });
      }

      // Check for performance monitoring configuration
      const hasMonitoring = configFiles.some(
        (f) =>
          f.includes("prometheus") ||
          f.includes("grafana") ||
          f.includes("metrics"),
      );

      if (!hasMonitoring && type === "mcp-server") {
        findings.push({
          id: "perftest.no_monitoring",
          area: "development",
          severity: "info",
          title: "Performance monitoring not configured",
          description: "No performance monitoring or metrics collection found.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can set up performance monitoring with:\n" +
            "- Prometheus metrics collection\n" +
            "- Grafana dashboards for visualization\n" +
            "- Custom metrics for MCP operations\n" +
            "- Alerting for performance degradation\n" +
            "- Real-time performance tracking",
        });
      }

      // Analyze current performance if endpoint available
      if (ctx.endpoint) {
        const perfAnalysis = await analyzeCurrentPerformance(ctx);
        if (perfAnalysis.findings.length > 0) {
          findings.push(...perfAnalysis.findings);
        }
      }

      // Check for performance baselines
      const hasBaselines = configFiles.some(
        (f) =>
          f.includes("baseline") ||
          f.includes("benchmark") ||
          f.includes("perf.json"),
      );

      if (!hasBaselines && hasPerfTests) {
        findings.push({
          id: "perftest.no_baselines",
          area: "development",
          severity: "info",
          title: "Performance baselines not established",
          description:
            "Performance tests exist but no baseline metrics for comparison.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can help establish performance baselines:\n" +
            "- Run initial performance tests\n" +
            "- Record baseline metrics\n" +
            "- Set up regression detection thresholds\n" +
            "- Create performance budget configuration\n" +
            "- Enable automated baseline updates",
        });
      }

      // Check for load testing tools configuration
      const hasLoadTestTools = configFiles.some(
        (f) =>
          f.includes("k6") ||
          f.includes("artillery") ||
          f.includes("locust") ||
          f.includes("jmeter"),
      );

      if (!hasLoadTestTools && !hasPerfTests) {
        findings.push({
          id: "perftest.no_tools",
          area: "development",
          severity: "info",
          title: "Load testing tools not configured",
          description: "No load testing framework detected.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can set up load testing with:\n" +
            "- k6 for JavaScript/TypeScript (recommended for MCP)\n" +
            "- Artillery for Node.js applications\n" +
            "- Locust for Python applications\n" +
            "- Custom load testing scripts\n\n" +
            "Which tool would you prefer?",
        });
      }
    }

    // Check conversation for performance testing requests
    const recentMessages = ctx.conversationHistory.slice(-3);
    const hasPerfRequest = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("performance") ||
          msg.content.toLowerCase().includes("load") ||
          msg.content.toLowerCase().includes("stress") ||
          msg.content.toLowerCase().includes("benchmark") ||
          msg.content.toLowerCase().includes("latency") ||
          msg.content.toLowerCase().includes("throughput")),
    );

    if (hasPerfRequest) {
      findings.push({
        id: "perftest.request.detected",
        area: "development",
        severity: "info",
        title: "Performance testing request detected",
        description:
          "I can help you set up comprehensive performance testing for your MCP server.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Available performance testing options:\n" +
          "- Load testing (concurrent connections)\n" +
          "- Stress testing (resource limits)\n" +
          "- Latency benchmarks (response times)\n" +
          "- Throughput testing (messages per second)\n" +
          "- Memory profiling (leak detection)\n" +
          "- Performance regression detection\n\n" +
          "Tell me which tests you need or ask me to generate a complete performance test suite.",
      });
    }

    // Validate performance
    const duration = Date.now() - startTime;
    ctx.logger(`Performance testing analysis completed in ${duration}ms`);

    return findings;
  },
};

function generatePerfTestFilePlan(language: string): FilePlan {
  const plan: FilePlan = [];

  if (language === "typescript" || language === "javascript") {
    plan.push(
      {
        action: "new",
        path: "tests/performance/load-test.ts",
        description: "Load testing for concurrent connections",
      },
      {
        action: "new",
        path: "tests/performance/stress-test.ts",
        description: "Stress testing for resource limits",
      },
      {
        action: "new",
        path: "tests/performance/latency-benchmark.ts",
        description: "Latency benchmarks for tool execution",
      },
      {
        action: "new",
        path: "tests/performance/throughput-test.ts",
        description: "Throughput testing for message handling",
      },
      {
        action: "new",
        path: "tests/performance/memory-profile.ts",
        description: "Memory leak detection tests",
      },
      {
        action: "new",
        path: "k6-load-test.js",
        description: "k6 load testing script",
      },
      {
        action: "new",
        path: "performance-baselines.json",
        description: "Performance baseline metrics",
      },
    );
  } else if (language === "python") {
    plan.push(
      {
        action: "new",
        path: "tests/performance/test_load.py",
        description: "Load testing for concurrent connections",
      },
      {
        action: "new",
        path: "tests/performance/test_stress.py",
        description: "Stress testing for resource limits",
      },
      {
        action: "new",
        path: "tests/performance/test_latency.py",
        description: "Latency benchmarks",
      },
      {
        action: "new",
        path: "locustfile.py",
        description: "Locust load testing configuration",
      },
      {
        action: "new",
        path: "performance_baselines.json",
        description: "Performance baseline metrics",
      },
    );
  }

  return plan;
}

async function analyzeCurrentPerformance(
  ctx: DevelopmentContext,
): Promise<{ findings: Finding[] }> {
  const findings: Finding[] = [];

  try {
    // Measure basic response time
    const measurementStart = Date.now();
    await ctx.request(ctx.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...ctx.headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "cortexdx-performance-test",
            version: "1.0.0",
          },
        },
      }),
    });
    const responseTime = Date.now() - measurementStart;

    // Define performance thresholds
    const thresholds: PerformanceThresholds = {
      maxResponseTimeMs: 1000,
      maxMemoryUsageMb: 512,
      maxCpuUsagePercent: 80,
      maxLlmInferenceTimeMs: 2000,
    };

    // Check response time
    if (responseTime > thresholds.maxResponseTimeMs) {
      findings.push({
        id: "perftest.slow_response",
        area: "performance",
        severity: "minor",
        title: "Slow server response time",
        description: `Server responded in ${responseTime}ms, exceeding ${thresholds.maxResponseTimeMs}ms threshold.`,
        evidence: [
          { type: "log", ref: "performance-measurement" },
          { type: "url", ref: ctx.endpoint },
        ],
        recommendation:
          "Consider optimizing:\n" +
          "- Database query performance\n" +
          "- Network latency\n" +
          "- Server resource allocation\n" +
          "- Caching strategies\n" +
          "- Connection pooling",
        confidence: 0.9,
      });
    } else {
      findings.push({
        id: "perftest.good_response",
        area: "performance",
        severity: "info",
        title: "Good server response time",
        description: `Server responded in ${responseTime}ms, within acceptable range.`,
        evidence: [
          { type: "log", ref: "performance-measurement" },
          { type: "url", ref: ctx.endpoint },
        ],
        confidence: 1.0,
      });
    }

    // Suggest comprehensive performance testing
    findings.push({
      id: "perftest.comprehensive_needed",
      area: "performance",
      severity: "info",
      title: "Comprehensive performance testing recommended",
      description:
        "Basic response time measured. Comprehensive testing needed for production readiness.",
      evidence: [{ type: "log", ref: "performance-measurement" }],
      recommendation:
        "Run comprehensive performance tests:\n" +
        "- Load testing with multiple concurrent users\n" +
        "- Stress testing to find breaking points\n" +
        "- Sustained load testing for stability\n" +
        "- Memory leak detection over time\n" +
        "- Performance regression testing",
    });
  } catch (error) {
    findings.push({
      id: "perftest.measurement_failed",
      area: "performance",
      severity: "minor",
      title: "Performance measurement failed",
      description: `Could not measure server performance: ${error}`,
      evidence: [
        { type: "log", ref: "performance-measurement" },
        { type: "url", ref: ctx.endpoint },
      ],
      recommendation:
        "Ensure server is running and accessible before performance testing.",
    });
  }

  return { findings };
}
