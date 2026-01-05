/**
 * JSON-RPC 2.0 Type Definitions
 * Based on MCP Schema Reference
 */

/**
 * Request ID - can be string, number, or null
 */
export type RequestId = string | number | null;

/**
 * JSON-RPC error object
 */
export interface JSONRPCError {
  /**
   * The error type that occurred
   */
  code: number;
  /**
   * A short description of the error
   */
  message: string;
  /**
   * Additional information about the error (optional)
   */
  data?: unknown;
}

/**
 * A request that expects a response
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: RequestId;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * A notification which does not expect a response
 */
export interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

/**
 * A successful (non-error) response to a request
 */
export interface JSONRPCResultResponse<T = unknown> {
  jsonrpc: "2.0";
  id: RequestId;
  result: T;
}

/**
 * A response to a request that indicates an error occurred
 */
export interface JSONRPCErrorResponse {
  jsonrpc: "2.0";
  id?: RequestId;
  error: JSONRPCError;
}

/**
 * Union of possible response types
 */
export type JSONRPCResponse<T = unknown> =
  | JSONRPCResultResponse<T>
  | JSONRPCErrorResponse;

/**
 * Refers to any valid JSON-RPC object that can be decoded off the wire, or encoded to be sent
 */
export type JSONRPCMessage =
  | JSONRPCRequest
  | JSONRPCNotification
  | JSONRPCResponse;

/**
 * Standard JSON-RPC 2.0 error codes
 */
export const JSONRPCErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32003,
  // MCP-specific error codes
  ServerError: -32000,
} as const;

/**
 * Type guard to check if a message is a request
 */
export function isJSONRPCRequest(
  message: JSONRPCMessage,
): message is JSONRPCRequest {
  return "id" in message && "method" in message;
}

/**
 * Type guard to check if a message is a notification
 */
export function isJSONRPCNotification(
  message: JSONRPCMessage,
): message is JSONRPCNotification {
  return !("id" in message) && "method" in message;
}

/**
 * Type guard to check if a response is an error
 */
export function isJSONRPCErrorResponse(
  response: JSONRPCResponse,
): response is JSONRPCErrorResponse {
  return "error" in response;
}

/**
 * Type guard to check if a response is successful
 */
export function isJSONRPCResultResponse<T = unknown>(
  response: JSONRPCResponse,
): response is JSONRPCResultResponse<T> {
  return "result" in response;
}

/**
 * Create a JSON-RPC request
 */
export function createJSONRPCRequest(
  method: string,
  params?: Record<string, unknown>,
  id: RequestId = generateRequestId(),
): JSONRPCRequest {
  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id,
    method,
  };
  if (params !== undefined) {
    request.params = params;
  }
  return request;
}

/**
 * Create a JSON-RPC notification
 */
export function createJSONRPCNotification(
  method: string,
  params?: Record<string, unknown>,
): JSONRPCNotification {
  const notification: JSONRPCNotification = {
    jsonrpc: "2.0",
    method,
  };
  if (params !== undefined) {
    notification.params = params;
  }
  return notification;
}

/**
 * Create a JSON-RPC success response
 */
export function createJSONRPCResultResponse<T = unknown>(
  id: RequestId,
  result: T,
): JSONRPCResultResponse<T> {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

/**
 * Create a JSON-RPC error response
 */
export function createJSONRPCErrorResponse(
  code: number,
  message: string,
  id?: RequestId,
  data?: unknown,
): JSONRPCErrorResponse {
  const response: JSONRPCErrorResponse = {
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
  };
  if (id !== undefined) {
    response.id = id;
  }
  if (data !== undefined) {
    response.error.data = data;
  }
  return response;
}

/**
 * Validate that a message conforms to JSON-RPC 2.0 structure
 */
export function validateJSONRPCMessage(message: unknown): JSONRPCMessage {
  if (typeof message !== "object" || message === null) {
    throw new Error("JSON-RPC message must be an object");
  }

  const msg = message as Record<string, unknown>;

  // Validate jsonrpc version
  if (msg.jsonrpc !== "2.0") {
    throw new Error('JSON-RPC version must be "2.0"');
  }

  // Check if it's a request/notification or response
  if ("method" in msg) {
    // Request or notification
    if (typeof msg.method !== "string" || msg.method.length === 0) {
      throw new Error("Method must be a non-empty string");
    }

    if ("params" in msg && typeof msg.params !== "object") {
      throw new Error("Params must be an object if present");
    }

    // Request has id, notification doesn't
    if ("id" in msg) {
      return msg as JSONRPCRequest;
    }
    return msg as JSONRPCNotification;
  }

  // Response
  if ("result" in msg) {
    if (!("id" in msg)) {
      throw new Error("Result response must have an id");
    }
    return msg as JSONRPCResultResponse;
  }

  if ("error" in msg) {
    const error = msg.error;
    if (typeof error !== "object" || error === null) {
      throw new Error("Error must be an object");
    }
    if (typeof error.code !== "number") {
      throw new Error("Error code must be a number");
    }
    if (typeof error.message !== "string") {
      throw new Error("Error message must be a string");
    }
    return msg as JSONRPCErrorResponse;
  }

  throw new Error(
    "JSON-RPC message must have either method, result, or error field",
  );
}

/**
 * Generate a unique request ID
 */
let requestIdCounter = 0;
export function generateRequestId(): string {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

/**
 * Parse a JSON-RPC message from a string
 */
export function parseJSONRPCMessage(data: string): JSONRPCMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch (error) {
    throw createJSONRPCErrorResponse(
      JSONRPCErrorCode.ParseError,
      "Parse error: Invalid JSON",
      null,
      { originalError: String(error) },
    );
  }

  try {
    return validateJSONRPCMessage(parsed);
  } catch (error) {
    throw createJSONRPCErrorResponse(
      JSONRPCErrorCode.InvalidRequest,
      `Invalid Request: ${String(error)}`,
      null,
    );
  }
}

/**
 * Serialize a JSON-RPC message to a string
 */
export function serializeJSONRPCMessage(message: JSONRPCMessage): string {
  return JSON.stringify(message);
}
