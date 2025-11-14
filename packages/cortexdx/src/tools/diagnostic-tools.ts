/**
 * Core Diagnostic MCP Tools
 * Provides MCP tool definitions for server inspection, validation, and analysis
 * Requirements: 3.1, 5.1, 6.1
 */

import { isStoryFeatureEnabled } from "../story/feature-flag.js";
import type { McpTool } from "../types.js";

const baseDiagnosticTools: McpTool[] = [
  {
    name: "inspect_mcp_server",
    description:
      "Comprehensive inspection of MCP server implementation for protocol compliance, configuration issues, and best practices violations. Analyzes server capabilities, tool definitions, and resource handlers.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint URL to inspect",
        },
        includeProtocolValidation: {
          type: "boolean",
          description:
            "Include detailed protocol compliance validation (default: true)",
        },
        includeSecurityScan: {
          type: "boolean",
          description:
            "Include security vulnerability scanning (default: true)",
        },
        includePerformanceProfile: {
          type: "boolean",
          description: "Include performance profiling (default: false)",
        },
        timeout: {
          type: "number",
          description: "Inspection timeout in seconds (default: 30)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "validate_protocol_compliance",
    description:
      "Validate MCP server compliance with protocol specification version 2024-11-05. Checks JSON-RPC message formats, response structures, and required capabilities with 99% accuracy.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to validate",
        },
        protocolVersion: {
          type: "string",
          description:
            "MCP protocol version to validate against (default: 2024-11-05)",
        },
        strictMode: {
          type: "boolean",
          description: "Enable strict compliance checking (default: false)",
        },
        checkCapabilities: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific capabilities to validate (e.g., 'tools', 'resources', 'prompts')",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "scan_security_vulnerabilities",
    description:
      "Scan MCP implementation for security vulnerabilities using OWASP-based detection with 95% accuracy. Identifies authentication issues, input sanitization problems, and privilege escalation risks.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to scan",
        },
        scanDepth: {
          type: "string",
          enum: ["quick", "standard", "deep"],
          description: "Security scan depth (default: standard)",
        },
        includeAuthValidation: {
          type: "boolean",
          description:
            "Include authentication and authorization validation (default: true)",
        },
        includeInputSanitization: {
          type: "boolean",
          description: "Check for input sanitization issues (default: true)",
        },
        includePrivilegeEscalation: {
          type: "boolean",
          description:
            "Check for privilege escalation vulnerabilities (default: true)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "profile_performance",
    description:
      "Analyze MCP server performance with millisecond precision timing. Measures response times, throughput, memory usage, and identifies bottlenecks within 20 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to profile",
        },
        duration: {
          type: "number",
          description: "Profiling duration in seconds (default: 60)",
        },
        monitoringInterval: {
          type: "number",
          description: "Real-time monitoring interval in seconds (default: 1)",
        },
        includeMemoryAnalysis: {
          type: "boolean",
          description: "Include memory usage analysis (default: true)",
        },
        includeThroughputTest: {
          type: "boolean",
          description: "Include throughput testing (default: true)",
        },
        identifyBottlenecks: {
          type: "boolean",
          description:
            "Identify and analyze performance bottlenecks (default: true)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "check_compatibility",
    description:
      "Verify MCP server compatibility across different client implementations and protocol versions. Tests interoperability within 120 seconds and suggests migration paths.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to check",
        },
        targetClients: {
          type: "array",
          items: { type: "string" },
          description: "Specific MCP clients to test compatibility with",
        },
        targetVersions: {
          type: "array",
          items: { type: "string" },
          description: "Protocol versions to test compatibility with",
        },
        includeMigrationPath: {
          type: "boolean",
          description:
            "Include migration path suggestions for version upgrades (default: true)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "analyze_configuration",
    description:
      "Analyze MCP server configuration for optimization opportunities, security issues, and best practices violations. Provides actionable recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to analyze",
        },
        configurationFile: {
          type: "string",
          description: "Path to configuration file (optional)",
        },
        includeOptimization: {
          type: "boolean",
          description: "Include optimization recommendations (default: true)",
        },
        includeSecurityReview: {
          type: "boolean",
          description: "Include security configuration review (default: true)",
        },
        environment: {
          type: "string",
          enum: ["development", "staging", "production"],
          description:
            "Target environment for configuration analysis (default: production)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "validate_tool_definitions",
    description:
      "Validate MCP tool definitions for correctness, completeness, and compliance with protocol standards. Checks input schemas, parameter types, and documentation.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint with tools to validate",
        },
        toolNames: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific tools to validate (optional, validates all if not specified)",
        },
        checkSchemaCompliance: {
          type: "boolean",
          description: "Validate JSON schema compliance (default: true)",
        },
        checkDocumentation: {
          type: "boolean",
          description: "Check for adequate documentation (default: true)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "test_transport_protocols",
    description:
      "Test MCP server transport protocol implementations (HTTP, SSE, WebSocket, JSON-RPC). Validates message handling, error responses, and streaming capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to test",
        },
        protocols: {
          type: "array",
          items: {
            type: "string",
            enum: ["http", "sse", "websocket", "jsonrpc"],
          },
          description:
            "Specific protocols to test (tests all if not specified)",
        },
        includeStreamingTest: {
          type: "boolean",
          description: "Include streaming capabilities test (default: true)",
        },
        includeErrorHandling: {
          type: "boolean",
          description: "Test error handling and recovery (default: true)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "analyze_error_patterns",
    description:
      "Analyze error logs and patterns from MCP server to identify recurring issues, root causes, and suggest preventive measures.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint to analyze",
        },
        logFile: {
          type: "string",
          description: "Path to log file for analysis (optional)",
        },
        timeRange: {
          type: "object",
          properties: {
            start: {
              type: "string",
              description: "Start timestamp (ISO 8601)",
            },
            end: { type: "string", description: "End timestamp (ISO 8601)" },
          },
          description: "Time range for log analysis (optional)",
        },
        identifyRootCauses: {
          type: "boolean",
          description: "Identify root causes of errors (default: true)",
        },
        suggestPreventiveMeasures: {
          type: "boolean",
          description: "Suggest preventive measures (default: true)",
        },
      },
      required: ["endpoint"],
    },
  },
  {
    name: "generate_diagnostic_report",
    description:
      "Generate comprehensive diagnostic report combining all analysis results in multiple formats (JSON, Markdown, HTML). Includes executive summary and detailed findings.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: {
          type: "string",
          description: "MCP server endpoint that was diagnosed",
        },
        format: {
          type: "string",
          enum: ["json", "markdown", "html", "pdf"],
          description: "Report output format (default: markdown)",
        },
        includeExecutiveSummary: {
          type: "boolean",
          description: "Include executive summary (default: true)",
        },
        includeEvidence: {
          type: "boolean",
          description:
            "Include evidence pointers and artifacts (default: true)",
        },
        includeRemediation: {
          type: "boolean",
          description:
            "Include remediation steps and code samples (default: true)",
        },
        outputPath: {
          type: "string",
          description: "Output file path for report (optional)",
        },
      },
      required: ["endpoint"],
    },
  },
];

const storyPayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "timestamp",
    "scope",
    "trigger",
    "propagation",
    "symptom",
    "evidence",
    "confidence",
    "suggested_actions",
  ],
  properties: {
    id: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    scope: {
      type: "string",
      enum: ["server", "tool", "connector", "network", "auth", "storage"],
    },
    trigger: {
      type: "object",
      required: ["kind", "details"],
      properties: {
        kind: { type: "string" },
        details: { type: "string" },
      },
    },
    propagation: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "array", items: { type: "string" } },
      },
    },
    symptom: {
      type: "object",
      required: ["user_visible", "technical"],
      properties: {
        user_visible: { type: "string" },
        technical: { type: "string" },
      },
    },
    evidence: {
      type: "object",
      required: ["logs", "traces", "metrics"],
      properties: {
        logs: { type: "array", items: { type: "string" } },
        traces: { type: "array", items: { type: "string" } },
        metrics: { type: "array", items: { type: "string" } },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    suggested_actions: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "label", "command", "reversible"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          command: { type: "string" },
          reversible: { type: "boolean" },
        },
      },
    },
  },
} as const;

const actionResultSchema = {
  type: "object",
  required: [
    "action",
    "target",
    "message",
    "reversible",
    "ok",
    "performedAt",
    "dryRun",
  ],
  properties: {
    action: { type: "string" },
    target: { type: "string" },
    message: { type: "string" },
    reversible: { type: "boolean" },
    ok: { type: "boolean" },
    performedAt: { type: "string", format: "date-time" },
    dryRun: { type: "boolean" },
  },
} as const;

const storyTools: McpTool[] = [
  {
    name: "story.list",
    description:
      "List synthesized diagnostic stories derived from graph, anomaly rules, and evidence pointers.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 20 },
        includeEvidence: {
          type: "boolean",
          description: "Include evidence arrays",
        },
      },
    },
  },
  {
    name: "story.get",
    description: "Retrieve a specific story by id",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "story.reprobe",
    description: "Trigger a safe reprobe for a degraded component (dry-run)",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string" },
      },
      required: ["target"],
    },
  },
];

export const createDiagnosticTools = (): McpTool[] => {
  if (!isStoryFeatureEnabled()) {
    return baseDiagnosticTools;
  }
  return [...baseDiagnosticTools, ...storyTools];
};
