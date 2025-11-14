/**
 * CortexDx Server
 * HTTP server that exposes the academic research providers as MCP endpoints
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { extname, join } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { ConversationManager } from "./conversation/manager.js";
import { AutoHealer } from "./healing/auto-healer.js";
import { MonitoringScheduler } from "./healing/scheduler.js";
import { createLlmOrchestrator } from "./ml/index.js";
import {
    buildQuickHealthPayload,
    performHealthCheck,
    recordDiagnostic,
    recordRequest,
    updateActiveConnections,
    updateConversations,
} from "./observability/health-checks.js";
import { getGlobalMonitoring } from "./observability/monitoring.js";
import { runPlugins } from "./plugin-host.js";
import { type AuthMiddlewareConfig, type AuthenticatedRequest, createAuthMiddleware, createToolAccessMiddleware } from "./plugins/auth-middleware.js";
import type { LicenseKey } from "./plugins/commercial-licensing.js";
import { type LicenseEnforcementConfig, createFeatureAccessMiddleware, createLicenseEnforcementMiddleware } from "./plugins/license-enforcement.js";
import { getAcademicRegistry } from "./registry/index.js";
import { TemplateEngine } from "./template-engine/engine.js";
import type { FixTemplate } from "./templates/fix-templates.js";
import * as FixTemplateModule from "./templates/fix-templates.js";
import { getResearchResource, listResearchResources } from "./resources/research-store.js";
import { findMcpTool, getAllMcpToolsFlat, executeDeepContextTool } from "./tools/index.js";
import { executeAcademicIntegrationTool } from "./tools/academic-integration-tools.js";
import type { DevelopmentContext, DiagnosticContext, McpTool, McpToolResult } from "./types.js";
const { getTemplate, getTemplatesByArea, getTemplatesBySeverity } = FixTemplateModule;

const listAllTemplates = (): FixTemplate[] => {
    if (Object.prototype.hasOwnProperty.call(FixTemplateModule, "FixTemplates")) {
        const registry = (FixTemplateModule as { FixTemplates?: Record<string, FixTemplate> }).FixTemplates;
        return registry ? Object.values(registry) : [];
    }
    return [];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5001;
const HOST = process.env.HOST || "127.0.0.1";

// Auth0 configuration from environment
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "";
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || "";
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || "";
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true";

// License configuration from environment
const REQUIRE_LICENSE = process.env.REQUIRE_LICENSE === "true";
const DEFAULT_TIER = (process.env.DEFAULT_TIER as "community" | "professional" | "enterprise") || "community";

// License database (in production, this would be backed by a database)
const licenseDatabase = new Map<string, LicenseKey>();

// Initialize demo licenses
if (process.env.NODE_ENV !== "production") {
    licenseDatabase.set("community-demo-key", {
        key: "community-demo-key",
        tier: "community",
        features: ["basic-diagnostics", "protocol-validation", "core-mcp-tools"],
    });

    licenseDatabase.set("professional-demo-key", {
        key: "professional-demo-key",
        tier: "professional",
        features: [
            "basic-diagnostics",
            "protocol-validation",
            "core-mcp-tools",
            "advanced-diagnostics",
            "llm-backends",
            "academic-validation",
            "performance-profiling",
            "security-scanning",
        ],
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    licenseDatabase.set("enterprise-demo-key", {
        key: "enterprise-demo-key",
        tier: "enterprise",
        features: ["*"],
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        organizationId: "demo-org",
        maxUsers: 100,
    });
}

// SSE clients for real-time updates
const sseClients = new Set<ServerResponse>();

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// Create diagnostic context for providers
const createDiagnosticContext = (req: IncomingMessage): DiagnosticContext => ({
    endpoint: `http://${req.headers.host || 'localhost'}${req.url || '/'}`,
    headers: req.headers as Record<string, string>,
    logger: (...args: unknown[]) => console.log(new Date().toISOString(), ...args),
    request: async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
        const response = await fetch(input, init);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json() as T;
    },
    jsonrpc: async <T>(method: string, params?: unknown): Promise<T> => {
        // Simple JSON-RPC implementation
        const response = await fetch(req.url || '', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            })
        });
        const result = await response.json();
        return result.result;
    },
    sseProbe: async () => ({ ok: true }),
    evidence: (ev) => console.log('Evidence:', ev),
    deterministic: false
});

// Create enhanced development context
const createDevelopmentContext = (req: IncomingMessage): DevelopmentContext => {
    const baseCtx = createDiagnosticContext(req);
    return {
        ...baseCtx,
        sessionId: req.headers['x-session-id'] as string || `session-${Date.now()}`,
        userExpertiseLevel: (req.headers['x-expertise-level'] as "beginner" | "intermediate" | "expert") || "intermediate",
        conversationHistory: [],
        projectContext: extractProjectContext(req)
    };
};

// Extract project context from request headers
const extractProjectContext = (req: IncomingMessage) => {
    const projectHeader = req.headers['x-project-context'] as string;
    if (!projectHeader) return undefined;

    try {
        return JSON.parse(projectHeader);
    } catch {
        return undefined;
    }
};

// Execute development tool
const executeDevelopmentTool = async (tool: McpTool, args: unknown, ctx: DevelopmentContext): Promise<McpToolResult> => {
    switch (tool.name) {
        case 'diagnose_mcp_server':
            return await diagnoseMcpServer(args, ctx);
        case 'start_conversation':
            return await startConversation(args, ctx);
        case 'continue_conversation':
            return await continueConversation(args, ctx);
        case 'generate_mcp_code':
            return await generateMcpCode(args, ctx);
        case 'validate_license':
            return await validateLicense(args, ctx);
        case 'cortexdx_academic_research':
            return await executeAcademicIntegrationTool(tool, args);
        case 'cortexdx_deepcontext_index':
        case 'cortexdx_deepcontext_search':
        case 'cortexdx_deepcontext_status':
        case 'cortexdx_deepcontext_clear':
            return await executeDeepContextTool(tool, args, ctx);
        default:
            throw new Error(`Unknown development tool: ${tool.name}`);
    }
};

// Development tool implementations
const diagnoseMcpServer = async (args: unknown, ctx: DevelopmentContext): Promise<McpToolResult> => {
    const { endpoint, suites = [], full = false } = args as { endpoint: string; suites?: string[]; full?: boolean };

    // Track diagnostic run
    recordDiagnostic();

    // Broadcast diagnostic start event
    broadcastEvent('diagnostic_start', { endpoint, suites, full });

    const results = await runPlugins({
        endpoint,
        suites,
        full,
        deterministic: ctx.deterministic || false,
        budgets: { timeMs: 30000, memMb: 256 }
    });

    // Broadcast diagnostic complete event
    broadcastEvent('diagnostic_complete', { endpoint, results });

    return {
        content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
        }]
    };
};

const startConversation = async (args: unknown, ctx: DevelopmentContext): Promise<McpToolResult> => {
    const { intent, context } = args as { intent: string; context?: string };

    updateConversations(1);
    const session = await conversationManager.startConversation(ctx, intent, context);

    return {
        content: [{
            type: 'text',
            text: JSON.stringify(session, null, 2)
        }]
    };
};

const continueConversation = async (args: unknown, ctx: DevelopmentContext): Promise<McpToolResult> => {
    const { sessionId, userInput } = args as { sessionId: string; userInput: string };

    const response = await conversationManager.continueConversation(sessionId, userInput);

    // If conversation completed, decrement counter
    if (response.completed) {
        updateConversations(-1);
    }

    return {
        content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2)
        }]
    };
};

const generateMcpCode = async (args: unknown, ctx: DevelopmentContext): Promise<McpToolResult> => {
    const { description, language = 'typescript', framework } = args as {
        description: string;
        language?: string;
        framework?: string;
    };

    // This would integrate with the LLM for code generation
    // For now, return a placeholder
    return {
        content: [{
            type: 'text',
            text: `Code generation for: ${description} (${language}${framework ? `, ${framework}` : ''})`
        }]
    };
};

const validateLicense = async (args: unknown, ctx: DevelopmentContext): Promise<McpToolResult> => {
    const { content, provider } = args as { content: string; provider?: string };

    // This would implement license validation logic
    // For now, return a placeholder
    return {
        content: [{
            type: 'text',
            text: JSON.stringify({
                isValid: true,
                license: 'MIT',
                restrictions: [],
                recommendations: [],
                riskLevel: 'low'
            }, null, 2)
        }]
    };
};

// Serve static files from web directory
const serveStaticFile = async (filePath: string, res: ServerResponse): Promise<boolean> => {
    try {
        const webDir = join(__dirname, 'web');
        const fullPath = join(webDir, filePath);

        // Security check: ensure path is within web directory
        if (!fullPath.startsWith(webDir)) {
            return false;
        }

        const content = await readFile(fullPath);
        const ext = extname(fullPath);
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(content);
        return true;
    } catch {
        return false;
    }
};

// Broadcast event to all SSE clients
const broadcastEvent = (event: string, data: unknown): void => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        client.write(message);
    }
};

// Get the academic registry and initialize all MCP tools
const registry = getAcademicRegistry();
const allMcpTools = getAllMcpToolsFlat();

type JsonRpcTool = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
};

const getJsonRpcToolList = (): JsonRpcTool[] => {
    const providerCapabilities = Object.values(registry.getAllCapabilities());
    const academicTools = providerCapabilities.flatMap((capability) =>
        (capability?.tools as Array<{ name?: string; description?: string; inputSchema?: Record<string, unknown> }> | undefined) ?? []
    );
    const normalizedAcademic = academicTools
        .filter((tool): tool is { name: string; description?: string; inputSchema?: Record<string, unknown> } => Boolean(tool.name))
        .map((tool) => ({
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
        }));

    const normalizedMcpTools = allMcpTools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: (tool.inputSchema as Record<string, unknown> | undefined) ?? { type: "object", properties: {} },
    }));

    const seen = new Set<string>();
    const combined = [...normalizedAcademic, ...normalizedMcpTools];
    return combined.filter((tool) => {
        if (seen.has(tool.name)) return false;
        seen.add(tool.name);
        return true;
    });
};
const conversationManager = new ConversationManager();
const llmOrchestrator = createLlmOrchestrator();

// Initialize Auth0 middleware
const authMiddlewareConfig: AuthMiddlewareConfig = {
    auth0: {
        domain: AUTH0_DOMAIN,
        clientId: AUTH0_CLIENT_ID,
        audience: AUTH0_AUDIENCE,
    },
    requireAuth: REQUIRE_AUTH,
    publicEndpoints: ["/", "/web/", "/health", "/mcp/health", "/events", "/providers"],
};

const authMiddleware = createAuthMiddleware(authMiddlewareConfig);
const toolAccessMiddleware = createToolAccessMiddleware();

// Initialize license enforcement middleware
const licenseEnforcementConfig: LicenseEnforcementConfig = {
    licenseDatabase,
    requireLicense: REQUIRE_LICENSE,
    defaultTier: DEFAULT_TIER,
};

const licenseEnforcementMiddleware = createLicenseEnforcementMiddleware(licenseEnforcementConfig);
const featureAccessMiddleware = createFeatureAccessMiddleware();

// Global scheduler for background monitoring
const createMonitoringSchedulerInstance = () =>
    new MonitoringScheduler({
        endpoint: `http://${HOST}:${PORT}`,
        logger: (...args) => console.log('[Monitoring]', ...args),
        request: async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
            const response = await fetch(input, init);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json() as T;
        },
        jsonrpc: async <T>(): Promise<T> => {
            return {} as T;
        },
        sseProbe: async () => ({ ok: true }),
        evidence: () => undefined,
        deterministic: true,
        sessionId: `server-${Date.now()}`,
        userExpertiseLevel: 'expert',
        conversationHistory: [],
    });

let monitoringScheduler = createMonitoringSchedulerInstance();

// Initialize global monitoring system
const monitoring = getGlobalMonitoring();
const ENABLE_MONITORING = process.env.ENABLE_MONITORING !== "false";
const MONITORING_INTERVAL_MS = process.env.MONITORING_INTERVAL_MS
    ? Number.parseInt(process.env.MONITORING_INTERVAL_MS)
    : 60000; // 1 minute default

if (ENABLE_MONITORING) {
    monitoring.onAlert((alert) => {
        console.warn(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.component} - ${alert.message}`);
        // Broadcast alert to SSE clients
        broadcastEvent('alert', alert);
    });
}

// Handle self-healing API requests
export async function handleSelfHealingAPI(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
    try {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const method = req.method;
        const route = url.pathname;

        // Set JSON response headers
        res.setHeader('Content-Type', 'application/json');

        // Create development context for operations
        const createDevContext = (): DevelopmentContext => ({
            endpoint: `http://${req.headers.host || 'localhost'}${req.url || '/'}`,
            logger: (...args) => console.log('[SelfHealingAPI]', ...args),
            request: async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
                const response = await fetch(input, init);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json() as T;
            },
            jsonrpc: async <T>(method: string, params?: unknown): Promise<T> => {
                return {} as T;
            },
            sseProbe: async () => ({ ok: true }),
            evidence: () => undefined,
            deterministic: true,
            sessionId: `api-${Date.now()}`,
            userExpertiseLevel: 'expert',
            conversationHistory: [],
        });

        // Route handling
        if (route === '/api/v1/self-diagnose' && method === 'POST') {
            // Self-diagnosis endpoint
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const options = body ? JSON.parse(body) : {};
                    const ctx = createDevContext();
                    const healer = new AutoHealer(ctx);

                    const report = await healer.healSelf({
                        autoFix: options.autoFix || false,
                        dryRun: options.dryRun || false,
                        severityThreshold: options.severity || 'major',
                    });

                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        report,
                        timestamp: new Date().toISOString(),
                    }));
                } catch (error) {
                    res.writeHead(500);
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        timestamp: new Date().toISOString(),
                    }));
                }
            });
            return;
        }

        if (route === '/api/v1/health' && method === 'GET') {
            // Quick health check endpoint
            const ctx = createDevContext();
            const healer = new AutoHealer(ctx);
            const health = await healer.quickHealthCheck();

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                health,
                timestamp: new Date().toISOString(),
            }));
            return;
        }

        if (route === '/api/v1/templates' && method === 'GET') {
            const area = url.searchParams.get('area');
            const severity = url.searchParams.get('severity');

            const baseTemplates = listAllTemplates();
            let templates: FixTemplate[] = baseTemplates;

            if (area) {
                templates = getTemplatesByArea?.(area) ?? [];
            }

            if (severity) {
                const severityValues: FixTemplate['severity'][] = ['blocker', 'major', 'minor', 'info'];
                if (severityValues.includes(severity as FixTemplate['severity'])) {
                    templates = getTemplatesBySeverity?.(severity as FixTemplate['severity']) ?? [];
                }
            }

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                templates: templates.map((t) => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    area: t.area,
                    severity: t.severity,
                    riskLevel: t.riskLevel,
                    estimatedTime: t.estimatedTime,
                    filesAffected: t.filesAffected,
                })),
                count: templates.length,
                timestamp: new Date().toISOString(),
            }));
            return;
        }

        if (route.startsWith('/api/v1/templates/') && method === 'POST') {
            // Apply template endpoint
            const templateId = route.split('/').pop();
            if (!templateId) {
                res.writeHead(404);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Template ID required',
                    timestamp: new Date().toISOString(),
                }));
                return;
            }

            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const options = body ? JSON.parse(body) : {};
                    const ctx = createDevContext();
                    const templateEngine = new TemplateEngine();

                    // Create a mock finding for the template application
                    const template = getTemplate?.(templateId);
                    if (!template || template.id !== templateId) {
                        res.writeHead(404);
                        res.end(JSON.stringify({
                            success: false,
                            error: `Template '${templateId}' not found`,
                            timestamp: new Date().toISOString(),
                        }));
                        return;
                    }

                    const mockFinding = {
                        id: `api_${templateId}_${Date.now()}`,
                        area: template.area,
                        severity: template.severity,
                        title: `API template application: ${template.name}`,
                        description: `Applying fix template ${templateId} via API`,
                        evidence: [],
                        tags: ['api-applied'],
                        templateId,
                        canAutoFix: true,
                    };

                    const result = await templateEngine.applyTemplate(
                        templateId,
                        mockFinding,
                        ctx,
                        {
                            dryRun: options.dryRun || false,
                            backupEnabled: options.backup !== false,
                            skipValidation: !options.validate,
                        }
                    );

                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: result.success,
                        result,
                        timestamp: new Date().toISOString(),
                    }));
                } catch (error) {
                    res.writeHead(500);
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        timestamp: new Date().toISOString(),
                    }));
                }
            });
            return;
        }

        if (route === '/api/v1/monitor' && method === 'POST') {
            // Monitoring control endpoint
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const options = body ? JSON.parse(body) : {};

                    if (options.action === 'start') {
                        monitoringScheduler = createMonitoringSchedulerInstance();
                        monitoringScheduler.start({
                            checkIntervalMs: (options.intervalSeconds || 300) * 1000,
                            configs: options.configs,
                        });

                        res.writeHead(200);
                        res.end(JSON.stringify({
                            success: true,
                            message: 'Monitoring started',
                            status: monitoringScheduler.getStatus(),
                            timestamp: new Date().toISOString(),
                        }));
                    } else if (options.action === 'stop') {
                        monitoringScheduler.stop();

                        res.writeHead(200);
                        res.end(JSON.stringify({
                            success: true,
                            message: 'Monitoring stopped',
                            timestamp: new Date().toISOString(),
                        }));
                    } else if (options.action === 'status') {
                        const status = monitoringScheduler.getStatus();
                        const jobs = monitoringScheduler.getJobs();

                        res.writeHead(200);
                        res.end(JSON.stringify({
                            success: true,
                            status,
                            jobs,
                            timestamp: new Date().toISOString(),
                        }));
                    } else {
                        res.writeHead(400);
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Invalid action. Use: start, stop, or status',
                            timestamp: new Date().toISOString(),
                        }));
                    }
                } catch (error) {
                    res.writeHead(500);
                    res.end(JSON.stringify({
                        success: false,
                        error: String(error),
                        timestamp: new Date().toISOString(),
                    }));
                }
            });
            return;
        }

        // 404 for unknown API endpoints
        res.writeHead(404);
        res.end(JSON.stringify({
            success: false,
            error: 'API endpoint not found',
            path: route,
            method,
            timestamp: new Date().toISOString(),
        }));

    } catch (error) {
        console.error('Self-healing API error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }));
    }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const requestStartTime = Date.now();

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // Track request metrics
    const originalEnd = res.end.bind(res);
    res.end = function (this: ServerResponse, chunk?: unknown, encoding?: unknown, callback?: unknown): ServerResponse {
        const responseTime = Date.now() - requestStartTime;
        const success = res.statusCode < 400;
        recordRequest(responseTime, success);
        // @ts-expect-error - Complex overload handling
        return originalEnd(chunk, encoding, callback);
    } as typeof res.end;

    // Apply authentication middleware
    let authPassed = false;
    await authMiddleware(req, res, () => {
        authPassed = true;
    });

    if (!authPassed) {
        return; // Auth middleware already sent response
    }

    // Apply license enforcement middleware
    let licensePassed = false;
    await licenseEnforcementMiddleware(req, res, () => {
        licensePassed = true;
    });

    if (!licensePassed) {
        return; // License middleware already sent response
    }

    try {
        // SSE endpoint for real-time updates
        const wantsSse =
            req.method === 'GET' &&
            (path === '/events' ||
                path === '/sse' ||
                (path === '/' &&
                    (req.headers.accept || '').includes('text/event-stream')));
        if (wantsSse) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            sseClients.add(res);
            updateActiveConnections(1);

            const writeEvent = (payload: Record<string, unknown>) => {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            };

            writeEvent({ type: 'connected', timestamp: new Date().toISOString() });

            const heartbeat = setInterval(() => {
                writeEvent({ type: 'heartbeat', timestamp: new Date().toISOString() });
            }, 2000);

            req.on('close', () => {
                clearInterval(heartbeat);
                sseClients.delete(res);
                updateActiveConnections(-1);
            });

            return;
        }

        // Serve web interface
        if (path === '/' && req.method === 'GET') {
            const served = await serveStaticFile('index.html', res);
            if (served) return;
        }

        // Serve static web assets
        if (path.startsWith('/web/') && req.method === 'GET') {
            const filePath = path.substring(5); // Remove '/web/' prefix
            const served = await serveStaticFile(filePath, res);
            if (served) return;
        }

        // Health check endpoint
        if (path === '/health' || path === '/mcp/health') {
            const detailed = url.searchParams.get('detailed') === 'true';
            const startTime = performance.now();

            try {
                if (detailed) {
                    // Comprehensive health check
                    const ctx = createDiagnosticContext(req);
                    const health = await performHealthCheck(ctx, {
                        enableDetailedChecks: true,
                        includeMetrics: true,
                        timeout: 5000,
                    });

                    const responseTime = Math.round(performance.now() - startTime);
                    recordRequest(responseTime, true);

                    res.writeHead(health.status === 'healthy' ? 200 : 503, {
                        'Content-Type': 'application/json',
                    });
                    res.end(JSON.stringify(health));
                } else {
                    // Quick health check
                    const responseTime = Math.round(performance.now() - startTime);
                    recordRequest(responseTime, true);

                    const providers = Object.keys(registry.getAllProviders());
                    const stateDbPath = process.env.CORTEXDX_STATE_DB ?? join(process.cwd(), '.cortexdx', 'workflow-state.db');
                    const quickPayload = buildQuickHealthPayload({
                        providers,
                        responseTimeMs: responseTime,
                        stateDbPath,
                        stateDbExists: existsSync(stateDbPath),
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(quickPayload));
                }
            } catch (error) {
                const responseTime = Math.round(performance.now() - startTime);
                recordRequest(responseTime, false);

                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString(),
                }));
            }
            return;
        }

        // Admin dashboard endpoint (requires admin role)
        if (path === '/admin/dashboard') {
            const authReq = req as AuthenticatedRequest;
            const hasAdminRole = authReq.auth?.roles.includes('admin') ?? false;

            if (!hasAdminRole && REQUIRE_AUTH) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Forbidden',
                    message: 'Admin role required for dashboard access'
                }));
                return;
            }

            const { getAdminDashboardImpl } = await import('./tools/commercial-feature-impl.js');
            const result = await getAdminDashboardImpl();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(result.content[0]?.text || '{}');
            return;
        }

        // License management endpoint
        if (path === '/admin/licenses') {
            const authReq = req as AuthenticatedRequest;
            const hasAdminRole = authReq.auth?.roles.includes('admin') ?? false;

            if (!hasAdminRole && REQUIRE_AUTH) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Forbidden',
                    message: 'Admin role required for license management'
                }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                licenses: Array.from(licenseDatabase.entries()).map(([key, license]) => ({
                    key,
                    tier: license.tier,
                    features: license.features,
                    expiresAt: license.expiresAt,
                    organizationId: license.organizationId,
                    maxUsers: license.maxUsers
                }))
            }));
            return;
        }

        // List all providers
        if (path === '/providers') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                providers: registry.getAllProviders(),
                categories: registry.getCategories()
            }));
            return;
        }

        // Provider capabilities
        if (path === '/capabilities') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(registry.getAllCapabilities()));
            return;
        }

        // Provider health checks
        if (path === '/health-checks') {
            const ctx = createDiagnosticContext(req);
            const healthResults = await registry.performHealthChecks(ctx);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(healthResults));
            return;
        }

        // Monitoring endpoints
        if (path === '/monitoring/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                monitoring: monitoring.getStatus(),
                alerts: monitoring.getAlerts(),
                timestamp: new Date().toISOString(),
            }));
            return;
        }

        if (path === '/monitoring/report') {
            try {
                const ctx = createDiagnosticContext(req);
                monitoring.setContext(ctx);
                const report = await monitoring.getReport();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(report));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString(),
                }));
            }
            return;
        }

        if (path === '/monitoring/alerts') {
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    alerts: monitoring.getAlerts(),
                    count: monitoring.getAlerts().length,
                    timestamp: new Date().toISOString(),
                }));
            } else if (req.method === 'DELETE') {
                monitoring.clearAlerts();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    message: 'Alerts cleared',
                    timestamp: new Date().toISOString(),
                }));
            }
            return;
        }

        if (path === '/monitoring/control' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                try {
                    const { action } = JSON.parse(body);

                    if (action === 'start') {
                        const ctx = createDiagnosticContext(req);
                        monitoring.setContext(ctx);
                        monitoring.start();

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            message: 'Monitoring started',
                            status: monitoring.getStatus(),
                            timestamp: new Date().toISOString(),
                        }));
                    } else if (action === 'stop') {
                        monitoring.stop();

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            message: 'Monitoring stopped',
                            status: monitoring.getStatus(),
                            timestamp: new Date().toISOString(),
                        }));
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: 'Invalid action. Use: start or stop',
                            timestamp: new Date().toISOString(),
                        }));
                    }
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: error instanceof Error ? error.message : 'Invalid request',
                        timestamp: new Date().toISOString(),
                    }));
                }
            });
            return;
        }

        // Individual provider endpoints
        const providerMatch = path.match(/^\/providers\/([^\/]+)(?:\/(.+))?$/);
        if (providerMatch) {
            const [, providerId, action] = providerMatch;
            if (!providerId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Provider ID is required' }));
                return;
            }

            const provider = registry.getProvider(providerId);

            if (!provider) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Provider not found: ${providerId}` }));
                return;
            }

            // Get provider capabilities
            if (!action || action === 'capabilities') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(provider.capabilities));
                return;
            }

            // Execute provider tools via POST
            if (req.method === 'POST' && action === 'execute') {
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk;
                });
                req.on('end', async () => {
                    try {
                        const { tool, params } = JSON.parse(body);
                        const ctx = createDiagnosticContext(req);
                        const providerInstance = registry.createProviderInstance(providerId, ctx);
                        const result = await providerInstance.executeTool(tool, params);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ result }));
                    } catch (error) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }));
                    }
                });
                return;
            }

            // Provider health check
            if (action === 'health') {
                const ctx = createDiagnosticContext(req);
                const providerInstance = registry.createProviderInstance(providerId, ctx);
                const isHealthy = providerInstance.healthCheck ? await providerInstance.healthCheck() : true;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ healthy: isHealthy }));
                return;
            }
        }

        // MCP protocol endpoints
        const isJsonRpcPost = req.method === 'POST' && (path === '/mcp' || path === '/' || path === '');
        if (isJsonRpcPost) {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const request = JSON.parse(body);

                    const respond = (result: unknown): void => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id ?? null,
                            result,
                        }));
                    };

                    const respondError = (code: number, message: string, statusCode = 400): void => {
                        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id ?? null,
                            error: { code, message },
                        }));
                    };

                    // Handle MCP initialize
                    if (request.method === 'initialize') {
                        respond({
                            protocolVersion: '2024-11-05',
                            capabilities: {
                                tools: {},
                                resources: { list: true, read: true },
                                prompts: {},
                            },
                            serverInfo: {
                                name: 'CortexDx Server',
                                version: '1.0.0',
                            },
                        });
                        return;
                    }

                    if (request.method === 'rpc.ping') {
                        respond({
                            status: 'ok',
                            timestamp: new Date().toISOString(),
                        });
                        return;
                    }

                    // Handle tools/list
                    if (request.method === 'tools/list') {
                        respond({ tools: getJsonRpcToolList() });
                        return;
                    }

                    if (request.method === 'resources/list') {
                        const researchResources = listResearchResources().map((resource) => ({
                            uri: `cortexdx://research/${resource.id}`,
                            name: `Academic Research — ${resource.report.topic}`,
                            description: `Captured ${new Date(resource.createdAt).toISOString()}`,
                            mimeType: 'application/json',
                        }));

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id,
                            result: { resources: researchResources }
                        }));
                        return;
                    }

                    if (request.method === 'resources/read') {
                        const uri = request.params?.uri as string | undefined;
                        if (!uri || !uri.startsWith('cortexdx://research/')) {
                            respondError(-32602, 'Unknown resource uri');
                            return;
                        }
                        const id = uri.split('/').pop() as string;
                        const resource = getResearchResource(id);
                        if (!resource) {
                            respondError(-32602, 'Resource not found', 404);
                            return;
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id,
                            result: {
                                contents: [
                                    {
                                        uri,
                                        mimeType: 'application/json',
                                        type: 'text',
                                        text: JSON.stringify(resource.report, null, 2)
                                    }
                                ]
                            }
                        }));
                        return;
                    }

                    // Handle tools/call
                    if (request.method === 'tools/call') {
                        const { name, arguments: args } = request.params;

                        // Check tool access authorization
                        let toolAccessGranted = false;
                        toolAccessMiddleware(req as AuthenticatedRequest, res, name, () => {
                            toolAccessGranted = true;
                        });

                        if (!toolAccessGranted) {
                            return; // Tool access middleware already sent response
                        }

                        // Check if it's an MCP tool first
                        const mcpTool = findMcpTool(name);
                        if (mcpTool) {
                            try {
                                const ctx = createDevelopmentContext(req);
                                const result = await executeDevelopmentTool(mcpTool, args, ctx);

                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    jsonrpc: '2.0',
                                    id: request.id,
                                    result
                                }));
                                return;
                            } catch (error) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    jsonrpc: '2.0',
                                    id: request.id,
                                    error: { code: -32603, message: error instanceof Error ? error.message : 'Tool execution failed' }
                                }));
                                return;
                            }
                        }

                        // Find which academic provider has this tool
                        const providers = registry.getAllProviders();
                        let targetProvider: string | null = null;

                        for (const [providerId, providerReg] of Object.entries(providers)) {
                            const tools = providerReg.capabilities.tools as Array<{ name?: string }>;
                            const hasTool = tools.some((tool) => tool.name === name);
                            if (hasTool) {
                                targetProvider = providerId;
                                break;
                            }
                        }

                        if (!targetProvider) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                jsonrpc: '2.0',
                                id: request.id,
                                error: { code: -32601, message: `Tool not found: ${name}` }
                            }));
                            return;
                        }

                        const ctx = createDiagnosticContext(req);
                        const providerInstance = registry.createProviderInstance(targetProvider, ctx);
                        const result = await providerInstance.executeTool(name, args);

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id,
                            result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
                        }));
                        return;
                    }

                    // Unknown method
                    respondError(-32601, `Method not found: ${request.method}`);
                } catch (error) {
                    console.error('JSON-RPC parse error:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        id: null,
                        error: { code: -32700, message: 'Parse error' }
                    }));
                }
            });
            return;
        }

        // Self-healing API endpoints
        if (path.startsWith('/api/v1/')) {
            await handleSelfHealingAPI(req, res, path);
            return;
        }

        // 404 for unknown paths
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));

    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        }));
    }
});

const SHOULD_LISTEN = process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";

if (SHOULD_LISTEN) {
    server.listen(PORT, HOST, () => {
        console.log(`🚀 CortexDx Server running on http://${HOST}:${PORT}`);
        console.log(`📚 Academic providers available: ${Object.keys(registry.getAllProviders()).join(', ')}`);
        console.log(`🌐 Web Interface: http://${HOST}:${PORT}/`);
        console.log("\nEndpoints:");
        console.log("  GET  /              - Web Interface");
        console.log("  GET  /health        - Health check (add ?detailed=true for full report)");
        console.log("  GET  /events        - SSE real-time updates");
        console.log("  GET  /providers     - List all providers");
        console.log("  GET  /capabilities  - All provider capabilities");
        console.log("  GET  /health-checks - Provider health status");
        console.log("  POST /mcp           - MCP protocol endpoint");
        console.log("  GET  /providers/:id - Provider details");
        console.log("  POST /providers/:id/execute - Execute provider tool");
        console.log("");
        console.log("Monitoring API:");
        console.log("  GET  /monitoring/status  - Monitoring system status");
        console.log("  GET  /monitoring/report  - Comprehensive monitoring report");
        console.log("  GET  /monitoring/alerts  - Current alerts");
        console.log("  DELETE /monitoring/alerts - Clear alerts");
        console.log("  POST /monitoring/control - Start/stop monitoring");
        console.log("");
        console.log("Self-Healing API:");
        console.log("  POST /api/v1/self-diagnose - Run self-diagnosis with optional auto-fix");
        console.log("  GET  /api/v1/health        - Quick health check");
        console.log("  GET  /api/v1/templates      - List available fix templates");
        console.log("  POST /api/v1/templates/:id - Apply a fix template");
        console.log("  POST /api/v1/monitor       - Control background monitoring");

        // Start monitoring if enabled
        if (ENABLE_MONITORING) {
            const ctx = {
                endpoint: `http://${HOST}:${PORT}`,
                logger: (...args: unknown[]) => console.log('[Monitoring]', ...args),
                request: async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
                    const response = await fetch(input, init);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json() as T;
                },
                jsonrpc: async <T>(): Promise<T> => ({} as T),
                sseProbe: async () => ({ ok: true }),
                evidence: () => undefined,
                deterministic: true,
            };

            monitoring.setContext(ctx);
            monitoring.start();
            console.log(`\n📊 Monitoring enabled (interval: ${MONITORING_INTERVAL_MS}ms)`);
        }
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    monitoring.stop();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    monitoring.stop();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

export { server };
export default server;
