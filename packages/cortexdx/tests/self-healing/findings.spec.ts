import { describe, expect, it } from "vitest";
import type { Finding } from "../../src/types.js";
import { normalizeFindings } from "../../src/self-healing/findings.js";

describe("normalizeFindings", () => {
  const baseFinding: Finding = {
    id: "finding-1",
    area: "security",
    severity: "minor",
    title: "TLS 1.0 enabled",
    description: "Legacy protocol detected",
    evidence: [{ type: "file", ref: "server/security.ts", lines: [10, 12] }],
    tags: ["tls"],
    recommendation: "Disable TLS 1.0",
  };

  it("deduplicates identical findings and preserves metadata", () => {
    const duplicates: Finding[] = [
      baseFinding,
      { ...baseFinding, id: "finding-1b" },
    ];

    const normalized = normalizeFindings(duplicates);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].tags).toContain("tls");
    expect(normalized[0].evidence?.pointers[0]).toContain("server/security.ts");
  });

  it("prefers higher severity and merges evidence when duplicates disagree", () => {
    const findings: Finding[] = [
      baseFinding,
      {
        ...baseFinding,
        id: "finding-2",
        severity: "blocker",
        evidence: [
          { type: "file", ref: "server/security.ts", lines: [10, 15] },
        ],
        tags: ["tls", "compliance"],
        recommendation: undefined,
      },
    ];

    const normalized = normalizeFindings(findings);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].severity).toBe("critical");
    expect(normalized[0].tags).toEqual(["tls", "compliance"]);
    expect(normalized[0].recommendation).toBe("Disable TLS 1.0");
  });
});
