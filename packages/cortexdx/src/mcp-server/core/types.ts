/**
 * Core MCP Types
 * Based on MCP specification draft (post 2025-06-18)
 */

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

/**
 * Tool definition with icon support
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  /**
   * Icon for the tool (SEP-973)
   */
  icon?: IconMetadata;
}

/**
 * Resource definition with icon support
 */
export interface ResourceDefinition {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  /**
   * Icon for the resource (SEP-973)
   */
  icon?: IconMetadata;
}

/**
 * Resource template definition with icon support
 */
export interface ResourceTemplateDefinition {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
  /**
   * Icon for the resource template (SEP-973)
   */
  icon?: IconMetadata;
}

/**
 * Prompt definition with icon support
 */
export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
  /**
   * Icon for the prompt (SEP-973)
   */
  icon?: IconMetadata;
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Enum schema for elicitation (SEP-1330)
 * Supports titled, untitled, single-select, and multi-select
 */
export interface EnumSchema {
  type: 'enum';
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
  action: 'accept' | 'decline' | 'cancel';
  content?: ElicitContent;
}

export type ElicitContent =
  | TextElicitContent
  | BooleanElicitContent
  | NumberElicitContent
  | EnumElicitContent
  | UrlElicitContent;

export interface TextElicitContent {
  type: 'text';
  value: string;
}

export interface BooleanElicitContent {
  type: 'boolean';
  value: boolean;
}

export interface NumberElicitContent {
  type: 'number';
  value: number;
}

export interface EnumElicitContent {
  type: 'enum';
  /**
   * Selected value(s) - array for multiSelect, single value otherwise
   */
  value: string | string[];
}

/**
 * URL elicitation content (SEP-1036)
 */
export interface UrlElicitContent {
  type: 'url';
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
  type: 'text' | 'boolean' | 'number' | 'enum' | 'url';
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
 * Sampling request with tool calling support (SEP-1577)
 */
export interface SamplingRequest {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
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
  role: 'user' | 'assistant';
  content: SamplingContent;
}

export type SamplingContent = TextContent | ImageContent | ToolResultContent;

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
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
 * Tool choice for sampling (SEP-1577)
 */
export type ToolChoice =
  | { type: 'auto' }
  | { type: 'none' }
  | { type: 'required' }
  | { type: 'tool'; name: string };

/**
 * Sampling response
 */
export interface SamplingResponse {
  role: 'assistant';
  content: TextContent | ToolUseContent;
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens' | 'toolUse';
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Tasks API (SEP-1686)
 * Re-exported from existing implementation for durable request tracking
 */
export type {
  TaskStatus,
  TaskRecord,
  TaskMetadata,
  CreateTaskParams,
  TaskAugmentation,
} from '../../tasks/types.js';

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
  scheme: 'Bearer';
  realm?: string;
  error?: 'invalid_token' | 'insufficient_scope';
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

  return parts.join(', ');
}
