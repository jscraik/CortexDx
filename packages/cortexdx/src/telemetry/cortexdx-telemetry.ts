/**
 * Telemetry wrapper for existing CortexDx server
 * 
 * This provides basic telemetry functionality similar to @shinzolabs/instrumentation-mcp
 * without requiring the MCP SDK upgrade.
 */

interface TelemetryData {
    serverName: string;
    serverVersion: string;
    method: string;
    duration: number;
    success: boolean;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

interface TelemetryConfig {
    serverName: string;
    serverVersion: string;
    exporterEndpoint: string;
    exporterAuth: {
        type: "bearer";
        token: string;
    };
    enabled?: boolean;
}

/**
 * Simple telemetry client for CortexDx
 */
export class CortexDxTelemetry {
    private config: TelemetryConfig;
    private queue: TelemetryData[] = [];
    private flushTimer?: NodeJS.Timeout;

    constructor(config: TelemetryConfig) {
        this.config = {
            enabled: process.env.NODE_ENV !== "test",
            ...config
        };

        // Flush telemetry data every 30 seconds
        if (this.config.enabled) {
            this.flushTimer = setInterval(() => this.flush(), 30000);
        }
    }

    /**
     * Record a tool execution
     */
    recordTool(method: string, duration: number, success: boolean, metadata?: Record<string, unknown>) {
        if (!this.config.enabled) return;

        this.queue.push({
            serverName: this.config.serverName,
            serverVersion: this.config.serverVersion,
            method,
            duration,
            success,
            timestamp: new Date().toISOString(),
            metadata
        });

        // Flush immediately if queue is getting large
        if (this.queue.length >= 10) {
            this.flush();
        }
    }

    /**
     * Create a timing wrapper for functions
     */
    withTiming<T>(method: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
        const start = Date.now();
        
        return fn()
            .then(result => {
                this.recordTool(method, Date.now() - start, true, metadata);
                return result;
            })
            .catch(error => {
                this.recordTool(method, Date.now() - start, false, { 
                    ...metadata, 
                    error: error.message 
                });
                throw error;
            });
    }

    /**
     * Flush telemetry data to the endpoint
     */
    private async flush() {
        if (this.queue.length === 0) return;

        const data = [...this.queue];
        this.queue = [];

        try {
            await fetch(this.config.exporterEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.exporterAuth.token}`
                },
                body: JSON.stringify({
                    telemetry: data,
                    source: 'cortexdx-custom'
                })
            });
        } catch (error) {
            console.error('Failed to send telemetry:', error);
            // Re-queue the data for retry (with a limit to prevent memory leaks)
            if (this.queue.length < 50) {
                this.queue.unshift(...data);
            }
        }
    }

    /**
     * Shutdown and flush remaining data
     */
    async shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        await this.flush();
    }
}

// Global telemetry instance
let telemetry: CortexDxTelemetry | null = null;

/**
 * Initialize telemetry for CortexDx server
 */
export function initializeTelemetry(config: TelemetryConfig): CortexDxTelemetry {
    telemetry = new CortexDxTelemetry(config);
    
    // Graceful shutdown
    process.on('SIGTERM', () => telemetry?.shutdown());
    process.on('SIGINT', () => telemetry?.shutdown());
    
    return telemetry;
}

/**
 * Get the global telemetry instance
 */
export function getTelemetry(): CortexDxTelemetry | null {
    return telemetry;
}

/**
 * Decorator for instrumenting tool functions
 * 
 * @example
 * ```typescript
 * const instrumentedHandler = instrumentTool('my_tool', async (args) => {
 *   // Your tool implementation
 *   return { content: [{ type: 'text', text: 'result' }] };
 * });
 * ```
 */
export function instrumentTool<T extends (...args: unknown[]) => Promise<unknown>>(
    toolName: string,
    handler: T,
    metadata?: Record<string, unknown>
): T {
    return (async (...args: Parameters<T>) => {
        const telemetryInstance = getTelemetry();
        if (!telemetryInstance) {
            return handler(...args);
        }

        return telemetryInstance.withTiming(
            `tool.${toolName}`,
            () => handler(...args),
            metadata
        );
    }) as T;
}

/**
 * Instrument JSON-RPC method handlers
 */
export function instrumentJsonRpc<T extends (...args: unknown[]) => Promise<unknown>>(
    method: string,
    handler: T
): T {
    return instrumentTool(`jsonrpc.${method}`, handler) as T;
}

/**
 * Record custom metrics
 */
export function recordMetric(
    name: string, 
    value: number, 
    success = true, 
    metadata?: Record<string, unknown>
) {
    getTelemetry()?.recordTool(name, value, success, metadata);
}

// Example usage with the current server architecture
export const USAGE_EXAMPLE = `
// In your server.ts file:

import { initializeTelemetry, instrumentTool, instrumentJsonRpc } from './instrumented-cortexdx.js';

// Initialize telemetry
const telemetry = initializeTelemetry({
    serverName: "cortexdx-mcp-server", 
    serverVersion: "1.0.0",
    exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
    exporterAuth: {
        type: "bearer",
        token: process.env.SHINZO_TELEMETRY_TOKEN || "38a0a136a9aab7d73ee3172b01b25d89"
    }
});

// Instrument your tool handlers:
const diagnoseMcpServer = instrumentTool('diagnose_mcp_server', async (args, ctx) => {
    // Your existing implementation
    const results = await runPlugins({
        endpoint: args.endpoint,
        suites: args.suites,
        full: args.full,
        deterministic: ctx.deterministic || false,
        budgets: { timeMs: 30000, memMb: 256 }
    });
    
    return {
        content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
        }]
    };
});

// Instrument JSON-RPC handlers:
async function handleJsonRpcCall(payload, req) {
    const { method } = payload;
    
    switch (method) {
        case "initialize":
            return instrumentJsonRpc('initialize', async () => {
                return createSuccessResponse(responseId, {
                    protocolVersion: "2024-11-05",
                    capabilities: { tools: {}, resources: { list: true, read: true }, prompts: {} },
                    serverInfo: { name: "CortexDx Server", version: "1.0.0" }
                });
            })();
        
        case "tools/call":
            return instrumentJsonRpc('tools/call', () => handleToolsCall(req, params, responseId))();
        
        // ... other cases
    }
}
`;
