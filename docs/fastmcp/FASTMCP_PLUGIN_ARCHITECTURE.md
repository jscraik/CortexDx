# FastMCP + Plugin Architecture Design

**Goal:** Align with FastMCP best practices while maintaining plugin modularity

**Date:** 2025-11-22

---

## Design Principles

1. ✅ **Use FastMCP features natively** - Don't hide them
2. ✅ **Keep plugin system** - For modularity and extensibility
3. ✅ **Bridge the gap** - Plugins enhance FastMCP, don't replace it
4. ✅ **Zero breaking changes** - Backward compatible migration path

---

## Architecture Overview

```typescript
┌─────────────────────────────────────────────────────────────┐
│                        McpServer                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              FastMCP Instance (Native)                 │  │
│  │  • Native authentication                               │  │
│  │  • Rich context (log, progress, streaming)            │  │
│  │  • Session management                                  │  │
│  │  • Tool annotations                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Plugin Enhancement Layer                  │  │
│  │  • Pre/post hooks for tools/resources                 │  │
│  │  • Context enrichment (auth, license, custom state)   │  │
│  │  • Cross-cutting concerns (logging, metrics)          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight:** Plugins extend FastMCP's context and behavior, they don't replace it.

---

## Enhanced Context Design

### FastMCP Native Context
```typescript
{
  session: AuthSession,      // From authenticate()
  sessionId: string,          // Per-client ID
  requestId: string,          // Per-request ID
  log: Logger,                // Scoped logger
  reportProgress: Function,   // Progress updates
  streamContent: Function,    // Streaming output
}
```

### Plugin Enhancement
```typescript
{
  ...fastMCPContext,          // All native features
  plugins: {                  // Plugin-added data
    auth: { userId, roles },
    license: { tier, features },
    custom: Map<string, unknown>
  }
}
```

---

## Implementation Strategy

### Phase 1: Non-Breaking Additions (Week 1)

Add new methods alongside existing ones:

```typescript
export class McpServer {
  private mcp: FastMCP;
  private plugins = new PluginRegistry();

  // NEW: Expose FastMCP instance
  get fastMCP(): FastMCP {
    return this.mcp;
  }

  // NEW: Add tool with full FastMCP features + plugins
  addFastMCPTool(config: FastMCPToolConfig): this {
    // Wrap execute to run plugin hooks
    const wrappedExecute = this.wrapWithPlugins(config.execute);

    this.mcp.addTool({
      ...config,
      execute: wrappedExecute,
    });

    return this;
  }

  // EXISTING: Keep for backward compatibility
  addTool(tool: McpTool): this {
    // Current implementation unchanged
  }
}
```

### Phase 2: Enhanced Constructor (Week 2)

Support FastMCP config options:

```typescript
export interface McpServerConfig {
  name: string;
  version: string;

  // NEW: FastMCP native options
  instructions?: string;
  authenticate?: (request: Request) => Promise<AuthSession>;
  logger?: Logger;

  // EXISTING: Custom options
  protocolVersion?: ProtocolVersion;
  transport: TransportConfig;
  capabilities?: Partial<ServerCapabilities>;

  // NEW: Plugin configuration
  plugins?: {
    enabled: boolean;
    autoRegister?: ServerPlugin[];
  };
}

constructor(config: McpServerConfig) {
  this.mcp = new FastMCP({
    name: config.name,
    version: config.version as `${number}.${number}.${number}`,
    instructions: config.instructions,
    logger: config.logger,
    // Wrap authenticate to allow plugin enhancement
    authenticate: config.authenticate
      ? this.wrapAuthenticate(config.authenticate)
      : undefined,
  });

  // Register plugins
  if (config.plugins?.autoRegister) {
    config.plugins.autoRegister.forEach(p => this.use(p));
  }
}
```

### Phase 3: Session Event Integration (Week 3)

Bridge FastMCP events with plugins:

```typescript
async start(): Promise<void> {
  // Hook into FastMCP session events
  this.mcp.on("connect", async (event) => {
    const ctx = this.createContextFromSession(event.session);

    // Run plugin hooks
    await this.plugins.runHook('onSessionConnect', ctx, event.session);

    // Listen for session events
    event.session.on("rootsChanged", async (e) => {
      await this.plugins.runHook('onRootsChanged', ctx, e.roots);
    });
  });

  this.mcp.on("disconnect", async (event) => {
    const ctx = this.createContextFromSession(event.session);
    await this.plugins.runHook('onSessionDisconnect', ctx, event.session);
  });

  // Start FastMCP with enhanced config
  await this.startTransport();
}
```

### Phase 4: Transport Enhancements (Week 4)

Expose all FastMCP transport options:

```typescript
export interface TransportConfig {
  type: 'httpStream' | 'stdio';

  httpStream?: {
    port: number;
    host?: string;
    endpoint?: string;        // NEW: Custom endpoint
    stateless?: boolean;      // NEW: Stateless mode
  };

  stdio?: {
    // Future stdio options
  };
}

private async startTransport(): Promise<void> {
  const { type, httpStream } = this.config.transport;

  if (type === 'httpStream') {
    await this.mcp.start({
      transportType: 'httpStream',
      httpStream: {
        port: httpStream.port,
        host: httpStream.host || '127.0.0.1',
        endpoint: httpStream.endpoint || '/mcp',
        stateless: httpStream.stateless || false,
      },
    });
  } else if (type === 'stdio') {
    await this.mcp.start({ transportType: 'stdio' });
  }
}
```

---

## Plugin System Enhancements

### Extended Plugin Interface

```typescript
export interface ServerPlugin {
  name: string;
  version?: string;
  priority?: number;

  // EXISTING lifecycle hooks
  onLoad?(server: ServerPluginHost): Promise<void>;
  onUnload?(server: ServerPluginHost): Promise<void>;

  // EXISTING request hooks
  onRequest?(ctx: RequestContext): Promise<HookResult>;
  onResponse?(ctx: RequestContext, response: JsonRpcResponse): Promise<JsonRpcResponse>;
  onError?(ctx: RequestContext, error: Error): Promise<JsonRpcResponse | undefined>;

  // EXISTING tool/resource hooks
  onToolCall?(ctx: RequestContext, toolName: string, args: unknown): Promise<void>;
  onToolResult?(ctx: RequestContext, toolName: string, result: unknown): Promise<unknown>;
  onResourceRead?(ctx: RequestContext, uri: string): Promise<void>;

  // NEW: Session event hooks
  onSessionConnect?(ctx: RequestContext, session: unknown): Promise<void>;
  onSessionDisconnect?(ctx: RequestContext, session: unknown): Promise<void>;
  onRootsChanged?(ctx: RequestContext, roots: unknown[]): Promise<void>;

  // NEW: Context enrichment
  enrichContext?(ctx: RequestContext, fastMCPContext: unknown): Promise<void>;
}
```

### Enhanced Request Context

```typescript
export interface RequestContext {
  // EXISTING fields
  request: JsonRpcRequest;
  meta: {
    clientId?: string;
    timestamp: number;
    transport: 'httpStreamable' | 'stdio' | 'websocket';
  };
  state: Map<string, unknown>;
  auth?: { userId?: string; roles: string[]; token?: string };
  license?: { tier: string; features: string[]; expiresAt?: number };

  // NEW: FastMCP native context
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

---

## Tool Registration Patterns

### Pattern 1: Native FastMCP (Recommended for New Tools)

```typescript
server.addFastMCPTool({
  name: "advanced-search",
  description: "Search with streaming results",
  parameters: z.object({
    query: z.string(),
    maxResults: z.number().optional(),
  }),
  annotations: {
    streamingHint: true,
    title: "Advanced Search",
  },
  canAccess: (session) => session?.role === "user" || session?.role === "admin",
  execute: async (args, ctx) => {
    // Full FastMCP context available
    ctx.log.info("Starting search", { query: args.query });

    await ctx.reportProgress({ progress: 0, total: 100 });

    const results = await searchDatabase(args.query);

    // Stream results incrementally
    for (let i = 0; i < results.length; i++) {
      await ctx.streamContent({
        type: "text",
        text: JSON.stringify(results[i]),
      });
      await ctx.reportProgress({
        progress: ((i + 1) / results.length) * 100,
        total: 100
      });
    }

    // Plugins still run! (onToolCall, onToolResult hooks)
    return { totalResults: results.length };
  },
});
```

### Pattern 2: Hybrid (Use Both FastMCP + Plugins)

```typescript
server.addFastMCPTool({
  name: "licensed-feature",
  parameters: z.object({ data: z.string() }),
  execute: async (args, ctx) => {
    // FastMCP native features
    ctx.log.info("Running licensed feature");

    // Access plugin-enriched context
    // (plugins can inject data into ctx during onToolCall hook)
    const license = await server.getPluginData(ctx, 'license');

    if (!license || license.tier === 'community') {
      throw new UserError("This feature requires a Professional license");
    }

    // Use streaming for large responses
    await ctx.reportProgress({ progress: 50, total: 100 });
    const result = await processData(args.data);

    return result;
  },
});
```

### Pattern 3: Legacy (Backward Compatible)

```typescript
// Old API still works
server.addTool({
  name: "legacy-tool",
  inputSchema: { type: "object", properties: { ... } },
  execute: async (args, ctx: RequestContext) => {
    // Works as before
    // Plugins run as before
    return result;
  },
});
```

---

## Plugin Implementation Examples

### Example 1: License Plugin with FastMCP

```typescript
export class LicensePlugin implements ServerPlugin {
  name = "license-enforcement";
  priority = 10; // Run early

  async enrichContext(ctx: RequestContext, fastMCPContext: unknown) {
    // Add license info to context
    const license = await this.checkLicense(ctx.request);
    ctx.license = license;
  }

  async onToolCall(ctx: RequestContext, toolName: string, args: unknown) {
    // Check if tool requires license
    if (this.requiresLicense(toolName)) {
      if (!ctx.license || ctx.license.tier === 'community') {
        throw new McpError(
          MCP_ERRORS.LICENSE_REQUIRED,
          `Tool ${toolName} requires a Professional license`
        );
      }
    }
  }
}
```

### Example 2: Auth Plugin with FastMCP

```typescript
export class AuthPlugin implements ServerPlugin {
  name = "auth-middleware";
  priority = 5; // Run very early

  async enrichContext(ctx: RequestContext, fastMCPContext: unknown) {
    // FastMCP's authenticate() already ran
    // We can enhance the session data
    if (fastMCPContext?.session) {
      const enrichedAuth = await this.enrichAuthData(fastMCPContext.session);
      ctx.auth = enrichedAuth;
    }
  }

  async onToolCall(ctx: RequestContext, toolName: string, args: unknown) {
    // Verify auth for protected tools
    if (this.requiresAuth(toolName) && !ctx.auth) {
      throw createAuthRequiredError();
    }
  }
}
```

### Example 3: Metrics Plugin

```typescript
export class MetricsPlugin implements ServerPlugin {
  name = "metrics-collector";

  async onToolCall(ctx: RequestContext, toolName: string, args: unknown) {
    // Use FastMCP's requestId for tracing
    const requestId = ctx.fastMCP?.requestId || 'unknown';

    this.metrics.increment('tool.calls', {
      tool: toolName,
      requestId,
    });
  }

  async onToolResult(ctx: RequestContext, toolName: string, result: unknown) {
    const duration = Date.now() - ctx.meta.timestamp;

    this.metrics.histogram('tool.duration', duration, {
      tool: toolName,
    });
  }

  async onSessionConnect(ctx: RequestContext, session: unknown) {
    this.metrics.increment('sessions.connected');
  }

  async onSessionDisconnect(ctx: RequestContext, session: unknown) {
    this.metrics.increment('sessions.disconnected');
  }
}
```

---

## Wrapper Implementation

### Core Wrapper Logic

```typescript
export class McpServer {
  private mcp: FastMCP;
  private plugins = new PluginRegistry();

  constructor(config: McpServerConfig) {
    this.mcp = new FastMCP({
      name: config.name,
      version: config.version as `${number}.${number}.${number}`,
      instructions: config.instructions,
      logger: config.logger || createLogger({ component: 'mcp-server' }),
      authenticate: config.authenticate
        ? this.wrapAuthenticate(config.authenticate)
        : undefined,
    });
  }

  /**
   * Wrap authenticate to allow plugin enhancement
   */
  private wrapAuthenticate(
    authenticate: (req: Request) => Promise<AuthSession>
  ) {
    return async (req: Request) => {
      // Run FastMCP's authenticate first
      const session = await authenticate(req);

      // Allow plugins to enrich session
      const ctx = this.createContext('initialize', undefined);
      ctx.fastMCP = { session };

      await this.plugins.runHook('enrichContext', ctx, { session });

      return session;
    };
  }

  /**
   * Wrap tool execution with plugin hooks
   */
  private wrapWithPlugins(
    execute: (args: unknown, ctx: unknown) => Promise<unknown>
  ) {
    return async (args: unknown, fastMCPContext: unknown) => {
      // Create enhanced context
      const ctx = this.createContext('tools/call', undefined);
      ctx.fastMCP = fastMCPContext;

      // Run pre-execution hooks
      await this.plugins.runHook('enrichContext', ctx, fastMCPContext);
      await this.plugins.runHook('onToolCall', ctx, args);

      try {
        // Execute tool with full context
        const result = await execute(args, fastMCPContext);

        // Run post-execution hooks
        const transformed = await this.plugins.runHook('onToolResult', ctx, result);

        return transformed !== undefined ? transformed : result;
      } catch (error) {
        // Run error hooks
        const errorResponse = await this.plugins.runHook('onError', ctx, error);
        if (errorResponse) throw errorResponse;
        throw error;
      }
    };
  }

  /**
   * Add tool with full FastMCP features + plugin support
   */
  addFastMCPTool(config: {
    name: string;
    description?: string;
    parameters: z.ZodType;
    annotations?: ToolAnnotations;
    canAccess?: (session: unknown) => boolean;
    execute: (args: unknown, ctx: unknown) => Promise<unknown>;
  }): this {
    this.mcp.addTool({
      ...config,
      execute: this.wrapWithPlugins(config.execute),
    });

    return this;
  }

  /**
   * Get underlying FastMCP instance for direct access
   */
  get fastMCP(): FastMCP {
    return this.mcp;
  }
}
```

---

## Migration Path

### Step 1: Update Dependencies (Day 1)

```json
{
  "dependencies": {
    "fastmcp": "^3.23.1",
    "zod": "^3.22.4"
  }
}
```

### Step 2: Update Config (Day 1)

```typescript
// Before
const server = new McpServer({
  name: "CortexDx",
  version: "0.1.0",
  transport: { type: 'httpStreamable', httpStreamable: { port: 5001 } },
});

// After (backward compatible)
const server = new McpServer({
  name: "CortexDx",
  version: "0.1.0",
  instructions: "AI-powered MCP diagnostics and security scanning",
  logger: createLogger({ component: 'cortexdx' }),
  authenticate: async (req) => {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || !validateApiKey(apiKey)) {
      throw new Response(null, { status: 401 });
    }
    return { userId: getUserId(apiKey), role: getRole(apiKey) };
  },
  transport: {
    type: 'httpStream',
    httpStream: {
      port: 5001,
      stateless: true, // Enable for serverless
    }
  },
});
```

### Step 3: Migrate Tools Incrementally (Week 1-2)

```typescript
// Old style (still works)
server.addTool({
  name: "diagnose_mcp_server",
  inputSchema: { /* JSON Schema */ },
  execute: async (args, ctx) => { /* ... */ },
});

// New style (gradually migrate)
server.addFastMCPTool({
  name: "diagnose_mcp_server_v2",
  description: "Comprehensive MCP server diagnostics",
  parameters: z.object({
    endpoint: z.string().url(),
    suites: z.array(z.string()).optional(),
  }),
  annotations: {
    streamingHint: true,
    title: "MCP Server Diagnostics",
    idempotentHint: true,
  },
  canAccess: (session) => session?.role === "admin" || session?.role === "user",
  execute: async (args, ctx) => {
    ctx.log.info("Starting diagnostics", { endpoint: args.endpoint });

    await ctx.reportProgress({ progress: 0, total: 100 });

    // Stream results as they come in
    for await (const result of runDiagnostics(args.endpoint)) {
      await ctx.streamContent({
        type: "text",
        text: JSON.stringify(result),
      });
    }

    return { status: "complete" };
  },
});
```

### Step 4: Update Plugins (Week 2-3)

Add new hooks to existing plugins:

```typescript
export class AuthPlugin implements ServerPlugin {
  // ... existing hooks ...

  // NEW: Session hooks
  async onSessionConnect(ctx, session) {
    this.activeSessions.set(session.id, session);
  }

  async onSessionDisconnect(ctx, session) {
    this.activeSessions.delete(session.id);
  }

  // NEW: Context enrichment
  async enrichContext(ctx, fastMCPContext) {
    if (fastMCPContext?.session) {
      ctx.auth = {
        userId: fastMCPContext.session.userId,
        roles: fastMCPContext.session.roles || [],
      };
    }
  }
}
```

### Step 5: Enable Advanced Features (Week 3-4)

```typescript
// Use stateless mode for serverless
server.start({
  transport: {
    type: 'httpStream',
    httpStream: {
      port: 5001,
      stateless: true,
    },
  },
});

// Use session events for tracking
server.fastMCP.on("connect", (event) => {
  console.log("Client connected:", event.session.id);
});

// Use remote sampling in tools
server.addFastMCPTool({
  name: "ai_assistant",
  execute: async (args, ctx) => {
    const response = await ctx.session.requestSampling({
      messages: [{ role: "user", content: { type: "text", text: args.query } }],
      maxTokens: 500,
    });
    return response.content;
  },
});
```

---

## Benefits of This Approach

### ✅ Alignment with FastMCP
- Uses native FastMCP features (streaming, progress, annotations)
- Follows official best practices
- Gets automatic updates and improvements

### ✅ Keeps Plugin Modularity
- Plugins still work for cross-cutting concerns
- Easy to add/remove features
- Plugin hooks run alongside FastMCP features

### ✅ Backward Compatible
- Existing tools continue working
- Gradual migration path
- No breaking changes

### ✅ Best of Both Worlds
- FastMCP's rich context and features
- Plugin architecture for extensibility
- Enhanced error handling and protocol compliance

---

## Next Steps

1. **Review this design** - Validate it meets your needs
2. **Implement Phase 1** - Non-breaking additions
3. **Migrate one tool** - Prove the pattern works
4. **Update plugins** - Add new hooks
5. **Roll out incrementally** - One feature at a time

---

## Questions to Consider

1. Should we deprecate `addTool()` eventually, or keep it forever?
2. Do we need a migration CLI tool to convert JSON Schema → Zod?
3. Should plugins be able to block tool execution (current: yes via onToolCall)?
4. Do we want plugin-level `canAccess` in addition to tool-level?
5. Should we expose `server.fastMCP` publicly or keep it internal?

---

**End of Design Document**
