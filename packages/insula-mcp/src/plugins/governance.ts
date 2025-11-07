import type { DiagnosticPlugin, Finding } from "../types.js";

interface GovernanceMetadata {
  framework?: string;
  version?: string;
  gates?: string[];
  standards?: string[];
  lastAudit?: string;
  commit?: string;
}

export const GovernancePlugin: DiagnosticPlugin = {
  id: "governance",
  title: "Governance & Policy Detection",
  order: 400,
  async run(ctx) {
    const findings: Finding[] = [];
    let governanceFound = false;

    // Strategy 1: Try MCP JSON-RPC method for governance metadata
    try {
      const govResponse = await ctx.jsonrpc<{ governance?: GovernanceMetadata }>(
        "governance/info"
      ).catch(() => null);

      if (govResponse?.governance) {
        governanceFound = true;
        const gov = govResponse.governance;
        findings.push({
          id: "gov.jsonrpc.detected",
          area: "governance",
          severity: "info",
          title: `Governance framework: ${gov.framework || "unknown"}`,
          description: buildGovernanceDescription(gov, "JSON-RPC"),
          evidence: [{ type: "url", ref: ctx.endpoint }],
          tags: ["governance", "compliance"]
        });
      }
    } catch (error) {
      ctx.logger(`[governance] JSON-RPC probe failed: ${String(error)}`);
    }

    // Strategy 2: Try standard .well-known location
    if (!governanceFound) {
      const baseUrl = ctx.endpoint.replace(/\/mcp\/?$/, "");
      const wellKnownUrl = `${baseUrl}/.well-known/mcp-governance.json`;

      try {
        const wellKnown = await ctx.request<GovernanceMetadata>(wellKnownUrl);
        if (wellKnown && (wellKnown.framework || wellKnown.version)) {
          governanceFound = true;
          findings.push({
            id: "gov.wellknown.detected",
            area: "governance",
            severity: "info",
            title: `Governance via .well-known: ${wellKnown.framework || "detected"}`,
            description: buildGovernanceDescription(wellKnown, ".well-known"),
            evidence: [{ type: "url", ref: wellKnownUrl }],
            tags: ["governance", "compliance"]
          });
        }
      } catch (error) {
        ctx.logger(`[governance] .well-known probe failed: ${String(error)}`);
      }
    }

    // Strategy 3: Try common governance pack locations
    if (!governanceFound) {
      const baseUrl = ctx.endpoint.replace(/\/mcp\/?$/, "");
      const packLocations = [
        { path: "/.cortex/manifest.json", name: "Cortex" },
        { path: "/.insula/manifest.json", name: "Insula" },
        { path: "/governance/manifest.json", name: "Generic" }
      ];

      for (const location of packLocations) {
        try {
          const manifest = await ctx.request<GovernanceMetadata>(`${baseUrl}${location.path}`);
          if (manifest && (manifest.framework || manifest.version)) {
            governanceFound = true;
            findings.push({
              id: "gov.pack.detected",
              area: "governance",
              severity: "info",
              title: `${location.name} governance pack detected`,
              description: buildGovernanceDescription(manifest, location.name),
              evidence: [{ type: "url", ref: `${baseUrl}${location.path}` }],
              tags: ["governance", "compliance"]
            });
            break;
          }
        } catch (error) {
          ctx.logger(`[governance] ${location.name} probe failed: ${String(error)}`);
        }
      }
    }

    // If no governance found, report as informational (not a failure)
    if (!governanceFound) {
      findings.push({
        id: "gov.not.detected",
        area: "governance",
        severity: "info",
        title: "No governance metadata exposed",
        description: "Server does not expose governance metadata via standard methods (JSON-RPC governance/info, .well-known/mcp-governance.json, or common pack locations). This is optional for MCP servers but recommended for enterprise deployments.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["governance"],
        recommendation: "Consider exposing governance metadata via JSON-RPC 'governance/info' method or .well-known/mcp-governance.json for transparency and compliance tracking."
      });
    }

    return findings;
  }
};

function buildGovernanceDescription(gov: GovernanceMetadata, source: string): string {
  const parts: string[] = [`Source: ${source}`];

  if (gov.version) parts.push(`Version: ${gov.version}`);
  if (gov.gates && gov.gates.length > 0) {
    parts.push(`Gates: ${gov.gates.join(", ")}`);
  }
  if (gov.standards && gov.standards.length > 0) {
    parts.push(`Standards: ${gov.standards.join(", ")}`);
  }
  if (gov.lastAudit) parts.push(`Last Audit: ${gov.lastAudit}`);
  if (gov.commit) parts.push(`Commit: ${gov.commit.substring(0, 8)}`);

  return parts.join(" | ");
}
