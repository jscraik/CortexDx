# FastMCP Server Examples

Examples demonstrating FastMCP-aligned MCP server implementation with plugin support.

## Basic Example

See `basic-fastmcp-server.ts` for a complete example showing:

- ✅ FastMCP native configuration (instructions, authenticate)
- ✅ Direct access to FastMCP instance (`server.fastMCP`)
- ✅ Tools with Zod schemas (no JSON Schema conversion needed)
- ✅ Streaming output with `ctx.streamContent`
- ✅ Progress reporting with `ctx.reportProgress`
- ✅ Per-tool authorization with `canAccess`
- ✅ Scoped logging with `ctx.log`
- ✅ Tool annotations (streamingHint, title, etc.)
- ✅ Session event handlers (connect, disconnect)
- ✅ Stateless mode support (for serverless)

## Running the Example

```bash
# Install dependencies
pnpm install

# Run the example
pnpm tsx examples/basic-fastmcp-server.ts
```

The server will start on `http://localhost:3000/mcp`.

## Testing Tools

### Using curl

```bash
# Simple tool call
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "hello",
      "arguments": {"name": "World"}
    }
  }'

# Streaming tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "stream_data",
      "arguments": {"count": 5}
    }
  }'

# Progress reporting
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "progress_task",
      "arguments": {"duration": 5}
    }
  }'

# Admin-only tool (requires demo-key)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "admin_action",
      "arguments": {"action": "test"}
    }
  }'

# Try with user-key (should fail for admin_action)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: user-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "admin_action",
      "arguments": {"action": "test"}
    }
  }'
```

## API Keys

The example uses simple demo authentication:

- `demo-key` - Admin role (can access all tools)
- `user-key` - User role (cannot access admin_action)

## Key Features Demonstrated

### 1. Native FastMCP Configuration

```typescript
const server = new McpServer({
  name: 'Example FastMCP Server',
  version: '1.0.0',
  instructions: 'Server instructions for LLMs...',
  authenticate: async (req) => {
    // Auth logic
    return { userId, role };
  },
  transport: {
    type: 'httpStreamable',
    httpStreamable: {
      port: 3000,
      endpoint: '/mcp',
      stateless: false,
    },
  },
});
```

### 2. Direct FastMCP Access

```typescript
server.fastMCP.on('connect', (event) => {
  console.log('Client connected');
});
```

### 3. Tools with Full Context

```typescript
server.addTool({
  name: 'my-tool',
  parameters: z.object({ /* Zod schema */ }),
  annotations: { streamingHint: true },
  canAccess: (session) => session?.role === 'admin',
  execute: async (args, ctx) => {
    ctx.log.info('Running tool');
    await ctx.reportProgress({ progress: 50, total: 100 });
    await ctx.streamContent({ type: 'text', text: 'Result' });
    return result;
  },
});
```

### 4. Stateless Mode (Serverless)

```typescript
transport: {
  type: 'httpStreamable',
  httpStreamable: {
    port: 3000,
    stateless: true, // Enable for serverless
  },
}
```

## Migration from Old Pattern

### Before (Deprecated)

```typescript
server.addTool({
  name: 'my-tool',
  inputSchema: { /* JSON Schema */ },
  execute: async (args, ctx: RequestContext) => {
    // Limited context
    return result;
  },
});
```

### After (FastMCP-aligned)

```typescript
server.addTool({
  name: 'my-tool',
  parameters: z.object({ /* Zod schema */ }),
  execute: async (args, ctx: FastMCPContext) => {
    // Full FastMCP context
    ctx.log.info('...');
    await ctx.reportProgress({ ... });
    return result;
  },
});
```

## Plugin Compatibility

Plugins still work seamlessly:

```typescript
import { createAuthPlugin, createCorsPlugin } from '@brainwav/cortexdx-server';

server.use(createAuthPlugin({ ... }));
server.use(createCorsPlugin({ ... }));
```

Plugin hooks run automatically around tool execution.

## Learn More

- [FastMCP Documentation](https://github.com/punkpeye/fastmcp)
- [MCP Specification](https://modelcontextprotocol.io)
- [Migration Plan](../../FASTMCP_MIGRATION_PLAN.md)
- [Architecture Design](../../FASTMCP_PLUGIN_ARCHITECTURE.md)
