/**
 * Transport Abstraction Types
 * Defines the interface for all MCP transports
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Supported transport types
 */
export type TransportType = 'httpStreamable' | 'stdio' | 'websocket';

/**
 * JSON-RPC request structure
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC response structure
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Request handler function type
 */
export type RequestHandler = (request: JsonRpcRequest) => Promise<JsonRpcResponse>;

/**
 * Transport lifecycle events
 */
export interface TransportEvents {
  onConnect?(clientId: string): void;
  onDisconnect?(clientId: string): void;
  onError?(error: Error): void;
}

/**
 * CORS configuration for HTTP-based transports
 */
export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  maxAge?: number;
}

/**
 * HTTP Streamable transport configuration
 */
export interface HttpStreamableConfig {
  port: number;
  host?: string;
  cors?: CorsConfig;
  // MCP spec 2025-06-18: require 403 for invalid origins
  strictOriginCheck?: boolean;
}

/**
 * STDIO transport configuration
 */
export interface StdioConfig {
  // STDIO typically doesn't need config
  // but we keep it for future extensibility
}

/**
 * WebSocket transport configuration
 */
export interface WebSocketConfig {
  port: number;
  host?: string;
  path?: string;
}

/**
 * Combined transport configuration
 */
export interface TransportConfig {
  type: TransportType;
  httpStreamable?: HttpStreamableConfig;
  stdio?: StdioConfig;
  websocket?: WebSocketConfig;
}

/**
 * Transport interface that all transports must implement
 */
export interface Transport {
  /**
   * Transport type identifier
   */
  readonly type: TransportType;

  /**
   * Start the transport and begin accepting connections
   */
  start(handler: RequestHandler): Promise<void>;

  /**
   * Stop the transport and close all connections
   */
  stop(): Promise<void>;

  /**
   * Set the protocol version for this transport
   * HTTP transports use this for the MCP-Protocol-Version header
   */
  setProtocolVersion(version: string): void;

  /**
   * Get current protocol version
   */
  getProtocolVersion(): string;

  /**
   * Set event handlers
   */
  setEvents(events: TransportEvents): void;

  /**
   * Check if transport is running
   */
  isRunning(): boolean;
}

/**
 * HTTP-specific request context
 */
export interface HttpRequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  origin?: string;
  clientId?: string;
}

/**
 * Factory function type for creating transports
 */
export type TransportFactory = (config: TransportConfig) => Transport;

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowedOrigins: ['http://localhost', 'http://127.0.0.1'],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version'],
  maxAge: 86400, // 24 hours
};
