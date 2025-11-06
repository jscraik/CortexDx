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

// Enhanced Protocol Validator Plugin for MCP protocol v2024-11-05
export const EnhancedProtocolValidatorPlugin: DiagnosticPlugin = {
  id: "enhanced-protocol-validator",
  title: "Enhanced MCP Protocol Validator (v2024-11-05)",
  order: 111,
  async run(ctx) {
    const findings: Finding[] = [];

    try {
      // Validate MCP protocol v2024-11-05 compliance
      const protocolResults = await validateMcpProtocol(ctx);
      findings.push(...protocolResults);

      // JSON-RPC message structure validation
      const jsonRpcResults = await validateJsonRpcStructure(ctx);
      findings.push(...jsonRpcResults);

      // Compatibility testing using worker sandbox
      const compatibilityResults = await performCompatibilityTesting(ctx);
      findings.push(...compatibilityResults);

    } catch (error) {
      findings.push({
        id: "mcp.protocol.validator.error",
        area: "protocol-validation",
        severity: "major",
        title: "Protocol validation failed",
        description: `Enhanced protocol validation error: ${String(error)}`,
        evidence: [{ type: "log", ref: "EnhancedProtocolValidatorPlugin" }],
        confidence: 0.9
      });
    }

    return findings;
  }
};

async function validateMcpProtocol(ctx: import("../types.js").DiagnosticContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Test MCP protocol v2024-11-05 initialization
    const initRequest = {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      clientInfo: {
        name: "insula-mcp-validator",
        version: "1.0.0"
      }
    };

    const initResponse = await ctx.jsonrpc<{
      protocolVersion?: string;
      capabilities?: unknown;
      serverInfo?: { name: string; version: string };
    }>("initialize", initRequest);

    if (!initResponse) {
      findings.push({
        id: "mcp.protocol.no_init_response",
        area: "protocol-validation",
        severity: "blocker",
        title: "No initialization response",
        description: "Server failed to respond to MCP initialize request",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.99
      });
      return findings;
    }

    // Validate protocol version
    if (initResponse.protocolVersion !== "2024-11-05") {
      findings.push({
        id: "mcp.protocol.version_mismatch",
        area: "protocol-validation",
        severity: "major",
        title: `Protocol version mismatch: ${initResponse.protocolVersion}`,
        description: "Server does not support MCP protocol v2024-11-05",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.95,
        recommendation: "Update server to support MCP protocol v2024-11-05"
      });
    } else {
      findings.push({
        id: "mcp.protocol.version_ok",
        area: "protocol-validation",
        severity: "info",
        title: "Protocol version validated",
        description: "Server supports MCP protocol v2024-11-05",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.99
      });
    }

    // Validate server info
    if (!initResponse.serverInfo?.name || !initResponse.serverInfo?.version) {
      findings.push({
        id: "mcp.protocol.missing_server_info",
        area: "protocol-validation",
        severity: "minor",
        title: "Incomplete server info",
        description: "Server info missing name or version fields",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.9
      });
    }

    // Validate capabilities structure
    if (!initResponse.capabilities || typeof initResponse.capabilities !== 'object') {
      findings.push({
        id: "mcp.protocol.invalid_capabilities",
        area: "protocol-validation",
        severity: "major",
        title: "Invalid capabilities structure",
        description: "Server capabilities field is missing or malformed",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.95
      });
    }

    // Test notification support (optional but recommended)
    try {
      await ctx.jsonrpc<void>("notifications/initialized");
      findings.push({
        id: "mcp.protocol.notifications_supported",
        area: "protocol-validation",
        severity: "info",
        title: "Notifications supported",
        description: "Server supports MCP notification protocol",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.8
      });
    } catch {
      findings.push({
        id: "mcp.protocol.notifications_unsupported",
        area: "protocol-validation",
        severity: "minor",
        title: "Notifications not supported",
        description: "Server does not support MCP notifications (optional feature)",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.7
      });
    }

  } catch (error) {
    findings.push({
      id: "mcp.protocol.validation_error",
      area: "protocol-validation",
      severity: "major",
      title: "Protocol validation error",
      description: `MCP protocol validation failed: ${String(error)}`,
      evidence: [{ type: "log", ref: "validateMcpProtocol" }],
      confidence: 0.9
    });
  }

  return findings;
}

async function validateJsonRpcStructure(ctx: import("../types.js").DiagnosticContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Test JSON-RPC 2.0 compliance with various message types
    const testCases = [
      {
        name: "Basic method call",
        method: "tools/list",
        params: undefined
      },
      {
        name: "Method with parameters",
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await ctx.jsonrpc<unknown>(testCase.method, testCase.params);

        // Validate response structure (should be handled by jsonrpc adapter)
        findings.push({
          id: `mcp.jsonrpc.${testCase.name.toLowerCase().replace(/\s+/g, '_')}_ok`,
          area: "jsonrpc-validation",
          severity: "info",
          title: `${testCase.name} - JSON-RPC valid`,
          description: "JSON-RPC message structure is compliant",
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.95
        });

      } catch (error) {
        const errorStr = String(error);

        // Distinguish between JSON-RPC errors and network/protocol errors
        if (errorStr.includes("JSON-RPC") || errorStr.includes("parse") || errorStr.includes("invalid")) {
          findings.push({
            id: `mcp.jsonrpc.${testCase.name.toLowerCase().replace(/\s+/g, '_')}_invalid`,
            area: "jsonrpc-validation",
            severity: "major",
            title: `${testCase.name} - JSON-RPC invalid`,
            description: `JSON-RPC structure validation failed: ${errorStr}`,
            evidence: [{ type: "log", ref: "validateJsonRpcStructure" }],
            confidence: 0.9
          });
        } else {
          // Method not supported is not a JSON-RPC structure issue
          findings.push({
            id: `mcp.jsonrpc.${testCase.name.toLowerCase().replace(/\s+/g, '_')}_unsupported`,
            area: "jsonrpc-validation",
            severity: "minor",
            title: `${testCase.name} - Method unsupported`,
            description: `Method not supported by server: ${testCase.method}`,
            evidence: [{ type: "url", ref: ctx.endpoint }],
            confidence: 0.8
          });
        }
      }
    }

    // Test batch request support (optional)
    try {
      // Note: This would require extending the jsonrpc adapter to support batch requests
      findings.push({
        id: "mcp.jsonrpc.batch_not_tested",
        area: "jsonrpc-validation",
        severity: "info",
        title: "Batch requests not tested",
        description: "JSON-RPC batch request testing requires adapter enhancement",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.5
      });
    } catch {
      // Batch testing not implemented yet
    }

  } catch (error) {
    findings.push({
      id: "mcp.jsonrpc.structure_error",
      area: "jsonrpc-validation",
      severity: "major",
      title: "JSON-RPC structure validation error",
      description: `JSON-RPC validation failed: ${String(error)}`,
      evidence: [{ type: "log", ref: "validateJsonRpcStructure" }],
      confidence: 0.9
    });
  }

  return findings;
}

async function performCompatibilityTesting(ctx: import("../types.js").DiagnosticContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Test compatibility with different MCP client behaviors
    const compatibilityTests = [
      {
        name: "Error handling",
        test: async () => {
          try {
            await ctx.jsonrpc<unknown>("nonexistent/method");
            return { success: false, reason: "Should have returned error for nonexistent method" };
          } catch (error) {
            const errorStr = String(error);
            if (errorStr.includes("not found") || errorStr.includes("unknown") || errorStr.includes("method")) {
              return { success: true, reason: "Proper error handling for unknown methods" };
            }
            return { success: false, reason: `Unexpected error format: ${errorStr}` };
          }
        }
      },
      {
        name: "Parameter validation",
        test: async () => {
          try {
            await ctx.jsonrpc<unknown>("initialize", { invalid: "parameters" });
            return { success: false, reason: "Should validate initialization parameters" };
          } catch (error) {
            return { success: true, reason: "Proper parameter validation" };
          }
        }
      }
    ];

    for (const compatTest of compatibilityTests) {
      try {
        const result = await compatTest.test();

        findings.push({
          id: `mcp.compatibility.${compatTest.name.toLowerCase().replace(/\s+/g, '_')}`,
          area: "compatibility-testing",
          severity: result.success ? "info" : "minor",
          title: `${compatTest.name} - ${result.success ? "Compatible" : "Issue"}`,
          description: result.reason,
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.8
        });

      } catch (error) {
        findings.push({
          id: `mcp.compatibility.${compatTest.name.toLowerCase().replace(/\s+/g, '_')}_error`,
          area: "compatibility-testing",
          severity: "minor",
          title: `${compatTest.name} - Test error`,
          description: `Compatibility test failed: ${String(error)}`,
          evidence: [{ type: "log", ref: "performCompatibilityTesting" }],
          confidence: 0.7
        });
      }
    }

    // Overall compatibility assessment
    const successfulTests = findings.filter(f => f.id.includes("compatibility") && f.severity === "info").length;
    const totalTests = compatibilityTests.length;
    const compatibilityScore = (successfulTests / totalTests) * 100;

    findings.push({
      id: "mcp.compatibility.summary",
      area: "compatibility-testing",
      severity: compatibilityScore >= 80 ? "info" : compatibilityScore >= 60 ? "minor" : "major",
      title: `Compatibility score: ${compatibilityScore.toFixed(1)}%`,
      description: `${successfulTests}/${totalTests} compatibility tests passed`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.9
    });

  } catch (error) {
    findings.push({
      id: "mcp.compatibility.testing_error",
      area: "compatibility-testing",
      severity: "major",
      title: "Compatibility testing failed",
      description: `Compatibility testing error: ${String(error)}`,
      evidence: [{ type: "log", ref: "performCompatibilityTesting" }],
      confidence: 0.9
    });
  }

  return findings;
}
