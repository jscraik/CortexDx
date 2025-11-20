/**
 * MCP Probe Engine
 * Orchestrates the complete MCP-to-MCP diagnostic workflow
 *
 * This implements the 7-step diagnostic cycle:
 * 1. Discover - Detect target MCP server capabilities
 * 2. Connect - Establish authenticated session
 * 3. Enumerate - List tools, resources, capabilities
 * 4. Probe - Execute diagnostic plugins
 * 5. Extract Metadata - Pull schema and configuration
 * 6. Evaluate - Run compliance and security checks
 * 7. Generate Report - Create hosted diagnostic report
 */

import { randomUUID } from "node:crypto";
import { createLogger } from "../logging/logger";
import { runPlugins } from "../plugin-host";
import type { HttpMcpClient } from "../providers/academic/http-mcp-client";
import { createDiagnosticMcpClient } from "../providers/diagnostic-mcp-client";
import type { Finding, McpToolResult } from "../types";

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  scope?: string;
}

export interface ProbeConfig {
  targetUrl: string;
  auth: Auth0Config;
  suites?: string[];
  full?: boolean;
  timeout?: number;
  outputFormat?: "markdown" | "json" | "both";
}

export interface ProbeMetadata {
  tools: Array<{ name: string; description: string }>;
  resources: Array<{ uri: string; name: string }>;
  capabilities: Record<string, unknown>;
  serverInfo?: { name: string; version: string };
  protocolVersion?: string;
}

export interface DiagnosticSummary {
  compliant: boolean;
  score: number;
  totalFindings: number;
  criticalFindings: number;
  findings: Array<{
    severity: string;
    area: string;
    title: string;
    description: string;
  }>;
}

export interface ProbeResult {
  success: boolean;
  reportId: string;
  reportUrl: string;
  summary: DiagnosticSummary;
  metadata: ProbeMetadata;
  findings: Finding[];
  timestamp: string;
  duration: number;
}

const logger = createLogger("mcp-probe-engine");

/**
 * Main probe function - orchestrates the complete diagnostic cycle
 */
export async function probeMcpServer(
  config: ProbeConfig,
): Promise<ProbeResult> {
  const startTime = Date.now();
  const reportId = generateReportId();

  try {
    logger.info({ targetUrl: config.targetUrl }, "Starting probe");

    // STEP 1 & 2: Discover & Connect
    logger.info({}, "Establishing diagnostic session");
    const client = await createDiagnosticMcpClient({
      targetServerUrl: config.targetUrl,
      auth0: config.auth,
      sessionConfig: {
        requestedBy: "cortexdx-probe-engine",
        scope: [
          "read:tools",
          "read:resources",
          "read:capabilities",
          "execute:diagnostics",
        ],
        duration: config.timeout || 3600,
        allowedEndpoints: ["/mcp", "/health", "/capabilities", "/providers"],
      },
      timeoutMs: 30000,
    });

    // STEP 3: Enumerate capabilities
    logger.info({}, "Enumerating server capabilities");
    const metadata = await enumerateCapabilities(client, config.targetUrl);

    // STEP 4, 5, 6: Probe, Extract, Evaluate
    logger.info({}, "Running diagnostic plugins");
    const findings = await runDiagnosticPlugins(
      config.targetUrl,
      config.suites || [],
      config.full || false,
    );

    // STEP 7: Generate Report
    logger.info({}, "Generating diagnostic report");
    const summary = generateSummary(findings);
    const duration = Date.now() - startTime;

    const result: ProbeResult = {
      success: true,
      reportId,
      reportUrl: `/reports/${reportId}`,
      summary,
      metadata,
      findings,
      timestamp: new Date().toISOString(),
      duration,
    };

    logger.info({ duration, score: summary.score }, "Probe completed");

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ error }, "Probe failed");

    const errorFindings: Finding[] = [
      {
        id: "probe.engine.error",
        area: "probe-engine",
        severity: "blocker",
        title: "Probe failed",
        description: error instanceof Error ? error.message : String(error),
        evidence: [],
      },
    ];

    return {
      success: false,
      reportId,
      reportUrl: `/reports/${reportId}`,
      summary: {
        compliant: false,
        score: 0,
        totalFindings: 1,
        criticalFindings: 1,
        findings: [
          {
            severity: "blocker",
            area: "probe-engine",
            title: "Probe failed",
            description: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      metadata: {
        tools: [],
        resources: [],
        capabilities: {},
      },
      findings: errorFindings,
      timestamp: new Date().toISOString(),
      duration,
    };
  }
}

/**
 * Enumerate target MCP server capabilities
 */
async function enumerateCapabilities(
  client: HttpMcpClient,
  _targetUrl: string,
): Promise<ProbeMetadata> {
  const metadata: ProbeMetadata = {
    tools: [],
    resources: [],
    capabilities: {},
  };

  try {
    // Enumerate tools
    const toolsResult = await client
      .callTool("tools/list", {})
      .catch(() => null);
    if (toolsResult && Array.isArray(toolsResult.content)) {
      const toolsData = extractToolsFromResult(toolsResult);
      metadata.tools = toolsData;
    }

    // Enumerate resources
    const resourcesResult = await client
      .callTool("resources/list", {})
      .catch(() => null);
    if (resourcesResult && Array.isArray(resourcesResult.content)) {
      const resourcesData = extractResourcesFromResult(resourcesResult);
      metadata.resources = resourcesData;
    }

    // Get server info via initialize
    const initResult = await client
      .callTool("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "cortexdx-probe",
          version: "1.0.0",
        },
      })
      .catch(() => null);

    const initResultTyped = initResult as
      | {
          serverInfo?: Record<string, unknown>;
          protocolVersion?: string;
          capabilities?: Record<string, unknown>;
        }
      | null;
    if (initResultTyped) {
      metadata.serverInfo = initResultTyped.serverInfo ?? {};
      metadata.protocolVersion = initResultTyped.protocolVersion ?? "unknown";
      metadata.capabilities = initResultTyped.capabilities ?? {};
    }
  } catch (error) {
    logger.warn({ error }, "Failed to enumerate some capabilities");
  }

  return metadata;
}

/**
 * Run diagnostic plugins against target server
 */
async function runDiagnosticPlugins(
  endpoint: string,
  suites: string[],
  full: boolean,
): Promise<Finding[]> {
  try {
    const result = await runPlugins({
      endpoint,
      suites,
      full,
      deterministic: false,
      budgets: {
        timeMs: 120000, // 2 minutes
        memMb: 512,
      },
    });

    return result.findings;
  } catch (error) {
    logger.error({ error }, "Plugin execution failed");
    return [
      {
        id: "probe.plugin.error",
        area: "probe-engine",
        severity: "major",
        title: "Diagnostic plugins failed",
        description: error instanceof Error ? error.message : String(error),
        evidence: [],
      },
    ];
  }
}

/**
 * Generate diagnostic summary from findings
 */
function generateSummary(findings: Finding[]): DiagnosticSummary {
  const criticalFindings = findings.filter(
    (f) => f.severity === "blocker",
  ).length;
  const majorFindings = findings.filter((f) => f.severity === "major").length;

  // Calculate compliance score (0-100)
  // No blockers = base 60, reduce by major/minor issues
  let score = 100;
  score -= criticalFindings * 30;
  score -= majorFindings * 10;
  score -= findings.filter((f) => f.severity === "minor").length * 2;
  score = Math.max(0, Math.min(100, score));

  const compliant = criticalFindings === 0 && majorFindings <= 2;

  return {
    compliant,
    score,
    totalFindings: findings.length,
    criticalFindings,
    findings: findings.map((f) => ({
      severity: f.severity,
      area: f.area,
      title: f.title,
      description: f.description,
    })),
  };
}

/**
 * Extract tools from MCP result
 */
function extractToolsFromResult(
  result: McpToolResult,
): Array<{ name: string; description: string }> {
  try {
    if (result.content && result.content.length > 0) {
      const content = result.content[0];
      if (content && content.type === "text" && content.text) {
        const data = JSON.parse(content.text);
        if (data.tools && Array.isArray(data.tools)) {
          return data.tools.map(
            (t: { name?: string; description?: string }) => ({
              name: t.name || "unknown",
              description: t.description || "",
            }),
          );
        }
      }
    }
  } catch (error) {
    logger.warn({ error }, "Failed to extract tools");
  }
  return [];
}

/**
 * Extract resources from MCP result
 */
function extractResourcesFromResult(
  result: McpToolResult,
): Array<{ uri: string; name: string }> {
  try {
    if (result.content && result.content.length > 0) {
      const content = result.content[0];
      if (content && content.type === "text" && content.text) {
        const data = JSON.parse(content.text);
        if (data.resources && Array.isArray(data.resources)) {
          return data.resources.map((r: { uri?: string; name?: string }) => ({
            uri: r.uri || "",
            name: r.name || "unknown",
          }));
        }
      }
    }
  } catch (error) {
    logger.warn({ error }, "Failed to extract resources");
  }
  return [];
}

/**
 * Generate unique report ID
 */
function generateReportId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().split("-")[0];
  return `probe_${timestamp}_${random}`;
}
