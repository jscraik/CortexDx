/**
 * MCP Protocol Constants
 * Shared protocol version constants for CortexDx packages
 * Moved from server package to avoid circular dependencies
 */

// Supported protocol versions
export const PROTOCOL_VERSIONS = {
  LEGACY: '2024-11-05',
  CURRENT: '2025-06-18',
  DRAFT: '2025-11-25', // RC release date
} as const;

export type ProtocolVersion = typeof PROTOCOL_VERSIONS[keyof typeof PROTOCOL_VERSIONS];

// Default to current stable version
export const DEFAULT_PROTOCOL_VERSION: ProtocolVersion = PROTOCOL_VERSIONS.CURRENT;
