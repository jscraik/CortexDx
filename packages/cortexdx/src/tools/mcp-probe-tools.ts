/**
 * MCP Probe Tools
 * Exposes the MCP-to-MCP probe engine as MCP tools
 */

import { type Auth0Config, probeMcpServer } from "../probe/mcp-probe-engine.js";
import { generateReport } from "../probe/report-generator.js";
import { getReportStore } from "../probe/report-store.js";
import type { DevelopmentContext, McpTool, McpToolResult } from "../types.js";

export const mcpProbeTools: McpTool[] = [
    {
        name: "cortexdx_probe_mcp_server",
        description: `Probe another MCP server using secure temporary session authentication.
Runs comprehensive diagnostics including protocol compliance, security scanning, and performance profiling.
Returns a hosted report URL with detailed findings, recommendations, and compliance score.

Use this when you need to:
- Diagnose issues in another MCP server
- Verify protocol compliance before deployment
- Perform security audits
- Benchmark performance
- Generate compliance reports`,
        inputSchema: {
            type: "object",
            properties: {
                targetUrl: {
                    type: "string",
                    description: "URL of the MCP server to probe (e.g., https://other-mcp-server.com)"
                },
                auth: {
                    type: "object",
                    description: "Auth0 configuration for authenticating with the target server",
                    properties: {
                        domain: {
                            type: "string",
                            description: "Auth0 domain (e.g., tenant.auth0.com)"
                        },
                        clientId: {
                            type: "string",
                            description: "Auth0 client ID"
                        },
                        clientSecret: {
                            type: "string",
                            description: "Auth0 client secret"
                        },
                        audience: {
                            type: "string",
                            description: "Auth0 audience (e.g., https://target-server.com/api)"
                        },
                        scope: {
                            type: "string",
                            description: "Optional Auth0 scopes (space-separated)"
                        }
                    },
                    required: ["domain", "clientId", "clientSecret", "audience"]
                },
                suites: {
                    type: "array",
                    items: { type: "string" },
                    description: "Diagnostic suites to run (e.g., ['protocol', 'security', 'performance']). Runs all if not specified."
                },
                full: {
                    type: "boolean",
                    description: "Run full comprehensive diagnostics (all plugins, default: false)"
                },
                timeout: {
                    type: "number",
                    description: "Session timeout in seconds (default: 3600)"
                },
                outputFormat: {
                    type: "string",
                    enum: ["markdown", "json", "both"],
                    description: "Report output format (default: both)"
                }
            },
            required: ["targetUrl", "auth"]
        }
    }
];

/**
 * Execute MCP probe tool
 */
export async function executeMcpProbeTool(
    tool: McpTool,
    args: unknown,
    ctx: DevelopmentContext
): Promise<McpToolResult> {
    if (tool.name === "cortexdx_probe_mcp_server") {
        return await probeServer(args, ctx);
    }

    throw new Error(`Unknown MCP probe tool: ${tool.name}`);
}

/**
 * Probe MCP server implementation
 */
async function probeServer(
    args: unknown,
    ctx: DevelopmentContext
): Promise<McpToolResult> {
    try {
        const config = args as {
            targetUrl: string;
            auth: Auth0Config;
            suites?: string[];
            full?: boolean;
            timeout?: number;
            outputFormat?: "markdown" | "json" | "both";
        };

        // Validate inputs
        if (!config.targetUrl) {
            return {
                content: [{
                    type: "text",
                    text: "Error: targetUrl is required"
                }],
                isError: true
            };
        }

        if (!config.auth || !config.auth.domain || !config.auth.clientId || !config.auth.clientSecret || !config.auth.audience) {
            return {
                content: [{
                    type: "text",
                    text: "Error: Complete auth configuration required (domain, clientId, clientSecret, audience)"
                }],
                isError: true
            };
        }

        ctx.logger(`[MCP Probe] Starting probe of ${config.targetUrl}...`);

        // Run the probe
        const result = await probeMcpServer({
            targetUrl: config.targetUrl,
            auth: config.auth,
            suites: config.suites,
            full: config.full,
            timeout: config.timeout,
            outputFormat: config.outputFormat
        });

        if (!result.success) {
            return {
                content: [{
                    type: "text",
                    text: `Probe failed: ${result.summary.findings[0]?.description || 'Unknown error'}`
                }],
                isError: true
            };
        }

        // Generate and store the full report
        const fullReport = generateReport(
            result.reportId,
            config.targetUrl,
            result.summary,
            result.metadata,
            result.findings,
            result.duration
        );

        const reportStore = getReportStore();
        reportStore.storeReport(fullReport);

        ctx.logger(`[MCP Probe] Completed - Score: ${result.summary.score}/100`);

        // Return summary with report URL
        const baseUrl = process.env.CORTEXDX_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
        const reportUrl = `${baseUrl}/api/v1/reports/${result.reportId}`;
        const markdownUrl = `${reportUrl}?format=markdown`;

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    reportId: result.reportId,
                    reportUrl,
                    markdownUrl,
                    summary: {
                        targetUrl: config.targetUrl,
                        compliant: result.summary.compliant,
                        score: result.summary.score,
                        duration: `${result.duration}ms`,
                        findings: {
                            total: result.summary.totalFindings,
                            critical: result.summary.criticalFindings,
                            byArea: groupFindingsByArea(result.summary.findings)
                        }
                    },
                    metadata: {
                        serverInfo: result.metadata.serverInfo,
                        protocolVersion: result.metadata.protocolVersion,
                        tools: result.metadata.tools.length,
                        resources: result.metadata.resources.length
                    },
                    recommendations: result.summary.compliant
                        ? ["Server is compliant. Continue monitoring and maintaining best practices."]
                        : ["Review the detailed report at the URL above for specific remediation steps."],
                    nextSteps: [
                        `View full report: ${reportUrl}`,
                        `Download markdown: ${markdownUrl}`,
                        result.summary.criticalFindings > 0
                            ? `⚠️ Address ${result.summary.criticalFindings} critical issue(s) before production deployment`
                            : "✓ No critical issues detected"
                    ]
                }, null, 2)
            }]
        };

    } catch (error) {
        ctx.logger('[MCP Probe] Error:', error);
        return {
            content: [{
                type: "text",
                text: `Probe execution failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
        };
    }
}

/**
 * Group findings by area for summary
 */
function groupFindingsByArea(findings: Array<{ area: string; severity: string }>): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const finding of findings) {
        groups[finding.area] = (groups[finding.area] || 0) + 1;
    }
    return groups;
}
