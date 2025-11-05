import type { DiagnosticPlugin, Finding } from "../types.js";

export const ProtocolPlugin: DiagnosticPlugin = {
  id: "protocol",
  title: "Protocol Conformance (JSON-RPC)",
  order: 110,
  async run(ctx) {
    const findings: Finding[] = [];
    try {
      const pong = await ctx.jsonrpc<unknown>("rpc.ping").catch(() => null);
      if (pong === null) {
        findings.push({
          id: "jsonrpc.no_ping",
          area: "protocol",
          severity: "minor",
          title: "No 'rpc.ping' response",
          description: "Server didn't respond to a simple JSON-RPC ping; method name may differ.",
          evidence: [{ type: "url", ref: ctx.endpoint }]
        });
      }
    } catch (error) {
      findings.push({
        id: "jsonrpc.error",
        area: "protocol",
        severity: "major",
        title: "JSON-RPC call error",
        description: String(error),
        evidence: [{ type: "log", ref: "ProtocolPlugin" }]
      });
    }
    return findings;
  }
};
