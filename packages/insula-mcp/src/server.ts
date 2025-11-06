#!/usr/bin/env node

/**
 * Insula MCP Server
 * HTTP server that exposes the academic research providers as MCP endpoints
 */

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { ConversationManager } from "./conversation/manager.js";
import { createLlmOrchestrator } from "./ml/index.js";
import { runPlugins } from "./plugin-host.js";
import { getAcademicRegistry } from "./registry/index.js";
import { findMcpTool, getAllMcpToolsFlat } from "./tools/index.js";
import type { DevelopmentContext, DiagnosticContext, McpTool, McpToolResult } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5000;
const HOST = process.env.HOST || "127.0.0.1";

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
        default:
            throw new Error(`Unknown development tool: ${tool.name}`);
    }
};

// Development tool implementations
const diagnoseMcpServer = async (args: unknown, ctx: DevelopmentContext): Promise<McpToolResult> => {
    const { endpoint, suites = [], full = false } = args as { endpoint: string; suites?: string[]; full?: boolean };

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
const conversationManager = new ConversationManager();
const llmOrchestrator = createLlmOrchestrator();

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
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

    try {
        // Serve web interface
        if (path === '/') {
            const served = await serveStaticFile('index.html', res);
            if (served) return;
        }

        // Serve static web assets
        if (path.startsWith('/web/')) {
            const filePath = path.substring(5); // Remove '/web/' prefix
            const served = await serveStaticFile(filePath, res);
            if (served) return;
        }

        // SSE endpoint for real-time updates
        if (path === '/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            sseClients.add(res);

            // Send initial connection event
            res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

            // Clean up on client disconnect
            req.on('close', () => {
                sseClients.delete(res);
            });

            return;
        }

        // Health check endpoint
        if (path === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                service: 'Insula MCP Server',
                version: '1.0.0',
                providers: Object.keys(registry.getAllProviders()),
                timestamp: new Date().toISOString()
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
        if (path === '/mcp' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', async () => {
                try {
                    const request = JSON.parse(body);

                    // Handle MCP initialize
                    if (request.method === 'initialize') {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id,
                            result: {
                                protocolVersion: '2024-11-05',
                                capabilities: {
                                    tools: {},
                                    resources: {},
                                    prompts: {}
                                },
                                serverInfo: {
                                    name: 'Insula MCP Server',
                                    version: '1.0.0'
                                }
                            }
                        }));
                        return;
                    }

                    // Handle tools/list
                    if (request.method === 'tools/list') {
                        const allCapabilities = registry.getAllCapabilities();
                        const academicTools = Object.values(allCapabilities).flatMap(cap => cap.tools);
                        const mcpTools = allMcpTools.map(tool => ({
                            name: tool.name,
                            description: tool.description,
                            inputSchema: tool.inputSchema
                        }));

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            jsonrpc: '2.0',
                            id: request.id,
                            result: { tools: [...academicTools, ...mcpTools] }
                        }));
                        return;
                    }

                    // Handle tools/call
                    if (request.method === 'tools/call') {
                        const { name, arguments: args } = request.params;

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
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: { code: -32601, message: `Method not found: ${request.method}` }
                    }));
                } catch (error) {
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

server.listen(PORT, HOST, () => {
    console.log(`🚀 Insula MCP Server running on http://${HOST}:${PORT}`);
    console.log(`📚 Academic providers available: ${Object.keys(registry.getAllProviders()).join(', ')}`);
    console.log(`🌐 Web Interface: http://${HOST}:${PORT}/`);
    console.log("\nEndpoints:");
    console.log("  GET  /              - Web Interface");
    console.log("  GET  /health        - Health check");
    console.log("  GET  /events        - SSE real-time updates");
    console.log("  GET  /providers     - List all providers");
    console.log("  GET  /capabilities  - All provider capabilities");
    console.log("  GET  /health-checks - Provider health status");
    console.log("  POST /mcp           - MCP protocol endpoint");
    console.log("  GET  /providers/:id - Provider details");
    console.log("  POST /providers/:id/execute - Execute provider tool");
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});