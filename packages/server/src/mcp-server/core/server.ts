/**
 * MCP Server Orchestrator
 * FastMCP-aligned implementation with plugin support
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { createLogger } from '../../logging/logger';
import {
  DEFAULT_PROTOCOL_VERSION,
  type ProtocolVersion,
  type ServerCapabilities,
} from './protocol';
// import { McpError, createToolExecutionError } from './errors'; // Removed unused imports
import type { TransportConfig, JsonRpcRequest, JsonRpcResponse } from '../transports/types';
import type {
  ServerPlugin,
  ServerPluginHost,
  RequestContext,
  PluginLogger,
} from '../plugins/types';
import type { IconMetadata } from './types';

const logger = createLogger({ component: 'mcp-server' });

/**
 * Authentication session returned by authenticate function
 */
export interface AuthSession {
  userId?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * FastMCP execution context available in tools
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
  streamContent?: (content: {
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }) => Promise<void>;
}

/**
 * Tool annotations (MCP 2025-03-26+)
 */
export interface ToolAnnotations {
  title?: string;
  streamingHint?: boolean;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * FastMCP tool configuration
 */
export interface FastMCPToolConfig {
  name: string;
  description?: string;
  parameters: z.ZodType;
  annotations?: ToolAnnotations;
  canAccess?: (session: unknown) => boolean;
  execute: (args: unknown, ctx: FastMCPContext) => Promise<unknown>;
}

/**
 * Server configuration with FastMCP options
 */
export interface McpServerConfig {
  name: string;
  version: string;

  // FastMCP native options
  instructions?: string;
  authenticate?: (request: Request) => Promise<AuthSession>;
  logger?: PluginLogger;

  // Protocol options
  protocolVersion?: ProtocolVersion;
  transport: TransportConfig;
  capabilities?: Partial<ServerCapabilities>;
}

/**
 * Resource definition with icon support (SEP-973)
 */
export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  /**
   * Icon metadata for the resource
   */
  icon?: IconMetadata;
  load: () => Promise<{ text?: string; blob?: Uint8Array }>;
}

/**
 * Resource template definition with icon support (SEP-973)
 */
export interface McpResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
  /**
   * Icon metadata for the resource template
   */
  icon?: IconMetadata;
  load: (params: Record<string, string>) => Promise<{ text?: string; blob?: Uint8Array }>;
}

/**
 * Prompt definition with icon support (SEP-973)
 */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  /**
   * Icon metadata for the prompt
   */
  icon?: IconMetadata;
  load: (args: Record<string, string>) => Promise<string>;
}

/**
 * Plugin registry for managing server plugins
 */
class PluginRegistry {
  private plugins: Map<string, ServerPlugin> = new Map();

  register(plugin: ServerPlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn({ plugin: plugin.name }, 'Plugin already registered, replacing');
    }
    this.plugins.set(plugin.name, plugin);
    logger.debug({ plugin: plugin.name, version: plugin.version }, 'Plugin registered');
  }

  unregister(name: string): void {
    this.plugins.delete(name);
    logger.debug({ plugin: name }, 'Plugin unregistered');
  }

  getAll(): ServerPlugin[] {
    return Array.from(this.plugins.values()).sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );
  }

  async runHook<T>(
    hookName: keyof ServerPlugin,
    ...args: unknown[]
  ): Promise<T | undefined> {
    for (const plugin of this.getAll()) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        try {
          const result = await (hook as Function).apply(plugin, args);
          if (result !== undefined) return result as T;
        } catch (error) {
          logger.error(
            { plugin: plugin.name, hook: hookName, error },
            'Plugin hook error'
          );
        }
      }
    }
    return undefined;
  }
}

/**
 * Main MCP Server class
 */
export class McpServer {
  private mcp: FastMCP;
  private plugins = new PluginRegistry();
  private toolNames: string[] = [];
  private resources: McpResource[] = [];
  private resourceTemplates: McpResourceTemplate[] = [];
  private prompts: McpPrompt[] = [];
  private running = false;
  private protocolVersion: ProtocolVersion;

  constructor(private config: McpServerConfig) {
    this.protocolVersion = config.protocolVersion || DEFAULT_PROTOCOL_VERSION;

    // Validate version string at runtime
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(config.version)) {
      throw new Error(
        `Invalid MCP server version "${config.version}". Expected format: "x.y.z"`
      );
    }

    // Create FastMCP with native options
    this.mcp = new FastMCP({
      name: config.name,
      version: config.version as `${number}.${number}.${number}`,
      instructions: config.instructions,
      logger: config.logger || logger,
      authenticate: config.authenticate
        ? this.wrapAuthenticate(config.authenticate)
        : undefined,
    });

    logger.info(
      {
        name: config.name,
        version: config.version,
        protocol: this.protocolVersion,
        transport: config.transport.type,
        hasAuth: !!config.authenticate,
        hasInstructions: !!config.instructions,
      },
      'MCP Server created'
    );
  }

  /**
   * Get underlying FastMCP instance for advanced features
   * @example
   * server.fastMCP.on("connect", (event) => {
   *   console.log("Client connected:", event.session);
   * });
   */
  get fastMCP(): FastMCP {
    return this.mcp;
  }

  /**
   * Register a plugin
   */
  use(plugin: ServerPlugin): this {
    this.plugins.register(plugin);
    return this;
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
        ctx.fastMCP = { session } as any;

        await this.plugins.runHook('enrichContext', ctx, { session });

        return session;
      } catch (error) {
        logger.warn({ error }, 'Authentication failed');
        throw error;
      }
    };
  }

  /**
   * Add tool with full FastMCP features + plugin support
   * @example
   * server.addTool({
   *   name: "search",
   *   description: "Search with streaming results",
   *   parameters: z.object({
   *     query: z.string(),
   *     maxResults: z.number().optional(),
   *   }),
   *   annotations: {
   *     streamingHint: true,
   *     title: "Advanced Search",
   *   },
   *   canAccess: (session) => session?.role === "admin",
   *   execute: async (args, ctx) => {
   *     ctx.log.info("Searching...");
   *     await ctx.reportProgress({ progress: 50, total: 100 });
   *     await ctx.streamContent({ type: "text", text: "Result" });
   *     return results;
   *   },
   * });
   */
  addTool(config: FastMCPToolConfig): this {
    this.toolNames.push(config.name);

    // Wrap execute to run plugin hooks
    const wrappedExecute = async (args: unknown, fastMCPContext: any) => {
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
      if (preResult !== undefined) {
        return preResult;
      }

      try {
        // Execute with full FastMCP context
        const result = await config.execute(args, fastMCPContext);

        // Post-execution plugin hooks
        const transformedResult = await this.plugins.runHook<unknown>(
          'onToolResult',
          ctx,
          config.name,
          result
        );
        if (transformedResult !== undefined) {
          return transformedResult;
        }

        return result;
      } catch (error) {
        // Error handling plugin hooks
        const errorResponse = await this.plugins.runHook<JsonRpcResponse>(
          'onError',
          ctx,
          error
        );
        if (errorResponse !== undefined) {
          return errorResponse;
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

    logger.debug({ tool: config.name }, 'Tool registered');
    return this;
  }

  /**
   * Register a resource
   */
  addResource(resource: McpResource): this {
    this.resources.push(resource);

    this.mcp.addResource({
      uri: resource.uri,
      name: resource.name || resource.uri,
      description: resource.description,
      mimeType: resource.mimeType || 'application/json',
      load: async () => {
        const ctx = this.createContext('resources/read', resource.uri);

        // Run pre-read hooks
        await this.plugins.runHook('onResourceRead', ctx, resource.uri);

        const result = await resource.load();
        return { text: result.text || '', uri: resource.uri };
      },
    });

    logger.debug({ resource: resource.uri }, 'Resource registered');
    return this;
  }

  /**
   * Register a resource template
   */
  addResourceTemplate(template: McpResourceTemplate): this {
    this.resourceTemplates.push(template);

    this.mcp.addResourceTemplate({
      uriTemplate: template.uriTemplate,
      name: template.name || template.uriTemplate,
      description: template.description,
      mimeType: template.mimeType || 'application/json',
      arguments: [],
      load: async (args) => {
        const stringArgs: Record<string, string> = {};
        for (const [key, value] of Object.entries(args)) {
          if (typeof value === 'string') {
            stringArgs[key] = value;
          } else {
            logger.warn({ key, value }, 'Non-string argument in resource template, converting to string');
            stringArgs[key] = String(value);
          }
        }
        const result = await template.load(stringArgs);
        return { text: result.text || '', uri: template.uriTemplate };
      },
    });

    logger.debug({ template: template.uriTemplate }, 'Resource template registered');
    return this;
  }

  /**
   * Register a prompt
   */
  addPrompt(prompt: McpPrompt): this {
    this.prompts.push(prompt);

    this.mcp.addPrompt({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
      load: async (args) => {
        // Convert args to Record<string, string> for our interface
        const stringArgs: Record<string, string> = {};
        for (const [key, value] of Object.entries(args)) {
          stringArgs[key] = String(value);
        }
        const content = await prompt.load(stringArgs);
        return content;
      },
    });

    logger.debug({ prompt: prompt.name }, 'Prompt registered');
    return this;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Server already running');
      return;
    }

    // Initialize plugins
    const host = this.createPluginHost();
    for (const plugin of this.plugins.getAll()) {
      if (plugin.onLoad) {
        await plugin.onLoad(host);
        logger.debug({ plugin: plugin.name }, 'Plugin loaded');
      }
    }

    // Hook into FastMCP session events
    this.mcp.on('connect', async (event: any) => {
      const ctx = this.createContext('session/connect', undefined);
      ctx.fastMCP = { session: event.session };

      logger.info(
        { sessionId: event.session?.id },
        'Client connected'
      );

      // Run plugin hooks
      await this.plugins.runHook('onSessionConnect', ctx, event.session);

      // Listen for session-specific events
      if (event.session?.on) {
        event.session.on('rootsChanged', async (e: any) => {
          await this.plugins.runHook('onRootsChanged', ctx, e.roots);
        });
      }
    });

    this.mcp.on('disconnect', async (event: any) => {
      const ctx = this.createContext('session/disconnect', undefined);
      ctx.fastMCP = { session: event.session };

      logger.info(
        { sessionId: event.session?.id },
        'Client disconnected'
      );

      await this.plugins.runHook('onSessionDisconnect', ctx, event.session);
    });

    // Start transport based on config
    const { type, httpStreamable } = this.config.transport;

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
            endpoint: httpStreamable.endpoint || '/mcp',
            stateless: httpStreamable.stateless || false,
          },
        });
        logger.info(
          {
            port: httpStreamable.port,
            host: httpStreamable.host || '127.0.0.1',
            endpoint: httpStreamable.endpoint || '/mcp',
            stateless: httpStreamable.stateless || false,
          },
          'HTTP Streamable transport started'
        );
        break;

      case 'stdio':
        await this.mcp.start({ transportType: 'stdio' });
        logger.info('STDIO transport started');
        break;

      default:
        throw new Error(`Unknown transport type: ${type}`);
    }

    this.running = true;
    logger.info(
      {
        name: this.config.name,
        version: this.config.version,
        tools: this.toolNames.length,
        resources: this.resources.length,
        prompts: this.prompts.length,
      },
      'MCP Server started'
    );
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Cleanup plugins
    const host = this.createPluginHost();
    for (const plugin of this.plugins.getAll()) {
      if (plugin.onUnload) {
        await plugin.onUnload(host);
        logger.debug({ plugin: plugin.name }, 'Plugin unloaded');
      }
    }

    await this.mcp.stop();
    this.running = false;
    logger.info('MCP Server stopped');
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; protocol: string } {
    return {
      name: this.config.name,
      version: this.config.version,
      protocol: this.protocolVersion,
    };
  }

  /**
   * Get registered tool names
   */
  getTools(): ReadonlyArray<string> {
    return this.toolNames;
  }

  /**
   * Get registered resources
   */
  getResources(): ReadonlyArray<McpResource> {
    return this.resources;
  }

  /**
   * Get registered prompts
   */
  getPrompts(): ReadonlyArray<McpPrompt> {
    return this.prompts;
  }

  /**
   * Create request context for hooks
   */
  private createContext(method: string, target?: string): RequestContext {
    return {
      request: {
        jsonrpc: '2.0',
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        method,
        params: target ? { name: target } : {},
      },
      meta: {
        timestamp: Date.now(),
        transport: this.config.transport.type,
      },
      state: new Map(),
    };
  }

  /**
   * Create plugin host for plugin lifecycle
   */
  private createPluginHost(): ServerPluginHost {
    const pluginLogger: PluginLogger = {
      debug: (msg, data) => logger.debug(data || {}, msg),
      info: (msg, data) => logger.info(data || {}, msg),
      warn: (msg, data) => logger.warn(data || {}, msg),
      error: (msg, data) => logger.error(data || {}, msg),
    };

    return {
      name: this.config.name,
      version: this.config.version,
      getTools: () => this.toolNames.map((name) => ({ name })),
      getResources: () => this.resources.map((r) => ({ uri: r.uri, name: r.name })),
      logger: pluginLogger,
    };
  }
}
