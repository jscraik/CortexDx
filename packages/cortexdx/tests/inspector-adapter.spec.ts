import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { InspectorAdapter } from "../src/adapters/inspector-adapter.js";
import type { DevelopmentContext } from "../src/types.js";

const baseContext = (): DevelopmentContext => ({
  endpoint: "http://localhost:5001",
  logger: () => undefined,
  request: async () => ({}),
  jsonrpc: async () => ({}),
  sseProbe: async () => ({ ok: true }),
  evidence: () => undefined,
  deterministic: true,
  sessionId: "inspector-test",
  userExpertiseLevel: "expert",
  conversationHistory: [],
});

describe("InspectorAdapter runtime safeguards", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    if (originalEnv.CORTEXDX_INSPECTOR_MAX_RUNTIME_MS === undefined) {
      delete process.env.CORTEXDX_INSPECTOR_MAX_RUNTIME_MS;
    } else {
      process.env.CORTEXDX_INSPECTOR_MAX_RUNTIME_MS = originalEnv.CORTEXDX_INSPECTOR_MAX_RUNTIME_MS;
    }
  });

  it("honours CORTEXDX_INSPECTOR_MAX_RUNTIME_MS environment override", () => {
    process.env.CORTEXDX_INSPECTOR_MAX_RUNTIME_MS = "1234";
    const adapter = new InspectorAdapter(baseContext());
    const runtime = (adapter as unknown as { resolveInspectorRuntimeBudget(): number }).resolveInspectorRuntimeBudget();
    expect(runtime).toBe(1234);
  });

  it("returns partial findings from stdout when timeout occurs", () => {
    const adapter = new InspectorAdapter(baseContext());
    const stdout = JSON.stringify({
      findings: [
        {
          id: "partial-1",
          severity: "minor",
          area: "protocol",
          description: "handshake incomplete",
          evidence: { raw: { step: "initialize" } },
        },
      ],
    });

    const findings = (adapter as unknown as {
      buildTimeoutFindings(
        stdout: string,
        stderr: string,
        endpoint: string,
        probes: { kind: string }[],
        budget: number,
        partial?: unknown[],
      ): unknown[];
    }).buildTimeoutFindings(stdout, "", "https://example.com", [{ kind: "handshake" }], 1234);

    expect(findings.length).toBeGreaterThan(0);
    expect(JSON.stringify(findings[0])).toContain("partial-1");
  });

  it("prefers streaming partial findings when provided", () => {
    const adapter = new InspectorAdapter(baseContext());
    const findings = (adapter as unknown as {
      buildTimeoutFindings(
        stdout: string,
        stderr: string,
        endpoint: string,
        probes: { kind: string }[],
        budget: number,
        partial?: unknown[],
      ): unknown[];
    }).buildTimeoutFindings(
      "",
      "",
      "https://example.com",
      [{ kind: "protocol" }],
      999,
      [
        {
          id: "probe_protocol_partial",
          severity: "info",
          area: "protocol",
          description: "protocol probe partial",
          evidence: { raw: { chunk: 1 } },
        },
      ],
    );

    expect(findings[0]).toMatchObject({
      id: "probe_protocol_partial",
      description: expect.stringContaining("partial result after 999ms"),
    });
  });
});

describe("InspectorAdapter handshake verification", () => {
  it("marks hasHandshake true when HTTP initialize succeeds", async () => {
    const adapter = new InspectorAdapter({
      ...baseContext(),
      request: async () => ({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "CortexDx", version: "1.0.0" },
        },
      }),
    });

    await (adapter as unknown as {
      verifyEndpointHandshake(endpoint: string): Promise<void>;
    }).verifyEndpointHandshake("https://example.com");

    const finding = (adapter as unknown as {
      analyzeHandshakeOutput(
        lines: string[],
        endpoint: string,
        timestamp: number,
      ): {
        evidence: {
          raw: {
            hasHandshake: boolean;
            handshakeVerified?: boolean;
            handshakeResponse?: unknown;
          };
        };
      };
    }).analyzeHandshakeOutput([], "https://example.com", Date.now());

    expect(finding.evidence.raw.hasHandshake).toBe(true);
    expect(finding.evidence.raw.handshakeVerified).toBe(true);
    expect(finding.evidence.raw.handshakeResponse).toEqual({
      protocolVersion: "2024-11-05",
      serverInfo: { name: "CortexDx", version: "1.0.0" },
    });
  });

  it("records error details when handshake verification fails", async () => {
    const adapter = new InspectorAdapter({
      ...baseContext(),
      request: async () => {
        throw new Error("network down");
      },
    });

    await (adapter as unknown as {
      verifyEndpointHandshake(endpoint: string): Promise<void>;
    }).verifyEndpointHandshake("https://invalid");

    const finding = (adapter as unknown as {
      analyzeHandshakeOutput(
        lines: string[],
        endpoint: string,
        timestamp: number,
      ): { evidence: { raw: { hasHandshake: boolean; handshakeError?: string } } };
    }).analyzeHandshakeOutput([], "https://invalid", Date.now());

    expect(finding.evidence.raw.hasHandshake).toBe(false);
    expect(finding.evidence.raw.handshakeError).toContain("network down");
  });
});
