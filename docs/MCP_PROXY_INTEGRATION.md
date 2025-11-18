# MCP Server Architecture - Simplified Native Transport

## Overview

This MCP server uses FastMCP's native HTTP transport (v3.23.0+), eliminating the need for the previous Express/Proxy wrapper architecture.

## Previous Architecture (Deprecated)

The old "Russian Doll" architecture (FastMCP inside mcp-proxy inside Express) was implemented as a polyfill for features that earlier MCP SDK versions did not support:

- **Browser Compatibility (CORS)**: FastMCP didn't natively handle CORS headers
- **Session Handshakes**: Raw MCP required complex 3-step handshake automation
- **Dual Transport**: Support for both SSE and HTTP POST endpoints

## Current Architecture (Native)

FastMCP v3.23.0+ natively supports all previously proxied features:

- Native CORS configuration
- Automatic SSE streaming endpoints
- HTTP POST message handling
- Session management

### Benefits

- **Performance**: Reduced latency (removes 2 extra HTTP hops per request)
- **Stability**: Eliminates socket hang up risks from http-proxy-middleware
- **Maintainability**: ~200 fewer lines of networking code
- **Standardization**: Strictly compliant with official MCP HTTP transport spec

## Configuration

### Environment Variables

```bash
# Server Configuration
MCP_HTTP_PORT=2001        # Port for the MCP server
MCP_HTTP_HOST=0.0.0.0     # Host to bind to
MCP_CORS_ORIGIN=*         # CORS origin (use comma-separated list for multiple)
```

### Removed Variables (No Longer Used)

```bash
# These are deprecated and should be removed:
# MCP_USE_PROXY=true
# MCP_PROXY_PORT_OFFSET=1000
# MCP_INTERNAL_PORT_OFFSET=1000
```

## Endpoints

When the server starts, the following endpoints are automatically available:

- **Main Endpoint**: `http://host:port/mcp`
- **SSE Streaming**: Automatic (handled by FastMCP)
- **POST Messages**: Automatic (handled by FastMCP)

## Dependencies

The simplified server only requires:

- `fastmcp`: ^3.23.0 - Core MCP server framework
- `zod`: ^3.22.0 - Schema validation for tool parameters

### Removed Dependencies

The following packages are no longer needed:

- `express`
- `http-proxy-middleware`
- `mcp-proxy`
- `body-parser`
- `@types/express`
- `@types/http-proxy-middleware`

## Usage

```typescript
import { startServer } from "@cortexdx/mcp-server";

// Start with defaults
const server = await startServer();

// Or with custom configuration
const server = await startServer({
  port: 3000,
  host: "localhost",
  endpoint: "/api/mcp",
});

// Stop when done
await server.stop();
```

## Client Compatibility

This server is compatible with:

- Claude Desktop
- Smithery CLI
- Any MCP-compliant client
- Web browsers (via CORS-enabled endpoints)
