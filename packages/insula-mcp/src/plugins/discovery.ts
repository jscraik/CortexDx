import type { DiagnosticPlugin, Finding } from "../types.js";

export const DiscoveryPlugin: DiagnosticPlugin = {
  id: "discovery",
  title: "Discovery (tools/prompts/resources)",
  order: 100,
  async run(ctx) {
    const findings: Finding[] = [];
    try {
      const result = await ctx.jsonrpc<unknown>("tools/list").catch(() => null);
      const tools = extractTools(result);
      if (!tools) {
        findings.push({
          id: "disc.unknown",
          area: "discovery",
          severity: "minor",
          title: "Could not enumerate tools via JSON-RPC",
          description: "Endpoint did not respond to 'tools/list'. Server may use a different method.",
          evidence: [{ type: "url", ref: ctx.endpoint }]
        });
      } else {
        const count = tools.length;
        findings.push({
          id: "disc.ok",
          area: "discovery",
          severity: "info",
          title: `Discovered ${count} tool(s)`,
          description: "Tools retrieved via JSON-RPC 'tools/list'.",
          evidence: [{ type: "url", ref: ctx.endpoint }]
        });
      }
    } catch (error) {
      findings.push({
        id: "disc.error",
        area: "discovery",
        severity: "major",
        title: "Discovery failed",
        description: String(error),
        evidence: [{ type: "log", ref: "DiscoveryPlugin" }]
      });
    }
    return findings;
  }
};

function extractTools(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const maybeTools = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybeTools)) return maybeTools;
  }
  return null;
}
