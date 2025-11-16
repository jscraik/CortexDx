import { safeParseJson } from "./utils/json.js";
import { createRateLimiterFromEnv } from "./middleware/rate-limiter.js";
import { createLogger } from "./logging/logger.js";
/**
 * CortexDx Server
 * HTTP server that exposes the academic research providers as MCP endpoints
 */

import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { type IncomingMessage, type ServerResponse, createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { TLSSocket } from "node:tls";
import { extname, join } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { ConversationManager } from "./conversation/manager.js";
import { AutoHealer } from "./healing/auto-healer.js";
import { MonitoringScheduler, type MonitoringConfig } from "./healing/scheduler.js";
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
import { type AuthMiddlewareConfig, type AuthenticatedRequest, checkToolAccess, createAuthMiddleware } from "./plugins/auth-middleware.js";
import { createDiagnosticSessionMiddleware } from "./plugins/diagnostic-session-middleware.js";
import type { LicenseKey } from "./plugins/commercial-licensing.js";
import { type LicenseEnforcementConfig, createFeatureAccessMiddleware, createLicenseEnforcementMiddleware } from "./plugins/license-enforcement.js";
import { getAcademicRegistry } from "./registry/index.js";
import { TemplateEngine } from "./template-engine/engine.js";
import type { FixTemplate } from "./templates/fix-templates.js";
import * as FixTemplateModule from "./templates/fix-templates.js";
import { getResearchResource, listResearchResources } from "./resources/research-store.js";
import { getMcpDocsResource, listMcpDocsResources } from "./resources/mcp-docs-store.js";
import { findMcpTool, getAllMcpToolsFlat, executeDeepContextTool } from "./tools/index.js";
import { executeAcademicIntegrationTool } from "./tools/academic-integration-tools.js";
import { executeMcpDocsTool } from "./tools/mcp-docs-tools.js";
import { executeMcpProbeTool } from "./tools/mcp-probe-tools.js";
import { getDiagnosticSessionManager, type DiagnosticSessionConfig } from "./auth/diagnostic-session-manager.js";
import { getReportStore } from "./probe/report-store.js";
import type {
    DevelopmentContext,
    DiagnosticContext,
    McpTool,
    McpToolResult,
    ProjectContext,
} from "./types.js";
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
const TLS_CERT_PATH = process.env.CORTEXDX_TLS_CERT_PATH;
const TLS_KEY_PATH = process.env.CORTEXDX_TLS_KEY_PATH;
const ADMIN_TOOL_TOKEN = process.env.CORTEXDX_ADMIN_TOKEN?.trim();
const RESTRICTED_TOOLS = new Set(["wikidata_sparql", "cortexdx_delete_workflow"]);

type SelfDiagnoseOptions = {
    autoFix?: boolean;
    dryRun?: boolean;
    severity?: "minor" | "major" | "blocker";
};

type TemplateApplyOptions = {
    dryRun?: boolean;
    backup?: boolean;
    validate?: boolean;
};

type MonitoringControlOptions = {
    action?: "start" | "stop" | "status";
    intervalSeconds?: number;
    configs?: MonitoringConfig[];
};

type MonitoringActionPayload = {
    action?: "start" | "stop";
};

type ProviderExecutePayload = {
    tool: string;
    params?: Record<string, unknown>;
};

type DiagnosticSessionCreatePayload = {
    requestedBy: string;
    scope: string[];
    duration: number;
    allowedEndpoints?: string[];
    metadata?: Record<string, unknown>;
};

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

// Create server logger instance
const serverLogger = createLogger({ component: 'server' });

// Create diagnostic context for providers
const createDiagnosticContext = (req: IncomingMessage): DiagnosticContext => {
    const diagnosticLogger = createLogger({ component: 'diagnostic', context: { endpoint: req.url } });
    return {
        endpoint: `http://${req.headers.host || 'localhost'}${req.url || '/'}`,
        headers: req.headers as Record<string, string>,
        logger: (...args: unknown[]) => diagnosticLogger.info({ data: args }, 'Diagnostic log'),
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
        evidence: (ev) => diagnosticLogger.debug({ evidence: ev }, 'Evidence collected'),
        deterministic: false
    };
};

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
const extractProjectContext = (req: IncomingMessage): ProjectContext | undefined => {
    const projectHeader = req.headers['x-project-context'] as string;
    if (!projectHeader) return undefined;

    try {
        return safeParseJson<ProjectContext>(projectHeader, "x-project-context header");
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
        case 'cortexdx_mcp_docs_search':
        case 'cortexdx_mcp_docs_lookup':
        case 'cortexdx_mcp_docs_versions':
            return await executeMcpDocsTool(tool, args, ctx);
        case 'cortexdx_probe_mcp_server':
            return await executeMcpProbeTool(tool, args, ctx);
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

// Initialize diagnostic session middleware
const diagnosticSessionMiddleware = createDiagnosticSessionMiddleware();

// Initialize license enforcement middleware
const licenseEnforcementConfig: LicenseEnforcementConfig = {
    licenseDatabase,
    requireLicense: REQUIRE_LICENSE,
    defaultTier: DEFAULT_TIER,
};

const licenseEnforcementMiddleware = createLicenseEnforcementMiddleware(licenseEnforcementConfig);
const featureAccessMiddleware = createFeatureAccessMiddleware();

// Global scheduler for background monitoring
const monitoringLogger = createLogger({ component: 'monitoring' });
const createMonitoringSchedulerInstance = () =>
    new MonitoringScheduler({
        endpoint: `http://${HOST}:${PORT}`,
        logger: (...args) => monitoringLogger.info({ data: args }, 'Monitoring event'),
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
        serverLogger.warn({ alert }, `[ALERT] ${alert.severity.toUpperCase()}: ${alert.component} - ${alert.message}`);
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
        const selfHealingLogger = createLogger({ component: 'self-healing-api' });
        const createDevContext = (): DevelopmentContext => ({
            endpoint: `http://${req.headers.host || 'localhost'}${req.url || '/'}`,
            logger: (...args) => selfHealingLogger.info({ data: args }, 'Self-healing event'),
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
            // Self-diagnosis endpoint with rate limiting
            const rateLimiter = createRateLimiterFromEnv();
            const allowed = await rateLimiter(req, res, '/api/v1/self-diagnose');

            if (!allowed) {
                // Rate limit exceeded, response already sent by middleware
                return;
            }

            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const options: SelfDiagnoseOptions = body
                        ? safeParseJson<SelfDiagnoseOptions>(body, "self-diagnose options")
                        : {};
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
                    const options: TemplateApplyOptions = body
                        ? safeParseJson<TemplateApplyOptions>(body, "template apply options")
                        : {};
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
                    const options: MonitoringControlOptions = body
                        ? safeParseJson<MonitoringControlOptions>(body, "monitoring control options")
                        : {};

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

        // Diagnostic session management endpoints
        if (route === '/api/v1/diagnostic-session/create' && method === 'POST') {
            // Create diagnostic session endpoint (requires Auth0 authentication)
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    // Verify Auth0 authentication
                    const authReq = req as AuthenticatedRequest;
                    if (!authReq.auth && REQUIRE_AUTH) {
                        res.writeHead(401);
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Authentication required. Provide valid Auth0 Bearer token.',
                            timestamp: new Date().toISOString(),
                        }));
                        return;
                    }

                    const payload: DiagnosticSessionCreatePayload = safeParseJson<DiagnosticSessionCreatePayload>(
                        body,
                        "diagnostic session create payload"
                    );

                    // Validate required fields
                    if (!payload.requestedBy || !payload.scope || !Array.isArray(payload.scope) || !payload.duration) {
                        res.writeHead(400);
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Missing required fields: requestedBy, scope (array), duration (seconds)',
                            timestamp: new Date().toISOString(),
                        }));
                        return;

                    // Validate scope array contents
                    const allowedScopePattern = /^(read|write|execute):\*$/;
                    if (
                        !payload.scope.every(
                            (s) => typeof s === "string" && allowedScopePattern.test(s)
                        )
                    ) {
                        res.writeHead(400);
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Invalid scope value(s). Allowed patterns: read:*, write:*, execute:*',
                            timestamp: new Date().toISOString(),
                        }));
                        return;
                    }

                    // Validate duration (min 60 seconds, max 24 hours)
                    if (payload.duration < 60) {
                        res.writeHead(400);
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Duration must be at least 60 seconds',
                            timestamp: new Date().toISOString(),
                        }));
                        return;
                    }
                    if (payload.duration > 86400) {
                        res.writeHead(400);
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Duration cannot exceed 86400 seconds (24 hours)',
                            timestamp: new Date().toISOString(),
                        }));
                        return;
                    }

                    const sessionManager = getDiagnosticSessionManager();
                    const config: DiagnosticSessionConfig = {
                        requestedBy: payload.requestedBy,
                        scope: payload.scope,
                        duration: payload.duration,
                        allowedEndpoints: payload.allowedEndpoints,
                        metadata: {
                            ...payload.metadata,
                            createdBy: authReq.auth?.userId || 'unknown',
                            createdVia: 'api'
                        }
                    };

                    const session = sessionManager.createSession(config);

                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        session,
                        message: 'Diagnostic session created successfully. Store the apiKey securely - it will not be shown again.',
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

        if (route.startsWith('/api/v1/diagnostic-session/') && route.endsWith('/revoke') && method === 'POST') {
            // Revoke diagnostic session endpoint
            // Robustly extract session ID from route
            const segments = route.split('/').filter(Boolean); // Remove empty segments
            // Expected: ['api', 'v1', 'diagnostic-session', '<sessionId>', 'revoke']
            if (
                segments.length !== 5 ||
                segments[0] !== 'api' ||
                segments[1] !== 'v1' ||
                segments[2] !== 'diagnostic-session' ||
                segments[4] !== 'revoke'
            ) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Malformed route. Expected /api/v1/diagnostic-session/:sessionId/revoke',
                    timestamp: new Date().toISOString(),
                }));
                return;
            }
            const sessionId = segments[3];
            if (!sessionId) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Session ID required',
                    timestamp: new Date().toISOString(),
                }));
                return;
            }

            try {
                const sessionManager = getDiagnosticSessionManager();
                const revoked = sessionManager.revokeSession(sessionId);

                if (revoked) {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        message: `Diagnostic session ${sessionId} revoked successfully`,
                        timestamp: new Date().toISOString(),
                    }));
                } else {
                    res.writeHead(404);
                    res.end(JSON.stringify({
                        success: false,
                        error: `Session ${sessionId} not found or already revoked`,
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
            return;
        }

        if (route.match(/^\/api\/v1\/diagnostic-session\/[^\/]+$/) && method === 'GET') {
            // Get diagnostic session info endpoint
            // Robustly extract session ID from route
            const segments = route.split('/').filter(Boolean); // Remove empty segments
            // Expected: ['api', 'v1', 'diagnostic-session', '<sessionId>']
            if (
                segments.length !== 4 ||
                segments[0] !== 'api' ||
                segments[1] !== 'v1' ||
                segments[2] !== 'diagnostic-session'
            ) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Malformed route. Expected /api/v1/diagnostic-session/:sessionId',
                    timestamp: new Date().toISOString(),
                }));
                return;
            }
            const sessionId = segments[3];
            if (!sessionId) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Session ID required',
                    timestamp: new Date().toISOString(),
                }));
                return;
            }

            try {
                const sessionManager = getDiagnosticSessionManager();
                const session = sessionManager.getSession(sessionId);

                if (session) {
                    const usage = sessionManager.getSessionUsage(sessionId);
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        session,
                        usage,
                        timestamp: new Date().toISOString(),
                    }));
                } else {
                    res.writeHead(404);
                    res.end(JSON.stringify({
                        success: false,
                        error: `Session ${sessionId} not found`,
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
            return;
        }

        if (route === '/api/v1/diagnostic-session' && method === 'GET') {
            // List diagnostic sessions endpoint
            try {
                // Use a static, trusted base URL to avoid Host header injection
                const url = new URL(req.url || '', process.env.CORTEXDX_BASE_URL || 'http://localhost');
                const requestedBy = url.searchParams.get('requestedBy');
                const status = url.searchParams.get('status') as "active" | "revoked" | "expired" | null;

                if (!requestedBy) {
                    res.writeHead(400);
                    res.end(JSON.stringify({
                        success: false,
                        error: 'requestedBy query parameter required',
                        timestamp: new Date().toISOString(),
                    }));
                    return;
                }

                const sessionManager = getDiagnosticSessionManager();
                const sessions = sessionManager.listSessions(requestedBy, status || undefined);

                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    sessions,
                    count: sessions.length,
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
            return;
        }

        // Diagnostic report endpoints
        if (route.match(/^\/api\/v1\/reports\/[^\/]+$/) && method === 'GET') {
            // Get diagnostic report by ID
            const reportId = route.split('/').pop();
            if (!reportId) {
                res.writeHead(400);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Report ID required',
                    timestamp: new Date().toISOString(),
                }));
                return;
            }

            try {
                const reportStore = getReportStore();
                const report = reportStore.getReport(reportId);

                if (!report) {
                    res.writeHead(404);
                    res.end(JSON.stringify({
                        success: false,
                        error: `Report ${reportId} not found or expired`,
                        timestamp: new Date().toISOString(),
                    }));
                    return;
                }

                // Check format query parameter
                const host = process.env.PUBLIC_HOST || 'localhost';
                const url = new URL(req.url, `http://${host}`);
                const format = url.searchParams.get('format') || 'json';

                if (format === 'markdown' || format === 'md') {
                    res.writeHead(200, { 'Content-Type': 'text/markdown' });
                    res.end(report.markdown);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(report.json);
                }
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: String(error),
                    timestamp: new Date().toISOString(),
                }));
            }
            return;
        }

        if (route === '/api/v1/reports' && method === 'GET') {
            // List reports
            try {
                const url = new URL(req.url || '', 'http://localhost');
                // Use a fixed base URL to avoid Host header injection
                const url = new URL(req.url || '', 'http://localhost');
                const reportStore = getReportStore();
                const targetUrl = url.searchParams.get('targetUrl');
                const limit = Number.parseInt(url.searchParams.get('limit') || '20');

                const reports = targetUrl
                    ? reportStore.listReportsByTarget(targetUrl, limit)
                    : reportStore.listRecentReports(limit);

                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    reports: reports.map(r => ({
                        id: r.id,
                        targetUrl: r.targetUrl,
                        timestamp: r.timestamp,
                        duration: r.duration,
                        score: r.score,
                        compliant: r.compliant,
                        createdAt: new Date(r.createdAt).toISOString(),
                        expiresAt: new Date(r.expiresAt).toISOString(),
                        url: `/api/v1/reports/${r.id}`
                    })),
                    count: reports.length,
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
            return;
        }

        if (route === '/api/v1/reports/stats' && method === 'GET') {
            // Get report statistics
            try {
                const reportStore = getReportStore();
                const stats = reportStore.getStatistics();

                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    statistics: stats,
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

const requestHandler = async (req: IncomingMessage, res: ServerResponse) => {
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

    const socket = req.socket as TLSSocket;
    const protocol = socket.encrypted ? "https" : "http";
    const url = new URL(req.url || '/', `${protocol}://${req.headers.host || HOST}`);
    const path = url.pathname;
    const normalizedPath = path.startsWith("/mcp")
        ? path.slice(4) || "/"
        : path;

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

    // Apply diagnostic session middleware (allows alternative auth via session key)
    let sessionPassed = false;
    await diagnosticSessionMiddleware(req, res, () => {
        sessionPassed = true;
    });

    if (!sessionPassed) {
        return; // Diagnostic session middleware already sent response
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
            (normalizedPath === '/events' ||
                normalizedPath === '/sse' ||
                (normalizedPath === '/' &&
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
                    const { action } = safeParseJson<MonitoringActionPayload>(body, "monitoring control payload");

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
                        const { tool, params } = safeParseJson<ProviderExecutePayload>(
                            body,
                            "provider execute payload",
                        );
                        const ctx = createDiagnosticContext(req);
                        const providerInstance = registry.createProviderInstance(providerId, ctx);
                        const result = await providerInstance.executeTool(tool, params ?? {});

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
                    const payload: JsonRpcRequestPayload | JsonRpcRequestPayload[] =
                        body.length > 0
                            ? safeParseJson<JsonRpcRequestPayload | JsonRpcRequestPayload[]>(
                                body,
                                "json-rpc payload",
                            )
                            : {};

                    if (Array.isArray(payload)) {
                        const responses: JsonRpcResponsePayload[] = [];
                        for (const entry of payload) {
                            const response = await handleJsonRpcCall(entry, req);
                            if (response) {
                                responses.push(response);
                            }
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(responses));
                        return;
                    }

                    const singleResponse = await handleJsonRpcCall(payload as JsonRpcRequestPayload, req);
                    if (!singleResponse) {
                        res.writeHead(204);
                        res.end();
                        return;
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(singleResponse));
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
};

const tlsEnabled =
    Boolean(TLS_CERT_PATH && TLS_KEY_PATH) &&
    TLS_CERT_PATH !== undefined &&
    TLS_KEY_PATH !== undefined &&
    existsSync(TLS_CERT_PATH) &&
    existsSync(TLS_KEY_PATH);

const server = tlsEnabled
    ? createHttpsServer(
        {
            cert: readFileSync(TLS_CERT_PATH as string),
            key: readFileSync(TLS_KEY_PATH as string)
        },
        requestHandler
    )
    : createHttpServer(requestHandler);

const SHOULD_LISTEN = process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";

type JsonRpcId = string | number | null;
type JsonRpcResponsePayload =
    | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
    | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

type JsonRpcRequestPayload = {
    jsonrpc?: string;
    id?: JsonRpcId;
    method?: string;
    params?: Record<string, unknown>;
};

const createSuccessResponse = (id: JsonRpcId, result: unknown): JsonRpcResponsePayload => ({
    jsonrpc: "2.0",
    id,
    result,
});

const createErrorResponse = (id: JsonRpcId, code: number, message: string): JsonRpcResponsePayload => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
});

async function handleJsonRpcCall(
    payload: JsonRpcRequestPayload | undefined,
    req: IncomingMessage,
): Promise<JsonRpcResponsePayload | undefined> {
    if (!payload || typeof payload !== "object") {
        return createErrorResponse(null, -32600, "Invalid Request");
    }

    const { id, method, params }: JsonRpcRequestPayload = payload ?? {};
    const responseId: JsonRpcId = id ?? null;

    if (!method || typeof method !== "string") {
        return createErrorResponse(responseId, -32600, "Invalid Request");
    }

    switch (method) {
        case "initialize":
            return createSuccessResponse(responseId, {
                protocolVersion: "2024-11-05",
                capabilities: {
                    tools: {},
                    resources: { list: true, read: true },
                    prompts: {},
                },
                serverInfo: {
                    name: "CortexDx Server",
                    version: "1.0.0",
                },
            });
        case "rpc.ping":
            return createSuccessResponse(responseId, {
                status: "ok",
                timestamp: new Date().toISOString(),
            });
        case "tools/list":
            return createSuccessResponse(responseId, { tools: getJsonRpcToolList() });
        case "resources/list":
            return createSuccessResponse(responseId, { resources: buildResourceList() });
        case "resources/read": {
            const uri = typeof params?.uri === "string" ? params.uri : undefined;
            if (!uri) {
                return createErrorResponse(responseId, -32602, "Unknown resource uri");
            }
            if (uri.startsWith("cortexdx://research/")) {
                const resourceId = uri.split("/").pop() as string;
                const resource = getResearchResource(resourceId);
                if (!resource) {
                    return createErrorResponse(responseId, -32602, "Resource not found");
                }
                return createSuccessResponse(responseId, {
                    contents: [
                        {
                            uri,
                            mimeType: "application/json",
                            type: "text",
                            text: JSON.stringify(resource.report, null, 2),
                        },
                    ],
                });
            }
            if (uri.startsWith("cortexdx://mcp-docs/")) {
                const resourceId = uri.split("/").pop() as string;
                const resource = getMcpDocsResource(resourceId);
                if (!resource) {
                    return createErrorResponse(responseId, -32602, "Resource not found");
                }
                return createSuccessResponse(responseId, {
                    contents: [
                        {
                            uri,
                            mimeType: "application/json",
                            type: "text",
                            text: JSON.stringify(resource.payload, null, 2),
                        },
                    ],
                });
            }
            return createErrorResponse(responseId, -32602, "Unknown resource uri");
        }
        case "tools/call":
            return await handleToolsCall(req, params, responseId);
        default:
            return createErrorResponse(responseId, -32601, `Method not found: ${method}`);
    }
}

const buildResourceList = () => {
    const researchResources = listResearchResources().map((resource) => ({
        uri: `cortexdx://research/${resource.id}`,
        name: `Academic Research — ${resource.report.topic}`,
        description: `Captured ${new Date(resource.createdAt).toISOString()}`,
        mimeType: "application/json",
    }));

    const docsResources = listMcpDocsResources().map((resource) => {
        const payload = resource.payload as { query?: string; chunk?: { title?: string; url: string } };
        const name =
            resource.type === "search"
                ? `MCP Docs Search — ${payload.query ?? "query"}`
                : `MCP Docs Chunk — ${payload.chunk?.title ?? payload.chunk?.url ?? resource.id}`;
        return {
            uri: `cortexdx://mcp-docs/${resource.id}`,
            name,
            description: `Captured ${new Date(resource.createdAt).toISOString()}`,
            mimeType: "application/json",
        };
    });

    return [...researchResources, ...docsResources];
};

async function handleToolsCall(
    req: IncomingMessage,
    params: Record<string, unknown> | undefined,
    id: JsonRpcId,
): Promise<JsonRpcResponsePayload> {
    const name = typeof params?.name === "string" ? params.name : undefined;
    if (!name) {
        return createErrorResponse(id, -32602, "Tool name is required");
    }
    const args =
        params && typeof params === "object" && "arguments" in params
            ? (params as { arguments?: unknown }).arguments
            : undefined;

    const access = checkToolAccess(req as AuthenticatedRequest, name);
    if (!access.allowed) {
        return createErrorResponse(id, -32001, access.reason || "Access denied to this tool");
    }

    const restrictedError = ensureRestrictedToolAccess(req, name, id);
    if (restrictedError) {
        return restrictedError;
    }

    const mcpTool = findMcpTool(name);
    if (mcpTool) {
        try {
            const ctx = createDevelopmentContext(req);
            const result = await executeDevelopmentTool(mcpTool, args, ctx);
            return createSuccessResponse(id, result);
        } catch (error) {
            return createErrorResponse(
                id,
                -32603,
                error instanceof Error ? error.message : "Tool execution failed",
            );
        }
    }

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
        return createErrorResponse(id, -32601, `Tool not found: ${name}`);
    }

    const ctx = createDiagnosticContext(req);
    const providerInstance = registry.createProviderInstance(targetProvider, ctx);
    const providerArgs = (args ?? {}) as Record<string, unknown>;
    const result = await providerInstance.executeTool(name, providerArgs);

    return createSuccessResponse(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    });
}

const ensureRestrictedToolAccess = (
    req: IncomingMessage,
    toolName: string,
    id: JsonRpcId,
): JsonRpcResponsePayload | undefined => {
    if (!RESTRICTED_TOOLS.has(toolName)) {
        return undefined;
    }
    const adminHeader = getHeaderValue(req.headers["x-cortexdx-admin-token"]);
    if (!ADMIN_TOOL_TOKEN) {
        return createErrorResponse(
            id,
            -32011,
            `Tool ${toolName} is disabled until CORTEXDX_ADMIN_TOKEN is configured.`,
        );
    }
    if (!adminHeader || adminHeader !== ADMIN_TOOL_TOKEN) {
        return createErrorResponse(
            id,
            -32012,
            `Tool ${toolName} requires X-CORTEXDX-ADMIN-TOKEN.`,
        );
    }
    return undefined;
};

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) {
        return value[0];
    }
    return typeof value === "string" ? value : undefined;
};

if (SHOULD_LISTEN) {
    server.listen(PORT, HOST, () => {
        const baseUrl = `${tlsEnabled ? "https" : "http"}://${HOST}:${PORT}`;
        const providers = Object.keys(registry.getAllProviders()).join(', ');

        serverLogger.info({ baseUrl, providers, tlsEnabled }, `🚀 CortexDx Server running on ${baseUrl}`);
        serverLogger.info(`📚 Academic providers available: ${providers}`);
        serverLogger.info(`🌐 Web Interface: ${baseUrl}/`);

        // Log endpoints in a structured way
        const endpoints = [
            { method: 'GET', path: '/', description: 'Web Interface' },
            { method: 'GET', path: '/health', description: 'Health check (add ?detailed=true for full report)' },
            { method: 'GET', path: '/events', description: 'SSE real-time updates' },
            { method: 'GET', path: '/providers', description: 'List all providers' },
            { method: 'GET', path: '/capabilities', description: 'All provider capabilities' },
            { method: 'GET', path: '/health-checks', description: 'Provider health status' },
            { method: 'POST', path: '/mcp', description: 'MCP protocol endpoint' },
            { method: 'GET', path: '/providers/:id', description: 'Provider details' },
            { method: 'POST', path: '/providers/:id/execute', description: 'Execute provider tool' },
        ];

        const monitoringEndpoints = [
            { method: 'GET', path: '/monitoring/status', description: 'Monitoring system status' },
            { method: 'GET', path: '/monitoring/report', description: 'Comprehensive monitoring report' },
            { method: 'GET', path: '/monitoring/alerts', description: 'Current alerts' },
            { method: 'DELETE', path: '/monitoring/alerts', description: 'Clear alerts' },
            { method: 'POST', path: '/monitoring/control', description: 'Start/stop monitoring' },
        ];

        const selfHealingEndpoints = [
            { method: 'POST', path: '/api/v1/self-diagnose', description: 'Run self-diagnosis with optional auto-fix' },
            { method: 'GET', path: '/api/v1/health', description: 'Quick health check' },
            { method: 'GET', path: '/api/v1/templates', description: 'List available fix templates' },
            { method: 'POST', path: '/api/v1/templates/:id', description: 'Apply a fix template' },
            { method: 'POST', path: '/api/v1/monitor', description: 'Control background monitoring' },
        ];

        serverLogger.info({ endpoints }, 'Main endpoints available');
        serverLogger.info({ endpoints: monitoringEndpoints }, 'Monitoring API endpoints');
        serverLogger.info({ endpoints: selfHealingEndpoints }, 'Self-Healing API endpoints');

        // Start monitoring if enabled
        if (ENABLE_MONITORING) {
            const ctx = {
                endpoint: baseUrl,
                logger: (...args: unknown[]) => monitoringLogger.info({ data: args }, 'Monitoring log'),
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
