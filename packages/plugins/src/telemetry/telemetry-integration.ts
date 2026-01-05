/**
 * Integration example: Adding telemetry to existing CortexDx server
 *
 * This shows how to integrate the custom telemetry with your existing server.ts
 * without requiring the MCP SDK upgrade.
 */

import {
  initializeTelemetry,
  instrumentTool,
  instrumentJsonRpc,
  recordMetric,
} from "./cortexdx-telemetry.js";

type TelemetryOverrides = {
  enabled?: boolean;
  exporterEndpoint?: string;
  serverName?: string;
  serverVersion?: string;
  token?: string;
};

function requireTelemetryToken(token?: string) {
  const resolved = token ?? process.env.SHINZO_TELEMETRY_TOKEN;

  if (!resolved) {
    throw new Error(
      "SHINZO_TELEMETRY_TOKEN is required when telemetry is enabled",
    );
  }

  return resolved;
}

// Initialize telemetry at server startup
export function setupTelemetry(overrides: TelemetryOverrides = {}) {
  const enabled =
    overrides.enabled ?? process.env.CORTEXDX_TELEMETRY_ENABLED !== "false";

  if (!enabled) {
    return null;
  }

  const telemetry = initializeTelemetry({
    serverName: overrides.serverName ?? "cortexdx-mcp-server",
    serverVersion: overrides.serverVersion ?? "1.0.0",
    exporterEndpoint:
      overrides.exporterEndpoint ??
      "https://api.app.shinzo.ai/telemetry/ingest_http",
    exporterAuth: {
      type: "bearer",
      token: requireTelemetryToken(overrides.token),
    },
    enabled,
  });

  console.log("📊 Telemetry initialized for CortexDx MCP server");
  return telemetry;
}

// Example: Instrument your existing tool handlers
export const createInstrumentedDevelopmentTools = () => {
  const diagnoseMcpServer = instrumentTool(
    "diagnose_mcp_server",
    async (args: unknown, ctx: unknown) => {
      const {
        endpoint,
        suites = [],
        full = false,
      } = args as {
        endpoint: string;
        suites?: string[];
        full?: boolean;
      };

      // Your existing implementation with added metrics
      recordMetric("diagnostic.started", 1, true, {
        endpoint,
        suites: suites.length,
        full,
      });

      // Simulate your existing runPlugins call
      const results = {
        findings: [],
        summary: `Diagnosed ${endpoint}`,
        timestamp: new Date().toISOString(),
      };

      recordMetric("diagnostic.findings", results.findings.length);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );

  const startConversation = instrumentTool(
    "start_conversation",
    async (args: unknown) => {
      const { intent, context } = args as { intent: string; context?: string };

      recordMetric("conversation.started", 1, true, { intent });

      const session = {
        id: `session-${Date.now()}`,
        intent,
        context,
        timestamp: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(session, null, 2),
          },
        ],
      };
    },
  );

  const validateLicense = instrumentTool(
    "validate_license",
    async (args: unknown) => {
      const { content, provider } = args as {
        content: string;
        provider?: string;
      };

      recordMetric("license.validation", 1, true, { provider });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                isValid: true,
                license: "Apache-2.0",
                restrictions: [],
                recommendations: [],
                riskLevel: "low",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return {
    diagnoseMcpServer,
    startConversation,
    validateLicense,
  };
};

// Example: Instrument JSON-RPC handlers
export const createInstrumentedJsonRpcHandlers = () => {
  const handleInitialize = instrumentJsonRpc(
    "initialize",
    async (responseId: unknown) => {
      recordMetric("handshake.initialize", 1);

      return {
        jsonrpc: "2.0",
        id: responseId,
        result: {
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
        },
      };
    },
  );

  const handleToolsList = instrumentJsonRpc(
    "tools/list",
    async (responseId: unknown) => {
      recordMetric("tools.list", 1);

      // Your existing getJsonRpcToolList() logic
      const tools = [
        { name: "cortexdx_diagnose", description: "Diagnose MCP server" },
        { name: "cortexdx_health", description: "Check server health" },
      ];

      return {
        jsonrpc: "2.0",
        id: responseId,
        result: { tools },
      };
    },
  );

  const handleToolsCall = instrumentJsonRpc(
    "tools/call",
    async (params: unknown, responseId: unknown) => {
      const { name, arguments: args } = params as {
        name: string;
        arguments?: unknown;
      };

      recordMetric("tools.call", 1, true, { toolName: name });

      // Your existing tool execution logic
      const result = {
        content: [
          {
            type: "text",
            text: `Executed tool: ${name}`,
          },
        ],
      };

      return {
        jsonrpc: "2.0",
        id: responseId,
        result,
      };
    },
  );

  return {
    handleInitialize,
    handleToolsList,
    handleToolsCall,
  };
};

// Integration instructions for your server.ts
export const INTEGRATION_INSTRUCTIONS = `
To integrate this telemetry into your existing server.ts:

1. Import the telemetry functions at the top:
   import { setupTelemetry, createInstrumentedDevelopmentTools } from './telemetry/telemetry-integration.js';

2. Initialize telemetry in your server startup:
   if (SHOULD_LISTEN) {
       setupTelemetry();
       server.listen(PORT, HOST, () => {
           // ... existing startup code
       });
   }

3. Replace your tool handlers with instrumented versions:
   const instrumentedTools = createInstrumentedDevelopmentTools();
   // Use instrumentedTools.diagnoseMcpServer instead of your current diagnoseMcpServer

4. Set the environment variable:
   export SHINZO_TELEMETRY_TOKEN="your-token-here"

5. Optionally disable telemetry:
   export CORTEXDX_TELEMETRY_ENABLED="false"

This will provide you with:
- Tool execution metrics 
- Performance timing
- Error tracking
- Usage analytics

All sent to the Shinzo telemetry endpoint for analysis.
`;

// Environment configuration
export const ENV_VARS = {
  SHINZO_TELEMETRY_TOKEN: process.env.SHINZO_TELEMETRY_TOKEN,
  CORTEXDX_TELEMETRY_ENABLED:
    process.env.CORTEXDX_TELEMETRY_ENABLED !== "false",
  TELEMETRY_ENDPOINT: "https://api.app.shinzo.ai/telemetry/ingest_http",
};
