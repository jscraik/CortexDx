import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runAcademicResearch } from "./academic-researcher.js";

const mockExecuteTool = vi.fn();

const mockRegistry = {
  createProviderInstance: vi.fn(),
  getProvider: vi.fn(),
};

vi.mock("../registry/index.js", () => ({
  getAcademicRegistry: () => mockRegistry,
}));

const basePaper = {
  id: "http://example.com/paper",
  published: "2024-01-01",
  summary: "Consistent abstract",
  title: "Seeded Paper",
};

describe("runAcademicResearch determinism", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    mockExecuteTool.mockImplementation(async () => [{ ...basePaper }]);
    mockRegistry.getProvider.mockReturnValue({ id: "arxiv", name: "arXiv" });
    mockRegistry.createProviderInstance.mockReturnValue({
      executeTool: mockExecuteTool,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("produces identical outputs across runs when deterministic", async () => {
    const first = await runAcademicResearch({
      topic: "Determinism in research",
      providers: ["arxiv"],
      deterministic: true,
      limit: 1,
    });

    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const second = await runAcademicResearch({
      topic: "Determinism in research",
      providers: ["arxiv"],
      deterministic: true,
      limit: 1,
    });

    expect(second.timestamp).toBe(first.timestamp);
    expect(second.providers).toEqual(first.providers);
    expect(second.findings).toEqual(first.findings);
  });

  it("varies outputs when deterministic is disabled", async () => {
    const first = await runAcademicResearch({
      topic: "Determinism in research",
      providers: ["arxiv"],
      deterministic: false,
      limit: 1,
    });

    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    mockExecuteTool.mockImplementation(async () => [{ ...basePaper }]);

    const second = await runAcademicResearch({
      topic: "Determinism in research",
      providers: ["arxiv"],
      deterministic: false,
      limit: 1,
    });

    expect(second.timestamp).not.toBe(first.timestamp);
  });
});
