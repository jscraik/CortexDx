import { describe, expect, it, vi } from "vitest";
import type { AcademicResearchReport } from "../src/research/academic-researcher.js";
import { executeAcademicIntegrationTool } from "../src/tools/academic-integration-tools.js";
import type { McpTool } from "../src/types.js";

type RunAcademicResearch = typeof import("../src/research/academic-researcher.js")["runAcademicResearch"];

vi.mock("../src/research/academic-researcher.js", () => ({
  runAcademicResearch: vi.fn(async () => mockReport),
}));

const mockReport: AcademicResearchReport = {
  topic: "MCP streaming",
  question: "How stable are SSE endpoints?",
  timestamp: new Date().toISOString(),
  providers: [
    {
      providerId: "context7",
      providerName: "Context7",
      findings: [
        {
          id: "context7-1",
          area: "research",
          severity: "info",
          title: "Context analysis",
          description: "Details",
          evidence: [],
          tags: ["research"],
        },
      ],
    },
  ],
  findings: [],
  summary: {
    totalFindings: 0,
    providersRequested: 1,
    providersResponded: 1,
    errors: [],
  },
};

describe("cortexdx_academic_research tool", () => {
  it("returns serialized report content", async () => {
    const tool = buildResearchTool();
    const result = await executeAcademicIntegrationTool(tool, {
      topic: "MCP streaming",
      deterministic: true,
      providers: ["context7"],
    });

    expect(result.content?.[0]?.type).toBe("text");
    expect(result.content?.[0]?.text).toContain("MCP streaming");
    const runAcademicResearch = vi.mocked(
      (await import("../src/research/academic-researcher.js")).runAcademicResearch as RunAcademicResearch,
    );
    expect(runAcademicResearch).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "MCP streaming", deterministic: true }),
    );
  });

  it("throws when topic is missing", async () => {
    const tool = buildResearchTool();
    await expect(executeAcademicIntegrationTool(tool, {})).rejects.toThrow(/topic is required/);
  });
});

describe("analyze_preprint_research tool", () => {
  it("routes requests to arxiv provider", async () => {
    const tool: McpTool = {
      name: "analyze_preprint_research",
      description: "",
      inputSchema: { type: "object", properties: {} },
    };

    const result = await executeAcademicIntegrationTool(tool, {
      query: "retrieval augmented generation",
      maxResults: 3,
    });

    const runAcademicResearch = vi.mocked(
      (await import("../src/research/academic-researcher.js")).runAcademicResearch as RunAcademicResearch,
    );

    expect(runAcademicResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "retrieval augmented generation",
        providers: ["arxiv"],
        limit: 3,
      }),
    );

    const payload = JSON.parse(result.content?.[0]?.text ?? "{}") as { report?: AcademicResearchReport };
  });
});

function buildResearchTool(): McpTool {
  return {
    name: "cortexdx_academic_research",
    description: "",
    inputSchema: { type: "object", properties: {} },
  } as McpTool;
}
