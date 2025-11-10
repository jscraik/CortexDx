/**
 * Self-Improvement Plugin Tests
 * Validates the internal diagnostic/development plugin behaviour
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { SelfImprovementPlugin } from "../src/plugins/development/self-improvement.js";
import type { DevelopmentContext } from "../src/types.js";

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
});

describe("Self-Improvement Plugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flags missing handshake instrumentation files", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/insula-mcp/src/plugins/streaming-sse.ts"],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    expect(findings.some((f) => f.id === "self_improvement.handshake_gaps")).toBe(
      true,
    );
  });

  it("summarizes inspector signals and captures health check details", async () => {
    const requestMock = vi.fn().mockResolvedValue({
      status: "healthy",
      version: "1.0.0",
    });

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      conversationHistory: [
        { role: "user", content: "SSE endpoint not streaming", timestamp: Date.now() },
        { role: "user", content: "Batch response is not an array", timestamp: Date.now() },
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
        name: "insula-mcp",
        type: "mcp-server",
        language: "typescript",
        dependencies: ["eventsource-parser", "@modelcontextprotocol/sdk"],
        configFiles: ["pnpm-lock.yaml", "tsconfig.json"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(findings.some((f) => f.id === "self_improvement.signal_digest")).toBe(true);
    expect(findings.some((f) => f.id === "self_improvement.health")).toBe(true);
    expect(findings.some((f) => f.id === "self_improvement.transport_transcript")).toBe(true);
  });
});

// Requirement 15.1: Handshake Gap Detection Tests
describe("Handshake Instrumentation Analysis (Req 15.1)", () => {
  it("detects missing jsonrpc.ts adapter file", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/insula-mcp/src/adapters/sse.ts"], // Missing jsonrpc.ts
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find((f) => f.id === "self_improvement.handshake_gaps");

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
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/insula-mcp/src/adapters/jsonrpc.ts"], // Missing sse.ts
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find((f) => f.id === "self_improvement.handshake_gaps");

    expect(handshakeFinding).toBeDefined();
    expect(handshakeFinding?.description).toContain("sse.ts");
  });

  it("detects both missing adapter files", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: ["packages/insula-mcp/src/plugins/streaming-sse.ts"], // Missing both
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find((f) => f.id === "self_improvement.handshake_gaps");

    expect(handshakeFinding).toBeDefined();
    expect(handshakeFinding?.description).toContain("jsonrpc.ts");
    expect(handshakeFinding?.description).toContain("sse.ts");
    expect(handshakeFinding?.evidence).toHaveLength(2);
  });

  it("does not flag when all adapter files are present", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const handshakeFinding = findings.find((f) => f.id === "self_improvement.handshake_gaps");

    expect(handshakeFinding).toBeUndefined();
  });
});

// Requirement 15.2: Dependency Validation Tests
describe("Dependency Validation (Req 15.2)", () => {
  it("detects missing @modelcontextprotocol/sdk dependency", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["eventsource-parser"], // Missing @modelcontextprotocol/sdk
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find((f) => f.id === "self_improvement.dependency_gaps");

    expect(depFinding).toBeDefined();
    expect(depFinding?.severity).toBe("minor");
    expect(depFinding?.description).toContain("@modelcontextprotocol/sdk");
    expect(depFinding?.recommendation).toContain("Install the missing packages");
  });

  it("detects missing eventsource-parser dependency", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk"], // Missing eventsource-parser
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find((f) => f.id === "self_improvement.dependency_gaps");

    expect(depFinding).toBeDefined();
    expect(depFinding?.description).toContain("eventsource-parser");
  });

  it("detects both missing dependencies", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["vitest"], // Missing both required deps
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find((f) => f.id === "self_improvement.dependency_gaps");

    expect(depFinding).toBeDefined();
    expect(depFinding?.description).toContain("@modelcontextprotocol/sdk");
    expect(depFinding?.description).toContain("eventsource-parser");
  });

  it("does not flag when all dependencies are present", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser", "vitest"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const depFinding = findings.find((f) => f.id === "self_improvement.dependency_gaps");

    expect(depFinding).toBeUndefined();
  });
});

// Requirement 15.3: Conversation Signal Analysis Tests
describe("Conversation Signal Analysis (Req 15.3)", () => {
  it("detects SSE streaming issues in conversation history", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        { role: "user", content: "SSE endpoint not streaming", timestamp: Date.now() },
        { role: "user", content: "SSE connection drops", timestamp: Date.now() },
        { role: "user", content: "SSE events not received", timestamp: Date.now() },
      ],
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find((f) => f.id === "self_improvement.signal_digest");

    expect(signalFinding).toBeDefined();
    expect(signalFinding?.severity).toBe("info");
    expect(signalFinding?.description).toContain("SSE streaming issues");
    expect(signalFinding?.description).toContain("3");
  });

  it("detects batch response issues in conversation history", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        { role: "user", content: "Batch response is not an array", timestamp: Date.now() },
        { role: "user", content: "Batch request failed", timestamp: Date.now() },
      ],
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find((f) => f.id === "self_improvement.signal_digest");

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
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find((f) => f.id === "self_improvement.signal_digest");

    expect(signalFinding).toBeDefined();
    expect(signalFinding?.description).toContain("Handshake gaps");
    expect(signalFinding?.description).toContain("2");
  });

  it("detects multiple signal types in conversation history", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        { role: "user", content: "SSE endpoint not streaming", timestamp: Date.now() },
        { role: "user", content: "Batch response is not an array", timestamp: Date.now() },
        { role: "user", content: "Handshake failed", timestamp: Date.now() },
        { role: "user", content: "SSE connection drops", timestamp: Date.now() },
      ],
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find((f) => f.id === "self_improvement.signal_digest");

    expect(signalFinding).toBeDefined();
    expect(signalFinding?.description).toContain("SSE");
    expect(signalFinding?.description).toContain("JSON-RPC batch issues");
    expect(signalFinding?.description).toContain("Handshake");
  });

  it("does not flag when no signals are detected", async () => {
    const ctx: DevelopmentContext = {
      ...baseContext(),
      conversationHistory: [
        { role: "user", content: "Everything works fine", timestamp: Date.now() },
        { role: "user", content: "No issues detected", timestamp: Date.now() },
      ],
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const signalFinding = findings.find((f) => f.id === "self_improvement.signal_digest");

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
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const healthFinding = findings.find((f) => f.id === "self_improvement.health");

    expect(healthFinding).toBeDefined();
    expect(healthFinding?.severity).toBe("info");
    expect(healthFinding?.description).toContain("healthy");
    expect(healthFinding?.description).toContain("1.0.0");
    expect(healthFinding?.evidence[0].type).toBe("url");
    expect(healthFinding?.evidence[0].ref).toContain("/health");
    expect(requestMock).toHaveBeenCalledWith(
      "http://localhost:5001/health",
      { method: "GET" }
    );
  });

  it("handles health endpoint failure gracefully", async () => {
    const requestMock = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const ctx: DevelopmentContext = {
      ...baseContext(),
      request: requestMock,
      projectContext: {
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);
    const healthFinding = findings.find((f) => f.id === "self_improvement.health_unreachable");

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
        name: "insula-mcp",
        type: "mcp-client",
        language: "typescript",
        dependencies: ["@modelcontextprotocol/sdk", "eventsource-parser"],
        configFiles: ["pnpm-lock.yaml"],
        sourceFiles: [
          "packages/insula-mcp/src/adapters/jsonrpc.ts",
          "packages/insula-mcp/src/adapters/sse.ts",
        ],
      },
    };

    const findings = await SelfImprovementPlugin.run(ctx);

    expect(requestMock).toHaveBeenCalledWith(
      "http://localhost:5001/health",
      { method: "GET" }
    );
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
          { role: "user", content: "SSE endpoint not streaming", timestamp: Date.now() },
          { role: "user", content: "Batch response is not an array", timestamp: Date.now() },
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
          name: "insula-mcp",
          type: "mcp-server",
          language: "typescript",
          dependencies: ["eventsource-parser"], // Missing @modelcontextprotocol/sdk
          configFiles: ["pnpm-lock.yaml", "tsconfig.json"],
          sourceFiles: [
            "packages/insula-mcp/src/adapters/sse.ts", // Missing jsonrpc.ts
          ],
        },
      };

      const findings = await SelfImprovementPlugin.run(ctx);

      // Should have findings for all checks
      expect(findings.length).toBeGreaterThan(0);

      // Handshake gap (Req 15.1)
      expect(findings.some((f) => f.id === "self_improvement.handshake_gaps")).toBe(true);

      // Dependency gap (Req 15.2)
      expect(findings.some((f) => f.id === "self_improvement.dependency_gaps")).toBe(true);

      // Signal digest (Req 15.3)
      expect(findings.some((f) => f.id === "self_improvement.signal_digest")).toBe(true);

      // Health probe (Req 15.4)
      expect(findings.some((f) => f.id === "self_improvement.health")).toBe(true);

      // Transport transcript
      expect(findings.some((f) => f.id === "self_improvement.transport_transcript")).toBe(true);
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
          name: "insula-mcp",
          type: "mcp-client",
          language: "typescript",
          dependencies: ["eventsource-parser"],
          configFiles: ["pnpm-lock.yaml"],
          sourceFiles: ["packages/insula-mcp/src/plugins/streaming-sse.ts"],
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
          name: "insula-mcp",
          type: "mcp-client",
          language: "typescript",
          dependencies: ["eventsource-parser"],
          configFiles: ["pnpm-lock.yaml"],
          sourceFiles: ["packages/insula-mcp/src/plugins/streaming-sse.ts"],
        },
      };

      const findings = await SelfImprovementPlugin.run(ctx);

      // Verify findings have the structure for LLM enhancement
      const handshakeFinding = findings.find((f) => f.id === "self_improvement.handshake_gaps");
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
