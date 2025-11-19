/**
 * Modular MCP Server
 * Public exports for the MCP server module
 */

// Core
export {
  McpServer,
  type McpServerConfig,
  type McpTool,
  type McpResource,
  type McpResourceTemplate,
  type McpPrompt,
} from './core/server.js';

export {
  PROTOCOL_VERSIONS,
  DEFAULT_PROTOCOL_VERSION,
  negotiateProtocolVersion,
  getProtocolVersionHeader,
  validateNotBatch,
  buildInitializeResponse,
  supportsFeature,
  ProtocolError,
  type ProtocolVersion,
  type ServerCapabilities,
  type ServerInfo,
  type InitializeResponse,
} from './core/protocol.js';

export {
  JSON_RPC_ERRORS,
  MCP_ERRORS,
  McpError,
  createToolExecutionError,
  createAuthRequiredError,
  createRateLimitedError,
  createProtocolMismatchError,
  formatJsonRpcError,
  type JsonRpcErrorCode,
  type McpErrorCode,
  type ErrorCode,
} from './core/errors.js';

export {
  jsonSchemaToZod,
  convertToolSchema,
  type JsonSchema,
} from './core/schema-converter.js';

// Transport types
export {
  type Transport,
  type TransportType,
  type TransportConfig,
  type TransportFactory,
  type TransportEvents,
  type RequestHandler,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type HttpStreamableConfig,
  type StdioConfig,
  type WebSocketConfig,
  type CorsConfig,
  type HttpRequestContext,
  DEFAULT_CORS_CONFIG,
} from './transports/types.js';

// Transport implementations
export {
  HttpStreamableTransport,
  createHttpStreamableTransport,
} from './transports/http-streamable.js';

export {
  StdioTransport,
  createStdioTransport,
} from './transports/stdio.js';

export {
  WebSocketTransport,
  createWebSocketTransport,
} from './transports/websocket.js';

// Plugin types
export {
  type ServerPlugin,
  type ServerPluginHost,
  type RequestContext,
  type HookResult,
  type PluginLogger,
  type PluginRegistrationOptions,
  type AuthPluginConfig,
  type LicensePluginConfig,
  type LicenseKey,
  type CorsPluginConfig,
  type PluginFactory,
} from './plugins/types.js';

// Plugin registry
export { PluginRegistry } from './plugins/registry.js';

// Plugin implementations
export {
  createAuthPlugin,
  hasRole,
  hasAnyRole,
  requireAuthentication,
} from './plugins/auth.js';

export {
  createCorsPlugin,
  DEFAULT_CORS_CONFIG as DEFAULT_CORS_PLUGIN_CONFIG,
  PERMISSIVE_CORS_CONFIG,
} from './plugins/cors.js';
