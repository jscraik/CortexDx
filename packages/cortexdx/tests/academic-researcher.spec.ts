import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderInstance, ProviderRegistration } from "../src/registry/providers/academic.js";
import type { DiagnosticContext } from "../src/types.js";
import { runAcademicResearch } from "../src/research/academic-researcher.js";

const mockRegistry = {
  getProvider: vi.fn(),
  createProviderInstance: vi.fn(),
};

vi.mock("../src/registry/index.js", () => ({
  getAcademicRegistry: () => mockRegistry,
}));

const baseRegistrations: Record<string, ProviderRegistration> = {
  "context7": createRegistration("context7"),
  exa: createRegistration("exa"),
  "vibe-check": createRegistration("vibe-check"),
};

let tempDir: string;
let capturedContext: DiagnosticContext | null = null;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "cortexdx-research-"));
  capturedContext = null;
  mockRegistry.getProvider.mockImplementation((id: string) => baseRegistrations[id]);
  mockRegistry.createProviderInstance.mockImplementation((id: string, context: DiagnosticContext) => {
    capturedContext = context;
    return createProviderInstanceStub(id);
  });
  process.env.CONTEXT7_API_KEY = "test-context7";
  process.env.CONTEXT7_API_BASE_URL = "https://context7.example.com";
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  mockRegistry.getProvider.mockReset();
  mockRegistry.createProviderInstance.mockReset();
  delete process.env.EXA_API_KEY;
  delete process.env.CONTEXT7_API_KEY;
  delete process.env.CONTEXT7_API_BASE_URL;
  delete process.env.CONTEXT7_PROFILE;
  delete process.env.VIBE_CHECK_PROFILE;
  delete process.env.VIBE_CHECK_HTTP_URL;
  delete process.env.VIBE_CHECK_STRICT;
  delete process.env.VIBE_CHECK_API_KEY;
});

describe("runAcademicResearch", () => {
  it("writes artifacts and aggregates provider findings", async () => {
    const report = await runAcademicResearch({
      topic: "MCP streaming",
      providers: ["context7"],
      outputDir: tempDir,
    });

    expect(report.providers).toHaveLength(1);
    expect(report.summary.totalFindings).toBeGreaterThan(0);
    expect(report.artifacts?.markdown).toBeTruthy();
    if (report.artifacts?.markdown) {
      expect(readFileSync(report.artifacts.markdown, "utf8")).toContain("Academic Research Report");
    }
  });

  it("skips providers that require credentials when none are supplied", async () => {
    const report = await runAcademicResearch({
      topic: "MCP security",
      providers: ["exa"],
    });

    expect(report.providers).toHaveLength(0);
    expect(report.summary.errors).toHaveLength(1);
    expect(report.summary.errors[0].message).toMatch(/Exa API key/i);
    expect(mockRegistry.createProviderInstance).not.toHaveBeenCalled();
  });

  it("injects credential headers from CLI overrides", async () => {
    const report = await runAcademicResearch({
      topic: "MCP security",
      providers: ["exa"],
      credentials: { exa: "test-secret" },
    });

    expect(report.providers).toHaveLength(1);
    expect(report.summary.errors).toHaveLength(0);
    expect(capturedContext?.headers?.["x-exa-api-key"]).toBe("test-secret");
  });

  it("injects Context7 endpoint/profile headers from env", async () => {
    process.env.CONTEXT7_PROFILE = "staging";

    await runAcademicResearch({
      topic: "Context-aware MCP",
      providers: ["context7"],
    });

    expect(capturedContext?.headers?.["context7-base-url"]).toBe(
      "https://context7.example.com",
    );
    expect(capturedContext?.headers?.["x-context7-profile"]).toBe("staging");
    expect(capturedContext?.headers?.authorization).toBe("Bearer test-context7");
  });

  it("injects Vibe Check HTTP headers from env", async () => {
    process.env.VIBE_CHECK_API_KEY = "vk-secret";
    process.env.VIBE_CHECK_HTTP_URL = "https://vibe-check.example.com";
    process.env.VIBE_CHECK_PROFILE = "ai-research";
    process.env.VIBE_CHECK_STRICT = "true";

    await runAcademicResearch({
      topic: "Research quality",
      providers: ["vibe-check"],
    });

    expect(capturedContext?.headers?.["vibe-check-url"]).toBe(
      "https://vibe-check.example.com",
    );
    expect(capturedContext?.headers?.["x-vibe-profile"]).toBe("ai-research");
    expect(capturedContext?.headers?.["x-vibe-strict"]).toBe("true");
    expect(capturedContext?.headers?.["x-vibe-api-key"]).toBe("vk-secret");
  });
});

function createRegistration(id: string): ProviderRegistration {
  return {
    id,
    name: `${id} provider`,
    description: `${id} description`,
    provider_class: class {},
    capabilities: {
      id,
      name: `${id} capabilities`,
      version: "1.0.0",
      description: "",
      tools: [],
      resources: [],
      prompts: [],
    },
    tags: [],
  } as ProviderRegistration;
}

function createProviderInstanceStub(id: string): ProviderInstance {
  if (id === "context7") {
    return {
      executeTool: vi.fn(async () => ({ summary: "analysis" })),
    } satisfies ProviderInstance;
  }
  if (id === "vibe-check") {
    return {
      executeTool: vi.fn(async () => ({ score: 0.9 })),
    } satisfies ProviderInstance;
  }
  return {
    executeTool: vi.fn(async () => [
      { title: "Result", url: "https://example.com", snippet: "desc", relevanceScore: 0.8 },
    ]),
  } satisfies ProviderInstance;
}
