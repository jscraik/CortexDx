/**
 * State Manager for LangGraph workflows
 * Implements persistent state across diagnostic sessions with SQLite backend
 * Requirements: 18.2
 */

import { randomUUID } from "node:crypto";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import { MemorySaver } from "@langchain/langgraph";
import Database from "better-sqlite3";
import type { WorkflowState } from "./workflow-types.js";

/**
 * State checkpoint for persistence
 */
export interface StateCheckpoint {
    checkpointId: string;
    workflowId: string;
    threadId: string;
    state: WorkflowState;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * State recovery options
 */
export interface StateRecoveryOptions {
    workflowId: string;
    threadId?: string;
    checkpointId?: string;
    beforeTimestamp?: number;
}

/**
 * State persistence configuration
 */
export interface StatePersistenceConfig {
    dbPath: string;
    enableAutoSave: boolean;
    autoSaveIntervalMs?: number;
    maxCheckpoints?: number;
    compressionEnabled?: boolean;
}

/**
 * State Manager class for persistent workflow state
 */
export class StateManager {
    private db: Database.Database;
    private config: StatePersistenceConfig;
    private memorySavers: Map<string, MemorySaver> = new Map();
    private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(config: StatePersistenceConfig) {
        this.config = config;
        try {
            this.db = new Database(config.dbPath);
            this.initializeDatabase();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to initialize StateManager database: ${message}`);
        }
    }

    /**
     * Initialize SQLite database schema
     * Requirements: 18.2
     */
    private initializeDatabase(): void {
        try {
            // Create checkpoints table
            this.db.exec(`
            CREATE TABLE IF NOT EXISTS workflow_checkpoints (
                checkpoint_id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                thread_id TEXT NOT NULL,
                state_json TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                metadata_json TEXT,
                compressed INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_thread 
            ON workflow_checkpoints(workflow_id, thread_id);

            CREATE INDEX IF NOT EXISTS idx_timestamp 
            ON workflow_checkpoints(timestamp DESC);
        `);

        // Create session continuity table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS workflow_sessions (
                session_id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                thread_id TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                last_checkpoint_id TEXT,
                status TEXT DEFAULT 'active',
                metadata_json TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_sessions 
            ON workflow_sessions(workflow_id, status);
        `);

        // Create state transitions table for history
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS state_transitions (
                transition_id INTEGER PRIMARY KEY AUTOINCREMENT,
                checkpoint_id TEXT NOT NULL,
                workflow_id TEXT NOT NULL,
                thread_id TEXT NOT NULL,
                from_node TEXT,
                to_node TEXT,
                transition_type TEXT,
                timestamp INTEGER NOT NULL,
                duration_ms INTEGER,
                FOREIGN KEY (checkpoint_id) REFERENCES workflow_checkpoints(checkpoint_id)
            );

            CREATE INDEX IF NOT EXISTS idx_transitions_checkpoint
            ON state_transitions(checkpoint_id);
        `);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to initialize database schema: ${message}`);
        }
    }

    /**
     * Save workflow state checkpoint
     * Requirements: 18.2
     */
    async saveCheckpoint(checkpoint: StateCheckpoint): Promise<void> {
        try {
            const stateJson = JSON.stringify(checkpoint.state);
            const metadataJson = checkpoint.metadata
                ? JSON.stringify(checkpoint.metadata)
                : null;

            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO workflow_checkpoints
                (checkpoint_id, workflow_id, thread_id, state_json, timestamp, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                checkpoint.checkpointId,
                checkpoint.workflowId,
                checkpoint.threadId,
                stateJson,
                checkpoint.timestamp,
                metadataJson
            );

            // Update session
            await this.updateSession(
                checkpoint.workflowId,
                checkpoint.threadId,
                checkpoint.checkpointId
            );

            // Cleanup old checkpoints if limit exceeded
            if (this.config.maxCheckpoints) {
                await this.cleanupOldCheckpoints(
                    checkpoint.workflowId,
                    checkpoint.threadId
                );
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save checkpoint ${checkpoint.checkpointId}: ${message}`);
        }
    }

    /**
     * Load workflow state from checkpoint
     * Requirements: 18.2
     */
    async loadCheckpoint(checkpointId: string): Promise<StateCheckpoint | null> {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM workflow_checkpoints
                WHERE checkpoint_id = ?
            `);

            const row = stmt.get(checkpointId) as {
                checkpoint_id: string;
                workflow_id: string;
                thread_id: string;
                state_json: string;
                timestamp: number;
                metadata_json: string | null;
            } | undefined;

            if (!row) {
                return null;
            }

            return {
                checkpointId: row.checkpoint_id,
                workflowId: row.workflow_id,
                threadId: row.thread_id,
                state: safeParseJson(row.state_json) as WorkflowState,
                timestamp: row.timestamp,
                metadata: row.metadata_json
                    ? (safeParseJson(row.metadata_json) as Record<string, unknown>)
                    : undefined,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load checkpoint ${checkpointId}: ${message}`);
        }
    }

    /**
     * Recover state after interruption
     * Requirements: 18.2
     */
    async recoverState(
        options: StateRecoveryOptions
    ): Promise<StateCheckpoint | null> {
        try {
            let query = `
                SELECT * FROM workflow_checkpoints
                WHERE workflow_id = ?
            `;
            const params: (string | number)[] = [options.workflowId];

            if (options.threadId) {
                query += " AND thread_id = ?";
                params.push(options.threadId);
            }

            if (options.checkpointId) {
                query += " AND checkpoint_id = ?";
                params.push(options.checkpointId);
            }

            if (options.beforeTimestamp) {
                query += " AND timestamp <= ?";
                params.push(options.beforeTimestamp);
            }

            query += " ORDER BY timestamp DESC LIMIT 1";

            const stmt = this.db.prepare(query);
            const row = stmt.get(...params) as {
                checkpoint_id: string;
                workflow_id: string;
                thread_id: string;
                state_json: string;
                timestamp: number;
                metadata_json: string | null;
            } | undefined;

            if (!row) {
                return null;
            }

            return {
                checkpointId: row.checkpoint_id,
                workflowId: row.workflow_id,
                threadId: row.thread_id,
                state: safeParseJson(row.state_json) as WorkflowState,
                timestamp: row.timestamp,
                metadata: row.metadata_json
                    ? (safeParseJson(row.metadata_json) as Record<string, unknown>)
                    : undefined,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to recover state for workflow ${options.workflowId}: ${message}`);
        }
    }

    /**
     * Create cross-session state continuity
     * Requirements: 18.2
     */
    async createSession(
        workflowId: string,
        threadId: string,
        metadata?: Record<string, unknown>
    ): Promise<string> {
        try {
            const sessionId = `session-${randomUUID()}`;
            const metadataJson = metadata ? JSON.stringify(metadata) : null;

            const stmt = this.db.prepare(`
                INSERT INTO workflow_sessions
                (session_id, workflow_id, thread_id, start_time, metadata_json)
                VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run(sessionId, workflowId, threadId, Date.now(), metadataJson);

            return sessionId;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to create session for workflow ${workflowId}: ${message}`);
        }
    }

    /**
     * Get session information
     */
    async getSession(sessionId: string): Promise<WorkflowSession | null> {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM workflow_sessions
                WHERE session_id = ?
            `);

            const row = stmt.get(sessionId) as {
                session_id: string;
                workflow_id: string;
                thread_id: string;
                start_time: number;
                last_checkpoint_id: string | null;
                status: string;
                metadata_json: string | null;
                created_at: number;
                updated_at: number;
            } | undefined;

            if (!row) {
                return null;
            }

            return {
                sessionId: row.session_id,
                workflowId: row.workflow_id,
                threadId: row.thread_id,
                startTime: row.start_time,
                lastCheckpointId: row.last_checkpoint_id || undefined,
                status: row.status as "active" | "completed" | "failed" | "interrupted",
                metadata: row.metadata_json
                    ? (safeParseJson(row.metadata_json) as Record<string, unknown>)
                    : undefined,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get session ${sessionId}: ${message}`);
        }
    }

    /**
     * List all sessions for a workflow
     */
    async listSessions(
        workflowId: string,
        status?: "active" | "completed" | "failed" | "interrupted"
    ): Promise<WorkflowSession[]> {
        try {
            let query = `
                SELECT * FROM workflow_sessions
                WHERE workflow_id = ?
            `;
            const params: (string | number)[] = [workflowId];

            if (status) {
                query += " AND status = ?";
                params.push(status);
            }

            query += " ORDER BY updated_at DESC";

            const stmt = this.db.prepare(query);
            const rows = stmt.all(...params) as Array<{
                session_id: string;
                workflow_id: string;
                thread_id: string;
                start_time: number;
                last_checkpoint_id: string | null;
                status: string;
                metadata_json: string | null;
                created_at: number;
                updated_at: number;
            }>;

            return rows.map((row) => ({
                sessionId: row.session_id,
                workflowId: row.workflow_id,
                threadId: row.thread_id,
                startTime: row.start_time,
                lastCheckpointId: row.last_checkpoint_id || undefined,
                status: row.status as "active" | "completed" | "failed" | "interrupted",
                metadata: row.metadata_json
                    ? (safeParseJson(row.metadata_json) as Record<string, unknown>)
                    : undefined,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to list sessions for workflow ${workflowId}: ${message}`);
        }
    }

    /**
     * Update session status
     */
    async updateSessionStatus(
        sessionId: string,
        status: "active" | "completed" | "failed" | "interrupted"
    ): Promise<void> {
        try {
            const stmt = this.db.prepare(`
                UPDATE workflow_sessions
                SET status = ?, updated_at = strftime('%s', 'now')
                WHERE session_id = ?
            `);

            stmt.run(status, sessionId);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to update session ${sessionId} status: ${message}`);
        }
    }

    /**
     * Record state transition
     */
    async recordTransition(
        checkpointId: string,
        workflowId: string,
        threadId: string,
        fromNode: string | null,
        toNode: string,
        transitionType: string,
        durationMs?: number
    ): Promise<void> {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO state_transitions
                (checkpoint_id, workflow_id, thread_id, from_node, to_node, transition_type, timestamp, duration_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                checkpointId,
                workflowId,
                threadId,
                fromNode,
                toNode,
                transitionType,
                Date.now(),
                durationMs || null
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to record transition for checkpoint ${checkpointId}: ${message}`);
        }
    }

    /**
     * Get state transition history
     */
    async getTransitionHistory(
        workflowId: string,
        threadId?: string
    ): Promise<StateTransition[]> {
        try {
            let query = `
                SELECT * FROM state_transitions
                WHERE workflow_id = ?
            `;
            const params: (string | number)[] = [workflowId];

            if (threadId) {
                query += " AND thread_id = ?";
                params.push(threadId);
            }

            query += " ORDER BY timestamp ASC";

            const stmt = this.db.prepare(query);
            const rows = stmt.all(...params) as Array<{
                transition_id: number;
                checkpoint_id: string;
                workflow_id: string;
                thread_id: string;
                from_node: string | null;
                to_node: string;
                transition_type: string;
                timestamp: number;
                duration_ms: number | null;
            }>;

            return rows.map((row) => ({
                transitionId: row.transition_id,
                checkpointId: row.checkpoint_id,
                workflowId: row.workflow_id,
                threadId: row.thread_id,
                fromNode: row.from_node || undefined,
                toNode: row.to_node,
                transitionType: row.transition_type,
                timestamp: row.timestamp,
                durationMs: row.duration_ms || undefined,
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get transition history for workflow ${workflowId}: ${message}`);
        }
    }

    /**
     * Get or create MemorySaver for a workflow
     */
    getMemorySaver(workflowId: string): MemorySaver {
        let saver = this.memorySavers.get(workflowId);
        if (!saver) {
            saver = new MemorySaver();
            this.memorySavers.set(workflowId, saver);
        }
        return saver;
    }

    /**
     * Enable auto-save for a workflow
     */
    enableAutoSave(
        workflowId: string,
        threadId: string,
        getState: () => WorkflowState
    ): void {
        if (!this.config.enableAutoSave) {
            return;
        }

        const intervalMs = this.config.autoSaveIntervalMs || 5000;
        const timer = setInterval(async () => {
            try {
                const state = getState();
                const checkpoint: StateCheckpoint = {
                    checkpointId: `auto-${Date.now()}`,
                    workflowId,
                    threadId,
                    state,
                    timestamp: Date.now(),
                    metadata: { autoSaved: true },
                };
                await this.saveCheckpoint(checkpoint);
            } catch (error) {
                // Log error but don't throw - auto-save failures shouldn't crash the workflow
                const message = error instanceof Error ? error.message : String(error);
                console.error(`[StateManager] Auto-save failed for ${workflowId}/${threadId}: ${message}`);
            }
        }, intervalMs);

        this.autoSaveTimers.set(`${workflowId}-${threadId}`, timer);
    }

    /**
     * Disable auto-save for a workflow
     */
    disableAutoSave(workflowId: string, threadId: string): void {
        const key = `${workflowId}-${threadId}`;
        const timer = this.autoSaveTimers.get(key);
        if (timer) {
            clearInterval(timer);
            this.autoSaveTimers.delete(key);
        }
    }

    /**
     * Close database connection
     */
    close(): void {
        try {
            // Clear all auto-save timers
            for (const timer of this.autoSaveTimers.values()) {
                clearInterval(timer);
            }
            this.autoSaveTimers.clear();

            // Close database
            this.db.close();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[StateManager] Error closing database: ${message}`);
        }
    }

    // Private helper methods

    private async updateSession(
        workflowId: string,
        threadId: string,
        checkpointId: string
    ): Promise<void> {
        try {
            const stmt = this.db.prepare(`
                UPDATE workflow_sessions
                SET last_checkpoint_id = ?, updated_at = strftime('%s', 'now')
                WHERE workflow_id = ? AND thread_id = ?
            `);

            stmt.run(checkpointId, workflowId, threadId);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to update session for workflow ${workflowId}: ${message}`);
        }
    }

    private async cleanupOldCheckpoints(
        workflowId: string,
        threadId: string
    ): Promise<void> {
        if (!this.config.maxCheckpoints) {
            return;
        }

        try {
            const stmt = this.db.prepare(`
                DELETE FROM workflow_checkpoints
                WHERE checkpoint_id IN (
                    SELECT checkpoint_id
                    FROM workflow_checkpoints
                    WHERE workflow_id = ? AND thread_id = ?
                    ORDER BY timestamp DESC
                    LIMIT -1 OFFSET ?
                )
            `);

            stmt.run(workflowId, threadId, this.config.maxCheckpoints);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Log but don't throw - cleanup failures shouldn't prevent checkpoint saves
            console.error(`[StateManager] Failed to cleanup old checkpoints for ${workflowId}/${threadId}: ${message}`);
        }
    }
}

/**
 * Workflow session information
 */
export interface WorkflowSession {
    sessionId: string;
    workflowId: string;
    threadId: string;
    startTime: number;
    lastCheckpointId?: string;
    status: "active" | "completed" | "failed" | "interrupted";
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}

/**
 * State transition record
 */
export interface StateTransition {
    transitionId: number;
    checkpointId: string;
    workflowId: string;
    threadId: string;
    fromNode?: string;
    toNode: string;
    transitionType: string;
    timestamp: number;
    durationMs?: number;
}

/**
 * Create (or reuse) a state manager instance per database path.
 * This allows callers to swap `--state-db` paths without restarting the process.
 */
const stateManagerInstances = new Map<string, StateManager>();

export function getStateManager(config?: StatePersistenceConfig): StateManager {
    const key = config?.dbPath ?? "__default__";
    let instance = stateManagerInstances.get(key);
    if (!instance) {
        if (!config) {
            throw new Error(`StateManager not initialized for key ${key}. Provide config on first call.`);
        }
        instance = new StateManager(config);
        stateManagerInstances.set(key, instance);
    }
    return instance;
}
