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

describe("InspectorAdapter diagnose", () => {
  it("should successfully run diagnostics and generate report", async () => {
    const adapter = new InspectorAdapter({
      ...baseContext(),
      request: async () => ({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "TestServer", version: "1.0.0" },
        },
      }),
    });

    const report = await adapter.diagnose("https://example.com", ["handshake", "security"]);

    expect(report).toBeDefined();
    expect(report.jobId).toContain("inspector_");
    expect(report.endpoint).toBe("https://example.com");
    expect(report.findings).toBeDefined();
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.metrics.probesRun).toBe(2);
  });

  it("should handle invalid endpoint gracefully", async () => {
    const adapter = new InspectorAdapter(baseContext());

    const report = await adapter.diagnose("invalid-endpoint", ["handshake"]);

    expect(report).toBeDefined();
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings[0].severity).toBe("blocker");
    expect(report.metrics.failures).toBe(1);
  });

  it("should generate mock findings in test mode", async () => {
    const adapter = new InspectorAdapter(baseContext());

    const report = await adapter.diagnose("http://test.com", ["security", "performance"]);

    expect(report).toBeDefined();
    expect(report.findings.length).toBe(2);
    expect(report.findings.some(f => f.area === "security")).toBe(true);
    expect(report.findings.some(f => f.area === "perf")).toBe(true);
  });
});

describe("InspectorAdapter probe mapping", () => {
  it("should assign correct area values in findings for each probe", async () => {
    const adapter = new InspectorAdapter(baseContext());

    const probeNames = [
      { probe: "handshake", expectedArea: "protocol" },
      { probe: "security", expectedArea: "security" },
      { probe: "performance", expectedArea: "perf" },
      { probe: "stream_sse", expectedArea: "streaming" },
      { probe: "cors_preflight", expectedArea: "cors" },
    ];

    for (const { probe, expectedArea } of probeNames) {
      const report = await adapter.diagnose("http://test.com", [probe]);
      expect(report.findings.length).toBeGreaterThan(0);
      expect(report.findings[0].area).toBe(expectedArea);
    }
  });
});

describe("InspectorAdapter finding conversion", () => {
  it("should convert inspector findings to CortexDx format", () => {
    const adapter = new InspectorAdapter(baseContext());

    const inspectorFindings = [
      {
        id: "test-1",
        severity: "major" as const,
        area: "security" as const,
        description: "Security issue detected",
        evidence: { raw: { test: "data" }, path: "test.ts", line: 42 },
        remediation: { suggestion: "Fix the issue" },
      },
    ];

    const converted = adapter.convertFindings(inspectorFindings);

    expect(converted.length).toBe(1);
    expect(converted[0].id).toBe("inspector_test-1");
    expect(converted[0].severity).toBe("major");
    expect(converted[0].area).toBe("security");
    expect(converted[0].title).toBe("Inspector: security");
    expect(converted[0].description).toBe("Security issue detected");
    expect(converted[0].recommendation).toBe("Fix the issue");
    expect(converted[0].tags).toContain("inspector");
    expect(converted[0].tags).toContain("security");
    expect(converted[0].requiresLLMAnalysis).toBe(true);
  });

  it("should handle findings without evidence", () => {
    const adapter = new InspectorAdapter(baseContext());

    const inspectorFindings = [
      {
        id: "test-2",
        severity: "minor" as const,
        area: "protocol" as const,
        description: "Protocol issue",
        evidence: undefined as any,
      },
    ];

    const converted = adapter.convertFindings(inspectorFindings);

    expect(converted.length).toBe(1);
    expect(converted[0].evidence).toEqual([]);
  });
});

describe("InspectorAdapter output parsing", () => {
  it("should parse JSON output with findings array", () => {
    const adapter = new InspectorAdapter(baseContext());
    const output = JSON.stringify({
      findings: [
        {
          id: "json-finding-1",
          severity: "major",
          area: "security",
          description: "Security finding",
          evidence: { raw: { data: "test" } },
        },
      ],
    });

    const findings = (adapter as unknown as {
      parseInspectorOutput(output: string, endpoint: string, probes: any[]): any[];
    }).parseInspectorOutput(output, "https://test.com", []);

    expect(findings.length).toBe(1);
    expect(findings[0].id).toBe("json-finding-1");
    expect(findings[0].severity).toBe("major");
  });

  it("should parse JSON output with probes object", () => {
    const adapter = new InspectorAdapter(baseContext());
    const output = JSON.stringify({
      probes: {
        handshake: { status: "passed", message: "Handshake successful" },
        security: { status: "failed", message: "Security check failed" },
      },
    });

    const findings = (adapter as unknown as {
      parseInspectorOutput(output: string, endpoint: string, probes: any[]): any[];
    }).parseInspectorOutput(output, "https://test.com", []);

    expect(findings.length).toBe(2);
    expect(findings[0].area).toBe("protocol"); // handshake maps to protocol
    expect(findings[1].area).toBe("security");
    expect(findings[1].severity).toBe("major"); // failed status
  });

  it("should handle port conflict errors", () => {
    const adapter = new InspectorAdapter(baseContext());
    const output = "Error: PORT IS IN USE - Proxy server cannot start";

    const findings = (adapter as unknown as {
      parseInspectorOutput(output: string, endpoint: string, probes: any[]): any[];
    }).parseInspectorOutput(output, "https://test.com", []);

    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("major");
    expect(findings[0].description).toContain("proxy port conflict");
  });
});

describe("InspectorAdapter self-diagnose", () => {
  it("should run self-diagnosis on default endpoint", async () => {
    const adapter = new InspectorAdapter({
      ...baseContext(),
      endpoint: "http://localhost:5001",
      request: async () => ({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "CortexDx", version: "1.0.0" },
        },
      }),
    });

    const report = await adapter.selfDiagnose();

    expect(report).toBeDefined();
    expect(report.endpoint).toBe("http://localhost:5001");
    expect(report.metrics.probesRun).toBe(5); // handshake, protocol, security, performance, sse
  });
});
