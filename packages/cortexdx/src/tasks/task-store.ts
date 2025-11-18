/**
 * Task Store - SQLite-backed storage for MCP Tasks API
 *
 * Provides CRUD operations for task lifecycle management with:
 * - Cryptographically secure task IDs
 * - Automatic expiration handling
 * - Cursor-based pagination
 * - User-based access control
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { TaskRecord, TaskMetadata, CreateTaskParams, TaskStatus } from './types.js';
import { createLogger } from '../logging/logger.js';

const logger = createLogger({ component: 'task-store' });

/**
 * Database row type for tasks table
 */
interface TaskRow {
  id: number;
  taskId: string;
  method: string;
  params: string;
  status: string;
  statusMessage: string | null;
  createdAt: string;
  ttl: number;
  pollInterval: number;
  result: string | null;
  error: string | null;
  userId: string | null;
  expiresAt: number;
}

/**
 * Database row type for task list query
 */
interface TaskListRow {
  taskId: string;
  status: string;
  statusMessage: string | null;
  createdAt: string;
  ttl: number;
  pollInterval: number;
}

/**
 * Database row type for task stats query
 */
interface TaskStatsRow {
  status: TaskStatus;
  count: number;
}

export class TaskStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent access (Critical #6)
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initSchema();
    logger.info({ dbPath }, 'Task store initialized');
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId TEXT UNIQUE NOT NULL,
        method TEXT NOT NULL,
        params TEXT NOT NULL,
        status TEXT NOT NULL,
        statusMessage TEXT,
        createdAt TEXT NOT NULL,
        ttl INTEGER NOT NULL,
        pollInterval INTEGER NOT NULL,
        result TEXT,
        error TEXT,
        userId TEXT,
        expiresAt INTEGER NOT NULL,
        CHECK (status IN ('working', 'input_required', 'completed', 'failed', 'cancelled'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_taskid ON tasks(taskId);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_expires ON tasks(expiresAt);
      CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(userId);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(createdAt DESC);
    `);
  }

  /**
   * Create a new task with cryptographically secure ID
   */
  createTask(params: CreateTaskParams): string {
    const taskId = randomUUID();
    const ttl = params.ttl || 300000; // Default 5 minutes
    const pollInterval = params.pollInterval || 5000; // Default 5 seconds
    const createdAt = new Date().toISOString();
    const expiresAt = Date.now() + ttl;

    this.db.prepare(`
      INSERT INTO tasks (taskId, method, params, status, statusMessage,
                        createdAt, ttl, pollInterval, expiresAt, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      params.method,
      JSON.stringify(params.params),
      'working',
      null,
      createdAt,
      ttl,
      pollInterval,
      expiresAt,
      params.userId || null
    );

    logger.info({ taskId, method: params.method, ttl }, 'Task created');
    return taskId;
  }

  /**
   * Retrieve a task by ID
   * Returns null if not found or expired
   */
  getTask(taskId: string, userId?: string): TaskRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM tasks
      WHERE taskId = ?
      AND (userId IS NULL OR userId = ?)
      AND expiresAt > ?
    `).get(taskId, userId || null, Date.now()) as TaskRow | undefined;

    if (!row) {
      return null;
    }

    return this.deserializeTask(row);
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus, statusMessage?: string): boolean {
    const result = this.db.prepare(`
      UPDATE tasks
      SET status = ?, statusMessage = ?
      WHERE taskId = ?
    `).run(status, statusMessage || null, taskId);

    logger.info({ taskId, status, statusMessage }, 'Task status updated');
    return result.changes > 0;
  }

  /**
   * Set task result (marks as completed)
   */
  setTaskResult(taskId: string, result: unknown): boolean {
    let serialized: string;
    try {
      serialized = JSON.stringify(result);
    } catch (serializeError) {
      logger.error({ taskId, error: serializeError }, 'Failed to serialize task result');
      // Store error instead
      this.setTaskError(taskId, {
        code: -32603,
        message: 'Result serialization failed'
      });
      return false;
    }
    const dbResult = this.db.prepare(`
      UPDATE tasks
      SET status = 'completed', result = ?
      WHERE taskId = ?
    `).run(serialized, taskId);

    logger.info({ taskId }, 'Task completed with result');
    return dbResult.changes > 0;
  }

  /**
   * Set task error (marks as failed)
   */
  setTaskError(taskId: string, error: { code: number; message: string; data?: unknown }): boolean {
    const result = this.db.prepare(`
      UPDATE tasks
      SET status = 'failed', error = ?
      WHERE taskId = ?
    `).run(JSON.stringify(error), taskId);

    logger.warn({ taskId, error }, 'Task failed with error');
    return result.changes > 0;
  }

  /**
   * List tasks with cursor-based pagination
   * Fixed: Use createdAt for cursor (Critical #1)
   */
  listTasks(
    limit = 50,
    cursor?: string,
    userId?: string
  ): { tasks: TaskMetadata[]; nextCursor?: string } {
    const whereClauses = ['expiresAt > ?'];
    const params: unknown[] = [Date.now()];

    if (cursor) {
      // Use createdAt for cursor (must match ORDER BY)
      whereClauses.push('createdAt < ?');
      params.push(cursor);
    }
    if (userId) {
      whereClauses.push('userId = ?');
      params.push(userId);
    }

    const query = `
      SELECT taskId, status, statusMessage, createdAt, ttl, pollInterval
      FROM tasks
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT ?
    `;
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as TaskListRow[];
    const tasks = rows.map(row => ({
      taskId: row.taskId,
      status: row.status as TaskStatus,
      statusMessage: row.statusMessage || undefined,
      createdAt: row.createdAt,
      ttl: row.ttl,
      pollInterval: row.pollInterval
    }));

    const nextCursor = tasks.length === limit && tasks[tasks.length - 1] ? tasks[tasks.length - 1].createdAt : undefined;
    return { tasks, nextCursor };
  }

  /**
   * Cancel a task if not in terminal state
   * Returns false if task not found, expired, or already terminal
   */
  cancelTask(taskId: string, userId?: string): boolean {
    const task = this.getTask(taskId, userId);
    if (!task) {
      return false;
    }

    // Can't cancel terminal states
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      logger.warn({ taskId, status: task.status }, 'Cannot cancel task in terminal state');
      return false;
    }

    const result = this.db.prepare(`
      UPDATE tasks
      SET status = 'cancelled'
      WHERE taskId = ?
    `).run(taskId);

    logger.info({ taskId }, 'Task cancelled');
    return result.changes > 0;
  }

  /**
   * Clean up expired tasks
   * Returns number of tasks pruned
   */
  pruneExpired(): number {
    const result = this.db.prepare(`
      DELETE FROM tasks WHERE expiresAt < ?
    `).run(Date.now());

    if (result.changes > 0) {
      logger.info({ count: result.changes }, 'Pruned expired tasks');
    }

    return result.changes;
  }

  /**
   * Get task count by status (for monitoring)
   */
  getTaskStats(): Record<TaskStatus, number> & { total: number } {
    const rows = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      WHERE expiresAt > ?
      GROUP BY status
    `).all(Date.now()) as TaskStatsRow[];

    const stats: Record<TaskStatus, number> & { total: number } = {
      working: 0,
      input_required: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0
    };

    for (const row of rows) {
      stats[row.status] = row.count;
      stats.total += row.count;
    }

    return stats;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
    logger.info('Task store closed');
  }

  /**
   * Helper to deserialize task from database row
   * Fixed: Added JSON.parse error handling (Critical #2)
   */
  private deserializeTask(row: TaskRow): TaskRecord {
    let params: unknown;
    let result: unknown;
    let error: { code: number; message: string; data?: unknown } | undefined;

    try {
      params = JSON.parse(row.params);
    } catch (parseError) {
      logger.error({ taskId: row.taskId, error: parseError }, 'Failed to parse task params');
      params = {}; // Fallback to empty object
    }

    try {
      result = row.result ? JSON.parse(row.result) : undefined;
    } catch (parseError) {
      logger.error({ taskId: row.taskId, error: parseError }, 'Failed to parse task result');
      result = undefined;
    }

    try {
      error = row.error ? JSON.parse(row.error) : undefined;
    } catch (parseError) {
      logger.error({ taskId: row.taskId, error: parseError }, 'Failed to parse task error');
      error = { code: -32603, message: 'Corrupted error data' };
    }

    return {
      taskId: row.taskId,
      method: row.method,
      params,
      status: row.status as TaskStatus,
      statusMessage: row.statusMessage || undefined,
      createdAt: row.createdAt,
      ttl: row.ttl,
      pollInterval: row.pollInterval,
      result,
      error,
      userId: row.userId || undefined,
      expiresAt: row.expiresAt
    };
  }
}
