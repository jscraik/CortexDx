/**
 * MCP Protocol Compliance Module
 * Implements MCP specification 2025-06-18 + Draft requirements
 */

// Import and re-export from core to maintain backward compatibility
// The canonical source is now in @brainwav/cortexdx-core
import {
  DEFAULT_PROTOCOL_VERSION,
  PROTOCOL_VERSIONS,
  type ProtocolVersion,
} from "@brainwav/cortexdx-core";
export { DEFAULT_PROTOCOL_VERSION, PROTOCOL_VERSIONS, type ProtocolVersion };

/**
 * Protocol capabilities for server initialization
 */
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, never>;
  experimental?: Record<string, unknown>;
}

/**
 * Server info for initialization response
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * Initialize response structure
 */
export interface InitializeResponse {
  protocolVersion: ProtocolVersion;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
}

/**
 * Validate incoming protocol version request
 * Returns negotiated version or throws if incompatible
 */
export function negotiateProtocolVersion(
  clientVersion: string,
  serverVersion: ProtocolVersion = DEFAULT_PROTOCOL_VERSION,
): ProtocolVersion {
  // Client requested version must be supported
  const supportedVersions = Object.values(PROTOCOL_VERSIONS);

  if (supportedVersions.includes(clientVersion as ProtocolVersion)) {
    // Return the minimum of client and server versions for compatibility
    const clientIndex = supportedVersions.indexOf(
      clientVersion as ProtocolVersion,
    );
    const serverIndex = supportedVersions.indexOf(serverVersion);
    return supportedVersions[
      Math.min(clientIndex, serverIndex)
    ] as ProtocolVersion;
  }

  // If client version is not recognized, use server version
  // The client will need to handle this
  return serverVersion;
}

/**
 * Create MCP-Protocol-Version header value
 * Required for HTTP transport in 2025-06-18 spec
 */
export function getProtocolVersionHeader(
  version: ProtocolVersion = DEFAULT_PROTOCOL_VERSION,
): string {
  return version;
}

/**
 * Validate that a request is not a JSON-RPC batch
 * Batching was removed in 2025-06-18 spec
 */
export function validateNotBatch(request: unknown): void {
  if (Array.isArray(request)) {
    throw new ProtocolError(
      -32600,
      "JSON-RPC batching is not supported. Send requests individually.",
    );
  }
}

/**
 * Protocol-level error
 */
export class ProtocolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ProtocolError";
  }
}

/**
 * Build initialize response for a server
 */
export function buildInitializeResponse(
  serverInfo: ServerInfo,
  capabilities: ServerCapabilities,
  protocolVersion: ProtocolVersion = DEFAULT_PROTOCOL_VERSION,
): InitializeResponse {
  return {
    protocolVersion,
    capabilities,
    serverInfo,
  };
}

/**
 * Check if a protocol version supports a feature
 */
export function supportsFeature(
  version: ProtocolVersion,
  feature: "elicitation" | "structuredOutput" | "resourceLinks" | "tasks",
): boolean {
  const versionIndex = Object.values(PROTOCOL_VERSIONS).indexOf(version);
  const currentIndex = Object.values(PROTOCOL_VERSIONS).indexOf(
    PROTOCOL_VERSIONS.CURRENT,
  );

  switch (feature) {
    case "elicitation":
    case "structuredOutput":
    case "resourceLinks":
      // Available in 2025-06-18+
      return versionIndex >= currentIndex;
    case "tasks":
      // Experimental, only in draft
      return version === PROTOCOL_VERSIONS.DRAFT;
    default:
      return false;
  }
}
