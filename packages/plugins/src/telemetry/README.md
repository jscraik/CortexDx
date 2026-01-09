# CortexDx Telemetry Integration

This directory contains telemetry integration for CortexDx MCP server using Shinzo Labs instrumentation.

## Overview

The `@shinzolabs/instrumentation-mcp` package provides telemetry for MCP servers, but requires
`@modelcontextprotocol/sdk` version ^1.15.1 (currently you have 0.6.1). This implementation provides a
compatible telemetry solution that works with your current setup.

## Files

- `cortexdx-telemetry.ts` - Core telemetry implementation
- `telemetry-integration.ts` - Integration examples for your server
- `instrumented-mcp-server.ts` - Future SDK-based implementation
- `README.md` - This documentation

## Quick Start

### 1. Environment Setup

Set your telemetry token:
```bash
export SHINZO_TELEMETRY_TOKEN="your-secure-token"
```

Or disable telemetry:
```bash
export CORTEXDX_TELEMETRY_ENABLED="false"
```

### 2. Initialize Telemetry

In your `server.ts`, add at the top:
```typescript
import { setupTelemetry } from './telemetry/telemetry-integration.js';
```

Then initialize during server startup:
```typescript
if (SHOULD_LISTEN) {
    setupTelemetry(); // Add this line
    server.listen(PORT, HOST, () => {
        // ... your existing startup code
    });
}
```

### 3. Instrument Your Tools

Replace your existing tool handlers with instrumented versions:

```typescript
import { instrumentTool, recordMetric } from './telemetry/cortexdx-telemetry.js';

// Before:
const diagnoseMcpServer = async (args, ctx) => { /* ... */ };

// After:
const diagnoseMcpServer = instrumentTool('diagnose_mcp_server', async (args, ctx) => {
    recordMetric('diagnostic.started', 1, true, { endpoint: args.endpoint });
    // ... your existing logic
    recordMetric('diagnostic.completed', 1);
    return result;
});
```

### 4. Instrument JSON-RPC Handlers

```typescript
import { instrumentJsonRpc } from './telemetry/cortexdx-telemetry.js';

// In your handleJsonRpcCall function:
case "initialize":
    return instrumentJsonRpc('initialize', async () => {
        return createSuccessResponse(responseId, {
            protocolVersion: "2024-11-05",
            // ... your response
        });
    })();

case "tools/call":
    return instrumentJsonRpc('tools/call', () => handleToolsCall(req, params, responseId))();
```

## What Gets Tracked

The telemetry automatically collects:

- **Tool Executions**: Which tools are called, how often, and their success rates
- **Performance Metrics**: Execution times for tools and JSON-RPC methods  
- **Error Tracking**: Failed operations and error messages
- **Usage Patterns**: Popular tools and usage frequency
- **Server Health**: Response times and availability

## Data Format

Telemetry data sent to Shinzo includes:
```json
{
  "telemetry": [
    {
      "serverName": "cortexdx-mcp-server",
      "serverVersion": "1.0.0", 
      "method": "tool.diagnose_mcp_server",
      "duration": 1250,
      "success": true,
      "timestamp": "2025-11-15T10:30:00.000Z",
      "metadata": {
        "endpoint": "http://localhost:3000",
        "suites": 2
      }
    }
  ],
  "source": "cortexdx-custom"
}
```

## Future: Full SDK Integration

When you upgrade to `@modelcontextprotocol/sdk` ^1.15.1:

1. Install the official instrumentation:
   ```bash
   pnpm --filter @brainwav/cortexdx add @modelcontextprotocol/sdk@^1.15.1
   ```

2. Use the official Shinzo package:
   ```typescript
   import { instrumentServer } from "@shinzolabs/instrumentation-mcp";
   import { Server } from "@modelcontextprotocol/sdk/server/index.js";

   const server = new Server({
     name: "cortexdx-mcp-server",
     version: "1.0.0"
   });

   instrumentServer(server, {
     serverName: "cortexdx-mcp-server",
     serverVersion: "1.0.0",
     exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
     exporterAuth: {
       type: "bearer",
       token: process.env.SHINZO_TELEMETRY_TOKEN
     }
   });
   ```

3. Replace your JSON-RPC handlers with `server.tool()` registrations

## Configuration

### Environment Variables

- `SHINZO_TELEMETRY_TOKEN` - Your telemetry API token (required)
- `CORTEXDX_TELEMETRY_ENABLED` - Set to "false" to disable (default: true)
- `NODE_ENV` - Set to "test" to disable telemetry in tests

### Telemetry Config

```typescript
{
  serverName: "cortexdx-mcp-server",
  serverVersion: "1.0.0", 
  exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
  exporterAuth: {
    type: "bearer",
    token: "your-token"
  },
  enabled: true
}
```

## Privacy & Security

- Telemetry data includes timing and usage metrics only
- No sensitive user data or content is transmitted
- Authentication tokens and secrets are never logged
- Data is sent to Shinzo Labs' secure telemetry endpoint
- You can disable telemetry entirely with `CORTEXDX_TELEMETRY_ENABLED=false`

## Troubleshooting

### Telemetry Not Working

1. Check your token: `echo $SHINZO_TELEMETRY_TOKEN`
2. Verify network access to: `https://api.app.shinzo.ai/telemetry/ingest_http`
3. Check console for telemetry errors
4. Ensure `CORTEXDX_TELEMETRY_ENABLED` is not set to "false"

### High Memory Usage

The telemetry queue is limited to 50 items. If you see warnings:
1. Check network connectivity to the telemetry endpoint
2. Verify your authentication token is valid
3. Consider reducing telemetry frequency for high-volume tools

### SDK Version Conflicts

If you see peer dependency warnings:
1. The custom telemetry (current implementation) works without SDK upgrade
2. For full Shinzo integration, upgrade: `pnpm add @modelcontextprotocol/sdk@^1.15.1`
3. Both approaches provide equivalent telemetry data

## Support

For questions about:
- **CortexDx integration**: Check your project documentation
- **Shinzo telemetry**: Visit [Shinzo Labs documentation](https://docs.shinzo.ai)
- **MCP Protocol**: See [Model Context Protocol docs](https://modelcontextprotocol.io)
