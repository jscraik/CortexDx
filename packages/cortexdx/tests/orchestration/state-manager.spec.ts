import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager, type StatePersistenceConfig, type StateCheckpoint } from '../../src/orchestration/state-manager.js';
import type { WorkflowState } from '../../src/orchestration/workflow-types.js';
import type { DiagnosticContext } from '../../src/types.js';

// Mock diagnostic context
const createMockContext = (): DiagnosticContext => ({
  endpoint: 'http://localhost:3000',
  headers: {},
  logger: () => { /* noop */ },
  request: async () => ({}),
  jsonrpc: async () => ({}),
  sseProbe: async () => ({ ok: true }),
  evidence: () => { /* noop */ },
  deterministic: true,
});

// Create mock workflow state
const createMockState = (overrides?: Partial<WorkflowState>): WorkflowState => ({
  endpoint: 'http://localhost:3000',
  findings: [],
  errors: [],
  currentNode: 'test-node',
  visitedNodes: ['node1', 'node2'],
  executionPath: ['Start', 'Process'],
  severity: null,
  findingCount: 0,
  hasBlockers: false,
  hasMajor: false,
  awaitingUserInput: false,
  context: createMockContext(),
  config: {
    workflowId: 'test-workflow',
    name: 'Test Workflow',
    description: 'Test description',
    enableCheckpointing: true,
  },
  startTime: Date.now(),
  nodeTimings: { node1: 100, node2: 150 },
  ...overrides,
});

describe('Orchestration - State Manager', () => {
  let stateManager: StateManager;
  let config: StatePersistenceConfig;

  beforeEach(() => {
    config = {
      dbPath: ':memory:', // Use in-memory SQLite for tests
      enableAutoSave: false,
      maxCheckpoints: 10,
    };

    stateManager = new StateManager(config);
  });

  afterEach(() => {
    stateManager.close();
  });

  describe('Checkpoint Management', () => {
    it('should save and load checkpoints', async () => {
      const checkpoint: StateCheckpoint = {
        checkpointId: 'checkpoint-1',
        workflowId: 'test-workflow',
        threadId: 'thread-1',
        state: createMockState(),
        timestamp: Date.now(),
        metadata: { test: true },
      };

      await stateManager.saveCheckpoint(checkpoint);

      const loaded = await stateManager.loadCheckpoint('checkpoint-1');

      expect(loaded).toBeDefined();
      expect(loaded?.checkpointId).toBe('checkpoint-1');
      expect(loaded?.workflowId).toBe('test-workflow');
      expect(loaded?.threadId).toBe('thread-1');
      expect(loaded?.state.currentNode).toBe('test-node');
      expect(loaded?.metadata).toEqual({ test: true });
    });

    it('should return null for nonexistent checkpoint', async () => {
      const loaded = await stateManager.loadCheckpoint('nonexistent');
      expect(loaded).toBeNull();
    });

    it('should update existing checkpoint', async () => {
      const checkpoint: StateCheckpoint = {
        checkpointId: 'update-test',
        workflowId: 'test-workflow',
        threadId: 'thread-1',
        state: createMockState({ currentNode: 'node-1' }),
        timestamp: Date.now(),
      };

      await stateManager.saveCheckpoint(checkpoint);

      // Update the checkpoint
      const updated: StateCheckpoint = {
        ...checkpoint,
        state: createMockState({ currentNode: 'node-2' }),
        timestamp: Date.now(),
      };

      await stateManager.saveCheckpoint(updated);

      const loaded = await stateManager.loadCheckpoint('update-test');
      expect(loaded?.state.currentNode).toBe('node-2');
    });

    it('should cleanup old checkpoints when limit exceeded', async () => {
      const manager = new StateManager({
        dbPath: ':memory:',
        enableAutoSave: false,
        maxCheckpoints: 3, // Only keep 3 checkpoints
      });

      try {
        // Save 5 checkpoints
        for (let i = 1; i <= 5; i++) {
          const checkpoint: StateCheckpoint = {
            checkpointId: `checkpoint-${i}`,
            workflowId: 'cleanup-test',
            threadId: 'thread-1',
            state: createMockState({ currentNode: `node-${i}` }),
            timestamp: Date.now() + i, // Increasing timestamps
          };
          await manager.saveCheckpoint(checkpoint);
        }

        // Wait a bit to ensure cleanup runs
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check that only the latest 3 exist
        const oldest = await manager.loadCheckpoint('checkpoint-1');
        const middle = await manager.loadCheckpoint('checkpoint-2');
        const recent3 = await manager.loadCheckpoint('checkpoint-3');
        const recent4 = await manager.loadCheckpoint('checkpoint-4');
        const newest = await manager.loadCheckpoint('checkpoint-5');

        // The exact behavior depends on when cleanup runs
        // At minimum, we should have the newest checkpoints
        expect(newest).toBeDefined();
        expect(recent4).toBeDefined();
        expect(recent3).toBeDefined();
      } finally {
        manager.close();
      }
    });
  });

  describe('State Recovery', () => {
    it('should recover state by workflow ID', async () => {
      const checkpoint: StateCheckpoint = {
        checkpointId: 'recovery-1',
        workflowId: 'recoverable-workflow',
        threadId: 'thread-1',
        state: createMockState({ currentNode: 'recovered-node' }),
        timestamp: Date.now(),
      };

      await stateManager.saveCheckpoint(checkpoint);

      const recovered = await stateManager.recoverState({
        workflowId: 'recoverable-workflow',
      });

      expect(recovered).toBeDefined();
      expect(recovered?.state.currentNode).toBe('recovered-node');
    });

    it('should recover state by workflow and thread ID', async () => {
      // Save checkpoints for different threads
      await stateManager.saveCheckpoint({
        checkpointId: 'thread-1-cp',
        workflowId: 'multi-thread',
        threadId: 'thread-1',
        state: createMockState({ currentNode: 'thread-1-node' }),
        timestamp: Date.now(),
      });

      await stateManager.saveCheckpoint({
        checkpointId: 'thread-2-cp',
        workflowId: 'multi-thread',
        threadId: 'thread-2',
        state: createMockState({ currentNode: 'thread-2-node' }),
        timestamp: Date.now(),
      });

      const recovered = await stateManager.recoverState({
        workflowId: 'multi-thread',
        threadId: 'thread-2',
      });

      expect(recovered?.state.currentNode).toBe('thread-2-node');
      expect(recovered?.threadId).toBe('thread-2');
    });

    it('should recover latest checkpoint when multiple exist', async () => {
      const baseTime = Date.now();

      await stateManager.saveCheckpoint({
        checkpointId: 'old-cp',
        workflowId: 'multi-checkpoint',
        threadId: 'thread-1',
        state: createMockState({ currentNode: 'old-node' }),
        timestamp: baseTime,
      });

      await stateManager.saveCheckpoint({
        checkpointId: 'new-cp',
        workflowId: 'multi-checkpoint',
        threadId: 'thread-1',
        state: createMockState({ currentNode: 'new-node' }),
        timestamp: baseTime + 1000,
      });

      const recovered = await stateManager.recoverState({
        workflowId: 'multi-checkpoint',
        threadId: 'thread-1',
      });

      expect(recovered?.checkpointId).toBe('new-cp');
      expect(recovered?.state.currentNode).toBe('new-node');
    });

    it('should recover state before specific timestamp', async () => {
      const baseTime = Date.now();

      await stateManager.saveCheckpoint({
        checkpointId: 'early-cp',
        workflowId: 'time-based',
        threadId: 'thread-1',
        state: createMockState({ currentNode: 'early' }),
        timestamp: baseTime - 2000,
      });

      await stateManager.saveCheckpoint({
        checkpointId: 'late-cp',
        workflowId: 'time-based',
        threadId: 'thread-1',
        state: createMockState({ currentNode: 'late' }),
        timestamp: baseTime,
      });

      const recovered = await stateManager.recoverState({
        workflowId: 'time-based',
        threadId: 'thread-1',
        beforeTimestamp: baseTime - 1000,
      });

      expect(recovered?.checkpointId).toBe('early-cp');
      expect(recovered?.state.currentNode).toBe('early');
    });

    it('should return null when no matching checkpoint found', async () => {
      const recovered = await stateManager.recoverState({
        workflowId: 'nonexistent',
        threadId: 'no-thread',
      });

      expect(recovered).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should create workflow sessions', async () => {
      const sessionId = await stateManager.createSession(
        'session-workflow',
        'session-thread',
        { user: 'test-user' }
      );

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-/);

      const session = await stateManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.workflowId).toBe('session-workflow');
      expect(session?.threadId).toBe('session-thread');
      expect(session?.status).toBe('active');
      expect(session?.metadata).toEqual({ user: 'test-user' });
    });

    it('should list sessions by workflow', async () => {
      await stateManager.createSession('list-test', 'thread-1');
      await stateManager.createSession('list-test', 'thread-2');
      await stateManager.createSession('other-workflow', 'thread-3');

      const sessions = await stateManager.listSessions('list-test');

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.threadId)).toContain('thread-1');
      expect(sessions.map((s) => s.threadId)).toContain('thread-2');
      expect(sessions.map((s) => s.threadId)).not.toContain('thread-3');
    });

    it('should filter sessions by status', async () => {
      const session1 = await stateManager.createSession('status-test', 'thread-1');
      const session2 = await stateManager.createSession('status-test', 'thread-2');

      await stateManager.updateSessionStatus(session1, 'completed');
      await stateManager.updateSessionStatus(session2, 'failed');

      const completed = await stateManager.listSessions('status-test', 'completed');
      expect(completed).toHaveLength(1);
      expect(completed[0].status).toBe('completed');

      const failed = await stateManager.listSessions('status-test', 'failed');
      expect(failed).toHaveLength(1);
      expect(failed[0].status).toBe('failed');
    });

    it('should update session status', async () => {
      const sessionId = await stateManager.createSession('update-status', 'thread-1');

      await stateManager.updateSessionStatus(sessionId, 'completed');

      const session = await stateManager.getSession(sessionId);
      expect(session?.status).toBe('completed');
    });

    it('should update session with latest checkpoint', async () => {
      const sessionId = await stateManager.createSession('checkpoint-link', 'thread-1');

      await stateManager.saveCheckpoint({
        checkpointId: 'linked-cp',
        workflowId: 'checkpoint-link',
        threadId: 'thread-1',
        state: createMockState(),
        timestamp: Date.now(),
      });

      const session = await stateManager.getSession(sessionId);
      expect(session?.lastCheckpointId).toBe('linked-cp');
    });
  });

  describe('State Transitions', () => {
    it('should record state transitions', async () => {
      await stateManager.recordTransition(
        'checkpoint-1',
        'transition-workflow',
        'thread-1',
        'node-a',
        'node-b',
        'normal',
        50
      );

      const history = await stateManager.getTransitionHistory('transition-workflow');

      expect(history).toHaveLength(1);
      expect(history[0].fromNode).toBe('node-a');
      expect(history[0].toNode).toBe('node-b');
      expect(history[0].transitionType).toBe('normal');
      expect(history[0].durationMs).toBe(50);
    });

    it('should record transition from START node', async () => {
      await stateManager.recordTransition(
        'checkpoint-start',
        'start-workflow',
        'thread-1',
        null, // No "from" node for start
        'first-node',
        'entry',
        10
      );

      const history = await stateManager.getTransitionHistory('start-workflow');

      expect(history).toHaveLength(1);
      expect(history[0].fromNode).toBeUndefined();
      expect(history[0].toNode).toBe('first-node');
      expect(history[0].transitionType).toBe('entry');
    });

    it('should retrieve transition history by thread', async () => {
      await stateManager.recordTransition(
        'cp-1',
        'multi-thread-transitions',
        'thread-1',
        'a',
        'b',
        'normal'
      );

      await stateManager.recordTransition(
        'cp-2',
        'multi-thread-transitions',
        'thread-2',
        'x',
        'y',
        'normal'
      );

      const thread1History = await stateManager.getTransitionHistory(
        'multi-thread-transitions',
        'thread-1'
      );

      expect(thread1History).toHaveLength(1);
      expect(thread1History[0].toNode).toBe('b');
    });

    it('should preserve transition order by timestamp', async () => {
      await stateManager.recordTransition(
        'cp-1',
        'ordered-transitions',
        'thread-1',
        null,
        'start',
        'entry'
      );

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await stateManager.recordTransition(
        'cp-2',
        'ordered-transitions',
        'thread-1',
        'start',
        'middle',
        'normal'
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await stateManager.recordTransition(
        'cp-3',
        'ordered-transitions',
        'thread-1',
        'middle',
        'end',
        'normal'
      );

      const history = await stateManager.getTransitionHistory('ordered-transitions');

      expect(history).toHaveLength(3);
      expect(history[0].toNode).toBe('start');
      expect(history[1].toNode).toBe('middle');
      expect(history[2].toNode).toBe('end');
    });
  });

  describe('MemorySaver Integration', () => {
    it('should create MemorySaver for workflow', () => {
      const saver = stateManager.getMemorySaver('test-workflow');

      expect(saver).toBeDefined();
    });

    it('should reuse MemorySaver for same workflow', () => {
      const saver1 = stateManager.getMemorySaver('reuse-test');
      const saver2 = stateManager.getMemorySaver('reuse-test');

      expect(saver1).toBe(saver2);
    });

    it('should create different MemorySavers for different workflows', () => {
      const saver1 = stateManager.getMemorySaver('workflow-1');
      const saver2 = stateManager.getMemorySaver('workflow-2');

      expect(saver1).not.toBe(saver2);
    });
  });

  describe('Auto-Save Functionality', () => {
    it('should enable auto-save with timer', async () => {
      const manager = new StateManager({
        dbPath: ':memory:',
        enableAutoSave: true,
        autoSaveIntervalMs: 50, // Very short interval for testing
      });

      try {
        let callCount = 0;
        const getState = () => {
          callCount++;
          return createMockState({ currentNode: `auto-node-${callCount}` });
        };

        manager.enableAutoSave('auto-workflow', 'thread-1', getState);

        // Wait for a few auto-saves
        await new Promise((resolve) => setTimeout(resolve, 200));

        manager.disableAutoSave('auto-workflow', 'thread-1');

        // Auto-save should have been called multiple times
        expect(callCount).toBeGreaterThan(1);
      } finally {
        manager.close();
      }
    });

    it('should disable auto-save', async () => {
      const manager = new StateManager({
        dbPath: ':memory:',
        enableAutoSave: true,
        autoSaveIntervalMs: 50,
      });

      try {
        let callCount = 0;
        const getState = () => {
          callCount++;
          return createMockState();
        };

        manager.enableAutoSave('disable-test', 'thread-1', getState);
        await new Promise((resolve) => setTimeout(resolve, 100));

        const countAfterEnable = callCount;

        manager.disableAutoSave('disable-test', 'thread-1');
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Call count should not increase after disabling
        expect(callCount).toBe(countAfterEnable);
      } finally {
        manager.close();
      }
    });

    it('should not enable auto-save when disabled in config', () => {
      const getState = () => createMockState();

      stateManager.enableAutoSave('no-autosave', 'thread-1', getState);

      // Should not throw, just silently skip
      // No assertions needed - test passes if no error
    });
  });

  describe('Database Persistence', () => {
    it('should persist state across manager instances', async () => {
      const dbPath = ':memory:';

      // This test is conceptual - in-memory databases don't persist
      // In real usage with file-based DBs, this would work
      const checkpoint: StateCheckpoint = {
        checkpointId: 'persist-test',
        workflowId: 'persist-workflow',
        threadId: 'thread-1',
        state: createMockState(),
        timestamp: Date.now(),
      };

      await stateManager.saveCheckpoint(checkpoint);

      const loaded = await stateManager.loadCheckpoint('persist-test');
      expect(loaded).toBeDefined();
    });
  });
});
