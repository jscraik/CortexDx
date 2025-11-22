# FastMCP Migration Implementation Plan

**Goal:** Align with FastMCP while keeping plugin modularity

**Timeline:** 4 weeks (incremental, non-breaking)

**Status:** Ready to implement

---

## Week 1: Foundation (Non-Breaking Additions)

### Task 1.1: Update Server Config Interface

**File:** `packages/server/src/mcp-server/core/server.ts`

**Changes:**

```typescript
export interface McpServerConfig {
  name: string;
  version: string;

  // NEW: FastMCP native options
  instructions?: string;
  authenticate?: (request: Request) => Promise<AuthSession>;
  logger?: Logger;

  // EXISTING
  protocolVersion?: ProtocolVersion;
  transport: TransportConfig;
  capabilities?: Partial<ServerCapabilities>;
}

// NEW: Auth session type
export interface AuthSession {
  userId?: string;
  role?: string;
  [key: string]: unknown;
}
```

**Priority:** P0 (Required for all other changes)

---

### Task 1.2: Expose FastMCP Instance

**File:** `packages/server/src/mcp-server/core/server.ts`

**Add to `McpServer` class:**

```typescript
export class McpServer {
  private mcp: FastMCP;
  // ... existing fields ...

  /**
   * Get underlying FastMCP instance for advanced features
   * @example
   * server.fastMCP.on("connect", (event) => {
   *   console.log("Client connected");
   * });
   */
  get fastMCP(): FastMCP {
    return this.mcp;
  }
}
```

**Priority:** P0 (Enables immediate use of FastMCP features)

---

### Task 1.3: Add FastMCP Tool Registration Method

**File:** `packages/server/src/mcp-server/core/server.ts`

**Add to `McpServer` class:**

```typescript
/**
 * Tool configuration with full FastMCP features
 */
export interface FastMCPToolConfig {
  name: string;
  description?: string;
  parameters: z.ZodType;
  annotations?: {
    title?: string;
    streamingHint?: boolean;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  canAccess?: (session: unknown) => boolean;
  execute: (args: unknown, ctx: FastMCPContext) => Promise<unknown>;
}

/**
 * FastMCP execution context
 */
export interface FastMCPContext {
  session?: AuthSession;
  sessionId?: string;
  requestId: string;
  log: {
    debug: (msg: string, data?: unknown) => void;
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
  };
  reportProgress?: (progress: { progress: number; total: number }) => Promise<void>;
  streamContent?: (content: { type: string; text?: string; data?: string; mimeType?: string }) => Promise<void>;
}

export class McpServer {
  // ... existing code ...

  /**
   * Add tool with full FastMCP features + plugin support
   * @example
   * server.addFastMCPTool({
   *   name: "search",
   *   parameters: z.object({ query: z.string() }),
   *   annotations: { streamingHint: true },
   *   canAccess: (session) => session?.role === "admin",
   *   execute: async (args, ctx) => {
   *     ctx.log.info("Searching...");
   *     await ctx.reportProgress({ progress: 50, total: 100 });
   *     return results;
   *   },
   * });
   */
  addFastMCPTool(config: FastMCPToolConfig): this {
    // Wrap execute to run plugin hooks
    const wrappedExecute = async (args: unknown, fastMCPContext: unknown) => {
      // Create plugin context
      const ctx = this.createContext('tools/call', config.name);
      ctx.fastMCP = fastMCPContext;

      // Pre-execution plugin hooks
      const preResult = await this.plugins.runHook<JsonRpcResponse>(
        'onToolCall',
        ctx,
        config.name,
        args
      );
      if (preResult) {
        return JSON.stringify(preResult);
      }

      try {
        // Execute with full FastMCP context
        let result = await config.execute(args, fastMCPContext as FastMCPContext);

        // Post-execution plugin hooks
        const transformedResult = await this.plugins.runHook<unknown>(
          'onToolResult',
          ctx,
          config.name,
          result
        );
        if (transformedResult !== undefined) {
          result = transformedResult;
        }

        return result;
      } catch (error) {
        // Error handling plugin hooks
        const errorResponse = await this.plugins.runHook<JsonRpcResponse>(
          'onError',
          ctx,
          error
        );
        if (errorResponse) {
          return JSON.stringify(errorResponse);
        }

        // Re-throw for FastMCP to handle
        throw error;
      }
    };

    // Register with FastMCP
    this.mcp.addTool({
      name: config.name,
      description: config.description || '',
      parameters: config.parameters,
      annotations: config.annotations,
      canAccess: config.canAccess,
      execute: wrappedExecute,
    });

    logger.debug({ tool: config.name }, 'FastMCP tool registered');
    return this;
  }

  // Keep existing addTool() for backward compatibility
  addTool(tool: McpTool): this {
    // ... existing implementation unchanged ...
  }
}
```

**Priority:** P0 (Core feature)

---

### Task 1.4: Update Transport Config

**File:** `packages/server/src/mcp-server/transports/types.ts`

**Changes:**

```typescript
export interface TransportConfig {
  type: 'httpStreamable' | 'stdio' | 'websocket';

  httpStreamable?: {
    port: number;
    host?: string;
    endpoint?: string;      // NEW
    stateless?: boolean;    // NEW
  };

  stdio?: {
    // Future options
  };

  websocket?: {
    // Future implementation
  };
}
```

**File:** `packages/server/src/mcp-server/core/server.ts`

**Update `start()` method:**

```typescript
async start(): Promise<void> {
  // ... plugin initialization ...

  const { type, httpStreamable, stdio } = this.config.transport;

  switch (type) {
    case 'httpStreamable':
      if (!httpStreamable) {
        throw new Error('httpStreamable config required');
      }
      await this.mcp.start({
        transportType: 'httpStream',
        httpStream: {
          port: httpStreamable.port,
          host: httpStreamable.host || '127.0.0.1',
          endpoint: httpStreamable.endpoint || '/mcp',  // NEW
          stateless: httpStreamable.stateless || false,  // NEW
        },
      });
      logger.info(
        {
          port: httpStreamable.port,
          stateless: httpStreamable.stateless,  // NEW
        },
        'HTTP Streamable transport started'
      );
      break;

    // ... stdio case unchanged ...
  }

  this.running = true;
}
```

**Priority:** P1 (Important for serverless support)

---

## Week 2: Plugin Enhancement

### Task 2.1: Extend Plugin Interface

**File:** `packages/server/src/mcp-server/plugins/types.ts`

**Add new hooks:**

```typescript
export interface ServerPlugin {
  // ... existing hooks ...

  /**
   * Called when a client connects (FastMCP session)
   */
  onSessionConnect?(ctx: RequestContext, session: unknown): Promise<void>;

  /**
   * Called when a client disconnects
   */
  onSessionDisconnect?(ctx: RequestContext, session: unknown): Promise<void>;

  /**
   * Called when filesystem roots change
   */
  onRootsChanged?(ctx: RequestContext, roots: unknown[]): Promise<void>;

  /**
   * Called to enrich context with plugin data
   * Runs before tool execution
   */
  enrichContext?(ctx: RequestContext, fastMCPContext: unknown): Promise<void>;
}
```

**Update `RequestContext`:**

```typescript
export interface RequestContext {
  // ... existing fields ...

  /**
   * FastMCP native context (when using addFastMCPTool)
   */
  fastMCP?: {
    session?: unknown;
    sessionId?: string;
    requestId?: string;
    log?: Logger;
    reportProgress?: (progress: ProgressUpdate) => Promise<void>;
    streamContent?: (content: Content) => Promise<void>;
  };
}
```

**Priority:** P1 (Enables plugin integration with FastMCP features)

---

### Task 2.2: Add Session Event Handlers

**File:** `packages/server/src/mcp-server/core/server.ts`

**Update `start()` method:**

```typescript
async start(): Promise<void> {
  // ... existing plugin initialization ...

  // NEW: Hook into FastMCP session events
  this.mcp.on("connect", async (event) => {
    const ctx = this.createContext('session/connect', undefined);
    ctx.fastMCP = { session: event.session };

    logger.info(
      { sessionId: event.session.id },
      'Client connected'
    );

    // Run plugin hooks
    await this.plugins.runHook('onSessionConnect', ctx, event.session);

    // Listen for session-specific events
    event.session.on("rootsChanged", async (e) => {
      await this.plugins.runHook('onRootsChanged', ctx, e.roots);
    });
  });

  this.mcp.on("disconnect", async (event) => {
    const ctx = this.createContext('session/disconnect', undefined);
    ctx.fastMCP = { session: event.session };

    logger.info(
      { sessionId: event.session?.id },
      'Client disconnected'
    );

    await this.plugins.runHook('onSessionDisconnect', ctx, event.session);
  });

  // ... existing transport start ...
}
```

**Priority:** P2 (Nice to have for session tracking)

---

### Task 2.3: Update Existing Plugins

**Example: Auth Plugin**

**File:** `packages/server/src/mcp-server/plugins/auth-plugin.ts` (if exists)

**Add:**

```typescript
export class AuthPlugin implements ServerPlugin {
  // ... existing code ...

  async enrichContext(ctx: RequestContext, fastMCPContext: unknown): Promise<void> {
    // If FastMCP's authenticate() already set session
    if (fastMCPContext?.session) {
      ctx.auth = {
        userId: fastMCPContext.session.userId,
        roles: fastMCPContext.session.roles || [],
        token: fastMCPContext.session.token,
      };
    }
  }

  async onSessionConnect(ctx: RequestContext, session: unknown): Promise<void> {
    logger.info(
      { userId: ctx.auth?.userId },
      'Authenticated session connected'
    );
  }
}
```

**Priority:** P2 (Demonstrates plugin enhancement)

---

## Week 3: Tool Migration

### Task 3.1: Create Migration Helper

**File:** `packages/server/src/mcp-server/utils/schema-to-zod.ts`

**Create helper to convert JSON Schema → Zod:**

```typescript
import { z } from 'zod';
import { jsonSchemaToZod } from '../core/schema-converter';

/**
 * Convert JSON Schema tool definition to Zod for FastMCP
 */
export function convertJsonSchemaToZod(
  jsonSchema: Record<string, unknown>
): z.ZodType {
  return jsonSchemaToZod(jsonSchema as any);
}

/**
 * Example usage:
 * const zodSchema = convertJsonSchemaToZod({
 *   type: "object",
 *   properties: {
 *     name: { type: "string" },
 *     age: { type: "integer" }
 *   },
 *   required: ["name"]
 * });
 */
```

**Priority:** P1 (Simplifies migration)

---

### Task 3.2: Migrate Example Tool

**Example: Migrate `diagnose_mcp_server` tool**

**Before (packages/server/src/tools/diagnostic-tools.ts):**

```typescript
server.addTool({
  name: "diagnose_mcp_server",
  description: "Run comprehensive diagnostics",
  inputSchema: {
    type: "object",
    properties: {
      endpoint: { type: "string" },
      suites: { type: "array", items: { type: "string" } },
    },
    required: ["endpoint"],
  },
  execute: async (args, ctx) => {
    const result = await runDiagnostics(args.endpoint);
    return JSON.stringify(result);
  },
});
```

**After:**

```typescript
import { z } from 'zod';

server.addFastMCPTool({
  name: "diagnose_mcp_server",
  description: "Run comprehensive MCP server diagnostics with real-time progress",
  parameters: z.object({
    endpoint: z.string().url().describe("MCP server endpoint URL"),
    suites: z.array(z.string()).optional().describe("Test suites to run"),
    timeout: z.number().optional().default(120000),
  }),
  annotations: {
    title: "MCP Server Diagnostics",
    streamingHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  canAccess: (session) => {
    // Allow all authenticated users
    return !!session;
  },
  execute: async (args, ctx) => {
    ctx.log.info("Starting diagnostics", { endpoint: args.endpoint });

    await ctx.reportProgress?.({ progress: 0, total: 100 });

    const results = [];
    const suites = args.suites || ['protocol', 'auth', 'security'];

    for (let i = 0; i < suites.length; i++) {
      const suite = suites[i];
      ctx.log.debug(`Running suite: ${suite}`);

      const result = await runTestSuite(args.endpoint, suite);
      results.push(result);

      // Stream results as they complete
      await ctx.streamContent?.({
        type: "text",
        text: JSON.stringify({ suite, result }),
      });

      const progress = ((i + 1) / suites.length) * 100;
      await ctx.reportProgress?.({ progress, total: 100 });
    }

    return {
      summary: {
        total: suites.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
      },
      results,
    };
  },
});
```

**Priority:** P1 (Proves the pattern)

---

### Task 3.3: Document Migration Pattern

**File:** `packages/server/TOOL_MIGRATION_GUIDE.md`

Create guide showing:
1. How to convert JSON Schema → Zod
2. How to use streaming and progress
3. How to use `canAccess` for authorization
4. How to use `ctx.log` for scoped logging
5. Examples of different tool patterns

**Priority:** P2 (Helps team migrate)

---

## Week 4: Advanced Features

### Task 4.1: Add Constructor Support for FastMCP Options

**File:** `packages/server/src/mcp-server/core/server.ts`

**Update constructor:**

```typescript
constructor(private config: McpServerConfig) {
  this.protocolVersion = config.protocolVersion || DEFAULT_PROTOCOL_VERSION;

  // Validate version
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(config.version)) {
    throw new Error(
      `Invalid version "${config.version}". Expected format: "x.y.z"`
    );
  }

  // Create FastMCP with native options
  this.mcp = new FastMCP({
    name: config.name,
    version: config.version as `${number}.${number}.${number}`,
    instructions: config.instructions,  // NEW
    logger: config.logger,              // NEW
    authenticate: config.authenticate   // NEW
      ? this.wrapAuthenticate(config.authenticate)
      : undefined,
  });

  logger.info(
    {
      name: config.name,
      version: config.version,
      hasAuth: !!config.authenticate,
      hasInstructions: !!config.instructions,
    },
    'MCP Server created'
  );
}

/**
 * Wrap authenticate to allow plugin enhancement
 */
private wrapAuthenticate(
  authenticate: (req: Request) => Promise<AuthSession>
) {
  return async (req: Request) => {
    try {
      const session = await authenticate(req);

      // Allow plugins to enrich session
      const ctx = this.createContext('authenticate', undefined);
      ctx.fastMCP = { session };

      await this.plugins.runHook('enrichContext', ctx, { session });

      return session;
    } catch (error) {
      logger.warn({ error }, 'Authentication failed');
      throw error;
    }
  };
}
```

**Priority:** P1 (Enables native FastMCP auth)

---

### Task 4.2: Example Server Configuration

**File:** `packages/server/src/index.ts`

**Update to use new features:**

```typescript
import { McpServer } from './mcp-server/core/server';
import { createLogger } from './logging/logger';
import { validateApiKey, getUserFromApiKey } from './auth/api-key-validator';

const server = new McpServer({
  name: 'CortexDx MCP Server',
  version: '0.1.0',

  // NEW: FastMCP native options
  instructions: `
    AI-powered MCP server diagnostics and security scanning.

    Available tools:
    - diagnose_mcp_server: Run comprehensive diagnostics
    - security_scan: Perform security analysis
    - validate_protocol: Check protocol compliance
  `,

  logger: createLogger({ component: 'mcp-server', level: 'info' }),

  authenticate: async (req: Request) => {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey || !validateApiKey(apiKey)) {
      throw new Response('Unauthorized', { status: 401 });
    }

    const user = getUserFromApiKey(apiKey);

    return {
      userId: user.id,
      role: user.role,
      email: user.email,
    };
  },

  // EXISTING options
  protocolVersion: '2025-06-18',
  transport: {
    type: 'httpStreamable',
    httpStreamable: {
      port: 5001,
      host: '0.0.0.0',
      endpoint: '/mcp',
      stateless: true,  // NEW: Enable for serverless
    },
  },
});

// Register plugins
server.use(new AuthPlugin());
server.use(new LicensePlugin());
server.use(new MetricsPlugin());

// Register tools (both styles work)
registerDiagnosticTools(server);  // Uses addFastMCPTool
registerLegacyTools(server);       // Uses addTool (backward compatible)

// Start server
await server.start();

// NEW: Access FastMCP features directly
server.fastMCP.on('connect', (event) => {
  console.log('Client connected:', event.session.id);
});

console.log('Server running at http://localhost:5001/mcp');
```

**Priority:** P1 (Working example)

---

## Testing Plan

### Unit Tests

**File:** `packages/server/src/mcp-server/core/server.spec.ts`

Add tests for:

```typescript
describe('McpServer - FastMCP Integration', () => {
  it('should expose fastMCP instance', () => {
    const server = new McpServer(config);
    expect(server.fastMCP).toBeDefined();
    expect(server.fastMCP.start).toBeDefined();
  });

  it('should register FastMCP tools with plugins', async () => {
    const server = new McpServer(config);
    const mockPlugin = { onToolCall: jest.fn() };
    server.use(mockPlugin);

    server.addFastMCPTool({
      name: 'test',
      parameters: z.object({}),
      execute: async () => 'result',
    });

    // Tool execution should trigger plugin
    // Test implementation
  });

  it('should support stateless mode', async () => {
    const server = new McpServer({
      ...config,
      transport: {
        type: 'httpStreamable',
        httpStreamable: { port: 5001, stateless: true },
      },
    });

    await server.start();
    // Verify stateless configuration
  });

  it('should handle streaming and progress', async () => {
    const progressUpdates = [];
    const streamedContent = [];

    server.addFastMCPTool({
      name: 'streaming-tool',
      parameters: z.object({}),
      execute: async (args, ctx) => {
        await ctx.reportProgress?.({ progress: 50, total: 100 });
        await ctx.streamContent?.({ type: 'text', text: 'chunk1' });
        return 'done';
      },
    });

    // Test implementation
  });
});
```

---

### Integration Tests

**File:** `packages/server/tests/fastmcp-integration.spec.ts`

Test:
1. Tool execution with streaming
2. Progress reporting
3. Session connect/disconnect events
4. Plugin hooks with FastMCP context
5. Authentication flow
6. Stateless mode operation

---

## Documentation Updates

### Task D.1: Update README

**File:** `packages/server/README.md`

Add sections:
- FastMCP Integration
- Using addFastMCPTool vs addTool
- Streaming and Progress
- Session Management
- Stateless Mode

### Task D.2: Create Examples

**File:** `packages/server/examples/`

Create:
- `basic-tool.ts` - Simple tool
- `streaming-tool.ts` - Tool with streaming
- `auth-tool.ts` - Tool with canAccess
- `plugin-integration.ts` - Plugin with FastMCP

### Task D.3: API Reference

**File:** `packages/server/API.md`

Document:
- `McpServerConfig` interface
- `FastMCPToolConfig` interface
- `FastMCPContext` interface
- Plugin hooks
- Migration guide

---

## Rollback Plan

If issues arise:

1. **No breaking changes** - All existing code continues working
2. **Feature flags** - Can disable FastMCP features per-tool
3. **Gradual migration** - Migrate tools one at a time
4. **Fallback** - Can always use `server.fastMCP` directly

---

## Success Criteria

- [ ] `server.fastMCP` property accessible
- [ ] `addFastMCPTool()` method works
- [ ] Streaming and progress work in tools
- [ ] Stateless mode configurable
- [ ] Session events fire and trigger plugin hooks
- [ ] Plugins work with both tool styles
- [ ] At least 3 tools migrated to new pattern
- [ ] All tests passing
- [ ] Documentation complete

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing tools | Keep `addTool()` unchanged, add new method |
| Plugin incompatibility | Extend interface, make new hooks optional |
| Performance overhead | Benchmark plugin hooks, optimize if needed |
| FastMCP API changes | Pin to specific version, test updates carefully |
| Team learning curve | Provide examples, migration guide, pair programming |

---

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | Foundation | Config updates, exposed instance, new method |
| **Week 2** | Plugins | Extended interface, session events, enrichment |
| **Week 3** | Migration | Helper utilities, migrated tools, examples |
| **Week 4** | Advanced | Auth integration, docs, full example server |

**Total Effort:** ~20-30 hours (depending on number of tools to migrate)

**Team Size:** 1-2 developers

**Risk Level:** Low (non-breaking, incremental)

---

## Next Actions

1. ✅ **Review this plan** - Get team approval
2. 📅 **Schedule kickoff** - Week 1 tasks
3. 🔧 **Create feature branch** - `feature/fastmcp-alignment`
4. 💻 **Implement Task 1.1** - Update config interface
5. ✅ **Commit and test** - Incremental progress

---

**Ready to Start?** Let me know and I can begin implementing Week 1 tasks!
