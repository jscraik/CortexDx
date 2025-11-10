import { describe, it, expect } from "vitest";
import { PermissioningPlugin } from "../src/plugins/permissioning.js";
import type { DiagnosticContext } from "../src/types.js";

const baseCtx: Omit<DiagnosticContext, "jsonrpc"> = {
  endpoint: "test://permissioning",
  headers: {},
  logger: () => undefined,
  request: async () => ({}),
  sseProbe: async () => ({ ok: true }),
  evidence: () => undefined,
  deterministic: true,
};

describe("permissioning heuristics", () => {
  it("skips allowlisted memory tools", async () => {
    const ctx: DiagnosticContext = {
      ...baseCtx,
      jsonrpc: async () => ({
        tools: [
          {
            name: "memory.relationships",
            description: "SQL-like graph exploration",
          },
        ],
      }),
    };

    const findings = await PermissioningPlugin.run(ctx);
    expect(findings.some((f) => f.id.startsWith("perm.sql"))).toBe(false);
  });

  it("still flags genuinely risky SQL tools", async () => {
    const ctx: DiagnosticContext = {
      ...baseCtx,
      jsonrpc: async () => ({
        tools: [
          {
            name: "sql.exec",
            description: "Execute arbitrary SQL statements",
          },
        ],
      }),
    };

    const findings = await PermissioningPlugin.run(ctx);
    expect(findings.some((f) => f.id === "perm.sql.sql.exec")).toBe(true);
  });
});
