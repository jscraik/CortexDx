/**
 * Task Types
 */

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskRecord {
  id: string;
  type: string;
  status: TaskStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: unknown;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata?: TaskMetadata;
}

export interface TaskMetadata {
  [key: string]: unknown;
}

export interface CreateTaskParams {
  type: string;
  input?: Record<string, unknown>;
  metadata?: TaskMetadata;
}

export interface TaskAugmentation {
  taskId: string;
  status: TaskStatus;
}
