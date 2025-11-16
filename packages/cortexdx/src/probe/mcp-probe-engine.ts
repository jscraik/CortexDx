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
import { createDiagnosticMcpClient } from "../providers/diagnostic-mcp-client.js";
import { runPlugins } from "../plugin-host.js";
import type { HttpMcpClient } from "../providers/academic/http-mcp-client.js";
import type { Finding, McpToolResult } from "../types.js";

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

/**
 * Main probe function - orchestrates the complete diagnostic cycle
 */
export async function probeMcpServer(config: ProbeConfig): Promise<ProbeResult> {
    const startTime = Date.now();
    const reportId = generateReportId();

    try {
        console.log(`[MCP Probe] Starting probe of ${config.targetUrl}`);

        // STEP 1 & 2: Discover & Connect
        console.log('[MCP Probe] Step 1-2: Establishing diagnostic session...');
        const client = await createDiagnosticMcpClient({
            targetServerUrl: config.targetUrl,
            auth0: config.auth,
            sessionConfig: {
                requestedBy: 'cortexdx-probe-engine',
                scope: [
                    'read:tools',
                    'read:resources',
                    'read:capabilities',
                    'execute:diagnostics'
                ],
                duration: config.timeout || 3600,
                allowedEndpoints: ['/mcp', '/health', '/capabilities', '/providers']
            },
            timeoutMs: 30000
        });

        // STEP 3: Enumerate capabilities
        console.log('[MCP Probe] Step 3: Enumerating server capabilities...');
        const metadata = await enumerateCapabilities(client, config.targetUrl);

        // STEP 4, 5, 6: Probe, Extract, Evaluate
        console.log('[MCP Probe] Step 4-6: Running diagnostic plugins...');
        const findings = await runDiagnosticPlugins(
            config.targetUrl,
            config.suites || [],
            config.full || false
        );

        // STEP 7: Generate Report
        console.log('[MCP Probe] Step 7: Generating diagnostic report...');
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
            duration
        };

        console.log(`[MCP Probe] Completed in ${duration}ms - Score: ${summary.score}/100`);

        return result;

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[MCP Probe] Failed:', error);

        const errorFindings: Finding[] = [{
            id: 'probe.engine.error',
            area: 'probe-engine',
            severity: 'blocker',
            title: 'Probe failed',
            description: error instanceof Error ? error.message : String(error),
            evidence: []
        }];

        return {
            success: false,
            reportId,
            reportUrl: `/reports/${reportId}`,
            summary: {
                compliant: false,
                score: 0,
                totalFindings: 1,
                criticalFindings: 1,
                findings: [{
                    severity: 'blocker',
                    area: 'probe-engine',
                    title: 'Probe failed',
                    description: error instanceof Error ? error.message : String(error)
                }]
            },
            metadata: {
                tools: [],
                resources: [],
                capabilities: {}
            },
            findings: errorFindings,
            timestamp: new Date().toISOString(),
            duration
        };
    }
}

/**
 * Enumerate target MCP server capabilities
 */
async function enumerateCapabilities(
    client: HttpMcpClient,
    targetUrl: string
): Promise<ProbeMetadata> {
    const metadata: ProbeMetadata = {
        tools: [],
        resources: [],
        capabilities: {}
    };

    try {
        // Enumerate tools
        const toolsResult = await client.callTool('tools/list', {}).catch(() => null);
        if (toolsResult && Array.isArray(toolsResult.content)) {
            const toolsData = extractToolsFromResult(toolsResult);
            metadata.tools = toolsData;
        }

        // Enumerate resources
        const resourcesResult = await client.callTool('resources/list', {}).catch(() => null);
        if (resourcesResult && Array.isArray(resourcesResult.content)) {
            const resourcesData = extractResourcesFromResult(resourcesResult);
            metadata.resources = resourcesData;
        }

        // Get server info via initialize
        const initResult = await client.callTool('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'cortexdx-probe',
                version: '1.0.0'
            }
        }).catch(() => null);

        if (initResult) {
            metadata.serverInfo = initResult.serverInfo;
            metadata.protocolVersion = initResult.protocolVersion;
            metadata.capabilities = initResult.capabilities || {};
        }

    } catch (error) {
        console.warn('[MCP Probe] Failed to enumerate some capabilities:', error);
    }

    return metadata;
}

/**
 * Run diagnostic plugins against target server
 */
async function runDiagnosticPlugins(
    endpoint: string,
    suites: string[],
    full: boolean
): Promise<Finding[]> {
    try {
        const result = await runPlugins({
            endpoint,
            suites,
            full,
            deterministic: false,
            budgets: {
                timeMs: 120000, // 2 minutes
                memMb: 512
            }
        });

        return result.findings;
    } catch (error) {
        console.error('[MCP Probe] Plugin execution failed:', error);
        return [{
            id: 'probe.plugin.error',
            area: 'probe-engine',
            severity: 'major',
            title: 'Diagnostic plugins failed',
            description: error instanceof Error ? error.message : String(error),
            evidence: []
        }];
    }
}

/**
 * Generate diagnostic summary from findings
 */
function generateSummary(findings: Finding[]): DiagnosticSummary {
    const criticalFindings = findings.filter(f => f.severity === 'blocker').length;
    const majorFindings = findings.filter(f => f.severity === 'major').length;

    // Calculate compliance score (0-100)
    // No blockers = base 60, reduce by major/minor issues
    let score = 100;
    score -= criticalFindings * 30;
    score -= majorFindings * 10;
    score -= findings.filter(f => f.severity === 'minor').length * 2;
    score = Math.max(0, Math.min(100, score));

    const compliant = criticalFindings === 0 && majorFindings <= 2;

    return {
        compliant,
        score,
        totalFindings: findings.length,
        criticalFindings,
        findings: findings.map(f => ({
            severity: f.severity,
            area: f.area,
            title: f.title,
            description: f.description
        }))
    };
}

/**
 * Extract tools from MCP result
 */
function extractToolsFromResult(result: McpToolResult): Array<{ name: string; description: string }> {
    try {
        if (result.content && result.content.length > 0) {
            const content = result.content[0];
            if (content.type === 'text' && content.text) {
                const data = JSON.parse(content.text);
                if (data.tools && Array.isArray(data.tools)) {
                    return data.tools.map((t: { name?: string; description?: string }) => ({
                        name: t.name || 'unknown',
                        description: t.description || ''
                    }));
                }
            }
        }
    } catch (error) {
        console.warn('[MCP Probe] Failed to extract tools:', error);
    }
    return [];
}

/**
 * Extract resources from MCP result
 */
function extractResourcesFromResult(result: McpToolResult): Array<{ uri: string; name: string }> {
    try {
        if (result.content && result.content.length > 0) {
            const content = result.content[0];
            if (content.type === 'text' && content.text) {
                const data = JSON.parse(content.text);
                if (data.resources && Array.isArray(data.resources)) {
                    return data.resources.map((r: { uri?: string; name?: string }) => ({
                        uri: r.uri || '',
                        name: r.name || 'unknown'
                    }));
                }
            }
        }
    } catch (error) {
        console.warn('[MCP Probe] Failed to extract resources:', error);
    }
    return [];
}

/**
 * Generate unique report ID
 */
function generateReportId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomUUID().split('-')[0];
    return `probe_${timestamp}_${random}`;
}
