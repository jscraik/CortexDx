import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AcademicRegistry,
  ProviderRegistration,
} from "../plugins/src/registry/providers/academic.ts";
import {
  runAcademicResearch,
  setAcademicRegistryOverride,
} from "../src/research/academic-researcher.js";

const mockExecuteTool = vi.fn();
const mockRegistry = {
  getProvider: vi.fn(),
  createProviderInstance: vi.fn(),
};

describe("academic provider license handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockExecuteTool.mockReset();
    mockRegistry.getProvider.mockReset();
    mockRegistry.createProviderInstance.mockReset();
    setAcademicRegistryOverride(mockRegistry as unknown as AcademicRegistry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAcademicRegistryOverride(undefined);
  });

  it("strips license metadata when includeLicense is false", async () => {
    prepareRegistry("openalex");
    mockExecuteTool.mockResolvedValueOnce({
      results: [
        {
          title: "Work with license",
          abstract: "Summary",
          license: "CC-BY-4.0",
          primary_location: { source: { url: "https://example.com/work" } },
        },
      ],
    });

    const report = await runAcademicResearch({
      topic: "License-less research",
      providers: ["openalex"],
      includeLicense: false,
      limit: 1,
      deterministic: true,
    });

    expect(mockExecuteTool).toHaveBeenCalledOnce();
    expect(report.providers[0].raw).toEqual({
      results: [
        {
          title: "Work with license",
          abstract: "Summary",
          primary_location: { source: { url: "https://example.com/work" } },
        },
      ],
    });
    const rawEntry = (report.providers[0].raw as {
      results?: Array<Record<string, unknown>>;
    }).results?.[0];
    expect(rawEntry).not.toHaveProperty("license");
  });

  it("retains license metadata by default", async () => {
    prepareRegistry("openalex");
    mockExecuteTool.mockResolvedValueOnce({
      results: [
        {
          title: "Work with license",
          abstract: "Summary",
          license: "MIT",
          primary_location: { source: { url: "https://example.com/work" } },
        },
      ],
    });

    const report = await runAcademicResearch({
      topic: "License-full research",
      providers: ["openalex"],
      limit: 1,
      deterministic: true,
    });

    expect(report.providers[0].raw).toEqual({
      results: [
        {
          title: "Work with license",
          abstract: "Summary",
          license: "MIT",
          primary_location: { source: { url: "https://example.com/work" } },
        },
      ],
    });
    const rawEntry = (report.providers[0].raw as {
      results?: Array<Record<string, unknown>>;
    }).results?.[0];
    expect(rawEntry?.license).toBe("MIT");
  });
});

function prepareRegistry(providerId: string): void {
  mockRegistry.getProvider.mockReturnValue({
    id: providerId,
    name: providerId,
    description: `${providerId} mock`,
    provider_class: class {},
    capabilities: {
      id: providerId,
      name: `${providerId} provider`,
      version: "1.0.0",
      description: "mock capabilities",
      tools: [],
      resources: [],
      prompts: [],
    },
    tags: [],
  } satisfies ProviderRegistration);
  mockRegistry.createProviderInstance.mockReturnValue({
    executeTool: mockExecuteTool,
  });
}
