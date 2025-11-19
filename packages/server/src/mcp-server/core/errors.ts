/**
 * Centralized MCP Error Codes
 * Based on JSON-RPC 2.0 and MCP specification
 */

// Standard JSON-RPC 2.0 error codes
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// Custom MCP error codes (implementation-defined range: -32000 to -32099)
export const MCP_ERRORS = {
  // Authentication & Authorization
  ACCESS_DENIED: -32001,
  AUTH_REQUIRED: -32002,
  INVALID_TOKEN: -32003,
  TOKEN_EXPIRED: -32004,

  // Licensing
  LICENSE_REQUIRED: -32010,
  LICENSE_EXPIRED: -32011,
  FEATURE_NOT_LICENSED: -32012,

  // Rate Limiting
  RATE_LIMITED: -32020,

  // Tool errors
  TOOL_NOT_FOUND: -32030,
  TOOL_DISABLED: -32031,
  TOOL_EXECUTION_ERROR: -32032,

  // Resource errors
  RESOURCE_NOT_FOUND: -32040,
  RESOURCE_ACCESS_DENIED: -32041,

  // Protocol errors
  PROTOCOL_VERSION_MISMATCH: -32050,
  BATCHING_NOT_SUPPORTED: -32051,

  // Server errors
  SERVER_SHUTTING_DOWN: -32060,
  SERVICE_UNAVAILABLE: -32061,
} as const;

export type JsonRpcErrorCode = typeof JSON_RPC_ERRORS[keyof typeof JSON_RPC_ERRORS];
export type McpErrorCode = typeof MCP_ERRORS[keyof typeof MCP_ERRORS];
export type ErrorCode = JsonRpcErrorCode | McpErrorCode;

/**
 * MCP Error class for consistent error handling
 */
export class McpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'McpError';
  }

  /**
   * Convert to JSON-RPC error object
   */
  toJsonRpcError(): { code: number; message: string; data?: unknown } {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined && { data: this.data }),
    };
  }
}

/**
 * Create a tool execution error (SEP-1303)
 * Input validation errors should be Tool Execution Errors, not Protocol Errors
 */
export function createToolExecutionError(
  message: string,
  details?: unknown
): McpError {
  return new McpError(MCP_ERRORS.TOOL_EXECUTION_ERROR, message, details);
}

/**
 * Create an auth required error
 */
export function createAuthRequiredError(message = 'Authentication required'): McpError {
  return new McpError(MCP_ERRORS.AUTH_REQUIRED, message);
}

/**
 * Create a rate limited error
 */
export function createRateLimitedError(retryAfter?: number): McpError {
  return new McpError(
    MCP_ERRORS.RATE_LIMITED,
    'Rate limit exceeded',
    retryAfter ? { retryAfter } : undefined
  );
}

/**
 * Create a protocol version mismatch error
 */
export function createProtocolMismatchError(
  clientVersion: string,
  serverVersion: string
): McpError {
  return new McpError(
    MCP_ERRORS.PROTOCOL_VERSION_MISMATCH,
    `Protocol version mismatch: client=${clientVersion}, server=${serverVersion}`,
    { clientVersion, serverVersion }
  );
}

/**
 * Helper to format error for JSON-RPC response
 */
export function formatJsonRpcError(
  id: string | number | null,
  error: McpError | Error
): {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
} {
  if (error instanceof McpError) {
    return {
      jsonrpc: '2.0',
      id,
      error: error.toJsonRpcError(),
    };
  }

  // Generic error
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: JSON_RPC_ERRORS.INTERNAL_ERROR,
      message: error.message || 'Internal error',
    },
  };
}
