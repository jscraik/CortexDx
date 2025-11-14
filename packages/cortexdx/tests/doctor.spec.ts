import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AcademicResearchReport } from "../src/research/academic-researcher.js";

const ORIGINAL_ENV = { ...process.env };

describe("runDoctor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("reports provider readiness in JSON mode", async () => {
    process.env.OPENALEX_CONTACT_EMAIL = "review@example.com";
    process.env.CONTEXT7_API_KEY = "ctx-key";
    process.env.CONTEXT7_API_BASE_URL = "https://ctx.example.com";
    process.env.VIBE_CHECK_HTTP_URL = "https://vibe.example.com";
    process.env.EXA_API_KEY = "exa-key";

    const researchModule = await import(
      "../src/research/academic-researcher.js"
    );
    vi.spyOn(researchModule, "selectConfiguredProviders").mockReturnValue({
      ready: [],
      missing: [],
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runDoctor } = await import("../src/commands/doctor.js");

    const exitCode = await runDoctor({
      providers: "openalex,context7,exa",
      json: true,
    });
    expect(exitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"));
    expect(payload.providers).toHaveLength(3);
    expect(payload.providers[0].status).toBe("ready");
  });

  it("runs research probe by default when providers are configured", async () => {
    // Set up environment variables for all default providers
    process.env.CONTEXT7_API_KEY = "test-key";
    process.env.CONTEXT7_API_BASE_URL = "https://test.example.com";
    process.env.VIBE_CHECK_HTTP_URL = "https://vibe.example.com";
    process.env.OPENALEX_CONTACT_EMAIL = "test@example.com";
    process.env.EXA_API_KEY = "exa-key";

    const mockReport: AcademicResearchReport = {
      topic: "MCP diagnostics",
      question: undefined,
      timestamp: new Date().toISOString(),
      providers: [
        {
          providerId: "context7",
          providerName: "Context7",
          findings: [
            {
              id: "1",
              area: "research",
              severity: "info",
              title: "Finding",
              description: "",
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
    };

    const researchModule = await import(
      "../src/research/academic-researcher.js"
    );
    vi.spyOn(researchModule, "selectConfiguredProviders").mockReturnValue({
      ready: ["context7"],
      missing: [],
    });
    const runAcademicResearchSpy = vi
      .spyOn(researchModule, "runAcademicResearch")
      .mockResolvedValue(mockReport as unknown as typeof mockReport);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runDoctor } = await import("../src/commands/doctor.js");

    const exitCode = await runDoctor({});
    expect(exitCode).toBe(0);
    expect(runAcademicResearchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "Model Context Protocol diagnostics",
        providers: ["context7"],
      }),
    );
    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0]).includes("[Doctor] Research"),
      ),
    ).toBe(true);
  });
});
