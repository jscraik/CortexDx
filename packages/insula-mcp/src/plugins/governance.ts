import type { DiagnosticPlugin, Finding } from "../types.js";

export const GovernancePlugin: DiagnosticPlugin = {
  id: "governance",
  title: "Governance / .insula",
  order: 400,
  async run() {
    const findings: Finding[] = [
      {
        id: "gov.pack.missing",
        area: "governance",
        severity: "major",
        title: "No governance pack loaded (.insula)",
        description: "Wire brAInwav BMAD+PRP gates (G0–G7) and policy-as-prompt checks.",
        evidence: [{ type: "file", ref: "./.insula/*" }]
      }
    ];
    return findings;
  }
};
