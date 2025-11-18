// apps/mcp-server/src/server.ts
// FastMCP server creation and tool registration

import { FastMCP } from "fastmcp";
import { z } from "zod";

export interface CreateServerOptions {
  logger?: Console | { log: (...args: unknown[]) => void };
}

/**
 * Create and configure a FastMCP server instance with tools
 */
export async function createServer(options: CreateServerOptions = {}): Promise<FastMCP> {
  const logger = options.logger ?? console;

  const server = new FastMCP({
    name: "CortexDx MCP Server",
    version: "1.0.0",
  });

  // Register tools
  registerTools(server, logger);

  logger.log("[MCP] Server instance created with tools registered");

  return server;
}

/**
 * Register all available tools on the server
 */
function registerTools(
  server: FastMCP,
  logger: Console | { log: (...args: unknown[]) => void }
): void {
  // Example: Health check tool
  server.addTool({
    name: "health_check",
    description: "Check the health status of the MCP server",
    parameters: z.object({}),
    execute: async () => {
      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      };
    },
  });

  // Example: Echo tool for testing
  server.addTool({
    name: "echo",
    description: "Echo back the provided message",
    parameters: z.object({
      message: z.string().describe("The message to echo back"),
    }),
    execute: async (args) => {
      logger.log(`[MCP] Echo tool called with message: ${args.message}`);
      return {
        echoed: args.message,
        timestamp: new Date().toISOString(),
      };
    },
  });

  // Example: Get server info tool
  server.addTool({
    name: "get_server_info",
    description: "Get information about the MCP server configuration",
    parameters: z.object({}),
    execute: async () => {
      return {
        name: "CortexDx MCP Server",
        version: "1.0.0",
        transport: "native-http",
        features: [
          "Native CORS support",
          "SSE streaming",
          "HTTP POST endpoints",
        ],
        note: "Running without Express/Proxy wrapper for improved performance",
      };
    },
  });

  logger.log("[MCP] Registered 3 tools: health_check, echo, get_server_info");
}
