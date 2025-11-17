/**
 * Tasks API Test Suite
 * Tests for MCP draft specification Tasks API implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskStore } from '../src/tasks/task-store.js';
import type { TaskStatus } from '../src/tasks/types.js';

describe('Tasks API - TaskStore', () => {
  let taskStore: TaskStore;

  beforeEach(() => {
    taskStore = new TaskStore(':memory:');
  });

  afterEach(() => {
    taskStore.close();
  });

  describe('Task Creation', () => {
    it('should create a task with default TTL and poll interval', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool', arguments: {} },
      });

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      const task = taskStore.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe('working');
      expect(task?.ttl).toBe(300000); // 5 minutes
      expect(task?.pollInterval).toBe(5000); // 5 seconds
    });

    it('should create a task with custom TTL', () => {
      const customTtl = 60000; // 1 minute
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
        ttl: customTtl,
      });

      const task = taskStore.getTask(taskId);
      expect(task?.ttl).toBe(customTtl);
    });

    it('should store task parameters correctly', () => {
      const params = {
        name: 'diagnose_mcp_server',
        arguments: { endpoint: 'https://example.com', suites: ['connectivity'] }
      };

      const taskId = taskStore.createTask({
        method: 'tools/call',
        params,
      });

      const task = taskStore.getTask(taskId);
      expect(task?.method).toBe('tools/call');
      expect(task?.params).toEqual(params);
    });
  });

  describe('Task Retrieval', () => {
    it('should retrieve an existing task', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
      });

      const task = taskStore.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.taskId).toBe(taskId);
    });

    it('should return null for non-existent task', () => {
      const task = taskStore.getTask('non-existent-id');
      expect(task).toBeNull();
    });

    it('should not retrieve expired tasks', async () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
        ttl: 100, // 100ms
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const task = taskStore.getTask(taskId);
      expect(task).toBeNull();
    });
  });

  describe('Task Status Updates', () => {
    it('should update task status', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
      });

      const updated = taskStore.updateTaskStatus(taskId, 'input_required', 'Waiting for user input');
      expect(updated).toBe(true);

      const task = taskStore.getTask(taskId);
      expect(task?.status).toBe('input_required');
      expect(task?.statusMessage).toBe('Waiting for user input');
    });

    it('should set task result and mark as completed', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
      });

      const result = { content: [{ type: 'text', text: 'Success!' }] };
      const updated = taskStore.setTaskResult(taskId, result);
      expect(updated).toBe(true);

      const task = taskStore.getTask(taskId);
      expect(task?.status).toBe('completed');
      expect(task?.result).toEqual(result);
    });

    it('should set task error and mark as failed', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
      });

      const error = { code: -32603, message: 'Internal error' };
      const updated = taskStore.setTaskError(taskId, error);
      expect(updated).toBe(true);

      const task = taskStore.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toEqual(error);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel a working task', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
      });

      const cancelled = taskStore.cancelTask(taskId);
      expect(cancelled).toBe(true);

      const task = taskStore.getTask(taskId);
      expect(task?.status).toBe('cancelled');
    });

    it('should not cancel a completed task', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
      });

      taskStore.setTaskResult(taskId, { success: true });

      const cancelled = taskStore.cancelTask(taskId);
      expect(cancelled).toBe(false);

      const task = taskStore.getTask(taskId);
      expect(task?.status).toBe('completed');
    });

    it('should not cancel a failed task', () => {
      const taskId = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'test_tool' },
      });

      taskStore.setTaskError(taskId, { code: -32603, message: 'Error' });

      const cancelled = taskStore.cancelTask(taskId);
      expect(cancelled).toBe(false);
    });
  });

  describe('Task Listing', () => {
    it('should list all tasks', () => {
      // Create multiple tasks
      const taskIds = [];
      for (let i = 0; i < 5; i++) {
        const taskId = taskStore.createTask({
          method: 'tools/call',
          params: { name: `tool_${i}` },
        });
        taskIds.push(taskId);
      }

      const { tasks, nextCursor } = taskStore.listTasks(10);
      expect(tasks.length).toBe(5);
      expect(nextCursor).toBeUndefined();
    });

    it('should paginate tasks with cursor', () => {
      // Create multiple tasks
      for (let i = 0; i < 10; i++) {
        taskStore.createTask({
          method: 'tools/call',
          params: { name: `tool_${i}` },
        });
      }

      // First page
      const page1 = taskStore.listTasks(5);
      expect(page1.tasks.length).toBe(5);
      expect(page1.nextCursor).toBeDefined();

      // Second page
      const page2 = taskStore.listTasks(5, page1.nextCursor);
      expect(page2.tasks.length).toBe(5);
      expect(page2.nextCursor).toBeUndefined();
    });

    it('should not include expired tasks in listing', async () => {
      // Create short-lived task
      taskStore.createTask({
        method: 'tools/call',
        params: { name: 'short_lived' },
        ttl: 100,
      });

      // Create long-lived task
      taskStore.createTask({
        method: 'tools/call',
        params: { name: 'long_lived' },
        ttl: 60000,
      });

      // Wait for first task to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const { tasks } = taskStore.listTasks(10);
      expect(tasks.length).toBe(1);
      expect(tasks[0].status).toBe('working');
    });
  });

  describe('Task Pruning', () => {
    it('should prune expired tasks', async () => {
      // Create tasks with short TTL
      for (let i = 0; i < 5; i++) {
        taskStore.createTask({
          method: 'tools/call',
          params: { name: `tool_${i}` },
          ttl: 100, // 100ms
        });
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const pruned = taskStore.pruneExpired();
      expect(pruned).toBe(5);

      // Verify tasks are gone
      const { tasks } = taskStore.listTasks(10);
      expect(tasks.length).toBe(0);
    });

    it('should not prune non-expired tasks', async () => {
      taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_1' },
        ttl: 60000, // 1 minute
      });

      const pruned = taskStore.pruneExpired();
      expect(pruned).toBe(0);

      const { tasks } = taskStore.listTasks(10);
      expect(tasks.length).toBe(1);
    });
  });

  describe('Task Statistics', () => {
    it('should return task statistics', () => {
      // Create tasks with different statuses
      const task1 = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_1' },
      });

      const task2 = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_2' },
      });

      taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_3' },
      });

      // Set different statuses
      taskStore.setTaskResult(task1, { success: true });
      taskStore.setTaskError(task2, { code: -32603, message: 'Error' });
      // task3 remains as 'working'

      const stats = taskStore.getTaskStats();
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.working).toBe(1);
      expect(stats.total).toBe(3);
    });
  });

  describe('User-based Access Control', () => {
    it('should filter tasks by user', () => {
      const user1Task = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_1' },
        userId: 'user-1',
      });

      const user2Task = taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_2' },
        userId: 'user-2',
      });

      // Retrieve user1's task
      const task1 = taskStore.getTask(user1Task, 'user-1');
      expect(task1).toBeDefined();

      // User2 can't access user1's task
      const task1AsUser2 = taskStore.getTask(user1Task, 'user-2');
      expect(task1AsUser2).toBeNull();

      // User2 can access their own task
      const task2 = taskStore.getTask(user2Task, 'user-2');
      expect(task2).toBeDefined();
    });

    it('should list only user-specific tasks', () => {
      taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_1' },
        userId: 'user-1',
      });

      taskStore.createTask({
        method: 'tools/call',
        params: { name: 'tool_2' },
        userId: 'user-2',
      });

      const user1Tasks = taskStore.listTasks(10, undefined, 'user-1');
      expect(user1Tasks.tasks.length).toBe(1);

      const user2Tasks = taskStore.listTasks(10, undefined, 'user-2');
      expect(user2Tasks.tasks.length).toBe(1);
    });
  });
});
