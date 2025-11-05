import type { Finding } from "../types.js";

export function buildArcTddPlan(stamp: Record<string, unknown>, findings: Finding[]): string {
  const blockers = findings.filter((finding) => finding.severity === "blocker");
  const majors = findings.filter((finding) => finding.severity === "major");
  return [
    "# ArcTDD Plan (Insula MCP)",
    "**North-Star:** Fix blockers first; majors second.",
    "## Blockers",
    ...blockers.map((finding) => `- ${finding.title} — ${finding.description}`),
    "## Majors",
    ...majors.map((finding) => `- ${finding.title} — ${finding.description}`)
  ].join("\n");
}
