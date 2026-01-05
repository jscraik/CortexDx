import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

export const ToolDriftPlugin: DiagnosticPlugin = {
  id: "tool-drift",
  title: "Tool Surface Drift",
  order: 300,
  async run(ctx) {
    const findings: Finding[] = [];
    const first = await ctx.jsonrpc<unknown>("tools/list").catch(() => null);
    const second = await ctx.jsonrpc<unknown>("tools/list").catch(() => null);
    if (first && second && JSON.stringify(first) !== JSON.stringify(second)) {
      findings.push({
        id: "tools.mutable",
        area: "security",
        severity: "major",
        title: "Mutable tool surface detected",
        description:
          "Tools change within a single session without version bump.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["tool-poisoning", "drift"],
      });
    }
    return findings;
  },
};
