import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PromptCache } from "../../src/self-healing/prompt-cache.js";
import { generateReasoningSummary } from "../../src/self-healing/ollama-reasoner.js";
import type { NormalizedFinding } from "../../src/self-healing/findings.js";

const sampleFinding: NormalizedFinding = {
  id: "nf_example",
  source: "security-scanner",
  title: "Example",
  severity: "major",
  precision: "file",
};

describe("ollama reasoner", () => {
  it("caches summaries for deterministic reruns", async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "ollama-cache-"));
    const cache = new PromptCache(cacheDir);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "Simulated summary" }),
    }) as unknown as typeof fetch;

    const first = await generateReasoningSummary([sampleFinding], {
      cache,
      deterministic: false,
      model: "gpt-oss-safeguard:latest",
      fetchImpl: mockFetch,
    });
    expect(first).toContain("Simulated summary");

    const cacheFiles = fs.readdirSync(cacheDir);
    expect(cacheFiles.some((file) => file.endsWith(".yaml"))).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const second = await generateReasoningSummary([sampleFinding], {
      cache,
      deterministic: true,
      model: "gpt-oss-safeguard:latest",
      fetchImpl: mockFetch,
    });
    expect(second).toBe(first);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws when deterministic cache is missing", async () => {
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ollama-cache-miss-"),
    );
    const cache = new PromptCache(cacheDir);

    await expect(
      generateReasoningSummary([sampleFinding], {
        cache,
        deterministic: true,
        model: "gpt-oss-safeguard:latest",
      }),
    ).rejects.toThrow();
  });
});
