// apps/mcp-server/src/index.ts
// Simplified FastMCP server using native HTTP transport (no Express/Proxy wrapper)

import { FastMCP } from "fastmcp";
import { createServer } from "./server";

// Type definitions
export interface StartServerOptions {
  port?: number;
  host?: string;
  endpoint?: string;
  server?: FastMCP;
  logger?: Console | { log: (...args: unknown[]) => void };
}

export interface StartedServer {
  server: FastMCP;
  transport: string;
  port: number;
  host: string;
  endpoint: `/${string}`;
  useProxy: boolean;
  stop: () => Promise<void>;
}

/**
 * Resolves the HTTP port from environment variables or returns default
 */
function resolveHttpPort(): number {
  const envPort = process.env.MCP_HTTP_PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      return parsed;
    }
  }
  return 2001; // Default port
}

/**
 * Start the MCP server using native FastMCP HTTP transport
 *
 * This implementation removes the Express/Proxy wrapper and uses FastMCP's
 * native HTTP transport which supports SSE, CORS, and POST requests natively.
 */
export async function startServer(options: StartServerOptions = {}): Promise<StartedServer> {
  const logger = options.logger ?? console;

  // 1. Initialize the FastMCP Server
  const server = options.server ?? (await createServer({ logger }));

  // 2. Resolve Configuration
  const port = options.port ?? resolveHttpPort();
  const host = options.host ?? process.env.MCP_HTTP_HOST ?? "0.0.0.0";
  const endpoint = options.endpoint ?? "/mcp";

  // 3. Parse CORS configuration
  const corsOrigin = process.env.MCP_CORS_ORIGIN;
  const origin = corsOrigin === "*"
    ? "*"
    : (corsOrigin?.split(",").map(s => s.trim()).filter(Boolean) || ["*"]);

  // 4. Start using NATIVE FastMCP HTTP Transport
  // This automatically handles SSE, CORS, and POST requests
  await server.start({
    transportType: "http",
    http: {
      port,
      host,
      endpoint,
      cors: {
        origin,
        allowCredentials: true,
      }
    },
  });

  logger.log(`[MCP] Server running natively at http://${host}:${port}${endpoint}`);
  logger.log(`[MCP] - SSE Endpoint: /sse (Automatic)`);
  logger.log(`[MCP] - POST Endpoint: /message (Automatic)`);

  return {
    server,
    transport: "http",
    port,
    host,
    endpoint: endpoint as `/${string}`,
    useProxy: false, // Deprecated flag - proxy layer removed
    stop: () => server.stop(),
  };
}

// Main entry point
if (require.main === module) {
  startServer()
    .then((result) => {
      console.log(`[MCP] Server started successfully on port ${result.port}`);
    })
    .catch((error) => {
      console.error("[MCP] Failed to start server:", error);
      process.exit(1);
    });
}

export { createServer } from "./server";
