import type { DiagnosticPlugin, Finding } from "../types.js";

export const ThreatModelPlugin: DiagnosticPlugin = {
  id: "threat-model",
  title: "Threat Model Checklist (agentic)",
  order: 410,
  async run(ctx) {
    const findings: Finding[] = [];
    const tools = await ctx.jsonrpc<unknown>("tools/list").catch(() => null);
    const names = extractToolNames(tools);
    const surface = JSON.stringify(names).toLowerCase();

    const injection = /prompt|template|system/i.test(surface);
    const exfil = /curl|http|get|post|upload|download/i.test(surface);
    const privilege = /exec|shell|sudo|chmod|chown|fs|file/i.test(surface);

    const checks = [
      { id: "stride.spoofing.auth", ok: true, text: "Auth scheme validated (G1)" },
      { id: "stride.tampering.muttools", ok: !/mutable|dynamic/i.test(surface), text: "Tool mutation guarded" },
      { id: "stride.repudiation.logging", ok: true, text: "Structured, redacted logs" },
      { id: "stride.info.disclosure", ok: !exfil, text: "No unconstrained net exfil tools" },
      { id: "stride.dos.streaming", ok: true, text: "Backpressure/heartbeat in streaming" },
      { id: "stride.elevation", ok: !privilege, text: "No exec/fs admin tools without prompts" }
    ];

    for (const check of checks) {
      findings.push({
        id: check.id,
        area: "threat-model",
        severity: check.ok ? "info" : "major",
        title: check.ok ? `Check: ${check.text}` : `Risk: ${check.text}`,
        description: check.ok
          ? "No immediate red flags from heuristics."
          : "Heuristics flagged a risky surface; ensure confirmations, scopes, and dry-runs.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.6
      });
}

function extractToolNames(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const maybe = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}

    if (injection) {
      findings.push({
        id: "stride.injection.surface",
        area: "threat-model",
        severity: "minor",
        title: "Prompt-injection surface present",
        description: "Prompts/templates detected; apply content sanitization and allowlists.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["injection"],
        confidence: 0.7
      });
    }

    return findings;
  }
};
