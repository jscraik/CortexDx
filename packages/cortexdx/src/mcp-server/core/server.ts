/**
 * MCP Server Orchestrator
 * Main entry point for the modular FastMCP server
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { createLogger } from '../../logging/logger.js';
import {
  DEFAULT_PROTOCOL_VERSION,
  validateNotBatch,
  buildInitializeResponse,
  type ProtocolVersion,
  type ServerCapabilities,
} from './protocol.js';
import { convertToolSchema } from './schema-converter.js';
import { McpError, MCP_ERRORS, createToolExecutionError } from './errors.js';
import type { TransportConfig, JsonRpcRequest, JsonRpcResponse } from '../transports/types.js';
import type {
  ServerPlugin,
  ServerPluginHost,
  RequestContext,
  PluginLogger,
} from '../plugins/types.js';
import type { IconMetadata } from './types.js';

const logger = createLogger({ component: 'mcp-server' });

/**
 * Server configuration
 */
export interface McpServerConfig {
  name: string;
  version: string;
  protocolVersion?: ProtocolVersion;
  transport: TransportConfig;
  capabilities?: Partial<ServerCapabilities>;
}

/**
 * Tool definition with icon support (SEP-973)
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  /**
   * Icon metadata for the tool
   */
  icon?: IconMetadata;
  execute: (args: unknown, ctx: RequestContext) => Promise<unknown>;
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
  private tools: McpTool[] = [];
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
    this.mcp = new FastMCP({
      name: config.name,
      version: config.version as `${number}.${number}.${number}`,
    });

    logger.info(
      {
        name: config.name,
        version: config.version,
        protocol: this.protocolVersion,
        transport: config.transport.type,
      },
      'MCP Server created'
    );
  }

  /**
   * Register a plugin
   */
  use(plugin: ServerPlugin): this {
    this.plugins.register(plugin);
    return this;
  }

  /**
   * Register a tool
   */
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
        const ctx = this.createContext('tools/call', tool.name);

        // Run pre-execution hooks
        const preResult = await this.plugins.runHook<JsonRpcResponse>(
          'onToolCall',
          ctx,
          tool.name,
          args
        );
        if (preResult) {
          return JSON.stringify(preResult);
        }

        try {
          let result = await tool.execute(args, ctx);

          // Allow plugins to transform result
          const transformedResult = await this.plugins.runHook<unknown>(
            'onToolResult',
            ctx,
            tool.name,
            result
          );
          if (transformedResult !== undefined) {
            result = transformedResult;
          }

          return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (error) {
          // Handle errors through plugin hooks
          const errorResponse = await this.plugins.runHook<JsonRpcResponse>(
            'onError',
            ctx,
            error
          );
          if (errorResponse) {
            return JSON.stringify(errorResponse);
          }

          // Convert to tool execution error (SEP-1303)
          const mcpError =
            error instanceof McpError
              ? error
              : createToolExecutionError(
                  error instanceof Error ? error.message : String(error)
                );

          return JSON.stringify({
            error: mcpError.message,
            isError: true,
            code: mcpError.code,
          });
        }
      },
    });

    logger.debug({ tool: tool.name }, 'Tool registered');
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

    // Start transport based on config
    const { type, httpStreamable, stdio, websocket } = this.config.transport;

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
          },
        });
        logger.info(
          { port: httpStreamable.port, host: httpStreamable.host || '127.0.0.1' },
          'HTTP Streamable transport started'
        );
        break;

      case 'stdio':
        await this.mcp.start({ transportType: 'stdio' });
        logger.info('STDIO transport started');
        break;

      case 'websocket':
        // WebSocket requires custom implementation
        // For now, throw not implemented
        throw new Error('WebSocket transport not yet implemented');

      default:
        throw new Error(`Unknown transport type: ${type}`);
    }

    this.running = true;
    logger.info(
      {
        name: this.config.name,
        version: this.config.version,
        tools: this.tools.length,
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
   * Get registered tools
   */
  getTools(): ReadonlyArray<McpTool> {
    return this.tools;
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
      getTools: () => this.tools.map((t) => ({ name: t.name, description: t.description })),
      getResources: () => this.resources.map((r) => ({ uri: r.uri, name: r.name })),
      logger: pluginLogger,
    };
  }
}
