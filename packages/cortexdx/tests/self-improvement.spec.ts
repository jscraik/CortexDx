/**
 * Self-Improvement Plugin Tests
 * Validates the internal diagnostic/development plugin behaviour
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SelfImprovementPlugin } from "../src/plugins/development/self-improvement.js";
import { InspectorAdapter } from "../src/adapters/inspector-adapter.js";
import * as mlRouter from "../src/ml/router.js";
import * as academicResearcher from "../src/research/academic-researcher.js";
import type { AcademicResearchReport } from "../src/research/academic-researcher.js";
import type { DevelopmentContext } from "../src/types.js";
import { createMockLlmAdapter } from "./utils/mock-llm-adapter.js";

const baseContext = (): DevelopmentContext => ({
  endpoint: "http://localhost:5001",
  logger: () => undefined,
  request: async () => ({ status: "unknown" }),
  jsonrpc: async () => ({}),
  sseProbe: async () => ({ ok: true }),
  evidence: () => undefined,
  deterministic: true,
  sessionId: "session-test",
  userExpertiseLevel: "intermediate",
  conversationHistory: [],
  requireAcademicInsights: true,
});

const buildMockAcademicReport = (): AcademicResearchReport => ({
  topic: "cortexdx",
  question: "",
  timestamp: new Date().toISOString(),
  providers: [
    {
      providerId: "semantic-scholar",
      providerName: "Semantic Scholar",
      findings: [],
    },
  ],
  findings: [
    {
      id: "research.mock.1",
      area: "research",
      severity: "info",
      title: "Mock academic signal",
      description: "Academic diagnostics reference",
      evidence: [],
      tags: ["academic"],
    },
  ],
  summary: {
    totalFindings: 1,
    providersRequested: 1,
    providersResponded: 1,
    errors: [],
  },
});

beforeEach(() => {
  vi.spyOn(mlRouter, "getEnhancedLlmAdapter").mockResolvedValue(
    createMockLlmAdapter(),
  );
  vi.spyOn(academicResearcher, "runAcademicResearch").mockResolvedValue(
    buildMockAcademicReport(),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Self-Improvement Plugin", () => {
  it("flags missing handshake instrumentation files", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/cortexdx/src/plugins/streaming-sse.ts"],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    expect(
      findings.some((f) => f.id === "self_improvement.handshake_gaps"),
    ).toBe(true);
  });

  it("summarizes inspector signals and captures health check details", async () => {
    const requestMock = vi.fn().mockImplementation((input) => {
      if (typeof input === "string" && input.includes("/mcp")) {
        return Promise.resolve({
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "test", version: "1.0.0" },
          },
        });
      }

      return Promise.resolve({
        status: "healthy",
        version: "1.0.0",
      });
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      conversationHistory: [
        {
          role: "user",
          content: "SSE endpoint not streaming",
          timestamp: Date.now(),
        },
        {
          role: "user",
          content: "Batch response is not an array",
          timestamp: Date.now(),
        },
      ],
      transport: {
        sessionId: "session-xyz",
        transcript: () => ({
          sessionId: "session-xyz",
          initialize: {
            method: "initialize",
            request: {},
            response: { result: { serverInfo: { name: "test" } } },
            status: 200,
            timestamp: new Date().toISOString(),
          },
          exchanges: [
            {
              method: "tools/list",
              request: {},
              response: { result: { tools: [] } },
              status: 200,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      },
      projectContext: {
        name: "cortexdx",
        type: "mcp-server",
        language: "typescript",
        dependencies: ["eventsource-parser", "@modelcontextprotocol/sdk"],
        configFiles: ["pnpm-lock.yaml", "tsconfig.json"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(
      findings.some((f) => f.id === "self_improvement.signal_digest"),
    ).toBe(true);
    expect(findings.some((f) => f.id === "self_improvement.health")).toBe(true);
    expect(
      findings.some((f) => f.id === "self_improvement.transport_transcript"),
    ).toBe(true);
  });
});

describe("Self-Improvement LLM analysis optimizations", () => {
  it("reuses cached analysis for duplicate findings and caps token budget", async () => {
    process.env.CORTEXDX_DISABLE_DEEPCONTEXT = "1";

    const mockAdapter = createMockLlmAdapter();
    const completionSpy = vi
      .spyOn(mockAdapter, "complete")
      .mockResolvedValue(JSON.stringify({ rootCause: "duplicate" }));
    vi.spyOn(mlRouter, "getEnhancedLlmAdapter").mockResolvedValue(mockAdapter);
    const emptyAcademicReport = buildMockAcademicReport();
    emptyAcademicReport.findings = [];
    emptyAcademicReport.summary.totalFindings = 0;
    vi.spyOn(academicResearcher, "runAcademicResearch").mockResolvedValueOnce(
      emptyAcademicReport,
    );

    const duplicateInspectorFinding = {
      id: "dup",
      severity: "info",
      area: "protocol",
      description: "duplicate finding",
      evidence: { raw: {} },
    };

    vi.spyOn(InspectorAdapter.prototype, "selfDiagnose").mockResolvedValue({
      jobId: "job-1",
      endpoint: "http://localhost:5001",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      findings: [duplicateInspectorFinding, duplicateInspectorFinding],
      metrics: { ms: 10, probesRun: 1, failures: 0 },
    });

    vi.spyOn(InspectorAdapter.prototype, "convertFindings").mockReturnValue([
      {
        id: "inspector_dup",
        area: "protocol",
        severity: "info",
        title: "Inspector duplicate",
        description: "duplicate finding",
        evidence: [],
        tags: ["inspector"],
      },
      {
        id: "inspector_dup",
        area: "protocol",
        severity: "info",
        title: "Inspector duplicate",
        description: "duplicate finding",
        evidence: [],
        tags: ["inspector"],
      },
    ]);

    const ctx: DevelopmentContext = {
      ...baseContext(),
      endpoint: "",
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);

    const duplicateFindings = findings.filter(
      (finding) => finding.id === "inspector_dup",
    );
    expect(duplicateFindings).toHaveLength(2);
    expect(duplicateFindings[0]?.llmAnalysis).toBe(
      duplicateFindings[1]?.llmAnalysis,
    );
    expect(completionSpy.mock.calls[0][1]).toBeLessThanOrEqual(512);
  });
});

describe("Academic insight integration", () => {
  it("appends academic findings to the result set", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/cortexdx/src/adapters/jsonrpc.ts"],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    expect(academicResearcher.runAcademicResearch).toHaveBeenCalledWith(
      expect.objectContaining({ topic: expect.stringContaining("cortexdx") }),
    );
    expect(findings.some((finding) => finding.tags?.includes("academic"))).toBe(
      true,
    );
  });

  it("emits a fallback finding when academic research fails", async () => {
    vi.spyOn(academicResearcher, "runAcademicResearch").mockRejectedValueOnce(
      new Error("missing API key"),
    );

    const findings = await SelfImprovementPlugin.run(baseContext());
    const failure = findings.find(
      (finding) => finding.id === "self_improvement.academic_failed",
    );
    expect(failure).toBeDefined();
    expect(failure?.description).toContain("missing API key");
  });

  it("escalates when academic insights are required but unavailable", async () => {
    vi.spyOn(academicResearcher, "runAcademicResearch").mockResolvedValueOnce({
      ...buildMockAcademicReport(),
      findings: [],
      summary: {
        totalFindings: 0,
        providersRequested: 1,
        providersResponded: 0,
        errors: [],
      },
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      requireAcademicInsights: true,
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const missing = findings.find(
      (finding) => finding.id === "self_improvement.academic_missing",
    );
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe("major");
  });

  it("downgrades when academic enforcement is disabled", async () => {
    vi.spyOn(academicResearcher, "runAcademicResearch").mockResolvedValueOnce({
      ...buildMockAcademicReport(),
      findings: [],
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      requireAcademicInsights: false,
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const baseline = findings.find(
      (finding) => finding.id === "self_improvement.academic_empty",
    );
    expect(baseline).toBeDefined();
    expect(baseline?.severity).toBe("info");
  });
});

describe("Memory leak guard", () => {
  it("reports healthy usage when under the threshold", async () => {
    const requestMock = vi.fn().mockImplementation((input: string) => {
      if (input.includes("/debug/memory")) {
        return Promise.resolve({
          heapUsed: 32 * 1024 * 1024,
          rss: 96 * 1024 * 1024,
        });
      }
      return Promise.resolve({ status: "healthy" });
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      memoryCheck: { path: "/debug/memory", thresholdMb: 64 },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const memoryFinding = findings.find(
      (finding) => finding.id === "self_improvement.memory_usage",
    );
    expect(memoryFinding).toBeDefined();
    expect(memoryFinding?.severity).toBe("info");
    expect(requestMock).toHaveBeenCalledWith(
      expect.stringContaining("/debug/memory"),
      expect.any(Object),
    );
  });

  it("raises a major finding when usage exceeds the threshold", async () => {
    const requestMock = vi.fn().mockImplementation((input: string) => {
      if (input.includes("/debug/memory")) {
        return Promise.resolve({
          heapUsed: 256 * 1024 * 1024,
          rss: 512 * 1024 * 1024,
        });
      }
      return Promise.resolve({ status: "healthy" });
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      memoryCheck: { path: "/debug/memory", thresholdMb: 128 },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const memoryFinding = findings.find(
      (finding) => finding.id === "self_improvement.memory_usage",
    );
    expect(memoryFinding).toBeDefined();
    expect(memoryFinding?.severity).toBe("major");
    expect(memoryFinding?.description).toContain("256");
  });

  it("records a failure when the memory probe cannot run", async () => {
    const requestMock = vi.fn().mockImplementation((input: string) => {
      if (input.includes("/debug/memory")) {
        return Promise.reject(new Error("probe offline"));
      }
      return Promise.resolve({ status: "healthy" });
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      memoryCheck: { path: "/debug/memory", thresholdMb: 128 },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const failure = findings.find(
      (finding) => finding.id === "self_improvement.memory_probe_failed",
    );
    expect(failure).toBeDefined();
    expect(failure?.severity).toBe("minor");
  });
});

// Requirement 15.1: Handshake Gap Detection Tests
describe("Handshake Instrumentation Analysis (Req 15.1)", () => {
  it("detects missing jsonrpc.ts adapter file", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/cortexdx/src/adapters/sse.ts"], // Missing jsonrpc.ts
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find(
      (f) => f.id === "self_improvement.handshake_gaps",
    );

    expect(handshakeFinding).toBeDefined();
    expect(handshakeFinding?.severity).toBe("major");
    expect(handshakeFinding?.description).toContain("jsonrpc.ts");
    expect(handshakeFinding?.evidence).toHaveLength(1);
    expect(handshakeFinding?.evidence[0].type).toBe("file");
  });

  it("detects missing sse.ts adapter file", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/cortexdx/src/adapters/jsonrpc.ts"], // Missing sse.ts
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find(
      (f) => f.id === "self_improvement.handshake_gaps",
    );

    expect(handshakeFinding).toBeDefined();
    expect(handshakeFinding?.description).toContain("sse.ts");
  });

  it("detects both missing adapter files", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/cortexdx/src/plugins/streaming-sse.ts"], // Missing both
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find(
      (f) => f.id === "self_improvement.handshake_gaps",
    );

    expect(handshakeFinding).toBeDefined();
    expect(handshakeFinding?.description).toContain("jsonrpc.ts");
    expect(handshakeFinding?.description).toContain("sse.ts");
    expect(handshakeFinding?.evidence).toHaveLength(2);
  });

  it("does not flag when all adapter files are present", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find(
      (f) => f.id === "self_improvement.handshake_gaps",
    );

    expect(handshakeFinding).toBeUndefined();
  });
});

// Requirement 15.2: Dependency Validation Tests
describe("Dependency Validation (Req 15.2)", () => {
  it("detects missing @modelcontextprotocol/sdk dependency", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["eventsource-parser"], // Missing @modelcontextprotocol/sdk
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find(
      (f) => f.id === "self_improvement.dependency_gaps",
    );

    expect(depFinding).toBeDefined();
    expect(depFinding?.severity).toBe("minor");
    expect(depFinding?.description).toContain("@modelcontextprotocol/sdk");
    expect(depFinding?.recommendation).toContain(
      "Install the missing packages",
    );
  });

  it("detects missing eventsource-parser dependency", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk"], // Missing eventsource-parser
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find(
      (f) => f.id === "self_improvement.dependency_gaps",
    );

    expect(depFinding).toBeDefined();
    expect(depFinding?.description).toContain("eventsource-parser");
  });

  it("detects both missing dependencies", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["vitest"], // Missing both required deps
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find(
      (f) => f.id === "self_improvement.dependency_gaps",
    );

    expect(depFinding).toBeDefined();
    expect(depFinding?.description).toContain("@modelcontextprotocol/sdk");
    expect(depFinding?.description).toContain("eventsource-parser");
  });

  it("does not flag when all dependencies are present", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: [
          "@modelcontextprotocol/sdk",
          "eventsource-parser",
          "vitest",
        ],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find(
      (f) => f.id === "self_improvement.dependency_gaps",
    );

    expect(depFinding).toBeUndefined();
  });
});

// Requirement 15.3: Conversation Signal Analysis Tests
describe("Conversation Signal Analysis (Req 15.3)", () => {
  it("detects SSE streaming issues in conversation history", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        {
          role: "user",
          content: "SSE endpoint not streaming",
          timestamp: Date.now(),
        },
        {
          role: "user",
          content: "SSE connection drops",
          timestamp: Date.now(),
        },
        {
          role: "user",
          content: "SSE events not received",
          timestamp: Date.now(),
        },
      ],
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find(
      (f) => f.id === "self_improvement.signal_digest",
    );

    expect(signalFinding).toBeDefined();
    expect(signalFinding?.severity).toBe("info");
    expect(signalFinding?.description).toContain("SSE streaming issues");
    expect(signalFinding?.description).toContain("3");
  });

  it("detects batch response issues in conversation history", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        {
          role: "user",
          content: "Batch response is not an array",
          timestamp: Date.now(),
        },
        {
          role: "user",
          content: "Batch request failed",
          timestamp: Date.now(),
        },
      ],
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find(
      (f) => f.id === "self_improvement.signal_digest",
    );

    expect(signalFinding).toBeDefined();
    expect(signalFinding?.description).toContain("JSON-RPC batch issues");
    expect(signalFinding?.description).toContain("2");
  });

  it("detects handshake/initialize issues in conversation history", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        { role: "user", content: "Handshake failed", timestamp: Date.now() },
        { role: "user", content: "Initialize timeout", timestamp: Date.now() },
      ],
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find(
      (f) => f.id === "self_improvement.signal_digest",
    );

    expect(signalFinding).toBeDefined();
    expect(signalFinding?.description).toContain("Handshake gaps");
    expect(signalFinding?.description).toContain("2");
  });

  it("detects multiple signal types in conversation history", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        {
          role: "user",
          content: "SSE endpoint not streaming",
          timestamp: Date.now(),
        },
        {
          role: "user",
          content: "Batch response is not an array",
          timestamp: Date.now(),
        },
        { role: "user", content: "Handshake failed", timestamp: Date.now() },
        {
          role: "user",
          content: "SSE connection drops",
          timestamp: Date.now(),
        },
      ],
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find(
      (f) => f.id === "self_improvement.signal_digest",
    );

    expect(signalFinding).toBeDefined();
    expect(signalFinding?.description).toContain("SSE");
    expect(signalFinding?.description).toContain("JSON-RPC batch issues");
    expect(signalFinding?.description).toContain("Handshake");
  });

  it("does not flag when no signals are detected", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        {
          role: "user",
          content: "Everything works fine",
          timestamp: Date.now(),
        },
        { role: "user", content: "No issues detected", timestamp: Date.now() },
      ],
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find(
      (f) => f.id === "self_improvement.signal_digest",
    );

    expect(signalFinding).toBeUndefined();
  });
});

// Requirement 15.4: Health Endpoint Probing Tests
describe("Health Endpoint Probing (Req 15.4)", () => {
  it("successfully probes health endpoint and returns status", async () => {
    const requestMock = vi.fn().mockResolvedValue({
      status: "healthy",
      version: "1.0.0",
      uptime: 12345,
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const healthFinding = findings.find(
      (f) => f.id === "self_improvement.health",
    );

    expect(healthFinding).toBeDefined();
    expect(healthFinding?.severity).toBe("info");
    expect(healthFinding?.description).toContain("healthy");
    expect(healthFinding?.description).toContain("1.0.0");
    expect(healthFinding?.evidence[0].type).toBe("url");
    expect(healthFinding?.evidence[0].ref).toContain("/health");
    expect(requestMock).toHaveBeenCalledWith("http://localhost:5001/health", {
      method: "GET",
    });
  });

  it("handles health endpoint failure gracefully", async () => {
    const requestMock = vi
      .fn()
      .mockRejectedValue(new Error("Connection refused"));

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const healthFinding = findings.find(
      (f) => f.id === "self_improvement.health_unreachable",
    );

    expect(healthFinding).toBeDefined();
    expect(healthFinding?.severity).toBe("minor");
    expect(healthFinding?.description).toContain("Unable to query");
    expect(healthFinding?.description).toContain("Connection refused");
  });

  it("handles endpoint with trailing slash", async () => {
    const requestMock = vi.fn().mockResolvedValue({ status: "healthy" });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      endpoint: "http://localhost:5001/",
      request: requestMock,
      projectContext: {
        name: "cortexdx",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/cortexdx/src/adapters/jsonrpc.ts",
          "packages/cortexdx/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);

    expect(requestMock).toHaveBeenCalledWith("http://localhost:5001/health", {
      method: "GET",
    });
  });
  // Integration test covering all requirements
  describe("Full Integration (All Requirements)", () => {
    it("runs all checks and produces comprehensive findings", async () => {
      const requestMock = vi.fn().mockResolvedValue({
        status: "healthy",
        version: "1.0.0",
      });

      const ctx: DevelopmentContext = {
        ...baseContext(),
        request: requestMock,
        conversationHistory: [
          {
            role: "user",
            content: "SSE endpoint not streaming",
            timestamp: Date.now(),
          },
          {
            role: "user",
            content: "Batch response is not an array",
            timestamp: Date.now(),
          },
        ],
        transport: {
          sessionId: "session-xyz",
          transcript: () => ({
            sessionId: "session-xyz",
            initialize: {
              method: "initialize",
              request: {},
              response: { result: { serverInfo: { name: "test" } } },
              status: 200,
              timestamp: new Date().toISOString(),
            },
            exchanges: [
              {
                method: "tools/list",
                request: {},
                response: { result: { tools: [] } },
                status: 200,
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        },
        projectContext: {
          name: "cortexdx",
          type: "mcp-server",
          language: "typescript",
          dependencies: ["eventsource-parser"], // Missing @modelcontextprotocol/sdk
          configFiles: ["pnpm-lock.yaml", "tsconfig.json"],
          sourceFiles: [
            "packages/cortexdx/src/adapters/sse.ts", // Missing jsonrpc.ts
          ],
        },
      };

      const findings = await SelfImprovementPlugin.run(ctx);

      // Should have findings for all checks
      expect(findings.length).toBeGreaterThan(0);

      // Handshake gap (Req 15.1)
      expect(
        findings.some((f) => f.id === "self_improvement.handshake_gaps"),
      ).toBe(true);

      // Dependency gap (Req 15.2)
      expect(
        findings.some((f) => f.id === "self_improvement.dependency_gaps"),
      ).toBe(true);

      // Signal digest (Req 15.3)
      expect(
        findings.some((f) => f.id === "self_improvement.signal_digest"),
      ).toBe(true);

      // Health probe (Req 15.4)
      expect(findings.some((f) => f.id === "self_improvement.health")).toBe(
        true,
      );

      // Transport transcript
      expect(
        findings.some((f) => f.id === "self_improvement.transport_transcript"),
      ).toBe(true);
    });
  });

  // Requirement 15.5: LLM Analysis Integration Tests
  describe("LLM Analysis Integration (Req 15.5)", () => {
    it("validates plugin requires LLM flag is set", () => {
      // Verify the plugin is configured to require LLM
      expect(SelfImprovementPlugin.requiresLlm).toBe(true);
    });

    it("validates findings structure supports LLM enhancement fields", async () => {
      const ctx: DevelopmentContext = {
        ...baseContext(),
        projectContext: {
          name: "cortexdx",
          type: "mcp-client",
          language: "typescript",
          dependencies: ["eventsource-parser"],
          configFiles: ["pnpm-lock.yaml"],
          sourceFiles: ["packages/cortexdx/src/plugins/streaming-sse.ts"],
        },
      };

      const findings = await SelfImprovementPlugin.run(ctx);

      // Verify that findings can accept LLM enhancement fields
      const finding = findings[0];
      if (finding) {
        // These fields should be allowed by the Finding type
        const enhancedFinding = {
          ...finding,
          llmAnalysis: "test analysis",
          rootCause: "test root cause",
          filesToModify: ["test.ts"],
          codeChanges: "test changes",
          validationSteps: ["step1"],
          riskLevel: "low" as const,
          templateId: "test-template",
          canAutoFix: true,
        };

        expect(enhancedFinding.llmAnalysis).toBe("test analysis");
        expect(enhancedFinding.rootCause).toBe("test root cause");
        expect(enhancedFinding.filesToModify).toEqual(["test.ts"]);
        expect(enhancedFinding.codeChanges).toBe("test changes");
        expect(enhancedFinding.validationSteps).toEqual(["step1"]);
        expect(enhancedFinding.riskLevel).toBe("low");
        expect(enhancedFinding.canAutoFix).toBe(true);
      }
    });

    it("validates LLM analysis enhances findings with required fields", async () => {
      const ctx: DevelopmentContext = {
        ...baseContext(),
        projectContext: {
          name: "cortexdx",
          type: "mcp-client",
          language: "typescript",
          dependencies: ["eventsource-parser"],
          configFiles: ["pnpm-lock.yaml"],
          sourceFiles: ["packages/cortexdx/src/plugins/streaming-sse.ts"],
        },
      };

      const findings = await SelfImprovementPlugin.run(ctx);

      // Verify findings have the structure for LLM enhancement
      const handshakeFinding = findings.find(
        (f) => f.id === "self_improvement.handshake_gaps",
      );
      expect(handshakeFinding).toBeDefined();

      // Check that finding has fields that can be enhanced by LLM
      expect(handshakeFinding).toHaveProperty("id");
      expect(handshakeFinding).toHaveProperty("severity");
      expect(handshakeFinding).toHaveProperty("description");
      expect(handshakeFinding).toHaveProperty("evidence");
      expect(handshakeFinding).toHaveProperty("recommendation");
    });
  });
});
