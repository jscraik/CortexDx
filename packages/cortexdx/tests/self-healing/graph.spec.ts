import { describe, expect, it } from "vitest";
import { runSelfHealingGraph } from "../../src/self-healing/graph.js";
import { buildSampleSecurityFindings } from "../../src/self-healing/samples.js";

describe("self-healing graph", () => {
  it("produces normalized findings", async () => {
    const result = await runSelfHealingGraph(
      { plugins: ["security-scanner"], endpoint: "http://localhost:5001", deterministic: false },
      {
        diagnosticsRunner: async () => buildSampleSecurityFindings(),
      },
    );
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0]!.source).toBe("security-scanner");
  });
});
