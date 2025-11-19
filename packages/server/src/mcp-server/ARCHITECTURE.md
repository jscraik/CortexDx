# Modular FastMCP Server Architecture

## Overview

This architecture refactors the existing `server-fastmcp.ts` into a modular, plugin-based design that:
- Conforms to MCP RC 2025-06-18 + Draft specification
- Supports multiple transports (httpStreamable, stdio, WebSocket)
- Uses a formal plugin system for extensibility
- Reuses existing CortexDx infrastructure

## Directory Structure

```
src/mcp-server/
├── core/
│   ├── server.ts          # Main server orchestrator
│   ├── protocol.ts        # Protocol version & compliance
│   ├── schema-converter.ts # JSON Schema to Zod (fixed)
│   └── errors.ts          # Centralized error codes
├── transports/
│   ├── types.ts           # Transport interface
│   ├── http-streamable.ts # HTTP Streamable transport
│   ├── stdio.ts           # STDIO transport
│   └── websocket.ts       # WebSocket transport
├── plugins/
│   ├── types.ts           # Server plugin interface
│   ├── registry.ts        # Plugin registry
│   ├── auth.ts            # Reuses plugins/auth-middleware
│   ├── license.ts         # Reuses plugins/license-enforcement
│   └── cors.ts            # Reuses plugins/cors
└── index.ts               # Public exports
```

## Core Components

### 1. Server Orchestrator (`core/server.ts`)

```typescript
export interface McpServerConfig {
  name: string;
  version: string;
  protocolVersion?: string; // Default: "2025-06-18"
  transport: TransportConfig;
  plugins?: ServerPlugin[];
}

export class McpServer {
  constructor(config: McpServerConfig);

  // Plugin management
  use(plugin: ServerPlugin): this;

  // Tool/Resource registration (reuses existing)
  addTool(tool: McpTool): this;
  addResource(resource: McpResource): this;
  addPrompt(prompt: McpPrompt): this;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

### 2. Transport Abstraction (`transports/types.ts`)

```typescript
export interface Transport {
  readonly type: 'httpStreamable' | 'stdio' | 'websocket';

  start(handler: RequestHandler): Promise<void>;
  stop(): Promise<void>;

  // RC compliance
  setProtocolVersion(version: string): void;
}

export interface TransportConfig {
  type: 'httpStreamable' | 'stdio' | 'websocket';

  // HTTP Streamable options
  httpStreamable?: {
    port: number;
    host?: string;
    cors?: CorsConfig;
  };

  // STDIO options
  stdio?: {
    // No special config needed
  };

  // WebSocket options
  websocket?: {
    port: number;
    host?: string;
    path?: string;
  };
}
```

### 3. Plugin System (`plugins/types.ts`)

```typescript
export interface ServerPlugin {
  name: string;
  version?: string;

  // Lifecycle hooks
  onLoad?(server: McpServer): Promise<void>;
  onUnload?(server: McpServer): Promise<void>;

  // Request hooks
  onRequest?(ctx: RequestContext): Promise<void | Response>;
  onResponse?(ctx: RequestContext, response: Response): Promise<Response>;
  onError?(ctx: RequestContext, error: Error): Promise<Response>;

  // Tool hooks
  onToolCall?(toolName: string, args: unknown): Promise<void>;
  onToolResult?(toolName: string, result: unknown): Promise<unknown>;

  // Resource hooks
  onResourceRead?(uri: string): Promise<void>;
}

// Reuse existing middleware as plugins
export function createAuthPlugin(config: AuthConfig): ServerPlugin;
export function createLicensePlugin(config: LicenseConfig): ServerPlugin;
export function createCorsPlugin(config: CorsConfig): ServerPlugin;
```

## Implementation Plan

### Phase 1: Core Types & Protocol (This PR)

1. **Create type definitions** - `transports/types.ts`, `plugins/types.ts`
2. **Protocol compliance module** - `core/protocol.ts`
   - Protocol version 2025-06-18
   - MCP-Protocol-Version header
   - No JSON-RPC batching
3. **Fixed schema converter** - `core/schema-converter.ts`
   - Recursive conversion
   - Proper array/object handling
   - No `.passthrough()`

### Phase 2: Transports

1. **HTTP Streamable** - Refactor from current FastMCP
2. **STDIO** - Add for CLI usage
3. **WebSocket** - Add for real-time apps

### Phase 3: Plugin Migration

1. **Auth plugin** - Wrap `plugins/auth-middleware.ts`
2. **License plugin** - Wrap `plugins/license-enforcement.ts`
3. **CORS plugin** - Wrap `plugins/cors.ts`

### Phase 4: Server Integration

1. **Refactor server-fastmcp.ts** to use new modules
2. **Deprecate legacy patterns**
3. **Add examples**

## Usage Example

```typescript
import { McpServer, createAuthPlugin, createLicensePlugin } from './mcp-server';
import { getAllMcpToolsFlat } from './tools';
import { httpStreamable, websocket } from './mcp-server/transports';

// Create server
const server = new McpServer({
  name: 'CortexDx Server',
  version: '2.0.0',
  protocolVersion: '2025-06-18',
  transport: {
    type: 'httpStreamable',
    httpStreamable: {
      port: 5001,
      host: '127.0.0.1',
    },
  },
});

// Add plugins
server
  .use(createAuthPlugin({
    auth0: { domain: AUTH0_DOMAIN, clientId: AUTH0_CLIENT_ID },
    requireAuth: REQUIRE_AUTH,
  }))
  .use(createLicensePlugin({
    licenseDatabase,
    requireLicense: REQUIRE_LICENSE,
  }));

// Register tools (reuse existing)
for (const tool of getAllMcpToolsFlat()) {
  server.addTool(tool);
}

// Start server
await server.start();
```

## RC Compliance Features

### Already Implemented (in existing code)
- [x] JSON-RPC 2.0 messaging
- [x] Initialize handshake
- [x] Tools (list/call)
- [x] Resources (list/read)
- [x] OAuth/JWT authentication

### To Implement
- [ ] Protocol version 2025-06-18
- [ ] MCP-Protocol-Version header
- [ ] No JSON-RPC batching
- [ ] HTTP 403 for invalid Origin
- [ ] Input validation as Tool Execution Errors
- [ ] Structured tool output
- [ ] Elicitation support
- [ ] Resource links in tool results
- [ ] Progress notifications
- [ ] Cancellation support

## Reused Infrastructure

| Component | Location | Usage |
|-----------|----------|-------|
| Tool definitions | `tools/index.ts` | Direct reuse |
| Resource stores | `resources/*.ts` | Direct reuse |
| Auth middleware | `plugins/auth-middleware.ts` | Wrapped as plugin |
| License enforcement | `plugins/license-enforcement.ts` | Wrapped as plugin |
| Diagnostic context | `context/context-factory.ts` | Direct reuse |
| Logger | `logging/logger.ts` | Direct reuse |
| Config | `server/config.ts` | Direct reuse |
| Diagnostic plugins | `plugins/*.ts` | Separate system |

## Migration Path

1. **New code** in `src/mcp-server/`
2. **server-fastmcp.ts** refactored to use new modules
3. **server.ts** (legacy) marked deprecated
4. **Tests** updated for new architecture
5. **Documentation** updated

## Notes

- Diagnostic plugins (`plugin-host.ts`) are separate from server plugins
- Server plugins handle request/response lifecycle
- Diagnostic plugins analyze MCP server behavior
- Both systems coexist and serve different purposes
