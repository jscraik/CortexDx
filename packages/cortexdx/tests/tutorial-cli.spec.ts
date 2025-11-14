import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("runCreateTutorial", () => {
  it("prints tutorial output with research highlights", async () => {
    const researchModule = await import("../src/research/academic-researcher.js");
    vi.spyOn(researchModule, "selectConfiguredProviders").mockReturnValue({
      ready: ["context7"],
      missing: [],
    });
    vi.spyOn(researchModule, "runAcademicResearch").mockResolvedValue({
      topic: "MCP streaming",
      timestamp: new Date().toISOString(),
      providers: [
        {
          providerId: "context7",
          providerName: "Context7",
          findings: [
            {
              id: "ctx-1",
              area: "research",
              severity: "info",
              title: "Contextual analysis",
              description: "details",
              evidence: [],
              tags: [],
            },
          ],
        },
      ],
      findings: [],
      summary: {
        totalFindings: 1,
        providersRequested: 1,
        providersResponded: 1,
        errors: [],
      },
      artifacts: { dir: "/tmp/research" },
    });
    vi.doMock("../src/deepcontext/client.js", () => ({
      DeepContextClient: class {
        async searchCodebase() {
          return {
            matches: [
              {
                file_path: "src/server.ts",
                start_line: 42,
                end_line: 48,
                content: "LLM handshake validation logic",
              },
            ],
          };
        }
      },
      resolveDeepContextApiKey: () => "mock-key",
    }));

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      logs.push(String(msg));
    });

    const { runCreateTutorial } = await import("../src/commands/interactive-cli.js");
    const code = await runCreateTutorial("MCP streaming", {
      exercises: true,
      expertise: "intermediate",
      lang: "typescript",
    });
    expect(code).toBe(0);
    expect(logs.join("\n")).toContain("Research Highlights:");
    expect(logs.join("\n")).toContain("DeepContext References:");
    expect(logs.join("\n")).toContain("Outline:");
    expect(logs.join("\n")).toContain("Exercises:");
    expect(logs.join("\n")).toContain("```typescript");

    logSpy.mockRestore();
  });
});
