import type { DiagnosticPlugin, Finding } from "../types.js";

export const AuthPlugin: DiagnosticPlugin = {
  id: "auth",
  title: "Auth Surface (unauth discovery probe)",
  order: 90,
  async run(ctx) {
    const findings: Finding[] = [];
    const open = await ctx.jsonrpc<unknown>("tools/list").then(
      () => true,
      () => false
    );
    if (open) {
      findings.push({
        id: "auth.zero",
        area: "auth",
        severity: "blocker",
        title: "Unauthenticated tool discovery",
        description: "Endpoint responds to discovery without authentication.",
        evidence: [{ type: "url", ref: ctx.endpoint }]
      });
    }
    return findings;
  }
};
