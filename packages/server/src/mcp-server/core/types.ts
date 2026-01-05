/**
 * Core MCP Types
 * Based on MCP specification draft (post 2025-06-18)
 */

// Re-export JSON-RPC 2.0 types
export type {
  JSONRPCError,
  JSONRPCErrorResponse,
  JSONRPCMessage,
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCResultResponse,
  RequestId,
} from "./jsonrpc.js";

export {
  createJSONRPCErrorResponse,
  createJSONRPCNotification,
  createJSONRPCRequest,
  createJSONRPCResultResponse,
  isJSONRPCErrorResponse,
  isJSONRPCNotification,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  JSONRPCErrorCode,
  parseJSONRPCMessage,
  serializeJSONRPCMessage,
  validateJSONRPCMessage,
} from "./jsonrpc.js";

// Import internal task types for use in MCP types
import type { TaskMetadata as InternalTaskMetadata } from "../../tasks/types.js";

/**
 * Icon metadata for tools, resources, and prompts (SEP-973)
 */
export interface IconMetadata {
  /**
   * URI to the icon (can be data: URI, http(s): URI, or relative path)
   */
  uri: string;

  /**
   * MIME type of the icon (e.g., "image/svg+xml", "image/png")
   */
  mimeType?: string;

  /**
   * Alt text for accessibility
   */
  alt?: string;
}

/**
 * Implementation info with optional description
 */
export interface Implementation {
  name: string;
  version: string;
  /**
   * Human-readable description of the implementation
   */
  description?: string;
}

// =============================================================================
// Lifecycle Types (Initialization, Capabilities, Client/Server Info)
// =============================================================================

/**
 * Icon for client/server info (different from IconMetadata)
 */
export interface InfoIcon {
  /**
   * URI to the icon
   */
  src: string;
  /**
   * MIME type of the icon
   */
  mimeType?: string;
  /**
   * Supported sizes (e.g., ["48x48", "any"])
   */
  sizes?: string[];
}

/**
 * Client information sent during initialization
 */
export interface ClientInfo {
  name: string;
  /**
   * Display name for the client
   */
  title?: string;
  version: string;
  /**
   * Human-readable description
   */
  description?: string;
  /**
   * Client icons
   */
  icons?: InfoIcon[];
  /**
   * Client website URL
   */
  websiteUrl?: string;
}

/**
 * Server information returned during initialization
 */
export interface ServerInfo {
  name: string;
  /**
   * Display name for the server
   */
  title?: string;
  version: string;
  /**
   * Human-readable description
   */
  description?: string;
  /**
   * Server icons
   */
  icons?: InfoIcon[];
  /**
   * Server website URL
   */
  websiteUrl?: string;
}

/**
 * Client capabilities for initialization
 */
export interface ClientCapabilities {
  /**
   * Filesystem roots capability
   */
  roots?: {
    listChanged?: boolean;
  };
  /**
   * LLM sampling capability
   */
  sampling?: Record<string, never>;
  /**
   * Elicitation capability
   */
  elicitation?: {
    form?: Record<string, never>;
    url?: Record<string, never>;
  };
  /**
   * Task-augmented requests capability
   */
  tasks?: {
    requests?: {
      elicitation?: {
        create?: Record<string, never>;
      };
      sampling?: {
        createMessage?: Record<string, never>;
      };
    };
  };
  /**
   * Non-standard experimental features
   */
  experimental?: Record<string, unknown>;
}

/**
 * Server capabilities for initialization
 */
export interface ServerCapabilities {
  /**
   * Structured log messages capability
   */
  logging?: Record<string, never>;
  /**
   * Prompt templates capability
   */
  prompts?: {
    listChanged?: boolean;
  };
  /**
   * Readable resources capability
   */
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  /**
   * Callable tools capability
   */
  tools?: {
    listChanged?: boolean;
  };
  /**
   * Argument autocompletion capability
   */
  completions?: Record<string, never>;
  /**
   * Task-augmented requests capability
   */
  tasks?: {
    list?: Record<string, never>;
    cancel?: Record<string, never>;
    requests?: {
      tools?: {
        call?: Record<string, never>;
      };
    };
  };
  /**
   * Non-standard experimental features
   */
  experimental?: Record<string, unknown>;
}

/**
 * Initialize request parameters
 */
export interface InitializeParams {
  /**
   * Protocol version supported by client
   */
  protocolVersion: string;
  /**
   * Client capabilities
   */
  capabilities: ClientCapabilities;
  /**
   * Client implementation information
   */
  clientInfo: ClientInfo;
}

/**
 * Initialize response result
 */
export interface InitializeResult {
  /**
   * Negotiated protocol version
   */
  protocolVersion: string;
  /**
   * Server capabilities
   */
  capabilities: ServerCapabilities;
  /**
   * Server implementation information
   */
  serverInfo: ServerInfo;
  /**
   * Optional instructions for the client
   */
  instructions?: string;
}

/**
 * Tool annotations describing behavior
 */
export interface ToolAnnotations {
  /**
   * Human-assigned title for the tool
   */
  title?: string;
  /**
   * If true, the tool does not modify state
   */
  readOnlyHint?: boolean;
  /**
   * If true, the tool may have destructive effects
   */
  destructiveHint?: boolean;
  /**
   * If true, the tool may take a long time
   */
  idempotentHint?: boolean;
  /**
   * If true, the tool interacts with the external world
   */
  openWorldHint?: boolean;
}

/**
 * Execution properties for a tool
 */
export interface ToolExecution {
  /**
   * Whether this tool supports task-augmented execution
   * - "forbidden": Does not support tasks (default)
   * - "optional": May support tasks
   * - "required": Requires task-augmented execution
   */
  taskSupport?: "forbidden" | "optional" | "required";
}

/**
 * Tool definition with icon support
 */
export interface ToolDefinition {
  name: string;
  /**
   * Human-readable title for display purposes
   */
  title?: string;
  description?: string;
  /**
   * JSON Schema for tool parameters (must be type: "object")
   */
  inputSchema: {
    type: "object";
    properties?: { [key: string]: object };
    required?: string[];
    $schema?: string;
  };
  /**
   * JSON Schema for validating structured output (must be type: "object")
   */
  outputSchema?: {
    type: "object";
    properties?: { [key: string]: object };
    required?: string[];
    $schema?: string;
  };
  /**
   * Icons for the tool (SEP-973)
   */
  icons?: IconMetadata[];
  /**
   * Tool behavior annotations
   */
  annotations?: ToolAnnotations;
  /**
   * Execution-related properties
   */
  execution?: ToolExecution;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Base interface for paginated requests
 */
export interface PaginatedRequestParams {
  /**
   * Pagination cursor from previous result
   */
  cursor?: string;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Base interface for paginated results
 */
export interface PaginatedResult {
  /**
   * Pagination cursor for next page
   */
  nextCursor?: string;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Tools list request parameters
 */
export interface ToolListRequest extends PaginatedRequestParams {
  // Inherits cursor and _meta from PaginatedRequestParams
}

/**
 * Tools list response
 */
export interface ToolListResponse extends PaginatedResult {
  tools: ToolDefinition[];
}

/**
 * Tool call request parameters
 * Extends TaskAugmentedRequestParams for task support
 */
export interface ToolCallRequest extends TaskAugmentedRequestParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * Tool call response
 *
 * NOTE: structuredContent should conform to the tool's outputSchema.
 * - If outputSchema defines type: "object", structuredContent must be a single object
 * - For array results, wrap in an object like { items: [...] }
 * - This ensures schema validation and proper LLM integration
 */
export interface ToolCallResponse {
  content: ToolCallContent[];
  /**
   * Structured content conforming to outputSchema
   * Must be a single object matching the outputSchema definition
   * @see https://modelcontextprotocol.io/best-practices/response-formatting
   */
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Tool call content types (for tool call responses)
 */
export type ToolCallContent =
  | { type: "text"; text: string; annotations?: ResourceAnnotations }
  | {
      type: "image";
      data: string;
      mimeType: string;
      annotations?: ResourceAnnotations;
    }
  | {
      type: "audio";
      data: string;
      mimeType: string;
      annotations?: ResourceAnnotations;
    }
  | {
      type: "resource_link";
      uri: string;
      name?: string;
      description?: string;
      mimeType?: string;
      annotations?: ResourceAnnotations;
    }
  | { type: "resource"; resource: EmbeddedResource };

/**
 * Notification when tools list changes
 */
export interface ToolListChangedNotification {
  [key: string]: never;
}

/**
 * Resource annotations for metadata
 */
export interface ResourceAnnotations {
  /**
   * Intended audience(s) for this resource
   */
  audience?: ("user" | "assistant")[];
  /**
   * Importance from 0.0 (optional) to 1.0 (required)
   */
  priority?: number;
  /**
   * ISO 8601 timestamp of last modification
   */
  lastModified?: string;
}

/**
 * Resource definition with icon support
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  /**
   * Human-readable title for display purposes
   */
  title?: string;
  description?: string;
  mimeType?: string;
  /**
   * Size in bytes
   */
  size?: number;
  /**
   * Icons for the resource (SEP-973)
   */
  icons?: IconMetadata[];
  /**
   * Resource annotations
   */
  annotations?: ResourceAnnotations;
}

/**
 * Resource template definition with icon support
 */
export interface ResourceTemplateDefinition {
  uriTemplate: string;
  name: string;
  /**
   * Human-readable title for display purposes
   */
  title?: string;
  description?: string;
  mimeType?: string;
  /**
   * Icons for the resource template (SEP-973)
   */
  icons?: IconMetadata[];
  /**
   * Resource annotations
   */
  annotations?: ResourceAnnotations;
}

/**
 * Resource content (text or binary)
 */
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  /**
   * Text content (mutually exclusive with blob)
   */
  text?: string;
  /**
   * Base64-encoded binary content
   */
  blob?: string;
  /**
   * Content annotations
   */
  annotations?: ResourceAnnotations;
}

/**
 * Resources list request parameters
 */
export interface ResourceListRequest extends PaginatedRequestParams {
  // Inherits cursor and _meta
}

/**
 * Resources list response
 */
export interface ResourceListResponse extends PaginatedResult {
  resources: ResourceDefinition[];
}

/**
 * Resource read request parameters
 */
export interface ResourceReadRequest {
  uri: string;
}

/**
 * Resource read response
 */
export interface ResourceReadResponse {
  contents: ResourceContent[];
}

/**
 * Resource templates list request
 */
export interface ResourceTemplatesListRequest {
  cursor?: string;
}

/**
 * Resource templates list response
 */
export interface ResourceTemplatesListResponse {
  resourceTemplates: ResourceTemplateDefinition[];
  nextCursor?: string;
}

/**
 * Resource subscribe request
 */
export interface ResourceSubscribeRequest {
  uri: string;
}

/**
 * Resource unsubscribe request
 */
export interface ResourceUnsubscribeRequest {
  uri: string;
}

/**
 * Notification when resources list changes
 */
export interface ResourceListChangedNotification {
  [key: string]: never;
}

/**
 * Notification when a subscribed resource is updated
 */
export interface ResourceUpdatedNotification {
  uri: string;
}

/**
 * Prompt definition with icon support
 */
export interface PromptDefinition {
  name: string;
  /**
   * Human-readable title for display purposes
   */
  title?: string;
  description?: string;
  arguments?: PromptArgument[];
  /**
   * Icons for the prompt (SEP-973)
   */
  icons?: IconMetadata[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Prompt message content types
 */
export type PromptContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "audio"; data: string; mimeType: string }
  | { type: "resource"; resource: EmbeddedResource };

/**
 * Prompt message with role and content
 */
export interface PromptMessage {
  role: "user" | "assistant";
  content: PromptContent;
}

/**
 * Prompts list request parameters
 */
export interface PromptListRequest extends PaginatedRequestParams {
  // Inherits cursor and _meta
}

/**
 * Prompts list response
 */
export interface PromptListResponse extends PaginatedResult {
  prompts: PromptDefinition[];
}

/**
 * Prompt get request parameters
 */
export interface PromptGetRequest {
  name: string;
  arguments?: Record<string, string>;
}

/**
 * Prompt get response
 */
export interface PromptGetResponse {
  description?: string;
  messages: PromptMessage[];
}

/**
 * Notification when prompts list changes
 */
export interface PromptListChangedNotification {
  [key: string]: never;
}

/**
 * Enum schema for elicitation (SEP-1330)
 * Supports titled, untitled, single-select, and multi-select
 */
export interface EnumSchema {
  type: "enum";
  /**
   * Whether multiple values can be selected
   */
  multiSelect?: boolean;
  /**
   * Enum values - can be simple strings or titled values
   */
  values: EnumValue[];
}

export type EnumValue = string | TitledEnumValue;

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
  action: "accept" | "decline" | "cancel";
  content?: ElicitContent;
}

export type ElicitContent =
  | TextElicitContent
  | BooleanElicitContent
  | NumberElicitContent
  | EnumElicitContent
  | UrlElicitContent;

export interface TextElicitContent {
  type: "text";
  value: string;
}

export interface BooleanElicitContent {
  type: "boolean";
  value: boolean;
}

export interface NumberElicitContent {
  type: "number";
  value: number;
}

export interface EnumElicitContent {
  type: "enum";
  /**
   * Selected value(s) - array for multiSelect, single value otherwise
   */
  value: string | string[];
}

/**
 * URL elicitation content (SEP-1036)
 */
export interface UrlElicitContent {
  type: "url";
  value: string;
  /**
   * Whether the URL was validated
   */
  validated?: boolean;
}

/**
 * Elicitation request schema
 */
export interface ElicitationSchema {
  type: "text" | "boolean" | "number" | "enum" | "url";
  /**
   * For enum type
   */
  enum?: EnumSchema;
  /**
   * For url type - allowed URL patterns
   */
  urlPatterns?: string[];
  /**
   * Validation constraints
   */
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

/**
 * Elicitation create request parameters
 * Extends TaskAugmentedRequestParams for task support
 */
export interface ElicitationCreateRequest extends TaskAugmentedRequestParams {
  /**
   * Message to display to the user
   */
  message: string;
  /**
   * Schema for the requested information
   * Keys are property names, values define the expected type and constraints
   */
  requestedSchema: Record<string, ElicitationSchema>;
}

/**
 * Elicitation create result for form mode
 * Returns the user's response directly
 */
export interface ElicitationFormResult extends ElicitResult {
  // Form mode returns ElicitResult directly
}

/**
 * Elicitation create result for URL mode
 * Returns URL for user to complete elicitation externally
 */
export interface ElicitationUrlResult {
  /**
   * Unique identifier for this elicitation
   */
  elicitationId: string;
  /**
   * URL where user should complete the elicitation
   */
  url: string;
}

/**
 * Union of possible elicitation create results
 */
export type ElicitationCreateResult =
  | ElicitationFormResult
  | ElicitationUrlResult;

/**
 * Notification sent when URL mode elicitation is completed
 */
export interface ElicitationCompleteNotification {
  /**
   * The elicitation ID from the create result
   */
  elicitationId: string;
  /**
   * The user's response
   */
  result: ElicitResult;
}

/**
 * Sampling request with tool calling support (SEP-1577)
 * Extends TaskAugmentedRequestParams for task support
 */
export interface SamplingRequest extends TaskAugmentedRequestParams {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: "none" | "thisServer" | "allServers";
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
  /**
   * Tools available for the model to call (SEP-1577)
   */
  tools?: SamplingTool[];
  /**
   * Tool choice configuration (SEP-1577)
   */
  toolChoice?: ToolChoice;
}

export interface SamplingMessage {
  role: "user" | "assistant";
  /**
   * Message content - can be single block or array
   */
  content: SamplingMessageContentBlock | SamplingMessageContentBlock[];
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * All possible content blocks in sampling messages
 */
export type SamplingMessageContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | ToolUseContent
  | ToolResultContent;

/**
 * Legacy alias for backward compatibility
 */
export type SamplingContent = SamplingMessageContentBlock;

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface AudioContent {
  type: "audio";
  data: string;
  mimeType: string;
}

/**
 * General content block type used across MCP
 */
export type ContentBlock =
  | TextContent
  | ImageContent
  | AudioContent
  | {
      type: "resource_link";
      uri: string;
      name?: string;
      description?: string;
      mimeType?: string;
      annotations?: ResourceAnnotations;
    }
  | { type: "resource"; resource: EmbeddedResource };

export interface ToolResultContent {
  type: "tool_result";
  /**
   * ID matching a previous ToolUseContent
   */
  toolUseId: string;
  /**
   * Unstructured result content (can include text, images, audio, resource links)
   */
  content: ContentBlock[];
  /**
   * Whether the tool use resulted in an error
   */
  isError?: boolean;
  /**
   * Optional structured result conforming to outputSchema
   */
  structuredContent?: { [key: string]: unknown };
  /**
   * Optional metadata for caching optimizations
   */
  _meta?: { [key: string]: unknown };
}

export interface ModelPreferences {
  hints?: ModelHint[];
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

export interface ModelHint {
  name?: string;
}

/**
 * Tool for sampling (SEP-1577)
 */
export interface SamplingTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Tool choice for sampling (MCP Spec)
 * Controls how the model uses tools during sampling
 */
export interface ToolChoice {
  /**
   * Tool use mode
   * - "auto": Model decides whether to use tools (default)
   * - "required": Model MUST use at least one tool
   * - "none": Model MUST NOT use any tools
   */
  mode?: "none" | "required" | "auto";
}

/**
 * Sampling response from sampling/createMessage
 */
export interface SamplingResponse {
  role: "assistant";
  /**
   * Response content - can be single block or array
   */
  content: SamplingMessageContentBlock | SamplingMessageContentBlock[];
  /**
   * Model that generated the message
   */
  model: string;
  /**
   * Why sampling stopped
   * - "endTurn": Natural end of assistant's turn
   * - "stopSequence": Stop sequence encountered
   * - "maxTokens": Token limit reached
   * - "toolUse": Model wants to use tools
   */
  stopReason?: "endTurn" | "stopSequence" | "maxTokens" | "toolUse" | string;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

export interface ToolUseContent {
  type: "tool_use";
  /**
   * Unique identifier for this tool use
   */
  id: string;
  /**
   * Name of the tool to call
   */
  name: string;
  /**
   * Arguments conforming to the tool's input schema
   */
  input: Record<string, unknown>;
  /**
   * Optional metadata for caching optimizations
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Progress token for tracking long-running operations
 */
export type ProgressToken = string | number;

/**
 * MCP Task status values (different from internal TaskStatus)
 * State transitions:
 * - working → input_required, completed, failed, cancelled
 * - input_required → working, completed, failed, cancelled
 * - completed, failed, cancelled are terminal states
 */
export type MCPTaskStatus =
  | "working" // Currently being processed
  | "input_required" // Needs input from requestor
  | "completed" // Successfully completed
  | "failed" // Did not complete successfully
  | "cancelled"; // Cancelled before completion

/**
 * Base parameters for task-augmented requests
 * Any request can include these fields to enable task execution
 */
export interface TaskAugmentedRequestParams {
  /**
   * If specified, the caller is requesting task-augmented execution.
   * The request will return a CreateTaskResult immediately, and the actual
   * result can be retrieved later via tasks/result.
   */
  task?: InternalTaskMetadata;
  /**
   * Metadata for this request
   */
  _meta?: {
    /**
     * Progress token for out-of-band progress notifications
     */
    progressToken?: ProgressToken;
    [key: string]: unknown;
  };
}

/**
 * Immediate response when a task-augmented request is created
 */
export interface CreateTaskResult {
  /**
   * Task information
   */
  task: MCPTask;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Full MCP task object with status and metadata
 */
export interface MCPTask {
  /**
   * Unique identifier for this task
   */
  taskId: string;
  /**
   * Current task status
   */
  status: MCPTaskStatus;
  /**
   * Human-readable status message
   */
  statusMessage?: string;
  /**
   * When the task was created (ISO 8601)
   */
  createdAt: string;
  /**
   * When the task was last updated (ISO 8601)
   */
  lastUpdatedAt: string;
  /**
   * Time-to-live in milliseconds
   */
  ttl?: number;
  /**
   * Suggested polling interval in milliseconds
   */
  pollInterval?: number;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Get task result request
 */
export interface GetTaskPayloadRequest {
  /**
   * Task ID to retrieve
   */
  taskId: string;
}

/**
 * Cancel task request
 */
export interface CancelTaskRequest {
  /**
   * Task ID to cancel
   */
  taskId: string;
  /**
   * Optional reason for cancellation
   */
  reason?: string;
}

/**
 * Cancel task result
 */
export interface CancelTaskResult {
  /**
   * Updated task information
   */
  task: MCPTask;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * List tasks request
 */
export interface ListTasksRequest {
  /**
   * Optional pagination cursor
   */
  cursor?: string;
}

/**
 * List tasks result
 */
export interface ListTasksResult {
  /**
   * Array of tasks
   */
  tasks: MCPTask[];
  /**
   * Pagination cursor for next page
   */
  nextCursor?: string;
  /**
   * Optional metadata
   */
  _meta?: { [key: string]: unknown };
}

/**
 * Internal task types from existing implementation
 * Re-exported for backward compatibility
 */
export type {
  CreateTaskParams,
  TaskAugmentation,
  TaskMetadata,
  TaskRecord,
  TaskStatus,
} from "../../tasks/types.js";

/**
 * OAuth Client ID Metadata (SEP-991)
 */
export interface OAuthClientMetadata {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  tos_uri?: string;
  policy_uri?: string;
  software_id?: string;
  software_version?: string;
}

/**
 * OpenID Connect Discovery metadata (PR #797)
 */
export interface OIDCDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  grant_types_supported?: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  token_endpoint_auth_methods_supported?: string[];
}

/**
 * WWW-Authenticate challenge for incremental consent (SEP-835)
 */
export interface AuthChallenge {
  scheme: "Bearer";
  realm?: string;
  error?: "invalid_token" | "insufficient_scope";
  error_description?: string;
  /**
   * Required scope(s) for the operation
   */
  scope?: string;
}

/**
 * Build WWW-Authenticate header value
 */
export function buildWWWAuthenticateHeader(challenge: AuthChallenge): string {
  const parts = [`${challenge.scheme}`];

  if (challenge.realm) {
    parts.push(`realm="${challenge.realm}"`);
  }

  if (challenge.error) {
    parts.push(`error="${challenge.error}"`);
  }

  if (challenge.error_description) {
    parts.push(`error_description="${challenge.error_description}"`);
  }

  if (challenge.scope) {
    parts.push(`scope="${challenge.scope}"`);
  }

  return parts.join(", ");
}

// =============================================================================
// Authorization Types (OAuth 2.1, RFC 8414, RFC 9728, RFC 7591)
// =============================================================================

/**
 * Protected Resource Metadata (RFC 9728)
 * Advertises authorization server location for MCP servers
 */
export interface ProtectedResourceMetadata {
  /**
   * Protected resource identifier
   */
  resource: string;
  /**
   * Authorization server(s) that can issue tokens for this resource
   */
  authorization_servers: string[];
  /**
   * Supported scopes for this resource
   */
  scopes_supported?: string[];
  /**
   * Supported bearer token methods
   */
  bearer_methods_supported?: ("header" | "body" | "query")[];
  /**
   * Supported resource signing algorithms
   */
  resource_signing_alg_values_supported?: string[];
  /**
   * Documentation URL
   */
  resource_documentation?: string;
  /**
   * Policy URL
   */
  resource_policy_uri?: string;
  /**
   * Terms of service URL
   */
  resource_tos_uri?: string;
}

/**
 * Authorization Server Metadata (RFC 8414)
 * Full OAuth 2.0 authorization server metadata
 */
export interface AuthorizationServerMetadata {
  /**
   * Authorization server identifier
   */
  issuer: string;
  /**
   * Authorization endpoint URL
   */
  authorization_endpoint: string;
  /**
   * Token endpoint URL
   */
  token_endpoint: string;
  /**
   * JWKS URI
   */
  jwks_uri?: string;
  /**
   * Dynamic client registration endpoint
   */
  registration_endpoint?: string;
  /**
   * Supported scopes
   */
  scopes_supported?: string[];
  /**
   * Supported response types
   */
  response_types_supported: string[];
  /**
   * Supported response modes
   */
  response_modes_supported?: string[];
  /**
   * Supported grant types
   */
  grant_types_supported?: string[];
  /**
   * Supported token endpoint auth methods
   */
  token_endpoint_auth_methods_supported?: string[];
  /**
   * Supported PKCE code challenge methods
   */
  code_challenge_methods_supported?: string[];
  /**
   * Service documentation URL
   */
  service_documentation?: string;
  /**
   * UI locales supported
   */
  ui_locales_supported?: string[];
  /**
   * Revocation endpoint
   */
  revocation_endpoint?: string;
  /**
   * Introspection endpoint
   */
  introspection_endpoint?: string;
  /**
   * Whether Client ID Metadata Documents are supported
   */
  client_id_metadata_document_supported?: boolean;
}

/**
 * Dynamic Client Registration Request (RFC 7591)
 */
export interface ClientRegistrationRequest {
  /**
   * Redirect URIs for authorization code flow
   */
  redirect_uris: string[];
  /**
   * Token endpoint authentication method
   */
  token_endpoint_auth_method?:
    | "none"
    | "client_secret_basic"
    | "client_secret_post"
    | "private_key_jwt";
  /**
   * Grant types the client will use
   */
  grant_types?: string[];
  /**
   * Response types the client will use
   */
  response_types?: string[];
  /**
   * Human-readable client name
   */
  client_name?: string;
  /**
   * Client homepage URL
   */
  client_uri?: string;
  /**
   * Logo URL
   */
  logo_uri?: string;
  /**
   * Requested scope
   */
  scope?: string;
  /**
   * Contacts
   */
  contacts?: string[];
  /**
   * Terms of service URL
   */
  tos_uri?: string;
  /**
   * Privacy policy URL
   */
  policy_uri?: string;
  /**
   * JWKS URI for client public keys
   */
  jwks_uri?: string;
  /**
   * Software identifier
   */
  software_id?: string;
  /**
   * Software version
   */
  software_version?: string;
}

/**
 * Dynamic Client Registration Response (RFC 7591)
 */
export interface ClientRegistrationResponse {
  /**
   * Issued client identifier
   */
  client_id: string;
  /**
   * Client secret (for confidential clients)
   */
  client_secret?: string;
  /**
   * Client secret expiration time
   */
  client_secret_expires_at?: number;
  /**
   * Registration access token
   */
  registration_access_token?: string;
  /**
   * Registration client URI
   */
  registration_client_uri?: string;
  /**
   * All other registration metadata
   */
  [key: string]: unknown;
}

/**
 * OAuth Token Request
 */
export interface TokenRequest {
  /**
   * Grant type
   */
  grant_type: "authorization_code" | "refresh_token" | "client_credentials";
  /**
   * Authorization code (for authorization_code grant)
   */
  code?: string;
  /**
   * Redirect URI (for authorization_code grant)
   */
  redirect_uri?: string;
  /**
   * Client identifier
   */
  client_id?: string;
  /**
   * PKCE code verifier
   */
  code_verifier?: string;
  /**
   * Refresh token (for refresh_token grant)
   */
  refresh_token?: string;
  /**
   * Requested scope
   */
  scope?: string;
  /**
   * Resource indicator (RFC 8707)
   */
  resource?: string;
}

/**
 * OAuth Token Response
 */
export interface TokenResponse {
  /**
   * Access token
   */
  access_token: string;
  /**
   * Token type (usually "Bearer")
   */
  token_type: string;
  /**
   * Token expiration in seconds
   */
  expires_in?: number;
  /**
   * Refresh token
   */
  refresh_token?: string;
  /**
   * Granted scope
   */
  scope?: string;
}

/**
 * OAuth Error Response
 */
export interface OAuthErrorResponse {
  /**
   * Error code
   */
  error:
    | "invalid_request"
    | "invalid_client"
    | "invalid_grant"
    | "unauthorized_client"
    | "unsupported_grant_type"
    | "invalid_scope"
    | "access_denied"
    | "server_error";
  /**
   * Human-readable error description
   */
  error_description?: string;
  /**
   * Error URI for more information
   */
  error_uri?: string;
}

/**
 * Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document)
 * Extended version of OAuthClientMetadata with full document fields
 */
export interface ClientIdMetadataDocument {
  /**
   * Client identifier (MUST match the document URL)
   */
  client_id: string;
  /**
   * Human-readable client name
   */
  client_name: string;
  /**
   * Redirect URIs
   */
  redirect_uris: string[];
  /**
   * Grant types
   */
  grant_types?: string[];
  /**
   * Response types
   */
  response_types?: string[];
  /**
   * Token endpoint auth method
   */
  token_endpoint_auth_method?: string;
  /**
   * Client homepage
   */
  client_uri?: string;
  /**
   * Logo URL
   */
  logo_uri?: string;
  /**
   * Contacts
   */
  contacts?: string[];
  /**
   * Terms of service
   */
  tos_uri?: string;
  /**
   * Privacy policy
   */
  policy_uri?: string;
  /**
   * JWKS URI for client authentication
   */
  jwks_uri?: string;
  /**
   * Software identifier
   */
  software_id?: string;
  /**
   * Software version
   */
  software_version?: string;
}

// =============================================================================
// Additional Utilities (Progress, Cancellation, Roots, Configuration)
// =============================================================================

/**
 * Progress notification for long-running operations
 */
export interface ProgressNotification {
  /**
   * Progress token from the original request
   */
  progressToken: string | number;
  /**
   * Current progress value
   */
  progress: number;
  /**
   * Total expected value (optional)
   */
  total?: number;
  /**
   * Human-readable message
   */
  message?: string;
}

/**
 * Cancellation notification
 */
export interface CancellationNotification {
  /**
   * ID of the request to cancel
   */
  requestId: string | number;
  /**
   * Reason for cancellation
   */
  reason?: string;
}

/**
 * Root definition for filesystem boundaries (Client feature)
 */
export interface Root {
  /**
   * URI of the root (e.g., file:///path/to/project)
   */
  uri: string;
  /**
   * Human-readable name
   */
  name?: string;
}

/**
 * Roots list changed notification
 */
export interface RootsListChangedNotification {
  /**
   * Updated list of roots
   */
  roots: Root[];
}

/**
 * Logging level
 */
export type LoggingLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

/**
 * Set logging level request
 */
export interface SetLoggingLevelRequest {
  level: LoggingLevel;
}

/**
 * Log message notification
 */
export interface LogMessageNotification {
  level: LoggingLevel;
  logger?: string;
  data?: unknown;
}

/**
 * Completion request for argument autocompletion
 */
export interface CompletionRequest {
  ref: CompletionReference;
  argument: CompletionArgument;
  /**
   * Context with previously completed arguments
   */
  context?: CompletionContext;
}

export interface CompletionReference {
  type: "ref/prompt" | "ref/resource";
  name?: string;
  uri?: string;
}

export interface CompletionArgument {
  name: string;
  value: string;
}

/**
 * Context for completion with previous argument values
 */
export interface CompletionContext {
  /**
   * Previously resolved argument values
   */
  arguments?: Record<string, string>;
}

/**
 * Completion result
 */
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
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: EmbeddedResource };

export interface EmbeddedResource {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Ping request/response for connection health
 */
export interface PingRequest {
  [key: string]: never;
}

export interface PingResponse {
  [key: string]: never;
}

// =============================================================================
// Utility Functions for Content Creation (FastMCP-inspired patterns)
// =============================================================================

/**
 * User-facing error that should be displayed to the user
 * Distinguishes from system/internal errors
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

/**
 * Helper to create image content from URL, path, or buffer
 * Based on FastMCP imageContent pattern
 */
export async function createImageContent(options: {
  url?: string;
  path?: string;
  buffer?: Buffer;
  mimeType?: string;
  annotations?: ResourceAnnotations;
}): Promise<ImageContent> {
  const { url, path, buffer, mimeType, annotations } = options;

  let data: string;
  let detectedMimeType = mimeType;

  if (url) {
    // Fetch from URL and convert to base64
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    data = Buffer.from(arrayBuffer).toString("base64");
    detectedMimeType =
      mimeType || response.headers.get("content-type") || "image/png";
  } else if (path) {
    // Read from file system
    const fs = await import("node:fs/promises");
    const fileBuffer = await fs.readFile(path);
    data = fileBuffer.toString("base64");
    // Detect MIME type from extension if not provided
    if (!detectedMimeType) {
      const ext = path.split(".").pop()?.toLowerCase();
      detectedMimeType =
        ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : "image/png";
    }
  } else if (buffer) {
    data = buffer.toString("base64");
    detectedMimeType = mimeType || "image/png";
  } else {
    throw new Error("Must provide one of: url, path, or buffer");
  }

  return {
    type: "image",
    data,
    mimeType: detectedMimeType,
    ...(annotations && { annotations }),
  };
}

/**
 * Helper to create audio content from URL, path, or buffer
 * Based on FastMCP audioContent pattern
 */
export async function createAudioContent(options: {
  url?: string;
  path?: string;
  buffer?: Buffer;
  mimeType?: string;
  annotations?: ResourceAnnotations;
}): Promise<AudioContent> {
  const { url, path, buffer, mimeType, annotations } = options;

  let data: string;
  let detectedMimeType = mimeType;

  if (url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    data = Buffer.from(arrayBuffer).toString("base64");
    detectedMimeType =
      mimeType || response.headers.get("content-type") || "audio/mpeg";
  } else if (path) {
    const fs = await import("node:fs/promises");
    const fileBuffer = await fs.readFile(path);
    data = fileBuffer.toString("base64");
    if (!detectedMimeType) {
      const ext = path.split(".").pop()?.toLowerCase();
      detectedMimeType =
        ext === "mp3"
          ? "audio/mpeg"
          : ext === "wav"
            ? "audio/wav"
            : "audio/mpeg";
    }
  } else if (buffer) {
    data = buffer.toString("base64");
    detectedMimeType = mimeType || "audio/mpeg";
  } else {
    throw new Error("Must provide one of: url, path, or buffer");
  }

  return {
    type: "audio",
    data,
    mimeType: detectedMimeType,
    ...(annotations && { annotations }),
  };
}
