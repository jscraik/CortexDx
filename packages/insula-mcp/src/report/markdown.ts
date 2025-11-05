import type { Finding } from "../types.js";

export function buildMarkdownReport(stamp: Record<string, unknown>, findings: Finding[]): string {
  const lines: string[] = [];
  lines.push("# Insula MCP Diagnostic Report (brAInwav)");
  lines.push(`- Endpoint: ${stamp.endpoint}`);
  lines.push(`- Date: ${stamp.inspectedAt}`);
  lines.push(`- Duration: ${stamp.durationMs}ms`);
  lines.push("");
  for (const finding of findings) {
    lines.push(`## [${finding.severity.toUpperCase()}] ${finding.title}`);
    lines.push(finding.description);
    if (finding.evidence?.length) {
      const ev = finding.evidence.map((e) => `${e.type}:${e.ref}`).join(", ");
      lines.push(`- Evidence: ${ev}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("_Data policy: read-only; optional redacted HAR if --har._");
  return lines.join("\n");
}
