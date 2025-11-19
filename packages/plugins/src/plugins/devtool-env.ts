import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

export const DevtoolEnvPlugin: DiagnosticPlugin = {
  id: "devtool",
  title: "DevTool Environment (CVE guard)",
  order: 10,
  async run() {
    const findings: Finding[] = [];
    findings.push({
      id: "inspector.version.warn",
      area: "devtool",
      severity: "minor",
      title: "Inspector version check recommended",
      description: "Ensure MCP Inspector >= v0.14.1 to avoid known RCE class. Add --doctor to see environment checks.",
      evidence: [{ type: "log", ref: "env" }]
    });
    return findings;
  }
};
