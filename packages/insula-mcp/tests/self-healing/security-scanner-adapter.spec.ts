import { describe, expect, it } from "vitest";
import type { Finding } from "../../src/types.js";
import { adaptSecurityFindings } from "../../src/self-healing/adapters/security-scanner.js";

describe("security-scanner adapter", () => {
  it("maps severity and fingerprints deterministically", () => {
    const findings: Finding[] = [
      {
        id: "security-001",
        area: "security",
        severity: "blocker",
        title: "Critical SQL injection",
        description: "Parameter `id` is injectable.",
        evidence: [{ type: "file", ref: "src/api/router.ts", lines: [42, 45] }],
        tags: ["sql-injection"],
      },
    ];

    const normalized = adaptSecurityFindings(findings);
    expect(normalized).toHaveLength(1);
    const [first] = normalized;
    expect(first.severity).toBe("critical");
    expect(first.precision).toBe("range");
    expect(first.location?.file).toBe("src/api/router.ts");
    expect(first.location?.start?.line).toBe(42);
    expect(first.location?.end?.line).toBe(45);

    const again = adaptSecurityFindings(findings);
    expect(again[0]!.id).toBe(first.id);
  });

  it("falls back to file precision when no line info", () => {
    const findings: Finding[] = [
      {
        id: "security-002",
        area: "security",
        severity: "major",
        title: "Permissive CORS",
        description: "CORS wildcard detected",
        evidence: [{ type: "url", ref: "http://localhost" }],
      },
    ];

    const normalized = adaptSecurityFindings(findings);
    expect(normalized[0]!.precision).toBe("file");
    expect(normalized[0]!.location?.file).toBeUndefined();
  });
});
