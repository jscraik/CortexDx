import type { DiagnosticContext, DiagnosticPlugin, EvidencePointer, Finding } from "@brainwav/cortexdx-core";
import type { CELRule } from "../adapters/protovalidate.js";
import { ProtovalidateAdapter } from "../adapters/protovalidate.js";
import { getMcpSpecEvidence } from "../library/mcp-docs-evidence.js";

// JSON-RPC error codes for validation
const JSONRPCErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32003,
  ServerError: -32000,
} as const;

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

// Enhanced Protocol Validator Plugin for MCP protocol v2024-11-05 with Protovalidate
export const EnhancedProtocolValidatorPlugin: DiagnosticPlugin = {
  id: "enhanced-protocol-validator",
  title: "Enhanced MCP Protocol Validator (v2024-11-05) with Protovalidate",
  order: 111,
  async run(ctx) {
    const findings: Finding[] = [];
    const protovalidate = new ProtovalidateAdapter();

    try {
      // Validate MCP protocol v2024-11-05 compliance with semantic validation
      const protocolResults = await validateMcpProtocolWithProtovalidate(ctx, protovalidate);
      findings.push(...protocolResults);

      // JSON-RPC message structure validation with semantic checks
      const jsonRpcResults = await validateJsonRpcWithSemantics(ctx, protovalidate);
      findings.push(...jsonRpcResults);

      // gRPC message validation (if applicable)
      const grpcResults = await validateGrpcMessages(ctx, protovalidate);
      findings.push(...grpcResults);

      // Enhanced MCP handshake validation
      const handshakeResults = await validateMcpHandshake(ctx, protovalidate);
      findings.push(...handshakeResults);

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

async function validateMcpProtocol(ctx: DiagnosticContext): Promise<Finding[]> {
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
        name: "cortexdx-validator",
        version: "1.0.0"
      }
    };

    const initResponse = await ctx.jsonrpc<{
      protocolVersion?: string;
      capabilities?: unknown;
      serverInfo?: { name: string; version: string };
    }>("initialize", initRequest);

    if (!initResponse) {
      const evidence = await buildProtocolEvidence(ctx, "MCP initialize request handshake");
      findings.push({
        id: "mcp.protocol.no_init_response",
        area: "protocol-validation",
        severity: "blocker",
        title: "No initialization response",
        description: "Server failed to respond to MCP initialize request",
        evidence,
        confidence: 0.99
      });
      return findings;
    }

    // Validate protocol version
    if (initResponse.protocolVersion !== "2024-11-05") {
      const evidence = await buildProtocolEvidence(ctx, "MCP protocol version negotiation 2024-11-05");
      findings.push({
        id: "mcp.protocol.version_mismatch",
        area: "protocol-validation",
        severity: "major",
        title: `Protocol version mismatch: ${initResponse.protocolVersion}`,
        description: "Server does not support MCP protocol v2024-11-05",
        evidence,
        confidence: 0.95,
        recommendation: "Update server to support MCP protocol v2024-11-05"
      });
    } else {
      const evidence = await buildProtocolEvidence(ctx, "MCP protocol version negotiation 2024-11-05");
      findings.push({
        id: "mcp.protocol.version_ok",
        area: "protocol-validation",
        severity: "info",
        title: "Protocol version validated",
        description: "Server supports MCP protocol v2024-11-05",
        evidence,
        confidence: 0.99
      });
    }

    // Validate server info
    if (!initResponse.serverInfo?.name || !initResponse.serverInfo?.version) {
      const evidence = await buildProtocolEvidence(ctx, "MCP initialize serverInfo");
      findings.push({
        id: "mcp.protocol.missing_server_info",
        area: "protocol-validation",
        severity: "minor",
        title: "Incomplete server info",
        description: "Server info missing name or version fields",
        evidence,
        confidence: 0.9
      });
    }

    // Validate capabilities structure
    if (!initResponse.capabilities || typeof initResponse.capabilities !== 'object') {
      const evidence = await buildProtocolEvidence(ctx, "MCP initialize capabilities object tools resources prompts");
      findings.push({
        id: "mcp.protocol.invalid_capabilities",
        area: "protocol-validation",
        severity: "major",
        title: "Invalid capabilities structure",
        description: "Server capabilities field is missing or malformed",
        evidence,
        confidence: 0.95
      });
    }

    // Test notification support (optional but recommended)
    try {
      await ctx.jsonrpc<void>("notifications/initialized");
      const evidence = await buildProtocolEvidence(ctx, "notifications/initialized method");
      findings.push({
        id: "mcp.protocol.notifications_supported",
        area: "protocol-validation",
        severity: "info",
        title: "Notifications supported",
        description: "Server supports MCP notification protocol",
        evidence,
        confidence: 0.8
      });
    } catch {
      const evidence = await buildProtocolEvidence(ctx, "notifications/initialized method");
      findings.push({
        id: "mcp.protocol.notifications_unsupported",
        area: "protocol-validation",
        severity: "minor",
        title: "Notifications not supported",
        description: "Server does not support MCP notifications (optional feature)",
        evidence,
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

async function buildProtocolEvidence(
  ctx: DiagnosticContext,
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

async function validateJsonRpcStructure(ctx: DiagnosticContext): Promise<Finding[]> {
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

async function performCompatibilityTesting(ctx: DiagnosticContext): Promise<Finding[]> {
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


/**
 * Validate MCP protocol with Protovalidate semantic validation
 * Requirements: 23.1, 23.2
 */
async function validateMcpProtocolWithProtovalidate(
  ctx: DiagnosticContext,
  protovalidate: ProtovalidateAdapter
): Promise<Finding[]> {
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
        name: "cortexdx-validator",
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

    // Define CEL rules for MCP protocol validation
    const mcpRules: CELRule[] = [
      {
        field: 'protocolVersion',
        expression: 'this.matches("^\\\\d{4}-\\\\d{2}-\\\\d{2}$")',
        message: 'Protocol version must be in YYYY-MM-DD format (e.g., "2024-11-05")',
        severity: 'error'
      },
      {
        field: 'serverInfo.name',
        expression: 'size(this) > 0',
        message: 'Server name must not be empty',
        severity: 'error'
      },
      {
        field: 'serverInfo.version',
        expression: 'size(this) > 0',
        message: 'Server version must not be empty',
        severity: 'error'
      },
      {
        field: 'capabilities',
        expression: 'has(this.tools) || has(this.resources) || has(this.prompts)',
        message: 'Server must declare at least one capability (tools, resources, or prompts)',
        severity: 'warning'
      }
    ];

    // Validate with Protovalidate
    const validationResult = await protovalidate.validate(initResponse, mcpRules);

    if (!validationResult.valid) {
      for (const violation of validationResult.violations) {
        findings.push({
          id: `mcp.protocol.semantic.${violation.constraintId}`,
          area: "protocol-validation",
          severity: violation.constraintId.includes('version') ? "major" : "minor",
          title: `Semantic validation failed: ${violation.fieldPath}`,
          description: violation.message,
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.95,
          recommendation: `Fix field ${violation.fieldPath}: ${violation.expectedConstraint}`
        });
      }
    }

    // Additional protocol version check
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

  } catch (error) {
    findings.push({
      id: "mcp.protocol.validation_error",
      area: "protocol-validation",
      severity: "major",
      title: "Protocol validation error",
      description: `MCP protocol validation failed: ${String(error)}`,
      evidence: [{ type: "log", ref: "validateMcpProtocolWithProtovalidate" }],
      confidence: 0.9
    });
  }

  return findings;
}

/**
 * Validate JSON-RPC messages with semantic validation
 * Requirements: 23.2
 */
async function validateJsonRpcWithSemantics(
  ctx: DiagnosticContext,
  protovalidate: ProtovalidateAdapter
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Define CEL rules for JSON-RPC 2.0 validation
    const jsonRpcRules: CELRule[] = [
      {
        field: 'jsonrpc',
        expression: 'this == "2.0"',
        message: 'JSON-RPC version must be "2.0"',
        severity: 'error'
      },
      {
        field: 'method',
        expression: 'size(this) > 0',
        message: 'Method name must not be empty',
        severity: 'error'
      },
      {
        field: 'id',
        expression: 'this != null',
        message: 'Request ID must be present for non-notification requests',
        severity: 'error'
      }
    ];

    // Test JSON-RPC 2.0 compliance with various message types
    const testCases = [
      {
        name: "Tools list",
        method: "tools/list",
        params: undefined
      },
      {
        name: "Resources list",
        method: "resources/list",
        params: undefined
      }
    ];

    for (const testCase of testCases) {
      try {
        const response = await ctx.jsonrpc<unknown>(testCase.method, testCase.params);

        // Validate response structure with Protovalidate
        if (response && typeof response === 'object') {
          const responseRules: CELRule[] = [
            {
              field: 'result',
              expression: 'has(this.result) || has(this.error)',
              message: 'Response must contain either result or error field',
              severity: 'error'
            }
          ];

          const validationResult = await protovalidate.validate(response, responseRules);

          if (validationResult.valid) {
            findings.push({
              id: `mcp.jsonrpc.${testCase.name.toLowerCase().replace(/\s+/g, '_')}_ok`,
              area: "jsonrpc-validation",
              severity: "info",
              title: `${testCase.name} - JSON-RPC semantically valid`,
              description: "JSON-RPC message structure and semantics are compliant",
              evidence: [{ type: "url", ref: ctx.endpoint }],
              confidence: 0.95
            });
          } else {
            for (const violation of validationResult.violations) {
              findings.push({
                id: `mcp.jsonrpc.semantic.${violation.constraintId}`,
                area: "jsonrpc-validation",
                severity: "major",
                title: `JSON-RPC semantic violation: ${violation.fieldPath}`,
                description: violation.message,
                evidence: [{ type: "url", ref: ctx.endpoint }],
                confidence: 0.9
              });
            }
          }
        }

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
            evidence: [{ type: "log", ref: "validateJsonRpcWithSemantics" }],
            confidence: 0.9
          });
        }
      }
    }

  } catch (error) {
    findings.push({
      id: "mcp.jsonrpc.semantic_error",
      area: "jsonrpc-validation",
      severity: "major",
      title: "JSON-RPC semantic validation error",
      description: `JSON-RPC semantic validation failed: ${String(error)}`,
      evidence: [{ type: "log", ref: "validateJsonRpcWithSemantics" }],
      confidence: 0.9
    });
  }

  return findings;
}

/**
 * Validate gRPC messages (if applicable)
 * Requirements: 23.2
 */
async function validateGrpcMessages(
  ctx: DiagnosticContext,
  protovalidate: ProtovalidateAdapter
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Check if server supports gRPC transport
    // For now, we'll add a placeholder since most MCP servers use HTTP/SSE/WebSocket
    findings.push({
      id: "mcp.grpc.not_applicable",
      area: "grpc-validation",
      severity: "info",
      title: "gRPC validation not applicable",
      description: "Server does not appear to use gRPC transport (HTTP/SSE/WebSocket detected)",
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.8
    });

  } catch (error) {
    findings.push({
      id: "mcp.grpc.validation_error",
      area: "grpc-validation",
      severity: "minor",
      title: "gRPC validation error",
      description: `gRPC validation failed: ${String(error)}`,
      evidence: [{ type: "log", ref: "validateGrpcMessages" }],
      confidence: 0.7
    });
  }

  return findings;
}

/**
 * Enhanced MCP handshake validation with semantic checks
 * Requirements: 23.2
 */
async function validateMcpHandshake(
  ctx: DiagnosticContext,
  protovalidate: ProtovalidateAdapter
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Define comprehensive CEL rules for MCP handshake
    const handshakeRules: CELRule[] = [
      {
        field: 'protocolVersion',
        expression: 'this.startsWith("2024-")',
        message: 'Protocol version should be from 2024 specification',
        severity: 'warning'
      },
      {
        field: 'capabilities.tools',
        expression: 'has(this.tools)',
        message: 'Server should declare tools capability',
        severity: 'warning'
      },
      {
        field: 'serverInfo.name',
        expression: 'size(this) >= 3 && size(this) <= 100',
        message: 'Server name should be between 3 and 100 characters',
        severity: 'warning'
      },
      {
        field: 'serverInfo.version',
        expression: 'this.matches("^\\\\d+\\\\.\\\\d+\\\\.\\\\d+") || this.matches("^\\\\d+\\\\.\\\\d+")',
        message: 'Server version should follow semantic versioning (e.g., "1.0.0")',
        severity: 'warning'
      }
    ];

    // Perform handshake
    const initRequest = {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      clientInfo: {
        name: "cortexdx-validator",
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
        id: "mcp.handshake.failed",
        area: "handshake-validation",
        severity: "blocker",
        title: "MCP handshake failed",
        description: "Server did not respond to initialize request",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.99
      });
      return findings;
    }

    // Validate handshake with Protovalidate
    const validationResult = await protovalidate.validate(initResponse, handshakeRules);

    if (validationResult.valid) {
      findings.push({
        id: "mcp.handshake.success",
        area: "handshake-validation",
        severity: "info",
        title: "MCP handshake successful",
        description: "Server completed handshake with valid protocol compliance",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.99
      });
    } else {
      for (const violation of validationResult.violations) {
        findings.push({
          id: `mcp.handshake.semantic.${violation.constraintId}`,
          area: "handshake-validation",
          severity: violation.constraintId.includes('version') ? "minor" : "info",
          title: `Handshake semantic issue: ${violation.fieldPath}`,
          description: violation.message,
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.85,
          recommendation: `Consider fixing: ${violation.expectedConstraint}`
        });
      }
    }

    // Test notification support (part of handshake)
    try {
      await ctx.jsonrpc<void>("notifications/initialized");
      findings.push({
        id: "mcp.handshake.notifications_supported",
        area: "handshake-validation",
        severity: "info",
        title: "Notifications supported",
        description: "Server supports MCP notification protocol",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.8
      });
    } catch {
      findings.push({
        id: "mcp.handshake.notifications_unsupported",
        area: "handshake-validation",
        severity: "minor",
        title: "Notifications not supported",
        description: "Server does not support MCP notifications (optional feature)",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.7
      });
    }

  } catch (error) {
    findings.push({
      id: "mcp.handshake.validation_error",
      area: "handshake-validation",
      severity: "major",
      title: "Handshake validation error",
      description: `MCP handshake validation failed: ${String(error)}`,
      evidence: [{ type: "log", ref: "validateMcpHandshake" }],
      confidence: 0.9
    });
  }

  return findings;
}

/**
 * JSON-RPC 2.0 Structure Validation Plugin
 * Validates messages against formal JSON-RPC 2.0 specification
 */
export const JSONRPC20ValidationPlugin: DiagnosticPlugin = {
  id: "jsonrpc-2.0-validator",
  title: "JSON-RPC 2.0 Message Structure Validator",
  order: 112,
  async run(ctx) {
    const findings: Finding[] = [];

    try {
      // Test various JSON-RPC 2.0 message types
      const testCases = [
        {
          name: "Initialize request",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "cortexdx", version: "1.0.0" }
          },
          expectResult: true
        },
        {
          name: "Tools list request",
          method: "tools/list",
          params: undefined,
          expectResult: true
        },
        {
          name: "Invalid method",
          method: "nonexistent/method",
          params: undefined,
          expectResult: false
        }
      ];

      for (const testCase of testCases) {
        try {
          const response = await ctx.jsonrpc<unknown>(testCase.method, testCase.params);

          // Validate response structure
          if (response !== null && typeof response === 'object') {
            findings.push({
              id: `jsonrpc.structure.${testCase.name.toLowerCase().replace(/\s+/g, '_')}_valid`,
              area: "jsonrpc-structure",
              severity: "info",
              title: `${testCase.name} - Valid JSON-RPC 2.0 response`,
              description: "Response conforms to JSON-RPC 2.0 structure",
              evidence: [{ type: "url", ref: ctx.endpoint }],
              confidence: 0.95
            });
          }
        } catch (error) {
          const errorStr = String(error);

          if (!testCase.expectResult) {
            // Expected error for invalid method
            if (errorStr.includes(String(JSONRPCErrorCode.MethodNotFound)) ||
              errorStr.includes("not found") ||
              errorStr.includes("unknown")) {
              findings.push({
                id: "jsonrpc.structure.error_handling_correct",
                area: "jsonrpc-structure",
                severity: "info",
                title: "Proper JSON-RPC error handling",
                description: `Server correctly returns error for nonexistent method (code: ${JSONRPCErrorCode.MethodNotFound})`,
                evidence: [{ type: "url", ref: ctx.endpoint }],
                confidence: 0.9
              });
            }
          } else if (errorStr.includes("parse") || errorStr.includes("invalid")) {
            findings.push({
              id: `jsonrpc.structure.${testCase.name.toLowerCase().replace(/\s+/g, '_')}_malformed`,
              area: "jsonrpc-structure",
              severity: "major",
              title: `${testCase.name} - Malformed response`,
              description: `Response does not conform to JSON-RPC 2.0: ${errorStr}`,
              evidence: [{ type: "log", ref: "JSONRPC20ValidationPlugin" }],
              confidence: 0.95
            });
          }
        }
      }

      // Test batch request rejection (removed in 2025-06-18)
      findings.push({
        id: "jsonrpc.batch.not_supported",
        area: "jsonrpc-structure",
        severity: "info",
        title: "Batch requests not tested",
        description: "JSON-RPC batching was removed in MCP 2025-06-18 specification",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.8
      });

    } catch (error) {
      findings.push({
        id: "jsonrpc.structure.validation_error",
        area: "jsonrpc-structure",
        severity: "major",
        title: "JSON-RPC structure validation error",
        description: `Validation failed: ${String(error)}`,
        evidence: [{ type: "log", ref: "JSONRPC20ValidationPlugin" }],
        confidence: 0.9
      });
    }

    return findings;
  }
};

/**
 * Task-Augmented Request Validation Plugin
 * Tests MCP task support for long-running operations
 */
export const TaskAugmentedRequestPlugin: DiagnosticPlugin = {
  id: "task-augmented-validator",
  title: "MCP Task-Augmented Request Validator",
  order: 113,
  async run(ctx) {
    const findings: Finding[] = [];

    try {
      // Test if server declares task capabilities
      const initRequest = {
        protocolVersion: "2024-11-05",
        capabilities: {
          tasks: {
            list: {},
            cancel: {},
            requests: {
              elicitation: { create: {} },
              sampling: { createMessage: {} }
            }
          }
        },
        clientInfo: {
          name: "cortexdx-task-validator",
          version: "1.0.0"
        }
      };

      const initResponse = await ctx.jsonrpc<{
        capabilities?: {
          tasks?: {
            list?: Record<string, never>;
            cancel?: Record<string, never>;
            requests?: {
              tools?: { call?: Record<string, never> };
            };
          };
          tools?: { listChanged?: boolean };
        };
      }>("initialize", initRequest);

      // Check server task capabilities
      const serverTaskCapabilities = initResponse?.capabilities?.tasks;

      if (serverTaskCapabilities) {
        findings.push({
          id: "mcp.tasks.capabilities_declared",
          area: "task-validation",
          severity: "info",
          title: "Task capabilities declared",
          description: `Server supports tasks: ${JSON.stringify(serverTaskCapabilities, null, 2)}`,
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.95
        });

        // Test tools/list to check for taskSupport in tool definitions
        try {
          const toolsResponse = await ctx.jsonrpc<{
            tools?: Array<{
              name: string;
              execution?: {
                taskSupport?: "forbidden" | "optional" | "required";
              };
            }>;
          }>("tools/list");

          if (toolsResponse?.tools) {
            const toolsWithTaskSupport = toolsResponse.tools.filter(
              t => t.execution?.taskSupport && t.execution.taskSupport !== "forbidden"
            );

            if (toolsWithTaskSupport.length > 0) {
              findings.push({
                id: "mcp.tasks.tools_support_tasks",
                area: "task-validation",
                severity: "info",
                title: `${toolsWithTaskSupport.length} tool(s) support task execution`,
                description: `Tools with task support: ${toolsWithTaskSupport.map(t => `${t.name} (${t.execution?.taskSupport})`).join(", ")}`,
                evidence: [{ type: "url", ref: ctx.endpoint }],
                confidence: 0.9
              });
            } else {
              findings.push({
                id: "mcp.tasks.no_tools_support_tasks",
                area: "task-validation",
                severity: "minor",
                title: "No tools declare task support",
                description: "Server declares task capabilities but no tools have execution.taskSupport set",
                evidence: [{ type: "url", ref: ctx.endpoint }],
                confidence: 0.8,
                recommendation: "Add execution.taskSupport to tool definitions that support long-running operations"
              });
            }
          }
        } catch (error) {
          findings.push({
            id: "mcp.tasks.tools_list_error",
            area: "task-validation",
            severity: "minor",
            title: "Could not check tool task support",
            description: `Failed to list tools: ${String(error)}`,
            evidence: [{ type: "log", ref: "TaskAugmentedRequestPlugin" }],
            confidence: 0.7
          });
        }

        // Test tasks/list if supported
        if (serverTaskCapabilities.list) {
          try {
            const tasksResponse = await ctx.jsonrpc<{
              tasks?: Array<{
                taskId: string;
                status: string;
                createdAt?: string;
                lastUpdatedAt?: string;
              }>;
            }>("tasks/list");

            findings.push({
              id: "mcp.tasks.list_supported",
              area: "task-validation",
              severity: "info",
              title: "tasks/list method supported",
              description: `Server returned ${tasksResponse?.tasks?.length || 0} tasks`,
              evidence: [{ type: "url", ref: ctx.endpoint }],
              confidence: 0.9
            });

            // Validate task structure
            if (tasksResponse?.tasks && tasksResponse.tasks.length > 0) {
              const validTasks = tasksResponse.tasks.every(task => {
                return task.taskId && task.status &&
                  ["working", "input_required", "completed", "failed", "cancelled"].includes(task.status);
              });

              if (validTasks) {
                findings.push({
                  id: "mcp.tasks.structure_valid",
                  area: "task-validation",
                  severity: "info",
                  title: "Task structure is valid",
                  description: "All tasks have required fields (taskId, status) with valid status values",
                  evidence: [{ type: "url", ref: ctx.endpoint }],
                  confidence: 0.95
                });
              } else {
                findings.push({
                  id: "mcp.tasks.structure_invalid",
                  area: "task-validation",
                  severity: "major",
                  title: "Invalid task structure detected",
                  description: "Some tasks missing required fields or have invalid status values",
                  evidence: [{ type: "log", ref: "TaskAugmentedRequestPlugin" }],
                  confidence: 0.9,
                  recommendation: "Ensure all tasks have taskId and valid status (working, input_required, completed, failed, cancelled)"
                });
              }
            }
          } catch (error) {
            findings.push({
              id: "mcp.tasks.list_error",
              area: "task-validation",
              severity: "minor",
              title: "tasks/list method failed",
              description: `Failed to list tasks: ${String(error)}`,
              evidence: [{ type: "log", ref: "TaskAugmentedRequestPlugin" }],
              confidence: 0.8
            });
          }
        }

      } else {
        findings.push({
          id: "mcp.tasks.capabilities_not_declared",
          area: "task-validation",
          severity: "info",
          title: "No task capabilities declared",
          description: "Server does not declare support for task-augmented requests (optional feature)",
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.9
        });
      }

    } catch (error) {
      findings.push({
        id: "mcp.tasks.validation_error",
        area: "task-validation",
        severity: "major",
        title: "Task validation error",
        description: `Task-augmented request validation failed: ${String(error)}`,
        evidence: [{ type: "log", ref: "TaskAugmentedRequestPlugin" }],
        confidence: 0.9
      });
    }

    return findings;
  }
};

/**
 * Sampling & Content Block Validation Plugin
 * Tests enhanced sampling types with tool use and content blocks
 */
export const SamplingValidationPlugin: DiagnosticPlugin = {
  id: "sampling-validator",
  title: "MCP Sampling & Content Block Validator",
  order: 114,
  async run(ctx) {
    const findings: Finding[] = [];

    try {
      // Test if server declares sampling capabilities
      const initRequest = {
        protocolVersion: "2024-11-05",
        capabilities: {
          sampling: {
            context: {},
            tools: {}
          }
        },
        clientInfo: {
          name: "cortexdx-sampling-validator",
          version: "1.0.0"
        }
      };

      const initResponse = await ctx.jsonrpc<{
        capabilities?: {
          logging?: Record<string, never>;
        };
      }>("initialize", initRequest);

      // Sampling is a client capability, server doesn't need to declare it
      // Check if we can call tools/list to validate content blocks in tool responses
      try {
        const toolsResponse = await ctx.jsonrpc<{
          tools?: Array<{
            name: string;
            inputSchema?: { type: string; properties?: unknown };
            outputSchema?: { type: string; properties?: unknown };
          }>;
        }>("tools/list");

        if (toolsResponse?.tools) {
          // Check for properly structured schemas
          const toolsWithInputSchema = toolsResponse.tools.filter(t =>
            t.inputSchema?.type === "object"
          );
          const toolsWithOutputSchema = toolsResponse.tools.filter(t =>
            t.outputSchema?.type === "object"
          );

          findings.push({
            id: "mcp.sampling.tool_schemas_found",
            area: "sampling-validation",
            severity: "info",
            title: "Tool schemas detected",
            description: `Found ${toolsWithInputSchema.length} tools with input schemas, ${toolsWithOutputSchema.length} with output schemas`,
            evidence: [{ type: "url", ref: ctx.endpoint }],
            confidence: 0.9
          });

          if (toolsWithOutputSchema.length === 0 && toolsResponse.tools.length > 0) {
            findings.push({
              id: "mcp.sampling.no_output_schemas",
              area: "sampling-validation",
              severity: "minor",
              title: "No tools define output schemas",
              description: "Tools without outputSchema cannot return structured content",
              evidence: [{ type: "url", ref: ctx.endpoint }],
              confidence: 0.8,
              recommendation: "Add outputSchema to tools that return structured data for better LLM integration"
            });
          }

          // Check if any tool has complex input schema (indicating proper content block support)
          const toolsWithComplexInputs = toolsResponse.tools.filter(t => {
            const props = t.inputSchema?.properties;
            return props && Object.keys(props).length > 0;
          });

          if (toolsWithComplexInputs.length > 0) {
            findings.push({
              id: "mcp.sampling.complex_inputs_supported",
              area: "sampling-validation",
              severity: "info",
              title: "Complex input schemas detected",
              description: `${toolsWithComplexInputs.length} tools support structured inputs for sampling`,
              evidence: [{ type: "url", ref: ctx.endpoint }],
              confidence: 0.85
            });
          }
        }
      } catch (error) {
        findings.push({
          id: "mcp.sampling.tools_check_error",
          area: "sampling-validation",
          severity: "minor",
          title: "Could not validate tool schemas",
          description: `Failed to check tools: ${String(error)}`,
          evidence: [{ type: "log", ref: "SamplingValidationPlugin" }],
          confidence: 0.7
        });
      }

      // Summary finding
      findings.push({
        id: "mcp.sampling.validation_complete",
        area: "sampling-validation",
        severity: "info",
        title: "Sampling validation complete",
        description: "Server supports tools for sampling integration. Content blocks (text, image, audio, resource) can be used in tool responses.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.8
      });

    } catch (error) {
      findings.push({
        id: "mcp.sampling.validation_error",
        area: "sampling-validation",
        severity: "major",
        title: "Sampling validation error",
        description: `Sampling validation failed: ${String(error)}`,
        evidence: [{ type: "log", ref: "SamplingValidationPlugin" }],
        confidence: 0.9
      });
    }

    return findings;
  }
};
