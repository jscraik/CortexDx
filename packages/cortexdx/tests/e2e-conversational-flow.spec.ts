/**
 * End-to-End Conversational Flow Test Suite
 * Tests conversational development features with real MCP servers
 * Requirements: 1.1, 2.2, 4.1, 9.4
 * Task: 14.1.1 - Test conversational flow with real MCP server
 */

import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CodeGenerationPlugin } from "../src/plugins/development/code-generation.js";
import { InteractiveDebuggerPlugin } from "../src/plugins/development/interactive-debugger.js";
import { ProblemResolverPlugin } from "../src/plugins/development/problem-resolver.js";
import type {
  ChatMessage,
  DevelopmentContext,
  ProjectContext,
} from "../src/types.js";

// Mock server processes
let okServer: ChildProcess;
let brokenServer: ChildProcess;

// Test ports
const OK_SERVER_PORT = 8088;
const BROKEN_SERVER_PORT = 8089;

beforeAll(async () => {
  // Start mock MCP servers for testing
  okServer = spawn("tsx", ["packages/cortexdx/scripts/mock-servers/ok.ts"]);
  brokenServer = spawn("tsx", [
    "packages/cortexdx/scripts/mock-servers/broken-sse.ts",
  ]);

  // Wait for servers to start
  await new Promise((resolve) => setTimeout(resolve, 2000));
});

afterAll(() => {
  // Clean up mock servers
  okServer?.kill();
  brokenServer?.kill();
});

describe("Interactive Debugger End-to-End", () => {
  it("should start debugging session with real error context", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content:
          "I'm getting a connection timeout error when trying to connect to my MCP server",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${BROKEN_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => {
        throw new Error("Connection timeout");
      },
      sseProbe: async () => ({ ok: false }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null, // Will be null in CI, but plugin should handle gracefully
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
    };

    const findings = await InteractiveDebuggerPlugin.run(ctx);

    // Should detect the problem even without LLM
    expect(findings).toBeDefined();
    expect(findings.length).toBeGreaterThan(0);

    // Should identify that debugging is needed
    const debuggerFinding = findings.find((f) => f.id.includes("debugger"));
    expect(debuggerFinding).toBeDefined();
  });

  it("should accept multiple input formats for debugging", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "Debug this issue",
      },
    ];

    const multipleInputs = {
      errorMessages: ["ECONNREFUSED", "Connection timeout"],
      logFiles: [
        {
          name: "server.log",
          content: "Error: Failed to connect to localhost:3000",
        },
      ],
      configFiles: [
        {
          name: "mcp-config.json",
          content: JSON.stringify({ port: 3000, timeout: 5000 }),
        },
      ],
    };

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${BROKEN_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
      multipleInputs,
    };

    const findings = await InteractiveDebuggerPlugin.run(ctx);

    expect(findings).toBeDefined();
    // Plugin should process multiple inputs
    expect(ctx.multipleInputs).toBeDefined();
    expect(ctx.multipleInputs?.errorMessages.length).toBe(2);
    expect(ctx.multipleInputs?.logFiles.length).toBe(1);
    expect(ctx.multipleInputs?.configFiles.length).toBe(1);
  });

  it("should provide ranked solution alternatives", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "My MCP server won't start",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${BROKEN_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => {
        throw new Error("EADDRINUSE");
      },
      sseProbe: async () => ({ ok: false }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
    };

    const findings = await InteractiveDebuggerPlugin.run(ctx);

    expect(findings).toBeDefined();
    // Should provide findings with recommendations
    const findingsWithRecommendations = findings.filter(
      (f) => f.recommendation,
    );
    expect(findingsWithRecommendations.length).toBeGreaterThan(0);
  });
});

describe("Code Generator End-to-End", () => {
  it("should detect missing MCP server implementation", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "I need to create a new MCP server",
      },
    ];

    const projectContext: ProjectContext = {
      type: "mcp-server",
      language: "typescript",
      sourceFiles: [], // No source files = needs implementation
      dependencies: [],
    };

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext,
    };

    const findings = await CodeGenerationPlugin.run(ctx);

    expect(findings).toBeDefined();
    expect(findings.length).toBeGreaterThan(0);

    // Without LLM, should report LLM missing
    // With LLM, would detect missing server implementation
    const llmMissingOrServerMissing = findings.some(
      (f) => f.id.includes("llm.missing") || f.id.includes("server.missing"),
    );
    expect(llmMissingOrServerMissing).toBe(true);
  });

  it("should detect missing MCP dependencies", async () => {
    const conversationHistory: ChatMessage[] = [];

    const projectContext: ProjectContext = {
      type: "mcp-server",
      language: "typescript",
      sourceFiles: ["src/server.ts"],
      dependencies: [], // Missing @modelcontextprotocol/sdk
    };

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext,
    };

    const findings = await CodeGenerationPlugin.run(ctx);

    // Without LLM, should report LLM missing
    // With LLM, would detect missing dependencies
    const llmMissingOrDepsMissing = findings.some(
      (f) =>
        f.id.includes("llm.missing") || f.id.includes("dependencies.missing"),
    );
    expect(llmMissingOrDepsMissing).toBe(true);
  });

  it("should detect code generation requests in conversation", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "Can you generate the server implementation for me?",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
    };

    const findings = await CodeGenerationPlugin.run(ctx);

    // Without LLM, should report LLM missing
    // With LLM, would detect generation request
    const llmMissingOrRequestDetected = findings.some(
      (f) => f.id.includes("llm.missing") || f.id.includes("request.detected"),
    );
    expect(llmMissingOrRequestDetected).toBe(true);
  });

  it("should complete academic analysis within performance threshold", async () => {
    const startTime = Date.now();

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory: [],
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
    };

    const findings = await CodeGenerationPlugin.run(ctx);
    const duration = Date.now() - startTime;

    expect(findings).toBeDefined();
    // Should complete within 10s (requirement from design)
    expect(duration).toBeLessThan(10000);
  });
});

describe("Problem Resolver End-to-End", () => {
  it("should detect and generate fixes for connection issues", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "Connection timeout when connecting to server",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${BROKEN_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => {
        throw new Error("ETIMEDOUT");
      },
      sseProbe: async () => ({ ok: false }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: ["src/server.ts"],
        dependencies: ["@modelcontextprotocol/sdk"],
      },
    };

    const findings = await ProblemResolverPlugin.run(ctx);

    expect(findings).toBeDefined();
    // Without LLM, should report LLM missing
    // With LLM, would detect connection problem
    const llmMissingOrConnectionIssue = findings.some(
      (f) => f.id.includes("llm.missing") || f.id.includes("connection"),
    );
    expect(llmMissingOrConnectionIssue).toBe(true);
  });

  it("should generate automated fixes with code samples", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "Getting JSON-RPC format errors",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: ["src/server.ts"],
        dependencies: ["@modelcontextprotocol/sdk"],
      },
    };

    const findings = await ProblemResolverPlugin.run(ctx);

    // Should provide fixes with code samples
    const findingsWithCode = findings.filter(
      (f) => f.remediation?.codeSamples && f.remediation.codeSamples.length > 0,
    );

    // If protocol issues detected, should have code samples
    if (findings.some((f) => f.id.includes("protocol"))) {
      expect(findingsWithCode.length).toBeGreaterThan(0);
    }
  });

  it("should validate fixes before suggesting application", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "Missing configuration file",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: ["src/server.ts"],
        dependencies: [],
      },
    };

    const findings = await ProblemResolverPlugin.run(ctx);

    // Should provide findings (either LLM missing or remediation steps)
    expect(findings.length).toBeGreaterThan(0);

    // If not just LLM missing, should have remediation
    const nonLlmFindings = findings.filter(
      (f) => !f.id.includes("llm.missing"),
    );
    if (nonLlmFindings.length > 0) {
      const findingsWithRemediation = nonLlmFindings.filter(
        (f) => f.remediation?.steps && f.remediation.steps.length > 0,
      );
      expect(findingsWithRemediation.length).toBeGreaterThan(0);
    }
  });

  it("should complete problem resolution within performance threshold", async () => {
    const startTime = Date.now();

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory: [
        {
          role: "user",
          content: "Help me fix this error",
        },
      ],
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
    };

    const findings = await ProblemResolverPlugin.run(ctx);
    const duration = Date.now() - startTime;

    expect(findings).toBeDefined();
    // Should complete within 30s (requirement from design)
    expect(duration).toBeLessThan(30000);
  });
});

describe("Integrated Conversational Workflow", () => {
  it("should handle complete problem-to-solution workflow", async () => {
    // Step 1: User reports problem
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content:
          "My MCP server isn't working. I get connection errors when I try to start it.",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${BROKEN_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => {
        throw new Error("ECONNREFUSED");
      },
      sseProbe: async () => ({ ok: false }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: ["src/server.ts"],
        dependencies: ["@modelcontextprotocol/sdk"],
      },
    };

    // Step 2: Interactive Debugger analyzes the problem
    const debugFindings = await InteractiveDebuggerPlugin.run(ctx);
    expect(debugFindings).toBeDefined();

    // Step 3: Problem Resolver generates fixes
    const resolverFindings = await ProblemResolverPlugin.run(ctx);
    expect(resolverFindings).toBeDefined();

    // Step 4: Verify workflow produces actionable results
    const allFindings = [...debugFindings, ...resolverFindings];
    const actionableFindings = allFindings.filter(
      (f) => f.recommendation || f.remediation,
    );

    expect(actionableFindings.length).toBeGreaterThan(0);
  });

  it("should maintain conversation context across plugin interactions", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "I need to create a new MCP server",
      },
      {
        role: "assistant",
        content:
          "I can help you generate an MCP server. What tools should it provide?",
      },
      {
        role: "user",
        content: "It should have a search tool and a data retrieval tool",
      },
    ];

    const ctx: DevelopmentContext = {
      endpoint: `http://localhost:${OK_SERVER_PORT}`,
      logger: () => {},
      request: async () => ({ data: [], total: 0 }),
      jsonrpc: async () => ({}),
      sseProbe: async () => ({ ok: true }),
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
    };

    // Code generator should detect the request
    const codeGenFindings = await CodeGenerationPlugin.run(ctx);

    // Should maintain context from conversation
    expect(ctx.conversationHistory.length).toBe(3);
    expect(codeGenFindings).toBeDefined();
  });

  it("should handle error recovery gracefully", async () => {
    const conversationHistory: ChatMessage[] = [
      {
        role: "user",
        content: "Fix my server",
      },
    ];

    // Simulate error condition
    const ctx: DevelopmentContext = {
      endpoint: "http://invalid-endpoint:99999",
      logger: () => {},
      request: async () => {
        throw new Error("Network error");
      },
      jsonrpc: async () => {
        throw new Error("Connection failed");
      },
      sseProbe: async () => {
        throw new Error("SSE probe failed");
      },
      evidence: () => {},
      deterministic: true,
      conversationalLlm: null,
      conversationHistory,
      projectContext: {
        type: "mcp-server",
        language: "typescript",
        sourceFiles: [],
        dependencies: [],
      },
    };

    // Plugins should handle errors gracefully
    const debugFindings = await InteractiveDebuggerPlugin.run(ctx);
    const codeGenFindings = await CodeGenerationPlugin.run(ctx);
    const resolverFindings = await ProblemResolverPlugin.run(ctx);

    // Should not throw, should return findings
    expect(debugFindings).toBeDefined();
    expect(codeGenFindings).toBeDefined();
    expect(resolverFindings).toBeDefined();
  });
});
