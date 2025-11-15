import type { DiagnosticPlugin, EvidencePointer, FilePlan, Finding } from "../types.js";
import { getMcpSpecEvidence } from "../library/mcp-docs-evidence.js";

/**
 * MCP Compatibility Checker Plugin
 *
 * Tests MCP servers against multiple client implementations and protocol versions
 * to ensure interoperability and identify compatibility issues.
 *
 * Requirements: 11.1, 11.3, 11.4
 * Performance target: Complete testing within 120 seconds
 */
export const McpCompatibilityCheckerPlugin: DiagnosticPlugin = {
  id: "mcp-compatibility-checker",
  title: "MCP Compatibility Checker (Interoperability Testing)",
  order: 115,
  async run(ctx) {
    const startTime = Date.now();
    const findings: Finding[] = [];

    try {
      // Test protocol version compatibility
      const versionResults = await testProtocolVersions(ctx);
      findings.push(...versionResults);

      // Test client behavior compatibility
      const clientResults = await testClientBehaviors(ctx);
      findings.push(...clientResults);

      // Test feature interoperability
      const featureResults = await testFeatureInterop(ctx);
      findings.push(...featureResults);

      // Generate migration recommendations
      const migrationResults = await generateMigrationPaths(ctx, findings);
      findings.push(...migrationResults);

      // Validate test duration (≤120s requirement)
      const testDuration = Date.now() - startTime;
      if (testDuration > 120000) {
        findings.push({
          id: "mcp.compat.timeout",
          area: "compatibility-performance",
          severity: "minor",
          title: "Compatibility testing exceeded time limit",
          description: `Testing took ${testDuration}ms, exceeding 120s requirement`,
          evidence: [{ type: "log", ref: "McpCompatibilityCheckerPlugin" }],
          confidence: 1.0,
        });
      } else {
        findings.push({
          id: "mcp.compat.performance",
          area: "compatibility-performance",
          severity: "info",
          title: `Compatibility testing completed in ${testDuration}ms`,
          description: "Testing completed within performance requirements",
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 1.0,
        });
      }
    } catch (error) {
      findings.push({
        id: "mcp.compat.error",
        area: "compatibility-testing",
        severity: "major",
        title: "Compatibility testing failed",
        description: `Compatibility checker error: ${String(error)}`,
        evidence: [{ type: "log", ref: "McpCompatibilityCheckerPlugin" }],
        confidence: 0.9,
      });
    }

    return findings;
  },
};

async function testProtocolVersions(
  ctx: import("../types.js").DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const versions = ["2024-11-05", "2024-10-07", "2024-09-01"];

  for (const version of versions) {
    try {
      const initRequest = {
        protocolVersion: version,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        clientInfo: { name: "cortexdx-compat-checker", version: "1.0.0" },
      };

      const response = await ctx.jsonrpc<{
        protocolVersion?: string;
        capabilities?: unknown;
        serverInfo?: { name: string; version: string };
      }>("initialize", initRequest);

      if (response?.protocolVersion === version) {
        const evidence = await buildSpecEvidence(ctx, `initialize protocol ${version}`);
        findings.push({
          id: `mcp.compat.version.${version.replace(/\./g, "_")}`,
          area: "version-compatibility",
          severity: "info",
          title: `Protocol ${version} supported`,
          description: `Server supports MCP protocol version ${version}`,
          evidence,
          confidence: 0.95,
        });
      } else if (response?.protocolVersion) {
        const evidence = await buildSpecEvidence(
          ctx,
          `MCP protocol ${version} negotiation initialize response`,
        );
        findings.push({
          id: `mcp.compat.version.${version.replace(/\./g, "_")}_mismatch`,
          area: "version-compatibility",
          severity: "minor",
          title: `Protocol ${version} version mismatch`,
          description: `Requested ${version}, server responded with ${response.protocolVersion}`,
          evidence,
          confidence: 0.9,
          recommendation: `Server may have backward compatibility issues with ${version}`,
        });
      }
    } catch (error) {
      const evidence = await buildSpecEvidence(
        ctx,
        `MCP protocol ${version} initialize support`,
      );
      findings.push({
        id: `mcp.compat.version.${version.replace(/\./g, "_")}_unsupported`,
        area: "version-compatibility",
        severity: "minor",
        title: `Protocol ${version} not supported`,
        description: `Server does not support protocol version ${version}: ${String(error)}`,
        evidence,
        confidence: 0.85,
      });
    }
  }

  return findings;
}

async function testClientBehaviors(
  ctx: import("../types.js").DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  const behaviorTests = [
    {
      name: "Graceful error handling",
      test: async () => {
        try {
          await ctx.jsonrpc<unknown>("nonexistent/method");
          return {
            success: false,
            reason: "Should return proper error for unknown methods",
          };
        } catch (error) {
          const errorStr = String(error);
          if (
            errorStr.includes("not found") ||
            errorStr.includes("unknown") ||
            errorStr.includes("method")
          ) {
            return {
              success: true,
              reason: "Proper error response for unknown methods",
            };
          }
          return {
            success: false,
            reason: `Unexpected error format: ${errorStr}`,
          };
        }
      },
    },
    {
      name: "Parameter validation",
      test: async () => {
        try {
          await ctx.jsonrpc<unknown>("initialize", { invalid: "params" });
          return {
            success: false,
            reason: "Should validate required parameters",
          };
        } catch (error) {
          return {
            success: true,
            reason: "Proper parameter validation",
          };
        }
      },
    },
    {
      name: "Concurrent request handling",
      test: async () => {
        try {
          const requests = [
            ctx.jsonrpc<unknown>("tools/list"),
            ctx.jsonrpc<unknown>("resources/list").catch(() => null),
            ctx.jsonrpc<unknown>("prompts/list").catch(() => null),
          ];
          await Promise.all(requests);
          return {
            success: true,
            reason: "Server handles concurrent requests",
          };
        } catch (error) {
          return {
            success: false,
            reason: `Concurrent request handling failed: ${String(error)}`,
          };
        }
      },
    },
    {
      name: "Large payload handling",
      test: async () => {
        try {
          const largeParams = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
              experimental: { largeData: "x".repeat(10000) },
            },
            clientInfo: { name: "test", version: "1.0.0" },
          };
          await ctx.jsonrpc<unknown>("initialize", largeParams);
          return {
            success: true,
            reason: "Server handles large payloads",
          };
        } catch (error) {
          return {
            success: false,
            reason: `Large payload handling failed: ${String(error)}`,
          };
        }
      },
    },
  ];

  for (const behaviorTest of behaviorTests) {
    try {
      const result = await behaviorTest.test();
      findings.push({
        id: `mcp.compat.behavior.${behaviorTest.name.toLowerCase().replace(/\s+/g, "_")}`,
        area: "client-behavior",
        severity: result.success ? "info" : "minor",
        title: `${behaviorTest.name} - ${result.success ? "Compatible" : "Issue"}`,
        description: result.reason,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.85,
      });
    } catch (error) {
      findings.push({
        id: `mcp.compat.behavior.${behaviorTest.name.toLowerCase().replace(/\s+/g, "_")}_error`,
        area: "client-behavior",
        severity: "minor",
        title: `${behaviorTest.name} - Test error`,
        description: `Behavior test failed: ${String(error)}`,
        evidence: [{ type: "log", ref: "testClientBehaviors" }],
        confidence: 0.7,
      });
    }
  }

  return findings;
}

async function testFeatureInterop(
  ctx: import("../types.js").DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  const featureTests = [
    {
      name: "Tools listing",
      method: "tools/list",
      required: true,
    },
    {
      name: "Resources listing",
      method: "resources/list",
      required: false,
    },
    {
      name: "Prompts listing",
      method: "prompts/list",
      required: false,
    },
    {
      name: "Logging support",
      method: "logging/setLevel",
      required: false,
    },
  ];

  for (const feature of featureTests) {
    try {
      await ctx.jsonrpc<unknown>(feature.method);
      const evidence = await buildSpecEvidence(
        ctx,
        feature.required ? `MCP capability ${feature.method}` : undefined,
      );
      findings.push({
        id: `mcp.compat.feature.${feature.name.toLowerCase().replace(/\s+/g, "_")}`,
        area: "feature-interoperability",
        severity: "info",
        title: `${feature.name} supported`,
        description: `Server implements ${feature.method}`,
        evidence,
        confidence: 0.95,
      });
    } catch (error) {
      const severity = feature.required ? "major" : "info";
      const evidence = await buildSpecEvidence(
        ctx,
        feature.required ? `MCP capability ${feature.method}` : undefined,
      );
      findings.push({
        id: `mcp.compat.feature.${feature.name.toLowerCase().replace(/\s+/g, "_")}_unsupported`,
        area: "feature-interoperability",
        severity,
        title: `${feature.name} ${feature.required ? "missing" : "not available"}`,
        description: feature.required
          ? `Required feature ${feature.method} not implemented`
          : `Optional feature ${feature.method} not available`,
        evidence,
        confidence: 0.9,
      });
    }
  }

  return findings;
}

async function generateMigrationPaths(
  ctx: import("../types.js").DiagnosticContext,
  existingFindings: Finding[],
): Promise<Finding[]> {
  const findings: Finding[] = [];

  const versionIssues = existingFindings.filter(
    (f) => f.area === "version-compatibility" && f.severity !== "info",
  );

  if (versionIssues.length > 0) {
    const migrationSteps: string[] = [
      "Review MCP protocol changelog for breaking changes",
      "Update server implementation to support latest protocol version",
      "Test backward compatibility with older clients",
      "Update client libraries to match server protocol version",
      "Deploy changes with gradual rollout strategy",
    ];

    const filePlan: FilePlan = [
      {
        action: "update",
        path: "mcp-server-config.json",
        description: "Update protocol version to 2024-11-05",
      },
      {
        action: "update",
        path: "package.json",
        description: "Update MCP SDK dependencies to latest versions",
      },
    ];

    findings.push({
      id: "mcp.compat.migration.version_upgrade",
      area: "migration-path",
      severity: "minor",
      title: "Protocol version migration recommended",
      description: `Found ${versionIssues.length} version compatibility issues`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.9,
      recommendation: "Upgrade to latest MCP protocol version",
      remediation: {
        steps: migrationSteps,
        filePlan,
      },
    });
  }

  const behaviorIssues = existingFindings.filter(
    (f) => f.area === "client-behavior" && f.severity !== "info",
  );

  if (behaviorIssues.length > 0) {
    findings.push({
      id: "mcp.compat.migration.behavior_fixes",
      area: "migration-path",
      severity: "minor",
      title: "Client behavior compatibility improvements needed",
      description: `Found ${behaviorIssues.length} client behavior issues`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.85,
      recommendation: "Implement robust error handling and validation",
      remediation: {
        steps: [
          "Add comprehensive input validation",
          "Implement proper error response formatting",
          "Add support for concurrent request handling",
          "Test with multiple client implementations",
        ],
      },
    });
  }

  const compatibilityScore = calculateCompatScore(existingFindings);
  findings.push({
    id: "mcp.compat.summary",
    area: "compatibility-summary",
    severity:
      compatibilityScore >= 80
        ? "info"
        : compatibilityScore >= 60
          ? "minor"
          : "major",
    title: `Overall compatibility score: ${compatibilityScore.toFixed(1)}%`,
    description: generateCompatSummary(existingFindings, compatibilityScore),
    evidence: [{ type: "url", ref: ctx.endpoint }],
    confidence: 0.95,
  });

  return findings;
}

function calculateCompatScore(findings: Finding[]): number {
  const compatFindings = findings.filter(
    (f) =>
      f.area === "version-compatibility" ||
      f.area === "client-behavior" ||
      f.area === "feature-interoperability",
  );

  if (compatFindings.length === 0) return 100;

  const successfulTests = compatFindings.filter(
    (f) => f.severity === "info",
  ).length;
  return (successfulTests / compatFindings.length) * 100;
}

function generateCompatSummary(findings: Finding[], score: number): string {
  const versionTests = findings.filter(
    (f) => f.area === "version-compatibility",
  ).length;
  const behaviorTests = findings.filter(
    (f) => f.area === "client-behavior",
  ).length;
  const featureTests = findings.filter(
    (f) => f.area === "feature-interoperability",
  ).length;

  return `Compatibility testing complete: ${score.toFixed(1)}% compatible. Tested ${versionTests} protocol versions, ${behaviorTests} client behaviors, and ${featureTests} features.`;
}

async function buildSpecEvidence(
  ctx: import("../types.js").DiagnosticContext,
  query?: string,
): Promise<EvidencePointer[]> {
  const evidence: EvidencePointer[] = [{ type: "url", ref: ctx.endpoint }];
  if (query) {
    const pointer = await getMcpSpecEvidence(query);
    if (pointer) {
      evidence.push(pointer);
    }
  }
  return evidence;
}
