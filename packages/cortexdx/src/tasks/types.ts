/**
 * Tasks API Types
 * Based on MCP draft specification (releasing Nov 25, 2025)
 */

/**
 * Task status follows the MCP spec lifecycle
 */
export type TaskStatus =
  | 'working'         // Initial state when accepted
  | 'input_required'  // Receiver needs requestor input
  | 'completed'       // Success; results available
  | 'failed'          // Execution unsuccessful
  | 'cancelled';      // Explicitly halted by requestor

/**
 * Internal task record stored in database
 */
export interface TaskRecord {
  taskId: string;
  method: string;          // Original request method (e.g., "tools/call")
  params: unknown;         // Original request params
  status: TaskStatus;
  statusMessage?: string;  // Human-readable status description
  createdAt: string;       // ISO 8601 timestamp
  ttl: number;             // Time-to-live in milliseconds
  pollInterval: number;    // Suggested polling interval in milliseconds
  result?: unknown;        // Stored result when completed
  error?: {                // Error details if failed
    code: number;
    message: string;
    data?: unknown;
  };
  userId?: string;         // Associated user for access control
  expiresAt: number;       // Unix timestamp (ms) when task expires
}

/**
 * Task metadata returned to client
 */
export interface TaskMetadata {
  taskId: string;
  status: TaskStatus;
  statusMessage?: string;
  createdAt: string;
  ttl: number;
  pollInterval: number;
}

/**
 * Task creation parameters
 */
export interface CreateTaskParams {
  method: string;
  params: unknown;
  ttl?: number;            // Default: 300000 (5 minutes)
  pollInterval?: number;   // Default: 5000 (5 seconds)
  userId?: string;
}

/**
 * Task augmentation parameters from client
 */
export interface TaskAugmentation {
  ttl?: number;
}
