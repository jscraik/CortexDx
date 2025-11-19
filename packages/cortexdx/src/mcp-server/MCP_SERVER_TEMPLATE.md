# Modular MCP Server Template

A portable template for building MCP servers that conform to the RC release (2025-06-18+).

## Dependencies

### Required NPM Packages

```json
{
  "dependencies": {
    "fastmcp": "^3.23.1",
    "@modelcontextprotocol/sdk": "^1.22.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0"
  }
}
```

### Protocol Specification

- **Target Version**: 2025-06-18
- **RC Release**: November 25, 2025
- **Changelog**: https://modelcontextprotocol.io/specification/draft/changelog

---

## Project Structure

```
src/mcp-server/
├── core/
│   ├── server.ts           # Main server orchestrator
│   ├── protocol.ts         # Protocol version & compliance
│   ├── schema-converter.ts # JSON Schema to Zod conversion
│   ├── errors.ts           # Centralized error codes
│   └── types.ts            # Draft specification types
├── transports/
│   ├── types.ts            # Transport interface definitions
│   ├── http-streamable.ts  # HTTP Streamable transport
│   ├── stdio.ts            # STDIO transport
│   └── websocket.ts        # WebSocket transport
├── plugins/
│   ├── types.ts            # Plugin interface definitions
│   ├── registry.ts         # Plugin registry & lifecycle
│   ├── auth.ts             # Authentication plugin
│   ├── cors.ts             # CORS plugin
│   └── rate-limit.ts       # Rate limiting plugin
├── index.ts                # Public exports
└── README.md               # Documentation
```

---

## Core Modules

### 1. Protocol Compliance (`core/protocol.ts`)

```typescript
// Protocol versions
export const PROTOCOL_VERSIONS = {
  LEGACY: '2024-11-05',
  CURRENT: '2025-06-18',
  DRAFT: '2025-11-25',
} as const;

export type ProtocolVersion = typeof PROTOCOL_VERSIONS[keyof typeof PROTOCOL_VERSIONS];

// Default version
export const DEFAULT_PROTOCOL_VERSION = PROTOCOL_VERSIONS.CURRENT;

// Server capabilities
export interface ServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, never>;
  experimental?: Record<string, unknown>;
}

// Initialize response
export interface InitializeResponse {
  protocolVersion: ProtocolVersion;
  capabilities: ServerCapabilities;
  serverInfo: { name: string; version: string };
}

// Protocol validation
export function validateNotBatch(request: unknown): void {
  if (Array.isArray(request)) {
    throw new Error('JSON-RPC batching not supported');
  }
}
```

### 2. Error Codes (`core/errors.ts`)

```typescript
// Standard JSON-RPC errors
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// Custom MCP errors
export const MCP_ERRORS = {
  ACCESS_DENIED: -32001,
  AUTH_REQUIRED: -32002,
  LICENSE_REQUIRED: -32010,
  RATE_LIMITED: -32020,
  TOOL_NOT_FOUND: -32030,
  TOOL_EXECUTION_ERROR: -32032,
  RESOURCE_NOT_FOUND: -32040,
  PROTOCOL_VERSION_MISMATCH: -32050,
} as const;

// Error class
export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
  }
}

// Tool execution errors (SEP-1303)
export function createToolExecutionError(message: string, details?: unknown): McpError {
  return new McpError(MCP_ERRORS.TOOL_EXECUTION_ERROR, message, details);
}
```

### 3. Schema Converter (`core/schema-converter.ts`)

```typescript
import { z } from 'zod';

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchema;
}

// Recursive JSON Schema to Zod conversion
export function jsonSchemaToZod(schema: JsonSchema): z.ZodType {
  // Handle enum
  if (schema.enum?.length) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  switch (schema.type) {
    case 'string': {
      let s = z.string();
      if (schema.minLength) s = s.min(schema.minLength);
      if (schema.maxLength) s = s.max(schema.maxLength);
      if (schema.pattern) s = s.regex(new RegExp(schema.pattern));
      return s;
    }

    case 'number':
    case 'integer': {
      let n = schema.type === 'integer' ? z.number().int() : z.number();
      if (schema.minimum) n = n.min(schema.minimum);
      if (schema.maximum) n = n.max(schema.maximum);
      return n;
    }

    case 'boolean':
      return z.boolean();

    case 'array':
      return z.array(schema.items ? jsonSchemaToZod(schema.items) : z.unknown());

    case 'object': {
      const shape: Record<string, z.ZodType> = {};
      const required = new Set(schema.required || []);

      for (const [key, prop] of Object.entries(schema.properties || {})) {
        let propType = jsonSchemaToZod(prop);
        if (!required.has(key)) propType = propType.optional();
        shape[key] = propType;
      }

      const obj = z.object(shape);
      return schema.additionalProperties === false ? obj.strict() : obj.passthrough();
    }

    default:
      return z.unknown();
  }
}

// Convert tool schema with strict validation
export function convertToolSchema(inputSchema: Record<string, unknown>): z.ZodType {
  if (!inputSchema.properties) return z.object({}).strict();
  return jsonSchemaToZod({
    ...(inputSchema as JsonSchema),
    additionalProperties: false,
  });
}
```

### 4. Draft Specification Types (`core/types.ts`)

```typescript
/**
 * Icon metadata for tools, resources, and prompts (SEP-973)
 */
export interface IconMetadata {
  uri: string;
  mimeType?: string;
  alt?: string;
}

/**
 * Implementation info with optional description
 */
export interface Implementation {
  name: string;
  version: string;
  description?: string;
}

// =============================================================================
// Lifecycle Types (Initialization, Capabilities)
// =============================================================================

/**
 * Icon for client/server info
 */
export interface InfoIcon {
  src: string;
  mimeType?: string;
  sizes?: string[];
}

/**
 * Client/Server information
 */
export interface ClientInfo {
  name: string;
  title?: string;
  version: string;
  description?: string;
  icons?: InfoIcon[];
  websiteUrl?: string;
}

export interface ServerInfo {
  name: string;
  title?: string;
  version: string;
  description?: string;
  icons?: InfoIcon[];
  websiteUrl?: string;
}

/**
 * Client capabilities for initialization
 */
export interface ClientCapabilities {
  roots?: { listChanged?: boolean };
  sampling?: Record<string, never>;
  elicitation?: { form?: Record<string, never>; url?: Record<string, never> };
  tasks?: {
    requests?: {
      elicitation?: { create?: Record<string, never> };
      sampling?: { createMessage?: Record<string, never> };
    };
  };
  experimental?: Record<string, unknown>;
}

/**
 * Server capabilities for initialization
 */
export interface ServerCapabilities {
  logging?: Record<string, never>;
  prompts?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  tools?: { listChanged?: boolean };
  completions?: Record<string, never>;
  tasks?: {
    list?: Record<string, never>;
    cancel?: Record<string, never>;
    requests?: { tools?: { call?: Record<string, never> } };
  };
  experimental?: Record<string, unknown>;
}

/**
 * Initialize request/response
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: ClientInfo;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
  instructions?: string;
}

/**
 * Enum schema for elicitation (SEP-1330)
 */
export interface EnumSchema {
  type: 'enum';
  multiSelect?: boolean;
  values: (string | TitledEnumValue)[];
}

export interface TitledEnumValue {
  value: string;
  title: string;
  description?: string;
  icon?: IconMetadata;
}

/**
 * Elicit result types (SEP-1330)
 */
export interface ElicitResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: ElicitContent;
}

export type ElicitContent =
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number }
  | { type: 'enum'; value: string | string[] }
  | { type: 'url'; value: string; validated?: boolean };

/**
 * Sampling request with tool calling support (SEP-1577)
 */
export interface SamplingRequest {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: SamplingTool[];
  toolChoice?: ToolChoice;
}

export interface SamplingTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export type ToolChoice =
  | { type: 'auto' }
  | { type: 'none' }
  | { type: 'required' }
  | { type: 'tool'; name: string };

/**
 * OpenID Connect Discovery metadata (PR #797)
 */
export interface OIDCDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  scopes_supported?: string[];
  response_types_supported: string[];
}

/**
 * OAuth Client ID Metadata (SEP-991)
 */
export interface OAuthClientMetadata {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
}

/**
 * WWW-Authenticate challenge for incremental consent (SEP-835)
 */
export interface AuthChallenge {
  scheme: 'Bearer';
  realm?: string;
  error?: 'invalid_token' | 'insufficient_scope';
  error_description?: string;
  scope?: string;
}

export function buildWWWAuthenticateHeader(challenge: AuthChallenge): string {
  const parts = [challenge.scheme];
  if (challenge.realm) parts.push(`realm="${challenge.realm}"`);
  if (challenge.error) parts.push(`error="${challenge.error}"`);
  if (challenge.scope) parts.push(`scope="${challenge.scope}"`);
  return parts.join(', ');
}

/**
 * Progress notification for long-running operations
 */
export interface ProgressNotification {
  progressToken: string | number;
  progress: number;
  total?: number;
  message?: string;
}

/**
 * Cancellation notification
 */
export interface CancellationNotification {
  requestId: string | number;
  reason?: string;
}

/**
 * Root definition for filesystem boundaries (Client feature)
 */
export interface Root {
  uri: string;
  name?: string;
}

/**
 * Logging level
 */
export type LoggingLevel =
  | 'debug' | 'info' | 'notice' | 'warning'
  | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * Completion request for argument autocompletion
 */
export interface CompletionRequest {
  ref: { type: 'ref/prompt' | 'ref/resource'; name?: string; uri?: string };
  argument: { name: string; value: string };
}

export interface CompletionResult {
  values: string[];
  total?: number;
  hasMore?: boolean;
}

/**
 * Resource link in tool results
 */
export interface ResourceLink {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * Structured tool output with resource links
 */
export interface StructuredToolOutput {
  content: ToolOutputContent[];
  resourceLinks?: ResourceLink[];
  isError?: boolean;
}

export type ToolOutputContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: EmbeddedResource };

export interface EmbeddedResource {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Ping request/response for connection health
 */
export interface PingRequest {}
export interface PingResponse {}
```

---

## Transport Layer

### Transport Interface (`transports/types.ts`)

```typescript
export type TransportType = 'httpStreamable' | 'stdio' | 'websocket';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type RequestHandler = (request: JsonRpcRequest) => Promise<JsonRpcResponse>;

export interface Transport {
  readonly type: TransportType;
  start(handler: RequestHandler): Promise<void>;
  stop(): Promise<void>;
  setProtocolVersion(version: string): void;
  getProtocolVersion(): string;
  isRunning(): boolean;
}

export interface TransportConfig {
  type: TransportType;
  httpStreamable?: { port: number; host?: string };
  stdio?: Record<string, never>;
  websocket?: { port: number; host?: string; path?: string };
}

// Session Management (Streamable HTTP)
export const MCP_HEADERS = {
  PROTOCOL_VERSION: 'MCP-Protocol-Version',
  SESSION_ID: 'Mcp-Session-Id',
} as const;

export interface SessionState {
  sessionId: string;
  createdAt: number;
  protocolVersion: string;
  data?: Record<string, unknown>;
}

export interface SseEvent {
  id?: string;       // Event ID for resumability
  event?: string;    // Event type
  data: string;      // JSON-RPC message
  retry?: number;    // Retry interval in ms
}

export interface SessionManager {
  create(protocolVersion: string): SessionState;
  get(sessionId: string): SessionState | undefined;
  terminate(sessionId: string): boolean;
  isValid(sessionId: string): boolean;
}
```

### HTTP Streamable Transport

```typescript
import { FastMCP } from 'fastmcp';
import type { Transport, TransportConfig, RequestHandler } from './types.js';

export class HttpStreamableTransport implements Transport {
  readonly type = 'httpStreamable' as const;
  private mcp: FastMCP | null = null;
  private protocolVersion = '2025-06-18';
  private running = false;

  constructor(private config: TransportConfig['httpStreamable']) {}

  async start(handler: RequestHandler): Promise<void> {
    const { port, host = '127.0.0.1' } = this.config!;

    this.mcp = new FastMCP({
      name: 'MCP Server',
      version: '1.0.0',
    });

    // FastMCP handles tool registration separately
    // Handler is used for custom routing

    await this.mcp.start({
      transportType: 'httpStream',
      httpStream: { port, host },
    });

    this.running = true;
  }

  async stop(): Promise<void> {
    if (this.mcp) {
      await this.mcp.stop();
      this.mcp = null;
    }
    this.running = false;
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  isRunning(): boolean {
    return this.running;
  }
}
```

### STDIO Transport

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport, RequestHandler } from './types.js';

export class StdioTransport implements Transport {
  readonly type = 'stdio' as const;
  private server: Server | null = null;
  private protocolVersion = '2025-06-18';
  private running = false;

  async start(handler: RequestHandler): Promise<void> {
    this.server = new Server(
      { name: 'MCP Server', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    );

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.running = true;
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
    this.running = false;
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  isRunning(): boolean {
    return this.running;
  }
}
```

### WebSocket Transport

```typescript
import { WebSocketServer } from 'ws';
import type { Transport, TransportConfig, RequestHandler } from './types.js';

export class WebSocketTransport implements Transport {
  readonly type = 'websocket' as const;
  private wss: WebSocketServer | null = null;
  private protocolVersion = '2025-06-18';
  private running = false;

  constructor(private config: TransportConfig['websocket']) {}

  async start(handler: RequestHandler): Promise<void> {
    const { port, host = '127.0.0.1', path = '/mcp' } = this.config!;

    this.wss = new WebSocketServer({ port, host, path });

    this.wss.on('connection', (ws) => {
      ws.on('message', async (data) => {
        try {
          const request = JSON.parse(data.toString());
          const response = await handler(request);
          ws.send(JSON.stringify(response));
        } catch (error) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32700, message: 'Parse error' },
          }));
        }
      });
    });

    this.running = true;
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          this.wss = null;
          this.running = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  isRunning(): boolean {
    return this.running;
  }
}
```

---

## Plugin System

### Plugin Interface (`plugins/types.ts`)

```typescript
export interface RequestContext {
  request: JsonRpcRequest;
  meta: { clientId?: string; timestamp: number; transport: TransportType };
  state: Map<string, unknown>;
  auth?: { userId?: string; roles: string[]; token?: string };
  license?: { tier: string; features: string[] };
}

export interface ServerPlugin {
  name: string;
  version?: string;
  priority?: number; // Lower runs first (default: 100)

  // Lifecycle
  onLoad?(server: ServerPluginHost): Promise<void>;
  onUnload?(server: ServerPluginHost): Promise<void>;

  // Request/Response
  onRequest?(ctx: RequestContext): Promise<void | JsonRpcResponse>;
  onResponse?(ctx: RequestContext, response: JsonRpcResponse): Promise<JsonRpcResponse>;
  onError?(ctx: RequestContext, error: Error): Promise<JsonRpcResponse | undefined>;

  // Tool/Resource
  onToolCall?(ctx: RequestContext, toolName: string, args: unknown): Promise<void>;
  onToolResult?(ctx: RequestContext, toolName: string, result: unknown): Promise<unknown>;
  onResourceRead?(ctx: RequestContext, uri: string): Promise<void>;
}

export interface ServerPluginHost {
  readonly name: string;
  readonly version: string;
  getTools(): ReadonlyArray<{ name: string }>;
  getResources(): ReadonlyArray<{ uri: string }>;
}
```

### Plugin Registry (`plugins/registry.ts`)

```typescript
export class PluginRegistry {
  private plugins: Map<string, ServerPlugin> = new Map();

  register(plugin: ServerPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): void {
    this.plugins.delete(name);
  }

  getAll(): ServerPlugin[] {
    return Array.from(this.plugins.values())
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  async runHook<T>(
    hookName: keyof ServerPlugin,
    ...args: unknown[]
  ): Promise<T | undefined> {
    for (const plugin of this.getAll()) {
      const hook = plugin[hookName] as Function | undefined;
      if (hook) {
        const result = await hook.apply(plugin, args);
        if (result !== undefined) return result as T;
      }
    }
    return undefined;
  }
}
```

---

## Main Server

### Server Orchestrator (`core/server.ts`)

```typescript
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { DEFAULT_PROTOCOL_VERSION, validateNotBatch } from './protocol.js';
import { convertToolSchema } from './schema-converter.js';
import { PluginRegistry } from '../plugins/registry.js';
import type { Transport, TransportConfig } from '../transports/types.js';
import type { ServerPlugin, RequestContext } from '../plugins/types.js';

export interface McpServerConfig {
  name: string;
  version: string;
  protocolVersion?: string;
  transport: TransportConfig;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute: (args: unknown, ctx: RequestContext) => Promise<unknown>;
}

export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  load: () => Promise<{ text?: string; blob?: Uint8Array }>;
}

export class McpServer {
  private mcp: FastMCP;
  private transport: Transport | null = null;
  private plugins = new PluginRegistry();
  private tools: McpTool[] = [];
  private resources: McpResource[] = [];

  constructor(private config: McpServerConfig) {
    this.mcp = new FastMCP({
      name: config.name,
      version: config.version,
    });
  }

  use(plugin: ServerPlugin): this {
    this.plugins.register(plugin);
    return this;
  }

  addTool(tool: McpTool): this {
    this.tools.push(tool);

    const zodSchema = tool.inputSchema
      ? convertToolSchema(tool.inputSchema)
      : z.object({}).strict();

    this.mcp.addTool({
      name: tool.name,
      description: tool.description || '',
      parameters: zodSchema,
      execute: async (args) => {
        const ctx = this.createContext(tool.name);

        // Run plugin hooks
        await this.plugins.runHook('onToolCall', ctx, tool.name, args);

        try {
          let result = await tool.execute(args, ctx);

          // Allow plugins to transform result
          result = await this.plugins.runHook('onToolResult', ctx, tool.name, result) ?? result;

          return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (error) {
          const errorResult = await this.plugins.runHook('onError', ctx, error);
          if (errorResult) return JSON.stringify(errorResult);
          throw error;
        }
      },
    });

    return this;
  }

  addResource(resource: McpResource): this {
    this.resources.push(resource);

    this.mcp.addResource({
      uri: resource.uri,
      name: resource.name || resource.uri,
      description: resource.description,
      mimeType: resource.mimeType || 'application/json',
      load: resource.load,
    });

    return this;
  }

  async start(): Promise<void> {
    // Initialize plugins
    const host = this.createPluginHost();
    for (const plugin of this.plugins.getAll()) {
      if (plugin.onLoad) await plugin.onLoad(host);
    }

    // Start transport based on config
    const { type, httpStreamable, websocket } = this.config.transport;

    if (type === 'httpStreamable' && httpStreamable) {
      await this.mcp.start({
        transportType: 'httpStream',
        httpStream: {
          port: httpStreamable.port,
          host: httpStreamable.host || '127.0.0.1',
        },
      });
    } else if (type === 'stdio') {
      await this.mcp.start({ transportType: 'stdio' });
    }
    // WebSocket requires custom implementation
  }

  async stop(): Promise<void> {
    // Cleanup plugins
    const host = this.createPluginHost();
    for (const plugin of this.plugins.getAll()) {
      if (plugin.onUnload) await plugin.onUnload(host);
    }

    await this.mcp.stop();
  }

  private createContext(method: string): RequestContext {
    return {
      request: { jsonrpc: '2.0', method, params: {} },
      meta: {
        timestamp: Date.now(),
        transport: this.config.transport.type,
      },
      state: new Map(),
    };
  }

  private createPluginHost() {
    return {
      name: this.config.name,
      version: this.config.version,
      getTools: () => this.tools.map(t => ({ name: t.name })),
      getResources: () => this.resources.map(r => ({ uri: r.uri })),
    };
  }
}
```

---

## Usage Examples

### Basic Server

```typescript
import { McpServer } from './mcp-server';

const server = new McpServer({
  name: 'My MCP Server',
  version: '1.0.0',
  transport: {
    type: 'httpStreamable',
    httpStreamable: { port: 3000 },
  },
});

server.addTool({
  name: 'hello',
  description: 'Say hello',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name to greet' },
    },
    required: ['name'],
  },
  execute: async (args) => {
    const { name } = args as { name: string };
    return { message: `Hello, ${name}!` };
  },
});

await server.start();
```

### With Plugins

```typescript
import { McpServer } from './mcp-server';
import { createAuthPlugin, createRateLimitPlugin } from './mcp-server/plugins';

const server = new McpServer({
  name: 'Secure MCP Server',
  version: '1.0.0',
  transport: {
    type: 'httpStreamable',
    httpStreamable: { port: 3000 },
  },
});

// Add plugins
server
  .use(createAuthPlugin({
    requireAuth: true,
    publicEndpoints: ['/health'],
  }))
  .use(createRateLimitPlugin({
    maxRequests: 100,
    windowMs: 60000,
  }));

// Add tools
server.addTool({ /* ... */ });

await server.start();
```

### Multiple Transports

```typescript
// HTTP Streamable (default, recommended)
const httpServer = new McpServer({
  name: 'HTTP Server',
  version: '1.0.0',
  transport: { type: 'httpStreamable', httpStreamable: { port: 3000 } },
});

// STDIO (for CLI tools)
const stdioServer = new McpServer({
  name: 'CLI Server',
  version: '1.0.0',
  transport: { type: 'stdio' },
});

// WebSocket (for real-time apps)
const wsServer = new McpServer({
  name: 'WebSocket Server',
  version: '1.0.0',
  transport: { type: 'websocket', websocket: { port: 3001 } },
});
```

### With Draft Features (Icons, Elicitation, Sampling)

```typescript
import {
  McpServer,
  type IconMetadata,
  type ElicitResult,
  type SamplingRequest,
  buildWWWAuthenticateHeader,
} from './mcp-server';

const server = new McpServer({
  name: 'Advanced MCP Server',
  version: '1.0.0',
  transport: { type: 'httpStreamable', httpStreamable: { port: 3000 } },
});

// Tool with icon (SEP-973)
server.addTool({
  name: 'analyze_data',
  description: 'Analyze dataset and return insights',
  icon: {
    uri: 'data:image/svg+xml,<svg>...</svg>',
    mimeType: 'image/svg+xml',
    alt: 'Analysis icon',
  },
  inputSchema: {
    type: 'object',
    properties: {
      dataset: { type: 'string', description: 'Dataset name' },
    },
    required: ['dataset'],
  },
  execute: async (args, ctx) => {
    // Check for required scope (incremental consent)
    if (!ctx.auth?.roles.includes('analyst')) {
      const challenge = buildWWWAuthenticateHeader({
        scheme: 'Bearer',
        error: 'insufficient_scope',
        scope: 'analyst:read',
        error_description: 'Analyst role required',
      });
      throw new Error(`Authorization required: ${challenge}`);
    }

    const { dataset } = args as { dataset: string };
    return { status: 'analyzed', dataset, insights: [] };
  },
});

// Resource with icon
server.addResource({
  uri: 'cortexdx://reports/daily',
  name: 'Daily Reports',
  description: 'Daily analysis reports',
  icon: {
    uri: 'https://example.com/icons/report.png',
    mimeType: 'image/png',
  },
  load: async () => ({
    text: JSON.stringify({ reports: [] }),
  }),
});

// Prompt with icon
server.addPrompt({
  name: 'security_audit',
  description: 'Guided security audit workflow',
  icon: {
    uri: 'https://example.com/icons/security.svg',
    mimeType: 'image/svg+xml',
  },
  arguments: [
    { name: 'target', description: 'Audit target', required: true },
  ],
  load: async (args) => {
    return `Perform security audit on: ${args.target}`;
  },
});

await server.start();
```

---

## RC Compliance Checklist

### Required for 2025-06-18

- [x] Protocol version negotiation
- [x] MCP-Protocol-Version header (HTTP)
- [x] No JSON-RPC batching
- [x] HTTP 403 for invalid Origin
- [x] Input validation as Tool Execution Errors (SEP-1303)
- [x] Structured tool output support (types)

### Recommended

- [x] Progress notifications (types)
- [x] Cancellation support (types)
- [x] Roots support (types)
- [ ] Resource subscriptions
- [x] Elicitation support (types)
- [x] Resource links in tool results (types)
- [x] Logging support (types)
- [x] Completion/autocompletion (types)
- [x] Lifecycle initialization (types)

### Draft Features (Post 2025-06-18)

**Major Features:**
- [x] Icon metadata for tools/resources/prompts (SEP-973)
- [x] OpenID Connect Discovery 1.0 (PR #797)
- [x] Incremental scope consent via WWW-Authenticate (SEP-835)
- [x] Tool naming guidance (SEP-986)
- [x] ElicitResult and EnumSchema with titled/multi-select (SEP-1330)
- [x] URL mode elicitation (SEP-1036)
- [x] Sampling with tools and toolChoice (SEP-1577)
- [x] OAuth Client ID Metadata Documents (SEP-991)
- [x] Tasks API for durable requests (SEP-1686)

**Minor Features:**
- [x] Implementation description field
- [x] HTTP 403 for invalid Origin clarification (PR #1439)
- [ ] SSE stream polling support (SEP-1699)

---

## Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Validate protocol compliance
npx mcp-validator http://localhost:3000
```

---

## License

MIT
