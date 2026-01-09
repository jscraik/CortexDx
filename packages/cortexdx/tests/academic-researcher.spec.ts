import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProviderInstance,
  ProviderRegistration,
} from "../src/registry/providers/academic.js";
import type { DiagnosticContext } from "../src/types.js";
import { runAcademicResearch } from "../src/research/academic-researcher.js";

const mockRegistry = {
  getProvider: vi.fn(),
  createProviderInstance: vi.fn(),
};

vi.mock("../../plugins/src/registry/index.js", () => ({
  getAcademicRegistry: () => mockRegistry,
}));

const baseRegistrations: Record<string, ProviderRegistration> = {
  context7: createRegistration("context7"),
  exa: createRegistration("exa"),
  "research-quality": createRegistration("research-quality"),
  "cortex-vibe": createRegistration("cortex-vibe"),
};

let tempDir: string;
let capturedContext: DiagnosticContext | null = null;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "cortexdx-research-"));
  capturedContext = null;
  mockRegistry.getProvider.mockImplementation(
    (id: string) => baseRegistrations[id],
  );
  mockRegistry.createProviderInstance.mockImplementation(
    (id: string, context: DiagnosticContext) => {
      capturedContext = context;
      return createProviderInstanceStub(id);
    },
  );
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
  delete process.env.CORTEX_VIBE_HTTP_URL;
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
      expect(readFileSync(report.artifacts.markdown, "utf8")).toContain(
        "Academic Research Report",
      );
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
    expect(capturedContext?.headers?.authorization).toBe(
      "Bearer test-context7",
    );
  });

  it("injects Cortex Vibe HTTP headers from env", async () => {
    process.env.CORTEX_VIBE_HTTP_URL = "https://cortex-vibe.example.com";

    await runAcademicResearch({
      topic: "Agent metacognitive oversight",
      providers: ["cortex-vibe"],
    });

    expect(capturedContext?.headers?.["cortex-vibe-base-url"]).toBe(
      "https://cortex-vibe.example.com",
    );
  });

  it("aborts slow providers and records timeout evidence", async () => {
    vi.useFakeTimers();
    try {
      const slowExecute = vi.fn(async () => {
        // Simulate a long-running operation that should be abortable
        return new Promise((resolve) => {
          setTimeout(() => resolve({ summary: "late" }), 60_000);
        });
      });
      mockRegistry.createProviderInstance.mockImplementationOnce(
        (_id: string, context: DiagnosticContext) => {
          capturedContext = context;
          return { executeTool: slowExecute } as ProviderInstance;
        },
      );

      const reportPromise = runAcademicResearch({
        topic: "Timeout scenarios",
        providers: ["context7"],
        deterministic: true,
      });

      vi.advanceTimersByTime(25_000);
      const report = await reportPromise;

      expect(report.providers).toHaveLength(0);
      expect(report.summary.errors[0].providerId).toBe("context7");
      expect(report.summary.errors[0].message).toMatch(/timed out/i);
      expect(report.summary.errors[0].evidence?.ref).toContain(
        "timeout/context7",
      );
      expect(slowExecute).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes abort signal to provider context request function", async () => {
    vi.useFakeTimers();
    try {
      let capturedSignal: AbortSignal | undefined;
      const slowExecute = vi.fn(async () => {
        // Make a request during provider execution to capture the abort signal
        if (capturedContext) {
          // Create a mock fetch to capture the signal
          const mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
            capturedSignal = init?.signal ?? undefined;
            throw new Error("Mock fetch - no actual request");
          });
          try {
            await capturedContext.request("/test-signal");
          } catch {
            // Expected to fail (mock fetch throws)
          } finally {
            mockFetch.mockRestore();
          }
        }
        // Return a promise that takes too long so timeout fires
        return new Promise((resolve) => {
          setTimeout(() => resolve({ summary: "late" }), 60_000);
        });
      });
      mockRegistry.createProviderInstance.mockImplementationOnce(
        (_id: string, context: DiagnosticContext) => {
          capturedContext = context;
          return { executeTool: slowExecute } as ProviderInstance;
        },
      );

      const reportPromise = runAcademicResearch({
        topic: "Abort signal verification",
        providers: ["context7"],
        deterministic: true,
      });

      // Advance time just a bit to let the request execute
      await vi.advanceTimersByTimeAsync(100);
      // The request should have captured a signal that isn't aborted yet
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      // Now advance past the timeout
      await vi.advanceTimersByTimeAsync(25_000);
      const report = await reportPromise;

      expect(report.providers).toHaveLength(0);
      expect(report.summary.errors[0].message).toMatch(/timed out/i);
    } finally {
      vi.useRealTimers();
    }
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
  if (id === "research-quality" || id === "cortex-vibe") {
    return {
      executeTool: vi.fn(async () => ({ score: 0.9 })),
    } satisfies ProviderInstance;
  }
  return {
    executeTool: vi.fn(async () => [
      {
        title: "Result",
        url: "https://example.com",
        snippet: "desc",
        relevanceScore: 0.8,
      },
    ]),
  } satisfies ProviderInstance;
}
