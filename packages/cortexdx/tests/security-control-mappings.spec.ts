import { describe, expect, it } from "vitest";
import type { Finding } from "../src/types.js";
import {
  annotateControlEvidence,
  getMissingControls,
  summarizeCoverage,
} from "../src/security/control-mappings.js";

describe("Security control mappings", () => {
  it("annotates injection findings with ASVS evidence", () => {
    const finding: Finding = {
      id: "owasp-a03-injection",
      area: "security",
      severity: "major",
      title: "Potential Injection",
      description: "Test",
      evidence: [],
      tags: ["injection"],
    };

    const matched = annotateControlEvidence(finding);

    expect(matched).toContain("V5.3.2");
    expect(
      finding.evidence?.some((e) => e.ref?.includes("V5.3.2")),
    ).toBe(true);
  });

  it("identifies missing high-severity controls", () => {
    const covered = new Set<string>(["V5.3.2", "AML.T0051"]);
    const missing = getMissingControls(covered, "high");

    expect(missing.some((control) => control.id === "V5.3.2")).toBe(false);
    expect(missing.some((control) => control.id === "V2.1.1")).toBe(true);
  });

  it("summarizes coverage for info-level reporting", () => {
    const coverage = new Set<string>(["V5.3.2", "AML.T0051", "V2.1.1"]);
    const summary = summarizeCoverage(coverage);
    expect(summary.description).toContain("Controls covered (3)");
    expect(summary.evidence).toHaveLength(3);

    const emptySummary = summarizeCoverage(new Set());
    expect(emptySummary.description).toContain("No ASVS or MITRE");
    expect(emptySummary.evidence).toHaveLength(0);
  });
});
