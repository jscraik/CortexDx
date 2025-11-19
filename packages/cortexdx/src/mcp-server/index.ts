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

// Draft specification types (post 2025-06-18)
export {
  type IconMetadata,
  type Implementation,
  // Lifecycle types
  type InfoIcon,
  type ClientInfo,
  type ServerInfo,
  type ClientCapabilities,
  type ServerCapabilities,
  type InitializeParams,
  type InitializeResult,
  type ToolDefinition,
  type ResourceDefinition,
  type ResourceTemplateDefinition,
  type PromptDefinition,
  type PromptArgument,
  type EnumSchema,
  type EnumValue,
  type TitledEnumValue,
  type ElicitResult,
  type ElicitContent,
  type TextElicitContent,
  type BooleanElicitContent,
  type NumberElicitContent,
  type EnumElicitContent,
  type UrlElicitContent,
  type ElicitationSchema,
  type ElicitationCreateRequest,
  type ElicitationFormResult,
  type ElicitationUrlResult,
  type ElicitationCreateResult,
  type ElicitationCompleteNotification,
  type SamplingRequest,
  type SamplingMessage,
  type SamplingContent,
  type TextContent,
  type ImageContent,
  type AudioContent,
  type ToolResultContent,
  type ModelPreferences,
  type ModelHint,
  type SamplingTool,
  type ToolChoice,
  type SamplingResponse,
  type ToolUseContent,
  type OAuthClientMetadata,
  type OIDCDiscoveryMetadata,
  type AuthChallenge,
  buildWWWAuthenticateHeader,
  // Authorization types (OAuth 2.1, RFC 8414, RFC 9728, RFC 7591)
  type ProtectedResourceMetadata,
  type AuthorizationServerMetadata,
  type ClientRegistrationRequest,
  type ClientRegistrationResponse,
  type TokenRequest,
  type TokenResponse,
  type OAuthErrorResponse,
  type ClientIdMetadataDocument,
  // Utility types
  type ProgressNotification,
  type CancellationNotification,
  type Root,
  type RootsListChangedNotification,
  type LoggingLevel,
  type SetLoggingLevelRequest,
  type LogMessageNotification,
  type CompletionRequest,
  type CompletionReference,
  type CompletionArgument,
  type CompletionResult,
  type ResourceLink,
  type StructuredToolOutput,
  type ToolOutputContent,
  type EmbeddedResource,
  type PingRequest,
  type PingResponse,
} from './core/types.js';

// Re-export Tasks API from existing implementation
export type {
  TaskStatus,
  TaskRecord,
  TaskMetadata,
  CreateTaskParams,
  TaskAugmentation,
} from '../tasks/types.js';

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
  // Session management
  MCP_HEADERS,
  type SessionState,
  type SseEvent,
  type SessionManager,
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
