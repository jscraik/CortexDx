import type { DiagnosticContext, DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

/**
 * System prompt for LLM-assisted MCP server discovery analysis
 * Used when analyzing server capabilities and compliance
 *
 * @todo This prompt is intended for future LLM integration in the discovery plugin.
 *       It will be used to guide LLM-based analysis of MCP server capabilities and compliance.
 *       If not implemented soon, consider moving to documentation or removing.
 */
export const DISCOVERY_ANALYSIS_PROMPT = `You are CortexDx's MCP server discovery analyzer.

## Analysis Goals
- Identify server capabilities and tool inventory
- Detect capability mismatches or missing implementations
- Validate protocol compliance
- Assess server health and readiness

## Discovery Workflow
1. Enumerate all tools, prompts, and resources
2. Validate schema compliance for each capability
3. Check for missing required fields
4. Assess tool descriptions for clarity
5. Identify potential integration issues

## Output Schema
\`\`\`json
{
  "serverInfo": {
    "name": "Server name",
    "version": "Server version",
    "protocolVersion": "2024-11-05",
    "capabilities": ["list", "of", "capabilities"],
    "vendor": "Server vendor/author"
  },
  "tools": [{
    "name": "tool_name",
    "description": "Tool description",
    "inputSchema": {},
    "compliance": "full|partial|missing",
    "issues": ["List of compliance issues"],
    "suggestions": ["Improvement suggestions"]
  }],
  "prompts": [{
    "name": "prompt_name",
    "description": "Prompt description",
    "arguments": [],
    "compliance": "full|partial|missing"
  }],
  "resources": [{
    "uri": "resource://path",
    "name": "Resource name",
    "mimeType": "application/json",
    "compliance": "full|partial|missing"
  }],
  "healthStatus": "healthy|degraded|unhealthy",
  "complianceScore": 0.0,
  "recommendations": [
    {"priority": "high|medium|low", "action": "", "reason": ""}
  ],
  "missingCapabilities": ["Capabilities that should be implemented"],
  "securityConcerns": ["Potential security issues found"],
  "recommendedTools": ["CortexDx plugins for deeper analysis"]
}
\`\`\`

## Behavioral Rules
- Validate all tools have proper inputSchema definitions
- Check for missing or inadequate tool descriptions
- Identify tools that may have security implications
- Suggest improvements for partial compliance
- Recommend related CortexDx plugins: protocol, mcp-compatibility, security-scanner`;

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
          description:
            "Endpoint did not respond to 'tools/list'. Server may use a different method.",
          evidence: [{ type: "url", ref: ctx.endpoint }],
        });
      } else {
        const count = tools.length;
        findings.push({
          id: "disc.ok",
          area: "discovery",
          severity: "info",
          title: `Discovered ${count} tool(s)`,
          description: "Tools retrieved via JSON-RPC 'tools/list'.",
          evidence: [{ type: "url", ref: ctx.endpoint }],
        });
      }
    } catch (error) {
      findings.push({
        id: "disc.error",
        area: "discovery",
        severity: "major",
        title: "Discovery failed",
        description: String(error),
        evidence: [{ type: "log", ref: "DiscoveryPlugin" }],
      });
    }
    return findings;
  },
};

// Enhanced MCP Inspector Plugin extending discovery functionality
export const EnhancedMcpInspectorPlugin: DiagnosticPlugin = {
  id: "enhanced-mcp-inspector",
  title: "Enhanced MCP Inspector (Protocol Compliance & Analysis)",
  order: 101,
  async run(ctx) {
    const startTime = Date.now();
    const findings: Finding[] = [];

    try {
      // MCP-specific inspection with protocol compliance validation
      const inspectionResults = await performMcpInspection(ctx);
      findings.push(...inspectionResults);

      // Validate analysis time requirement (<30s)
      const analysisTime = Date.now() - startTime;
      if (analysisTime > 30000) {
        findings.push({
          id: "mcp.inspector.timeout",
          area: "performance",
          severity: "minor",
          title: "Analysis time exceeded threshold",
          description: `MCP inspection took ${analysisTime}ms, exceeding 30s requirement`,
          evidence: [{ type: "log", ref: "EnhancedMcpInspectorPlugin" }],
          confidence: 1.0,
        });
      } else {
        findings.push({
          id: "mcp.inspector.performance",
          area: "performance",
          severity: "info",
          title: `MCP inspection completed in ${analysisTime}ms`,
          description: "Analysis completed within performance requirements",
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 1.0,
        });
      }
    } catch (error) {
      findings.push({
        id: "mcp.inspector.error",
        area: "mcp-inspection",
        severity: "major",
        title: "Enhanced MCP inspection failed",
        description: `Inspection error: ${String(error)}`,
        evidence: [{ type: "log", ref: "EnhancedMcpInspectorPlugin" }],
        confidence: 0.9,
      });
    }

    return findings;
  },
};

async function performMcpInspection(
  ctx: DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Enhanced tool discovery with MCP-specific validation
  const toolsResult = await inspectMcpTools(ctx);
  findings.push(...toolsResult);

  // Resource discovery and validation
  const resourcesResult = await inspectMcpResources(ctx);
  findings.push(...resourcesResult);

  // Prompt discovery and validation
  const promptsResult = await inspectMcpPrompts(ctx);
  findings.push(...promptsResult);

  // Server capabilities inspection
  const capabilitiesResult = await inspectServerCapabilities(ctx);
  findings.push(...capabilitiesResult);

  // Server instructions inspection
  const instructionsResult = await inspectServerInstructions(ctx);
  findings.push(...instructionsResult);

  return findings;
}

async function inspectMcpTools(
  ctx: DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const toolsResponse = await ctx.jsonrpc<{
      tools?: Array<{
        name: string;
        description?: string;
        inputSchema?: unknown;
      }>;
    }>("tools/list");
    const tools = toolsResponse?.tools || [];

    if (tools.length === 0) {
      findings.push({
        id: "mcp.tools.empty",
        area: "mcp-tools",
        severity: "minor",
        title: "No tools discovered",
        description: "MCP server reported no available tools",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.99,
      });
    } else {
      // Validate tool schema compliance
      let validTools = 0;
      let invalidTools = 0;

      for (const tool of tools) {
        if (validateToolSchema(tool)) {
          validTools++;
        } else {
          invalidTools++;
          findings.push({
            id: "mcp.tools.invalid_schema",
            area: "mcp-tools",
            severity: "major",
            title: `Invalid tool schema: ${tool.name}`,
            description:
              "Tool does not conform to MCP tool schema requirements",
            evidence: [{ type: "url", ref: ctx.endpoint }],
            confidence: 0.95,
          });
        }
      }

      findings.push({
        id: "mcp.tools.summary",
        area: "mcp-tools",
        severity: "info",
        title: `Tools inspection: ${validTools} valid, ${invalidTools} invalid`,
        description: `Discovered ${tools.length} tools with ${((validTools / tools.length) * 100).toFixed(1)}% schema compliance`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.99,
      });
    }
  } catch (error) {
    findings.push({
      id: "mcp.tools.error",
      area: "mcp-tools",
      severity: "major",
      title: "Tool inspection failed",
      description: `Failed to inspect MCP tools: ${String(error)}`,
      evidence: [{ type: "log", ref: "inspectMcpTools" }],
      confidence: 0.9,
    });
  }

  return findings;
}

async function inspectMcpResources(
  ctx: DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const resourcesResponse = await ctx.jsonrpc<{
      resources?: Array<{
        uri: string;
        name?: string;
        description?: string;
        mimeType?: string;
      }>;
    }>("resources/list");
    const resources = resourcesResponse?.resources || [];

    findings.push({
      id: "mcp.resources.count",
      area: "mcp-resources",
      severity: "info",
      title: `Discovered ${resources.length} resource(s)`,
      description:
        resources.length > 0
          ? "MCP server provides resource access capabilities"
          : "No resources available",
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.99,
    });

    // Validate resource URIs and schemas
    for (const resource of resources) {
      if (!resource.uri) {
        findings.push({
          id: "mcp.resources.missing_uri",
          area: "mcp-resources",
          severity: "major",
          title: "Resource missing URI",
          description: "Resource definition lacks required URI field",
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.95,
        });
      }
    }
  } catch (_error) {
    // Resources endpoint is optional in MCP
    findings.push({
      id: "mcp.resources.unavailable",
      area: "mcp-resources",
      severity: "info",
      title: "Resources not available",
      description:
        "Server does not support resource listing (optional feature)",
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.8,
    });
  }

  return findings;
}

async function inspectMcpPrompts(
  ctx: DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const promptsResponse = await ctx.jsonrpc<{
      prompts?: Array<{
        name: string;
        description?: string;
        arguments?: unknown;
      }>;
    }>("prompts/list");
    const prompts = promptsResponse?.prompts || [];

    findings.push({
      id: "mcp.prompts.count",
      area: "mcp-prompts",
      severity: "info",
      title: `Discovered ${prompts.length} prompt(s)`,
      description:
        prompts.length > 0
          ? "MCP server provides prompt templates"
          : "No prompts available",
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.99,
    });
  } catch (_error) {
    // Prompts endpoint is optional in MCP
    findings.push({
      id: "mcp.prompts.unavailable",
      area: "mcp-prompts",
      severity: "info",
      title: "Prompts not available",
      description: "Server does not support prompt listing (optional feature)",
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.8,
    });
  }

  return findings;
}

async function inspectServerInstructions(
  ctx: DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const response = await ctx.jsonrpc<{ instructions?: string | string[] }>(
      "server/instructions",
    );
    const instructions = normalizeServerInstructions(response?.instructions);
    if (instructions.length > 0) {
      const firstInstruction = instructions[0];
      if (firstInstruction !== undefined) {
        const preview = firstInstruction.slice(0, 240);
        findings.push({
          id: "mcp.instructions.present",
          area: "mcp-governance",
          severity: "info",
          title: `Server instructions available (${instructions.length})`,
          description: `Example: ${preview}`,
          evidence: [{ type: "url", ref: ctx.endpoint }],
          confidence: 0.95,
        });
      }
    } else {
      findings.push({
        id: "mcp.instructions.empty",
        area: "mcp-governance",
        severity: "info",
        title: "Server instructions endpoint returned no data",
        description:
          "Consider publishing concise server instructions to guide MCP clients.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.75,
      });
    }
  } catch (_error) {
    findings.push({
      id: "mcp.instructions.unavailable",
      area: "mcp-governance",
      severity: "info",
      title: "Server instructions not exposed",
      description: `server/instructions call failed: ${String(_error)}`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.6,
    });
  }
  return findings;
}

function normalizeServerInstructions(input: unknown): string[] {
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(input)) {
    return input
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

async function inspectServerCapabilities(
  ctx: DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const initResponse = await ctx.jsonrpc<{
      capabilities?: {
        tools?: unknown;
        resources?: unknown;
        prompts?: unknown;
        logging?: unknown;
      };
    }>("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "cortexdx-inspector", version: "1.0.0" },
    });

    const capabilities = initResponse?.capabilities || {};
    const supportedFeatures = Object.keys(capabilities);

    findings.push({
      id: "mcp.capabilities.summary",
      area: "mcp-capabilities",
      severity: "info",
      title: `Server capabilities: ${supportedFeatures.join(", ") || "none"}`,
      description: `MCP server supports ${supportedFeatures.length} capability categories`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      confidence: 0.99,
    });

    // Validate protocol version support
    if (!initResponse) {
      findings.push({
        id: "mcp.capabilities.no_init",
        area: "mcp-capabilities",
        severity: "blocker",
        title: "Server does not support initialization",
        description: "MCP server failed to respond to initialize request",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        confidence: 0.99,
      });
    }
  } catch (error) {
    findings.push({
      id: "mcp.capabilities.error",
      area: "mcp-capabilities",
      severity: "major",
      title: "Capabilities inspection failed",
      description: `Failed to inspect server capabilities: ${String(error)}`,
      evidence: [{ type: "log", ref: "inspectServerCapabilities" }],
      confidence: 0.9,
    });
  }

  return findings;
}

function validateToolSchema(tool: {
  name: string;
  description?: string;
  inputSchema?: unknown;
}): boolean {
  // Basic MCP tool schema validation
  if (!tool.name || typeof tool.name !== "string") {
    return false;
  }

  if (tool.inputSchema && typeof tool.inputSchema !== "object") {
    return false;
  }

  return true;
}

function extractTools(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const maybeTools = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybeTools)) return maybeTools;
  }
  return null;
}
