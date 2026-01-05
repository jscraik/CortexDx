/**
 * Modular MCP Server
 * Public exports for the MCP server module
 */

// Core
export {
  McpServer,
  type AuthSession,
  type FastMCPContext,
  type ToolAnnotations as FastMCPToolAnnotations,
  type FastMCPToolConfig,
  type McpPrompt,
  type McpResource,
  type McpResourceTemplate,
  type McpServerConfig,
} from "./core/server.js";

export {
  DEFAULT_PROTOCOL_VERSION,
  PROTOCOL_VERSIONS,
  ProtocolError,
  buildInitializeResponse,
  getProtocolVersionHeader,
  negotiateProtocolVersion,
  supportsFeature,
  validateNotBatch,
  type InitializeResponse,
  type ServerCapabilities as ProtocolServerCapabilities,
  type ServerInfo as ProtocolServerInfo,
  type ProtocolVersion,
} from "./core/protocol.js";

// URI Template validation and matching
export {
  buildUriFromTemplate,
  extractTemplateParameters,
  matchUriTemplate,
  matchesAnyTemplate,
  validateUriTemplate,
  type UriTemplateMatch,
  type UriTemplateValidationResult,
} from "./core/uri-template.js";

export {
  JSON_RPC_ERRORS,
  MCP_ERRORS,
  McpError,
  createAuthRequiredError,
  createProtocolMismatchError,
  createRateLimitedError,
  createToolExecutionError,
  formatJsonRpcError,
  type ErrorCode,
  type JsonRpcErrorCode,
  type McpErrorCode,
} from "./core/errors.js";

export {
  convertToolSchema,
  jsonSchemaToZod,
  type JsonSchema,
} from "./core/schema-converter.js";

// Draft specification types (post 2025-06-18)
export {
  buildWWWAuthenticateHeader,
  type AudioContent,
  type AuthChallenge,
  type AuthorizationServerMetadata,
  type BooleanElicitContent,
  type CancellationNotification,
  type ClientCapabilities,
  type ClientIdMetadataDocument,
  type ClientInfo,
  type ClientRegistrationRequest,
  type ClientRegistrationResponse,
  type CompletionArgument,
  type CompletionContext,
  type CompletionReference,
  type CompletionRequest,
  type CompletionResult,
  type ElicitContent,
  type ElicitResult,
  type ElicitationCompleteNotification,
  type ElicitationCreateRequest,
  type ElicitationCreateResult,
  type ElicitationFormResult,
  type ElicitationSchema,
  type ElicitationUrlResult,
  type EmbeddedResource,
  type EnumElicitContent,
  type EnumSchema,
  type EnumValue,
  type IconMetadata,
  type ImageContent,
  type Implementation,
  // Lifecycle types
  type InfoIcon,
  type InitializeParams,
  type InitializeResult,
  type LogMessageNotification,
  type LoggingLevel,
  type ModelHint,
  type ModelPreferences,
  type NumberElicitContent,
  type OAuthClientMetadata,
  type OAuthErrorResponse,
  type OIDCDiscoveryMetadata,
  type PingRequest,
  type PingResponse,
  // Utility types
  type ProgressNotification,
  type PromptArgument,
  type PromptContent,
  type PromptDefinition,
  type PromptGetRequest,
  type PromptGetResponse,
  type PromptListChangedNotification,
  type PromptListRequest,
  type PromptListResponse,
  type PromptMessage,
  // Authorization types (OAuth 2.1, RFC 8414, RFC 9728, RFC 7591)
  type ProtectedResourceMetadata,
  type ResourceAnnotations,
  type ResourceContent,
  type ResourceDefinition,
  type ResourceLink,
  type ResourceListChangedNotification,
  type ResourceListRequest,
  type ResourceListResponse,
  type ResourceReadRequest,
  type ResourceReadResponse,
  type ResourceSubscribeRequest,
  type ResourceTemplateDefinition,
  type ResourceTemplatesListRequest,
  type ResourceTemplatesListResponse,
  type ResourceUnsubscribeRequest,
  type ResourceUpdatedNotification,
  type Root,
  type RootsListChangedNotification,
  type SamplingContent,
  type SamplingMessage,
  type SamplingRequest,
  type SamplingResponse,
  type SamplingTool,
  type ServerCapabilities,
  type ServerInfo,
  type SetLoggingLevelRequest,
  type StructuredToolOutput,
  type TextContent,
  type TextElicitContent,
  type TitledEnumValue,
  type TokenRequest,
  type TokenResponse,
  type ToolAnnotations,
  type ToolCallContent,
  type ToolCallRequest,
  type ToolCallResponse,
  type ToolChoice,
  type ToolDefinition,
  type ToolListChangedNotification,
  type ToolListRequest,
  type ToolListResponse,
  type ToolOutputContent,
  type ToolResultContent,
  type ToolUseContent,
  type UrlElicitContent,
} from "./core/types.js";

// Re-export Tasks API from existing implementation
export type {
  CreateTaskParams,
  TaskAugmentation,
  TaskMetadata,
  TaskRecord,
  TaskStatus,
} from "../tasks/types.js";

// Transport types
export {
  DEFAULT_CORS_CONFIG,
  // Session management
  MCP_HEADERS,
  type CorsConfig,
  type HttpRequestContext,
  type HttpStreamableConfig,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type RequestHandler,
  type SessionManager,
  type SessionState,
  type SseEvent,
  type StdioConfig,
  type Transport,
  type TransportConfig,
  type TransportEvents,
  type TransportFactory,
  type TransportType,
  type WebSocketConfig,
} from "./transports/types.js";

// Transport implementations
export {
  HttpStreamableTransport,
  createHttpStreamableTransport,
} from "./transports/http-streamable.js";

export {
  StdioTransport,
  createStdioTransport,
} from "./transports/stdio.js";

export {
  WebSocketTransport,
  createWebSocketTransport,
} from "./transports/websocket.js";

// Plugin types
export type {
  AuthPluginConfig,
  CorsPluginConfig,
  HookResult,
  LicenseKey,
  LicensePluginConfig,
  PluginFactory,
  PluginLogger,
  PluginRegistrationOptions,
  RequestContext,
  ServerPlugin,
  ServerPluginHost,
} from "./plugins/types.js";

// Plugin registry
export { PluginRegistry } from "./plugins/registry.js";

// Plugin implementations
export {
  createAuthPlugin,
  hasAnyRole,
  hasRole,
  requireAuthentication,
} from "./plugins/auth.js";

export {
  DEFAULT_CORS_CONFIG as DEFAULT_CORS_PLUGIN_CONFIG,
  PERMISSIVE_CORS_CONFIG,
  createCorsPlugin,
} from "./plugins/cors.js";
