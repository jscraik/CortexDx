/**
 * Example instrumented MCP server using @shinzolabs/instrumentation-mcp
 * 
 * This demonstrates how to add telemetry instrumentation to an MCP server
 * using the Shinzo Labs instrumentation package.
 */

import { instrumentServer } from "@shinzolabs/instrumentation-mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Create and configure an instrumented MCP server
 * 
 * @example
 * ```typescript
 * const server = createInstrumentedMcpServer();
 * // Server is now automatically instrumented with telemetry
 * ```
 */
export async function createInstrumentedMcpServer() {
    // Create the MCP server instance using high-level API
    const server = new McpServer({
        name: "cortexdx-mcp-server",
        version: "1.0.0"
    });

    // Add instrumentation BEFORE registering tools
    instrumentServer(server, {
        serverName: "cortexdx-mcp-server",
        serverVersion: "1.0.0",
        exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
        exporterAuth: {
            type: "bearer",
            token: process.env.SHINZO_TELEMETRY_TOKEN || "38a0a136a9aab7d73ee3172b01b25d89"
        }
    });

    // Register tools using the high-level API
    server.registerTool(
        "cortexdx_diagnose",
        {
            title: "Diagnose MCP Server",
            description: "Diagnose MCP server issues",
            inputSchema: {
                endpoint: z.string().describe("MCP server endpoint to diagnose"),
                suites: z.array(z.string()).optional().describe("Diagnostic suites to run")
            },
            outputSchema: {
                status: z.string(),
                endpoint: z.string(),
                timestamp: z.string()
            }
        },
        async ({ endpoint }) => {
            const output = {
                status: "diagnosed",
                endpoint,
                timestamp: new Date().toISOString()
            };
            
            return {
                content: [{
                    type: "text",
                    text: `Diagnosing ${endpoint}...`
                }],
                structuredContent: output
            };
        }
    );

    server.registerTool(
        "cortexdx_health",
        {
            title: "Health Check",
            description: "Check server health",
            inputSchema: {},
            outputSchema: {
                status: z.string(),
                timestamp: z.string()
            }
        },
        async () => {
            const output = {
                status: "healthy",
                timestamp: new Date().toISOString()
            };
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(output, null, 2)
                }],
                structuredContent: output
            };
        }
    );

    return server;
}

/**
 * Integration guide for adding instrumentation to existing CortexDx server
 * 
 * To add telemetry to your existing server.ts implementation:
 * 
 * 1. Upgrade the MCP SDK:
 *    pnpm --filter @brainwav/cortexdx add @modelcontextprotocol/sdk@^1.15.1
 * 
 * 2. Migrate to the high-level McpServer API:
 *    ```typescript
 *    import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 *    import { instrumentServer } from "@shinzolabs/instrumentation-mcp";
 *    
 *    const server = new McpServer({ 
 *      name: "cortexdx", 
 *      version: "1.0.0" 
 *    });
 *    
 *    // Instrument the high-level server instance
 *    instrumentServer(server, {
 *      serverName: "cortexdx-mcp-server",
 *      serverVersion: "1.0.0", 
 *      exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
 *      exporterAuth: {
 *        type: "bearer",
 *        token: process.env.SHINZO_TELEMETRY_TOKEN
 *      }
 *    });
 *    
 *    // Register tools with server.registerTool(...)
 *    ```
 * 
 * 3. Set environment variable:
 *    export SHINZO_TELEMETRY_TOKEN="your-token"
 * 
 * The instrumentation will automatically track:
 * - Tool execution metrics
 * - Performance data
 * - Error rates
 * - Usage patterns
 */

export const INTEGRATION_STEPS = [
    "1. Upgrade @modelcontextprotocol/sdk to ^1.15.1",
    "2. Migrate to McpServer high-level API",
    "3. Instrument McpServer instance directly before tool registration", 
    "4. Configure SHINZO_TELEMETRY_TOKEN environment variable",
    "5. Register tools using server.registerTool() method"
];

export const TELEMETRY_CONFIG = {
    serverName: "cortexdx-mcp-server",
    serverVersion: "1.0.0",
    exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
    defaultToken: "38a0a136a9aab7d73ee3172b01b25d89" // Demo token from your snippet
} as const;

/**
 * Example standalone server that can be run directly
 */
async function runInstrumentedServer() {
    const server = await createInstrumentedMcpServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.log('🎯 Instrumented CortexDx MCP server started with telemetry');
}

// Run if this file is executed directly
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('instrumented-mcp-server.ts')) {
    runInstrumentedServer().catch(console.error);
}
