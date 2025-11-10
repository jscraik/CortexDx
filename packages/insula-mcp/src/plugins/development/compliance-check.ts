/**
 * Compliance Check Plugin
 * Validates MCP implementation compliance with protocol specifications
 */

import type { DevelopmentContext, DevelopmentPlugin, Finding } from "../../types.js";

// Helper functions
async function checkMcpCompliance(endpoint: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
        // Check if server responds to MCP initialize
        const initResponse = await testMcpInitialize(endpoint);
        if (!initResponse.success) {
            findings.push({
                id: "compliance.initialize.failed",
                area: "compliance",
                severity: "major",
                title: "MCP initialize method not working",
                description: "Server does not properly respond to MCP initialize requests.",
                evidence: [{ type: "url", ref: `${endpoint}/mcp` }],
                recommendation: "Implement proper MCP initialize method according to protocol specification.",
                remediation: {
                    steps: [
                        "Implement initialize method handler",
                        "Return proper protocol version and capabilities",
                        "Follow JSON-RPC 2.0 message format",
                        "Test with MCP client tools"
                    ]
                }
            });
        } else {
            // Check protocol version compliance
            if (initResponse.protocolVersion !== "2024-11-05") {
                findings.push({
                    id: "compliance.version.outdated",
                    area: "compliance",
                    severity: "minor",
                    title: "Outdated MCP protocol version",
                    description: `Server reports protocol version ${initResponse.protocolVersion}, latest is 2024-11-05.`,
                    evidence: [{ type: "url", ref: `${endpoint}/mcp` }],
                    recommendation: "Update to the latest MCP protocol version for best compatibility."
                });
            }

            // Check capabilities structure
            if (!initResponse.capabilities || typeof initResponse.capabilities !== 'object') {
                findings.push({
                    id: "compliance.capabilities.invalid",
                    area: "compliance",
                    severity: "major",
                    title: "Invalid capabilities structure",
                    description: "Server capabilities are not properly structured according to MCP specification.",
                    evidence: [{ type: "url", ref: `${endpoint}/mcp` }],
                    recommendation: "Ensure capabilities object includes tools, resources, and prompts properties."
                });
            }
        }

        // Check tools/list endpoint
        const toolsResponse = await testToolsList(endpoint);
        if (!toolsResponse.success) {
            findings.push({
                id: "compliance.tools.list.failed",
                area: "compliance",
                severity: "major",
                title: "Tools list method not working",
                description: "Server does not properly respond to tools/list requests.",
                evidence: [{ type: "url", ref: `${endpoint}/mcp` }],
                recommendation: "Implement tools/list method to expose available tools."
            });
        }

    } catch (error) {
        findings.push({
            id: "compliance.network.error",
            area: "compliance",
            severity: "major",
            title: "Cannot connect to MCP server",
            description: `Network error while testing compliance: ${error instanceof Error ? error.message : 'Unknown error'}`,
            evidence: [{ type: "url", ref: endpoint }],
            recommendation: "Ensure the MCP server is running and accessible at the specified endpoint."
        });
    }

    return findings;
}

interface McpTestResult {
    success: boolean;
    error?: string;
    protocolVersion?: string;
    capabilities?: unknown;
    serverInfo?: unknown;
}

async function testMcpInitialize(endpoint: string): Promise<McpTestResult> {
    try {
        const response = await fetch(`${endpoint}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'cortexdx-diagnostic', version: '1.0.0' }
                }
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const result = await response.json();

        if (result.error) {
            return { success: false, error: result.error.message };
        }

        return {
            success: true,
            protocolVersion: result.result?.protocolVersion,
            capabilities: result.result?.capabilities,
            serverInfo: result.result?.serverInfo
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

interface ToolsListResult {
    success: boolean;
    error?: string;
    tools?: unknown[];
}

async function testToolsList(endpoint: string): Promise<ToolsListResult> {
    try {
        const response = await fetch(`${endpoint}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {}
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const result = await response.json();

        if (result.error) {
            return { success: false, error: result.error.message };
        }

        return {
            success: true,
            tools: result.result?.tools || []
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

interface ProjectContext {
    type?: string;
    language?: string;
    dependencies?: string[];
    configFiles?: string[];
}

function checkProjectCompliance(projectContext: ProjectContext): Finding[] {
    const findings: Finding[] = [];
    const { type, language, dependencies = [], configFiles = [] } = projectContext;

    // Check for MCP SDK dependency
    if (type === "mcp-server" && language === "typescript") {
        const hasMcpSdk = dependencies.some((dep: string) =>
            dep.includes("@modelcontextprotocol/sdk") ||
            dep.includes("mcp-sdk")
        );

        if (!hasMcpSdk) {
            findings.push({
                id: "compliance.sdk.missing",
                area: "compliance",
                severity: "minor",
                title: "MCP SDK not found",
                description: "Project does not include the official MCP SDK dependency.",
                evidence: [{ type: "file", ref: "package.json" }],
                recommendation: "Consider using the official MCP SDK for better protocol compliance and easier development."
            });
        }
    }

    // Check for proper configuration files
    const requiredConfigs = type === "mcp-server" ? ["package.json"] : ["package.json"];
    const missingConfigs = requiredConfigs.filter(config => !configFiles.includes(config));

    if (missingConfigs.length > 0) {
        findings.push({
            id: "compliance.config.missing",
            area: "compliance",
            severity: "minor",
            title: "Missing configuration files",
            description: `Required configuration files not found: ${missingConfigs.join(", ")}`,
            evidence: [{ type: "file", ref: "project-root" }],
            recommendation: "Ensure all required configuration files are present for proper MCP implementation."
        });
    }

    return findings;
}

export const ComplianceCheckPlugin: DevelopmentPlugin = {
    id: "compliance-check",
    title: "MCP Protocol Compliance",
    category: "development",
    order: 5,
    requiresLlm: false,

    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];

        try {
            // Check MCP protocol compliance if endpoint is available
            if (ctx.endpoint) {
                const complianceResults = await checkMcpCompliance(ctx.endpoint);
                findings.push(...complianceResults);
            }

            // Check project structure for compliance issues
            if (ctx.projectContext) {
                findings.push(...checkProjectCompliance(ctx.projectContext));
            }

            // Check conversation for compliance-related concerns
            const recentMessages = ctx.conversationHistory.slice(-5);
            const hasComplianceQuestions = recentMessages.some(msg =>
                msg.content.toLowerCase().includes("protocol") ||
                msg.content.toLowerCase().includes("specification") ||
                msg.content.toLowerCase().includes("compliance") ||
                msg.content.toLowerCase().includes("standard")
            );

            if (hasComplianceQuestions) {
                findings.push({
                    id: "compliance.questions.detected",
                    area: "compliance",
                    severity: "info",
                    title: "Protocol compliance questions detected",
                    description: "Recent conversation indicates questions about MCP protocol compliance.",
                    evidence: [{ type: "log", ref: "conversation-history" }],
                    recommendation: "I can help ensure your MCP implementation follows the protocol specifications. Would you like me to run a detailed compliance check?"
                });
            }

        } catch (error) {
            findings.push({
                id: "compliance.check.error",
                area: "compliance",
                severity: "minor",
                title: "Compliance check failed",
                description: `Could not complete compliance check: ${error instanceof Error ? error.message : 'Unknown error'}`,
                evidence: [{ type: "log", ref: "compliance-check" }],
                recommendation: "Ensure the MCP server is accessible and implements the required protocol endpoints."
            });
        }

        return findings;
    }
};