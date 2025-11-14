import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AcademicResearchReport,
  runAcademicResearch,
} from "../src/research/academic-researcher.js";
import type { Finding } from "../src/types.js";

const mockRunAcademicResearch = vi.fn();

vi.mock("../src/research/academic-researcher.js", () => ({
  runAcademicResearch: vi.fn(
    (...args: Parameters<typeof runAcademicResearch>) =>
      mockRunAcademicResearch(...args),
  ),
}));

describe("runResearch CLI command", () => {
  const originalLog = console.log;
  const collectedLogs: string[] = [];

  beforeEach(() => {
    mockRunAcademicResearch.mockReset();
    collectedLogs.length = 0;
    console.log = vi.fn((...args: unknown[]) => {
      collectedLogs.push(
        args
          .map((value) =>
            typeof value === "string" ? value : JSON.stringify(value),
          )
          .join(" "),
      );
    }) as typeof console.log;
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it("passes CLI options through and prints provider summary", async () => {
    mockRunAcademicResearch.mockResolvedValueOnce(
      buildReport(
        [
          buildFinding({
            id: "context7-1",
            title: "Contextual analysis",
            severity: "info",
            description: "analysis details",
          }),
        ],
        "MCP streaming",
      ),
    );
    const { runResearch } = await import("../src/commands/research.js");

    const exitCode = await runResearch("MCP streaming", {
      question: "How resilient are SSE probes?",
      providers: "context7,EXA,context7",
      limit: "3",
      credential: ["exa:sk-test"],
      header: ["x-custom:demo"],
    });

    expect(mockRunAcademicResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "MCP streaming",
        question: "How resilient are SSE probes?",
        providers: ["context7", "EXA", "context7"],
        limit: 3,
        credentials: { exa: "sk-test" },
        headers: { "x-custom": "demo" },
        includeLicense: true,
        deterministic: false,
        outputDir: undefined,
      }),
    );
    expect(exitCode).toBe(0);
    expect(collectedLogs.some((line) => line.includes("Providers: 1/1"))).toBe(
      true,
    );
    expect(
      collectedLogs.some((line) => line.includes("[INFO] Contextual analysis")),
    ).toBe(true);
  });

  it("emits JSON output and returns severity-based exit codes", async () => {
    mockRunAcademicResearch.mockResolvedValueOnce(
      buildReport(
        [
          buildFinding({
            id: "exa-incident",
            severity: "major",
            title: "Exa congestion",
          }),
        ],
        "Endpoint hardening",
      ),
    );
    const { runResearch } = await import("../src/commands/research.js");

    const exitCode = await runResearch("Endpoint hardening", { json: true });

    expect(exitCode).toBe(2);
    expect(collectedLogs[0]).toContain('"topic": "Endpoint hardening"');
  });
});

function buildReport(
  findings: Finding[],
  topic = "MCP streaming",
): AcademicResearchReport {
  return {
    topic,
    timestamp: "2025-11-12T00:00:00.000Z",
    providers: [
      {
        providerId: "context7",
        providerName: "Context7",
        findings,
      },
    ],
    findings,
    summary: {
      totalFindings: findings.length,
      providersRequested: 1,
      providersResponded: 1,
      errors: [],
    },
  };
}

function buildFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "finding-1",
    area: "research",
    severity: "info",
    title: "Sample finding",
    description: "details",
    evidence: [],
    tags: ["academic"],
    ...overrides,
  };
}
