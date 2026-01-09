/**
 * Exa Provider Tests
 * Verifies API-key handling and result mapping
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExaProvider } from "../src/providers/academic/exa.mcp.js";
import type { DiagnosticContext } from "../src/types.js";

const baseContext: DiagnosticContext = {
  endpoint: "test://exa",
  logger: () => undefined,
  request: async () => ({ data: [], total: 0 }),
  jsonrpc: async () => ({}),
  sseProbe: async () => ({ ok: true }),
  evidence: () => undefined,
  deterministic: true,
};

const originalFetch = globalThis.fetch;

describe("ExaProvider search", () => {
  beforeEach(() => {
    delete process.env.EXA_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    delete process.env.EXA_API_KEY;
  });

  it("throws when EXA_API_KEY is not configured", async () => {
    const provider = new ExaProvider(baseContext);
    await expect(provider.search({ query: "SSE diagnostics" })).rejects.toThrow(
      /EXA_API_KEY/i,
    );
  });

  it("maps Exa API responses into search results", async () => {
    process.env.EXA_API_KEY = "exa-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: "doc-1",
            title: "Diagnosing SSE transports",
            url: "https://exa.ai/doc-1",
            highlights: ["SSE guidance"],
            publishedDate: "2025-10-01",
            authors: ["Researcher One"],
            score: 0.91,
          },
        ],
      }),
    });

    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const provider = new ExaProvider(baseContext);
    const results = await provider.search({
      query: "SSE diagnostics",
      limit: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.exa.ai/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "exa-test-key",
        }),
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Diagnosing SSE transports");
    expect(results[0].confidence).toBeGreaterThan(0.9);
  });
});
