/**
 * Server Plugin System Types
 * Defines the interface for MCP server plugins
 *
 * Note: These are different from diagnostic plugins in plugin-host.ts
 * Server plugins handle request/response lifecycle
 * Diagnostic plugins analyze MCP server behavior
 */

import type { JsonRpcRequest, JsonRpcResponse } from "../transports/types";

/**
 * Request context passed to plugin hooks
 */
export interface RequestContext {
  /**
   * Original JSON-RPC request
   */
  request: JsonRpcRequest;

  /**
   * Request metadata
   */
  meta: {
    clientId?: string;
    timestamp: number;
    transport: "httpStreamable" | "stdio" | "websocket";
  };

  /**
   * Mutable state that plugins can use to pass data
   */
  state: Map<string, unknown>;

  /**
   * Auth information (set by auth plugin)
   */
  auth?: {
    userId?: string;
    roles: string[];
    token?: string;
  };

  /**
   * License information (set by license plugin)
   */
  license?: {
    tier: "community" | "professional" | "enterprise";
    features: string[];
    expiresAt?: number;
  };

  /**
   * FastMCP native context (when using addTool with FastMCPContext)
   */
  fastMCP?: {
    session?: unknown;
    sessionId?: string;
    requestId?: string;
    log?: (...args: unknown[]) => void;
    reportProgress?: (progress: {
      progress: number;
      total?: number;
    }) => Promise<void>;
    streamContent?: (content: {
      type: string;
      text?: string;
      data?: unknown;
    }) => Promise<void>;
  };
}

/**
 * Plugin hook result
 * Return undefined to continue, or a response to short-circuit
 */
export type HookResult = void | undefined | JsonRpcResponse;

/**
 * Server plugin interface
 */
export interface ServerPlugin {
  /**
   * Unique plugin name
   */
  name: string;

  /**
   * Plugin version (optional)
   */
  version?: string;

  /**
   * Plugin priority (lower runs first, default: 100)
   */
  priority?: number;

  /**
   * Called when plugin is loaded
   */
  onLoad?(server: ServerPluginHost): Promise<void>;

  /**
   * Called when plugin is unloaded
   */
  onUnload?(server: ServerPluginHost): Promise<void>;

  /**
   * Called before request is processed
   * Return a response to short-circuit processing
   */
  onRequest?(ctx: RequestContext): Promise<HookResult>;

  /**
   * Called after response is generated
   * Can modify the response before sending
   */
  onResponse?(
    ctx: RequestContext,
    response: JsonRpcResponse,
  ): Promise<JsonRpcResponse>;

  /**
   * Called when an error occurs
   * Can transform the error response
   */
  onError?(
    ctx: RequestContext,
    error: Error,
  ): Promise<JsonRpcResponse | undefined>;

  /**
   * Called before a tool is executed
   */
  onToolCall?(
    ctx: RequestContext,
    toolName: string,
    args: unknown,
  ): Promise<void>;

  /**
   * Called after a tool returns
   * Can transform the result
   */
  onToolResult?(
    ctx: RequestContext,
    toolName: string,
    result: unknown,
  ): Promise<unknown>;

  /**
   * Called before a resource is read
   */
  onResourceRead?(ctx: RequestContext, uri: string): Promise<void>;

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

/**
 * Server plugin host interface
 * Provided to plugins for server interaction
 */
export interface ServerPluginHost {
  /**
   * Server name
   */
  readonly name: string;

  /**
   * Server version
   */
  readonly version: string;

  /**
   * Get registered tools
   */
  getTools(): ReadonlyArray<{ name: string; description?: string }>;

  /**
   * Get registered resources
   */
  getResources(): ReadonlyArray<{ uri: string; name?: string }>;

  /**
   * Logger
   */
  logger: PluginLogger;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

/**
 * Plugin registration options
 */
export interface PluginRegistrationOptions {
  /**
   * Override plugin priority
   */
  priority?: number;

  /**
   * Plugin-specific configuration
   */
  config?: Record<string, unknown>;
}

/**
 * Auth plugin configuration
 * Wraps existing auth-middleware
 */
export interface AuthPluginConfig {
  auth0?: {
    domain: string;
    clientId: string;
    audience?: string;
  };
  requireAuth: boolean;
  publicEndpoints?: string[];
  adminRoles?: string[];
}

/**
 * License plugin configuration
 * Wraps existing license-enforcement
 */
export interface LicensePluginConfig {
  licenseDatabase: Map<string, LicenseKey>;
  requireLicense: boolean;
  defaultTier?: "community" | "professional" | "enterprise";
}

/**
 * License key structure
 */
export interface LicenseKey {
  key: string;
  tier: "community" | "professional" | "enterprise";
  features: string[];
  expiresAt?: number;
  organizationId?: string;
  maxUsers?: number;
}

/**
 * CORS plugin configuration
 */
export interface CorsPluginConfig {
  allowedOrigins: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  maxAge?: number;
  // MCP spec 2025-06-18: strict origin check returns 403
  strictOriginCheck?: boolean;
}

/**
 * Helper type for plugin factory functions
 */
export type PluginFactory<T> = (config: T) => ServerPlugin;
