import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

export const ThreatModelPlugin: DiagnosticPlugin = {
  id: "threat-model",
  title: "Threat Model Checklist (agentic)",
  order: 410,
  async run(ctx) {
    const findings: Finding[] = [];
    const tools = await ctx.jsonrpc<unknown>("tools/list").catch(() => null);
    const rawTools = extractToolNames(tools);
    const nameSurface = rawTools
      .map((tool) =>
        tool && typeof (tool as { name?: string }).name === "string"
          ? (tool as { name: string }).name
          : "",
      )
      .join(" ")
      .toLowerCase();
    const descSurface = rawTools
      .map((tool) =>
        tool &&
        typeof (tool as { description?: string }).description === "string"
          ? (tool as { description: string }).description
          : "",
      )
      .join(" ")
      .toLowerCase();
    const combinedSurface = `${nameSurface} ${descSurface}`;

    const injection = /prompt|template|system/i.test(combinedSurface);

    const networkNames = rawTools
      .map((tool) =>
        tool && typeof (tool as { name?: string }).name === "string"
          ? (tool as { name: string }).name.toLowerCase()
          : "",
      )
      .filter((name) =>
        /\b(curl|http|fetch|get|post|upload|download)\b/.test(name),
      );
    const NETWORK_ALLOWLIST = new Set([
      "fetch",
      "data.upload",
      "data.download",
      "data.smart_reference",
    ]);
    const exfilHard = networkNames.length > 0;
    const exfilSoft =
      !exfilHard &&
      /\b(curl|http|fetch|get|post|upload|download)\b/i.test(descSurface);
    const exfilIsAllowlisted =
      exfilHard && networkNames.every((name) => NETWORK_ALLOWLIST.has(name));

    const privilegeHard = /\b(exec|shell|sudo|chmod|chown|fs|file)\b/i.test(
      nameSurface,
    );
    const privilegeSoft =
      !privilegeHard &&
      /\b(exec|shell|sudo|chmod|chown|fs|file)\b/i.test(descSurface);

    const mutationRisk = /mutable|dynamic/i.test(descSurface);

    type Level = "info" | "minor" | "major";
    const checks: Array<{
      id: string;
      level: Level;
      text: string;
      riskDescription?: string;
    }> = [
      {
        id: "stride.spoofing.auth",
        level: "info",
        text: "Auth scheme validated (G1)",
      },
      {
        id: "stride.tampering.muttools",
        level: mutationRisk ? "minor" : "info",
        text: "Tool mutation guarded",
      },
      {
        id: "stride.repudiation.logging",
        level: "info",
        text: "Structured, redacted logs",
      },
      {
        id: "stride.info.disclosure",
        level: exfilHard
          ? exfilIsAllowlisted
            ? "minor"
            : "major"
          : exfilSoft
            ? "minor"
            : "info",
        text: "Network exfiltration surface",
        riskDescription:
          "Ensure network-capable tools require explicit scopes and confirmations.",
      },
      {
        id: "stride.dos.streaming",
        level: "info",
        text: "Backpressure/heartbeat in streaming",
      },
      {
        id: "stride.elevation",
        level: privilegeHard ? "major" : privilegeSoft ? "minor" : "info",
        text: "No exec/fs admin tools without prompts",
        riskDescription:
          "Exec/file tools demand multi-step confirmation and allowlists.",
      },
    ];

    for (const check of checks) {
      const severity = check.level;
      findings.push({
        id: check.id,
        area: "threat-model",
        severity,
        title:
          severity === "info" ? `Check: ${check.text}` : `Risk: ${check.text}`,
        description:
          severity === "info"
            ? "No immediate red flags from heuristics."
            : (check.riskDescription ??
              "Heuristics flagged a risky surface; ensure confirmations, scopes, and dry-runs."),
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.6,
      });
    }

    if (injection) {
      findings.push({
        id: "stride.injection.surface",
        area: "threat-model",
        severity: "minor",
        title: "Prompt-injection surface present",
        description:
          "Prompts/templates detected; apply content sanitization and allowlists.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["injection"],
        confidence: 0.7,
      });
    }

    return findings;
  },
};

function extractToolNames(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const maybe = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}
