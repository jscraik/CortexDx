import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EnhancedPatternMatcher } from "../src/learning/pattern-matcher.js";
import { recordFindingsForLearning } from "../src/learning/pattern-feedback-loop.js";
import { getPatternStorage } from "../src/learning/pattern-datastore.js";
import type { Finding, Problem } from "../src/types.js";

const originalDb = process.env.CORTEXDX_PATTERN_DB;
let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), "cortexdx-patterns-"));
  process.env.CORTEXDX_PATTERN_DB = join(tempDir, "patterns.db");
});

afterAll(() => {
  if (originalDb) {
    process.env.CORTEXDX_PATTERN_DB = originalDb;
  } else {
    delete process.env.CORTEXDX_PATTERN_DB;
  }
  rmSync(tempDir, { recursive: true, force: true });
});

describe("pattern feedback loop", () => {
  it("persists findings as patterns and common issues", async () => {
    const findings: Finding[] = [
      {
        id: "finding-1",
        area: "protocol",
        severity: "major",
        title: "Missing tools/list",
        description: "Endpoint did not respond to tools/list",
        evidence: [{ type: "url", ref: "https://example.com/mcp" }],
        source: "discovery",
        recommendation: "Implement the tools/list handler",
        tags: ["protocol", "tools"],
      },
    ];

    await recordFindingsForLearning({ endpoint: "https://example.com/mcp", findings });
    const storage = getPatternStorage();
    const patterns = await storage.loadAllPatterns();

    expect(patterns.length).toBeGreaterThan(0);
    const stored = patterns[0];
    expect(stored.problemSignature.toLowerCase()).toContain("missing");
    expect(stored.solution.description).toContain("Implement");
  });

  it("anonymizes sensitive details before persisting", async () => {
    const finding: Finding = {
      id: "finding-anon",
      area: "security",
      severity: "major",
      title: "Leak",
      description: "Observed https://private.internal/api with token bearer abc123",
      evidence: [{ type: "log", ref: "sensitive" }],
      source: "security",
    };

    await recordFindingsForLearning({ endpoint: "https://private.internal/mcp", findings: [finding] });
    const storage = getPatternStorage();
    const patterns = await storage.loadAllPatterns();
    const stored = patterns.find((pattern) => pattern.solution.id === `solution-${finding.id}`);

    expect(stored).toBeTruthy();
    expect(stored?.problemSignature).not.toContain("private.internal");
    expect(stored?.problemSignature).toContain("example.com");
    expect(stored?.problemSignature).not.toContain("abc123");
  });

  it("infers confidence from severity when the finding omits it", async () => {
    const finding: Finding = {
      id: "finding-confidence",
      area: "protocol",
      severity: "blocker",
      title: "Critical failure",
      description: "tools/list crashed",
      evidence: [{ type: "log", ref: "crash" }],
      source: "discovery",
    };

    await recordFindingsForLearning({ endpoint: "https://example.com/mcp", findings: [finding] });
    const storage = getPatternStorage();
    const patterns = await storage.loadAllPatterns();
    const stored = patterns.find((pattern) => pattern.solution.id === `solution-${finding.id}`);

    expect(stored).toBeTruthy();
    expect(stored?.confidence).toBeCloseTo(0.9, 2);
  });

  it("retains manual confidence overrides when reprocessing", async () => {
    const finding: Finding = {
      id: "finding-confidence-override",
      area: "security",
      severity: "minor",
      title: "Rate limiting drift",
      description: "429 handling inconsistent",
      evidence: [{ type: "log", ref: "ratelimit" }],
      source: "ratelimit",
    };

    await recordFindingsForLearning({ endpoint: "https://example.com/mcp", findings: [finding] });
    const storage = getPatternStorage();
    const first = await storage.loadAllPatterns();
    const stored = first.find((pattern) => pattern.solution.id === `solution-${finding.id}`);
    expect(stored).toBeTruthy();
    if (!stored) return;

    stored.confidence = 0.21;
    await storage.savePattern(stored);

    await recordFindingsForLearning({ endpoint: "https://example.com/mcp", findings: [finding] });
    const updated = await storage.loadPattern(stored.id);
    expect(updated?.confidence).toBeCloseTo(0.21, 5);
  });

  it("surfaces recorded patterns through the enhanced matcher", async () => {
    const finding: Finding = {
      id: "pattern-matcher",
      area: "protocol",
      severity: "major",
      title: "tools/list failure",
      description: "tools/list returned 500 with missing headers",
      evidence: [{ type: "log", ref: "tools" }],
      source: "protocol",
      tags: ["tools", "headers"],
    };

    await recordFindingsForLearning({ endpoint: "https://example.com/mcp", findings: [finding] });
    const storage = getPatternStorage();
    const patterns = await storage.loadAllPatterns();
    const matcher = new EnhancedPatternMatcher();

    const problem: Problem = {
      id: "p1",
      type: "protocol",
      description: "tools/list keeps failing when headers are missing",
      affectedComponents: ["tools", "headers"],
      severity: "major",
      evidence: [
        {
          type: "log",
          ref: "tools",
          data: "HTTP 500 :: missing headers",
        },
      ],
    };

    const matches = await matcher.findMatches(problem, patterns, 0);
    expect(matches.length).toBeGreaterThan(0);
    const match = matches.find((m) => m.pattern.solution.id === `solution-${finding.id}`);
    expect(match).toBeTruthy();
    expect(match?.confidence ?? 0).toBeGreaterThanOrEqual(0);
  });
});
