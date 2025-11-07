/**
 * Self-Improvement Plugin Tests
 * Validates the internal diagnostic/development plugin behaviour
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DevelopmentContext } from "../src/types.js";
import { SelfImprovementPlugin } from "../src/plugins/development/self-improvement.js";

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
