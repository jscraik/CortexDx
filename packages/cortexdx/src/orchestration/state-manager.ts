import { MemorySaver } from "@langchain/langgraph";
import type {
  WorkflowState,
  WorkflowTransition,
} from "../../../server/src/orchestration/workflow-types.js";

export interface StateCheckpoint {
  checkpointId: string;
  workflowId: string;
  threadId: string;
  state: WorkflowState;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type StatePersistenceConfig = {
  dbPath?: string;
  enableAutoSave?: boolean;
  autoSaveIntervalMs?: number;
  maxCheckpoints?: number;
};

export class StateManager {
  private checkpoints = new Map<string, StateCheckpoint>();
  private transitions: WorkflowTransition[] = [];
  private sessions = new Map<
    string,
    {
      workflowId: string;
      threadId: string;
      status: string;
      metadata?: Record<string, unknown>;
      lastCheckpointId?: string;
    }
  >();
  private memorySavers = new Map<string, MemorySaver>();
  private autoSaveTimers = new Map<string, NodeJS.Timeout>();

  constructor(private config: StatePersistenceConfig = {}) {}

  async saveCheckpoint(checkpoint: StateCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.checkpointId, { ...checkpoint });
    // enforce maxCheckpoints per workflow/thread
    const max = this.config.maxCheckpoints ?? 1000;
    const all = [...this.checkpoints.values()].filter(
      (cp) =>
        cp.workflowId === checkpoint.workflowId &&
        cp.threadId === checkpoint.threadId,
    );
    if (all.length > max) {
      const sorted = all.sort((a, b) => b.timestamp - a.timestamp);
      const toDelete = sorted.slice(max);
      for (const old of toDelete) {
        this.checkpoints.delete(old.checkpointId);
      }
    }

    // link to session if exists
    for (const [id, session] of this.sessions.entries()) {
      if (
        session.workflowId === checkpoint.workflowId &&
        session.threadId === checkpoint.threadId
      ) {
        this.sessions.set(id, { ...session, lastCheckpointId: checkpoint.checkpointId });
      }
    }
  }

  async loadCheckpoint(
    checkpointId: string,
  ): Promise<(StateCheckpoint & { checkpointId: string }) | null> {
    const cp = this.checkpoints.get(checkpointId);
    return cp ? { ...cp } : null;
  }

  async recoverState(input: {
    workflowId: string;
    threadId?: string;
    beforeTimestamp?: number;
  }): Promise<StateCheckpoint | null> {
    const matches = [...this.checkpoints.values()].filter((cp) => {
      if (cp.workflowId !== input.workflowId) return false;
      if (input.threadId && cp.threadId !== input.threadId) return false;
      if (input.beforeTimestamp && cp.timestamp >= input.beforeTimestamp) return false;
      return true;
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.timestamp - a.timestamp);
    return { ...matches[0] };
  }

  async createSession(
    workflowId: string,
    threadId: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const id = `session-${this.sessions.size + 1}`;
    this.sessions.set(id, {
      workflowId,
      threadId,
      status: "active",
      metadata: metadata ? { ...metadata } : undefined,
    });
    return id;
  }

  async getSession(
    sessionId: string,
  ): Promise<
    | {
        sessionId: string;
        workflowId: string;
        threadId: string;
        status: string;
        metadata?: Record<string, unknown>;
        lastCheckpointId?: string;
      }
    | null
  > {
    const session = this.sessions.get(sessionId);
    return session
      ? { sessionId, ...session }
      : null;
  }

  async listSessions(
    workflowId?: string,
    status?: string,
  ): Promise<
    Array<{
      sessionId: string;
      workflowId: string;
      threadId: string;
      status: string;
      metadata?: Record<string, unknown>;
      lastCheckpointId?: string;
    }>
  > {
    return [...this.sessions.entries()]
      .map(([sessionId, session]) => ({ sessionId, ...session }))
      .filter((session) =>
        workflowId ? session.workflowId === workflowId : true,
      )
      .filter((session) => (status ? session.status === status : true));
  }

  async updateSessionStatus(
    sessionId: string,
    status: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.set(sessionId, { ...session, status });
  }

  async recordTransition(
    checkpointId: string,
    workflowId: string,
    threadId: string,
    fromNode: string | null,
    toNode: string,
    transitionType: string,
    durationMs?: number,
  ): Promise<void> {
    const id = `t-${this.transitions.length + 1}`;
    this.transitions.push({
      id,
      checkpointId,
      workflowId,
      threadId,
      fromNode: fromNode || undefined,
      toNode,
      transitionType,
      timestamp: Date.now(),
      durationMs,
    });
  }

  async getTransitionHistory(
    workflowId: string,
    threadId?: string,
  ): Promise<WorkflowTransition[]> {
    return this.transitions
      .filter((t) => t.workflowId === workflowId)
      .filter((t) => (threadId ? t.threadId === threadId : true))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getMemorySaver(workflowId: string): MemorySaver {
    let saver = this.memorySavers.get(workflowId);
    if (!saver) {
      saver = new MemorySaver();
      this.memorySavers.set(workflowId, saver);
    }
    return saver;
  }

  enableAutoSave(
    workflowId: string,
    threadId: string,
    getState: () => WorkflowState,
  ): void {
    if (!this.config.enableAutoSave) return;
    const key = `${workflowId}:${threadId}`;
    const intervalMs = this.config.autoSaveIntervalMs ?? 5000;
    if (this.autoSaveTimers.has(key)) return;
    const timer = setInterval(async () => {
      const state = getState();
      await this.saveCheckpoint({
        checkpointId: `${key}:${Date.now()}`,
        workflowId,
        threadId,
        state,
        timestamp: Date.now(),
      });
    }, intervalMs);
    this.autoSaveTimers.set(key, timer);
  }

  disableAutoSave(workflowId: string, threadId: string): void {
    const key = `${workflowId}:${threadId}`;
    const timer = this.autoSaveTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(key);
    }
  }

  close(): void {
    this.checkpoints.clear();
    this.transitions.length = 0;
    this.sessions.clear();
    for (const timer of this.autoSaveTimers.values()) clearInterval(timer);
    this.autoSaveTimers.clear();
    this.memorySavers.clear();
  }
}

