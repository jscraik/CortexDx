# MCP Draft Specification Implementation Plan

**Target Release:** November 25, 2025 (8 days)
**Current Protocol:** 2024-11-05
**Target Protocol:** draft (post-2025-06-18)
**SDK Version:** @modelcontextprotocol/sdk v1.22.0 ✅ (Latest)

---

## Executive Summary

This plan outlines the implementation of **9 major features** from the draft MCP specification, with prioritization based on value to CortexDx's diagnostic and development workflows.

### Implementation Priority

🔴 **CRITICAL (Days 1-4):**
1. Tasks API (experimental) - Perfect for long-running diagnostics
2. Tool naming audit - ✅ **ALREADY COMPLIANT**
3. Protocol version update

🟡 **HIGH VALUE (Days 5-6):**
4. Icons metadata for tools/resources
5. Enhanced tool execution error handling

🟢 **MEDIUM VALUE (Days 7-8):**
6. Enhanced authorization flows
7. Tool calling in sampling
8. Security best practices review

---

## 1. Tasks API Implementation 🔴 CRITICAL

### Overview
The Tasks API enables **deferrable execution** with polling-based result retrieval - perfect for your long-running diagnostic workflows.

### Current Pain Point
Your diagnostic operations can take **minutes to hours** with no standardized way for clients to:
- Track progress
- Poll for status
- Retrieve results asynchronously
- Cancel operations

### Value Proposition
- ✅ Standardized async operation pattern
- ✅ Built-in polling mechanism
- ✅ Task lifecycle management
- ✅ Better UX for long-running diagnostics

### Implementation Tasks

#### Phase 1: Core Infrastructure (Day 1)

**1.1 Task Storage Layer**
```typescript
// packages/cortexdx/src/tasks/task-store.ts
import Database from 'better-sqlite3';

interface TaskRecord {
  taskId: string;
  method: string;          // Original request method
  params: unknown;         // Original request params
  status: 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled';
  statusMessage?: string;
  createdAt: string;
  ttl: number;
  pollInterval: number;
  result?: unknown;        // Stored result when completed
  error?: unknown;         // Error details if failed
}

export class TaskStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        taskId TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        params TEXT NOT NULL,
        status TEXT NOT NULL,
        statusMessage TEXT,
        createdAt TEXT NOT NULL,
        ttl INTEGER NOT NULL,
        pollInterval INTEGER NOT NULL,
        result TEXT,
        error TEXT,
        expiresAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_expires ON tasks(expiresAt);
    `);
  }

  createTask(task: Omit<TaskRecord, 'taskId'>): string {
    const taskId = crypto.randomUUID();
    const expiresAt = Date.now() + task.ttl;

    this.db.prepare(`
      INSERT INTO tasks (taskId, method, params, status, statusMessage,
                        createdAt, ttl, pollInterval, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      task.method,
      JSON.stringify(task.params),
      task.status,
      task.statusMessage,
      task.createdAt,
      task.ttl,
      task.pollInterval,
      expiresAt
    );

    return taskId;
  }

  getTask(taskId: string): TaskRecord | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE taskId = ?').get(taskId);
    if (!row) return null;

    return {
      ...row,
      params: JSON.parse(row.params),
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ? JSON.parse(row.error) : undefined
    };
  }

  updateTaskStatus(taskId: string, status: TaskRecord['status'], statusMessage?: string) {
    this.db.prepare(`
      UPDATE tasks SET status = ?, statusMessage = ? WHERE taskId = ?
    `).run(status, statusMessage, taskId);
  }

  setTaskResult(taskId: string, result: unknown) {
    this.db.prepare(`
      UPDATE tasks SET status = 'completed', result = ? WHERE taskId = ?
    `).run(JSON.stringify(result), taskId);
  }

  setTaskError(taskId: string, error: unknown) {
    this.db.prepare(`
      UPDATE tasks SET status = 'failed', error = ? WHERE taskId = ?
    `).run(JSON.stringify(error), taskId);
  }

  listTasks(limit = 50, cursor?: string): { tasks: TaskRecord[]; nextCursor?: string } {
    const rows = this.db.prepare(`
      SELECT * FROM tasks
      WHERE (? IS NULL OR taskId > ?)
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(cursor, cursor, limit);

    const tasks = rows.map(row => ({
      ...row,
      params: JSON.parse(row.params),
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ? JSON.parse(row.error) : undefined
    }));

    const nextCursor = tasks.length === limit ? tasks[tasks.length - 1].taskId : undefined;
    return { tasks, nextCursor };
  }

  cancelTask(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task) return false;

    // Can't cancel terminal states
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return false;
    }

    this.db.prepare(`
      UPDATE tasks SET status = 'cancelled' WHERE taskId = ?
    `).run(taskId);
    return true;
  }

  // Clean up expired tasks
  pruneExpired(): number {
    const result = this.db.prepare(`
      DELETE FROM tasks WHERE expiresAt < ?
    `).run(Date.now());

    return result.changes;
  }
}
```

**1.2 Task Executor**
```typescript
// packages/cortexdx/src/tasks/task-executor.ts
import type { TaskStore } from './task-store.js';
import type { DiagnosticContext } from '../types.js';

export class TaskExecutor {
  constructor(
    private taskStore: TaskStore,
    private logger: Logger
  ) {}

  /**
   * Execute a task asynchronously
   */
  async executeTask(taskId: string, ctx: DiagnosticContext) {
    const task = this.taskStore.getTask(taskId);
    if (!task) {
      this.logger.error({ taskId }, 'Task not found');
      return;
    }

    try {
      this.logger.info({ taskId, method: task.method }, 'Starting task execution');

      // Dispatch to appropriate handler based on method
      let result: unknown;

      switch (task.method) {
        case 'tools/call':
          result = await this.executeToolCall(task.params, ctx);
          break;
        case 'sampling/createMessage':
          result = await this.executeSampling(task.params, ctx);
          break;
        case 'elicitation/create':
          result = await this.executeElicitation(task.params, ctx);
          break;
        default:
          throw new Error(`Unsupported task method: ${task.method}`);
      }

      // Store result
      this.taskStore.setTaskResult(taskId, result);
      this.logger.info({ taskId }, 'Task completed successfully');

    } catch (error) {
      this.logger.error({ taskId, error }, 'Task execution failed');
      this.taskStore.setTaskError(taskId, {
        code: -32603,
        message: error instanceof Error ? error.message : 'Task execution failed'
      });
    }
  }

  private async executeToolCall(params: unknown, ctx: DiagnosticContext) {
    const { name, arguments: args } = params as { name: string; arguments?: unknown };

    // Import and use existing tool execution logic
    const { findMcpTool } = await import('../tools/index.js');
    const { executeDevelopmentTool } = await import('../server.js'); // May need refactor

    const tool = findMcpTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    return await executeDevelopmentTool(tool, args, ctx as DevelopmentContext);
  }

  private async executeSampling(params: unknown, ctx: DiagnosticContext) {
    // Implement sampling via LLM orchestrator
    throw new Error('Sampling not yet implemented');
  }

  private async executeElicitation(params: unknown, ctx: DiagnosticContext) {
    // Implement elicitation
    throw new Error('Elicitation not yet implemented');
  }
}
```

#### Phase 2: Server Integration (Day 2)

**2.1 Add Task Capability**
```typescript
// packages/cortexdx/src/server.ts

// Initialize task store
import { TaskStore } from './tasks/task-store.js';
import { TaskExecutor } from './tasks/task-executor.js';

const taskStore = new TaskStore('.cortexdx/tasks.db');
const taskExecutor = new TaskExecutor(taskStore, serverLogger);

// Prune expired tasks every 5 minutes
setInterval(() => {
  const pruned = taskStore.pruneExpired();
  if (pruned > 0) {
    serverLogger.info({ pruned }, 'Pruned expired tasks');
  }
}, 5 * 60 * 1000);

// Update initialize response
case "initialize":
  return createSuccessResponse(responseId, {
    protocolVersion: "draft", // Updated
    capabilities: {
      tools: {
        // Add task support
        taskRequests: true
      },
      resources: {
        list: true,
        read: true,
        taskRequests: true
      },
    },
    serverInfo: {
      name: "CortexDx Server",
      version: "1.0.0",
    },
  });
```

**2.2 Handle Task Augmentation**
```typescript
// packages/cortexdx/src/server.ts

async function handleJsonRpcCall(
  payload: JsonRpcRequestPayload | undefined,
  req: IncomingMessage,
): Promise<JsonRpcResponsePayload | undefined> {
  // ... existing code ...

  const { id, method, params } = payload ?? {};

  // Check if this is a task-augmented request
  const taskParams = params && typeof params === 'object' && 'task' in params
    ? (params as { task?: { ttl?: number } }).task
    : undefined;

  if (taskParams) {
    // Create task instead of executing immediately
    const ttl = taskParams.ttl || 300000; // Default 5 minutes
    const taskId = taskStore.createTask({
      method,
      params,
      status: 'working',
      createdAt: new Date().toISOString(),
      ttl,
      pollInterval: 5000, // Poll every 5 seconds
    });

    // Execute asynchronously
    const ctx = createDevelopmentContext(req);
    taskExecutor.executeTask(taskId, ctx).catch(err => {
      serverLogger.error({ taskId, error: err }, 'Background task execution failed');
    });

    // Return task metadata immediately
    const task = taskStore.getTask(taskId);
    return createSuccessResponse(responseId, {
      task: {
        taskId: task.taskId,
        status: task.status,
        createdAt: task.createdAt,
        ttl: task.ttl,
        pollInterval: task.pollInterval
      }
    });
  }

  // ... existing synchronous handling ...
}
```

**2.3 Add Task Management Endpoints**
```typescript
// packages/cortexdx/src/server.ts

switch (method) {
  // ... existing cases ...

  case "tasks/get": {
    const taskId = typeof params?.taskId === 'string' ? params.taskId : undefined;
    if (!taskId) {
      return createErrorResponse(responseId, -32602, 'taskId is required');
    }

    const task = taskStore.getTask(taskId);
    if (!task) {
      return createErrorResponse(responseId, -32602, 'Task not found or expired');
    }

    return createSuccessResponse(responseId, {
      task: {
        taskId: task.taskId,
        status: task.status,
        statusMessage: task.statusMessage,
        createdAt: task.createdAt,
        ttl: task.ttl,
        pollInterval: task.pollInterval
      }
    });
  }

  case "tasks/result": {
    const taskId = typeof params?.taskId === 'string' ? params.taskId : undefined;
    if (!taskId) {
      return createErrorResponse(responseId, -32602, 'taskId is required');
    }

    const task = taskStore.getTask(taskId);
    if (!task) {
      return createErrorResponse(responseId, -32602, 'Task not found or expired');
    }

    if (task.status === 'completed') {
      return createSuccessResponse(responseId, task.result);
    } else if (task.status === 'failed') {
      return createErrorResponse(
        responseId,
        (task.error as { code: number })?.code || -32603,
        (task.error as { message: string })?.message || 'Task execution failed'
      );
    } else {
      return createErrorResponse(
        responseId,
        -32602,
        `Task is not in terminal state (current: ${task.status})`
      );
    }
  }

  case "tasks/list": {
    const limit = typeof params?.limit === 'number' ? params.limit : 50;
    const cursor = typeof params?.cursor === 'string' ? params.cursor : undefined;

    const { tasks, nextCursor } = taskStore.listTasks(limit, cursor);

    return createSuccessResponse(responseId, {
      tasks: tasks.map(t => ({
        taskId: t.taskId,
        status: t.status,
        statusMessage: t.statusMessage,
        createdAt: t.createdAt,
        ttl: t.ttl
      })),
      nextCursor
    });
  }

  case "tasks/cancel": {
    const taskId = typeof params?.taskId === 'string' ? params.taskId : undefined;
    if (!taskId) {
      return createErrorResponse(responseId, -32602, 'taskId is required');
    }

    const cancelled = taskStore.cancelTask(taskId);
    if (!cancelled) {
      return createErrorResponse(
        responseId,
        -32602,
        'Task not found, expired, or already in terminal state'
      );
    }

    return createSuccessResponse(responseId, {});
  }
}
```

#### Phase 3: Testing & Documentation (Day 3)

**3.1 Integration Tests**
```typescript
// packages/cortexdx/tests/tasks-api.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskStore } from '../src/tasks/task-store.js';

describe('Tasks API', () => {
  let taskStore: TaskStore;

  beforeEach(() => {
    taskStore = new TaskStore(':memory:');
  });

  it('should create and retrieve task', () => {
    const taskId = taskStore.createTask({
      method: 'tools/call',
      params: { name: 'test_tool' },
      status: 'working',
      createdAt: new Date().toISOString(),
      ttl: 60000,
      pollInterval: 5000
    });

    const task = taskStore.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.status).toBe('working');
  });

  it('should update task to completed', () => {
    const taskId = taskStore.createTask(/* ... */);
    taskStore.setTaskResult(taskId, { success: true });

    const task = taskStore.getTask(taskId);
    expect(task?.status).toBe('completed');
    expect(task?.result).toEqual({ success: true });
  });

  it('should prevent cancelling terminal tasks', () => {
    const taskId = taskStore.createTask(/* ... */);
    taskStore.setTaskResult(taskId, { success: true });

    const cancelled = taskStore.cancelTask(taskId);
    expect(cancelled).toBe(false);
  });

  it('should prune expired tasks', async () => {
    const taskId = taskStore.createTask({
      /* ... */
      ttl: 100 // 100ms
    });

    await new Promise(resolve => setTimeout(resolve, 150));
    const pruned = taskStore.pruneExpired();

    expect(pruned).toBe(1);
    expect(taskStore.getTask(taskId)).toBeNull();
  });
});
```

**3.2 Documentation**
- Add Tasks API guide to `docs/TASKS_API.md`
- Update `README.md` with task-augmented request examples
- Add task lifecycle diagram

#### Phase 4: CLI Integration (Day 4)

**4.1 Add --async Flag**
```typescript
// packages/cortexdx/src/commands/diagnose.ts

program
  .command('diagnose <endpoint>')
  .option('--async', 'Execute diagnostic as async task with polling')
  .option('--task-ttl <ms>', 'Task time-to-live in milliseconds', '300000')
  .action(async (endpoint, options) => {
    if (options.async) {
      // Create task
      const response = await callMcpMethod(endpoint, 'tools/call', {
        name: 'diagnose_mcp_server',
        arguments: { endpoint, suites: options.suites },
        task: { ttl: parseInt(options.taskTtl) }
      });

      const { taskId, pollInterval } = response.task;
      console.log(`Task created: ${taskId}`);
      console.log(`Polling for results every ${pollInterval}ms...`);

      // Poll for completion
      while (true) {
        await sleep(pollInterval);

        const status = await callMcpMethod(endpoint, 'tasks/get', { taskId });
        console.log(`Status: ${status.task.status}`);

        if (['completed', 'failed', 'cancelled'].includes(status.task.status)) {
          // Get results
          const result = await callMcpMethod(endpoint, 'tasks/result', { taskId });
          console.log('Task complete:', result);
          break;
        }
      }
    } else {
      // Synchronous execution (existing code)
      // ...
    }
  });
```

### Estimated Effort: **3-4 days**

---

## 2. Tool Naming Audit ✅ ALREADY COMPLIANT

### Status: **COMPLETE**

All **111 tools** in the codebase are already compliant with the new naming guidance:
- ✅ Length: 1-128 characters (all 9-33 chars)
- ✅ Alphanumeric + underscore/dash/dot only
- ✅ No spaces or special characters
- ✅ Case-sensitive

**Examples of compliant names:**
- `diagnose_mcp_server`
- `cortexdx_deepcontext_index`
- `ide_validate_code`
- `story.list`, `story.get`

### Estimated Effort: **0 hours** ✅

---

## 3. Protocol Version Update 🔴 CRITICAL

### Changes Required

**server.ts:1586**
```typescript
// Current:
protocolVersion: "2024-11-05"

// Updated:
protocolVersion: "draft"
```

**Note:** On Nov 25, 2025, replace `"draft"` with the official version number (likely `"2025-11-25"` or similar).

### Testing

1. Update all protocol compliance tests
2. Run integration tests against draft-compliant clients
3. Verify backward compatibility handling

### Estimated Effort: **2 hours**

---

## 4. Icons Metadata 🟡 HIGH VALUE

### Overview

Add optional icon arrays to tools, resources, prompts for enhanced UX.

### Icon Format

```typescript
interface Icon {
  src: string;      // URL or data URI
  mimeType: string; // "image/png", "image/svg+xml"
  sizes: string[];  // ["48x48", "96x96"]
}
```

### Implementation

**4.1 Add Icons to Tool Definitions**
```typescript
// packages/cortexdx/src/tools/diagnostic-tools.ts

export const diagnosticTools: McpTool[] = [
  {
    name: "diagnose_mcp_server",
    description: "Comprehensive MCP server diagnostic",
    inputSchema: { /* ... */ },
    icons: [
      {
        src: "data:image/svg+xml;base64,...", // Diagnostic icon SVG
        mimeType: "image/svg+xml",
        sizes: ["48x48"]
      }
    ]
  },
  // ... other tools
];
```

**4.2 Icon Asset Creation**

Create SVG icons for tool categories:
- 🔍 Diagnostics (magnifying glass)
- 🛠️ Development (wrench)
- 📚 Academic (book)
- 🔐 License (lock)
- 📊 Reports (chart)
- 🤖 AI/Agent (robot)
- 🔌 IDE (code editor)

**4.3 Add Icons to Resources**
```typescript
// packages/cortexdx/src/resources/research-store.ts

const resource = {
  uri: `cortexdx://research/${id}`,
  name: `Academic Research — ${report.topic}`,
  description: `Captured ${new Date(createdAt).toISOString()}`,
  mimeType: "application/json",
  icons: [
    {
      src: "https://cortexdx.io/icons/research.svg",
      mimeType: "image/svg+xml",
      sizes: ["48x48"]
    }
  ]
};
```

### Estimated Effort: **1 day**

---

## 5. Enhanced Tool Execution Error Handling 🟡 HIGH VALUE

### Spec Requirement (SEP-1303)

> Input validation errors should be returned as Tool Execution Errors rather than Protocol Errors to enable model self-correction.

### Current State

Your server returns `-32602` (Invalid params) protocol errors for tool validation failures.

### Required Changes

**Return validation errors as tool results:**

```typescript
// packages/cortexdx/src/server.ts - handleToolsCall

async function handleToolsCall(
  req: IncomingMessage,
  params: Record<string, unknown> | undefined,
  id: JsonRpcId,
): Promise<JsonRpcResponsePayload> {
  const name = typeof params?.name === 'string' ? params.name : undefined;
  if (!name) {
    // Still a protocol error - no tool name provided
    return createErrorResponse(id, -32602, "Tool name is required");
  }

  const args = params?.arguments;
  const mcpTool = findMcpTool(name);

  if (mcpTool) {
    try {
      const ctx = createDevelopmentContext(req);

      // Validate input schema
      if (mcpTool.inputSchema) {
        const validation = validateToolInput(mcpTool.inputSchema, args);
        if (!validation.valid) {
          // Return as TOOL ERROR, not protocol error
          return createSuccessResponse(id, {
            content: [
              {
                type: "text",
                text: `Input validation failed: ${validation.errors.join(', ')}`
              }
            ],
            isError: true  // Mark as execution error
          });
        }
      }

      const result = await executeDevelopmentTool(mcpTool, args, ctx);
      return createSuccessResponse(id, result);

    } catch (error) {
      // Execution errors also returned as tool results
      return createSuccessResponse(id, {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Tool execution failed"
          }
        ],
        isError: true
      });
    }
  }

  // Tool not found is still a protocol error
  return createErrorResponse(id, -32601, `Tool not found: ${name}`);
}
```

**Add input validation helper:**
```typescript
// packages/cortexdx/src/utils/validation.ts

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateToolInput(
  schema: Record<string, unknown>,
  input: unknown
): ValidationResult {
  // Use existing Ajv validator
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  const valid = validate(input);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors || []).map(err =>
    `${err.instancePath || 'input'} ${err.message}`
  );

  return { valid: false, errors };
}
```

### Estimated Effort: **4 hours**

---

## 6. Enhanced Authorization 🟢 MEDIUM VALUE

### New Features

1. **OpenID Connect Discovery** (PR #797)
2. **Incremental Scope Consent via WWW-Authenticate** (SEP-835)
3. **OAuth Client ID Metadata Documents** (SEP-991)

### Assessment

You already have Auth0 integration which supports:
- ✅ OIDC Discovery (Auth0 provides `.well-known/openid-configuration`)
- ✅ JWT token validation
- ✅ Scope management

### Recommended Actions

**6.1 Add WWW-Authenticate Header Support**

When a tool requires additional scopes:
```typescript
// packages/cortexdx/src/plugins/auth-middleware.ts

function checkToolScopes(tool: string, userScopes: string[]): {
  allowed: boolean;
  missingScopes?: string[];
} {
  const requiredScopes = TOOL_SCOPE_MAP[tool] || [];
  const missingScopes = requiredScopes.filter(s => !userScopes.includes(s));

  return {
    allowed: missingScopes.length === 0,
    missingScopes: missingScopes.length > 0 ? missingScopes : undefined
  };
}

// In handleToolsCall:
const access = checkToolScopes(name, userScopes);
if (!access.allowed) {
  // Set WWW-Authenticate header for incremental consent
  res.setHeader('WWW-Authenticate',
    `Bearer realm="CortexDx", scope="${access.missingScopes.join(' ')}"`
  );
  return createErrorResponse(id, -32001,
    `Additional scopes required: ${access.missingScopes.join(', ')}`
  );
}
```

**6.2 Document OAuth Client Registration**

Add `docs/OAUTH_CLIENT_REGISTRATION.md` with:
- Client ID metadata document format
- Registration process
- Scope documentation

### Estimated Effort: **1 day**

---

## 7. Tool Calling in Sampling 🟢 MEDIUM VALUE

### Spec Feature (SEP-1577)

Servers can request tool execution from clients during sampling.

### Implementation

**7.1 Extend Sampling Support**
```typescript
// packages/cortexdx/src/ml/orchestrator.ts

async function requestSamplingWithTools(
  messages: Message[],
  availableTools: Tool[]
): Promise<SamplingResult> {
  const response = await ctx.sampling.createMessage({
    messages,
    tools: availableTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    })),
    toolChoice: {
      type: "auto" // Let model decide when to call tools
    },
    maxTokens: 4096
  });

  return response;
}
```

**7.2 Advertise Sampling Capability**
```typescript
// server.ts - initialize response
capabilities: {
  tools: { taskRequests: true },
  resources: { list: true, read: true, taskRequests: true },
  sampling: {
    toolCalling: true
  }
}
```

### Estimated Effort: **6 hours**

---

## 8. Security Best Practices Review 🟢 MEDIUM VALUE

### Actions

1. Review updated security guidance at:
   https://modelcontextprotocol.io/specification/draft/basic/security_best_practices

2. Audit current implementation against new recommendations

3. Update security documentation

### Checklist

- [ ] Task ID generation uses crypto.randomUUID() ✅ (already planned)
- [ ] Rate limiting on task creation ⚠️ (needs implementation)
- [ ] Resource quotas per user ⚠️ (needs implementation)
- [ ] Validate Origin headers on HTTP transport ⚠️ (check)
- [ ] Input validation on all tool calls ✅ (being enhanced)
- [ ] Secure credential storage ✅ (already implemented)

### Estimated Effort: **4 hours**

---

## 9. URL Mode Elicitation 🟢 OPTIONAL

### Spec Feature (SEP-1036)

Servers can request user input via URL navigation.

### Assessment

Not critical for your use case. Consider implementing in future release.

### Estimated Effort: **Not planned**

---

## Implementation Timeline

### Week 1 (Nov 17-20) - Core Features

**Monday (Day 1):**
- ✅ Morning: SDK version check, tool naming audit
- 🔴 Afternoon: Tasks API - Storage layer implementation
- 🔴 Evening: Tasks API - Executor implementation

**Tuesday (Day 2):**
- 🔴 Morning: Tasks API - Server integration
- 🔴 Afternoon: Tasks API - Endpoint handlers
- 🟡 Evening: Enhanced error handling implementation

**Wednesday (Day 3):**
- 🔴 Morning: Tasks API testing
- 🔴 Afternoon: Protocol version update + testing
- 🟡 Evening: Icons metadata planning

**Thursday (Day 4):**
- 🔴 Morning: Tasks CLI integration
- 🟡 Afternoon: Icons asset creation
- 🟡 Evening: Icons implementation for tools

### Week 2 (Nov 21-24) - Polish & Testing

**Friday (Day 5):**
- 🟡 Morning: Icons implementation for resources
- 🟢 Afternoon: Authorization enhancements
- 🟢 Evening: Sampling with tools

**Saturday (Day 6):**
- 🟢 Morning: Security review
- 🟢 Afternoon: Documentation updates
- Testing: Integration tests

**Sunday (Day 7):**
- Testing: End-to-end scenarios
- Testing: Performance validation
- Documentation: Migration guide

**Monday Nov 24 (Day 8):**
- Final testing
- Code review
- Prepare for release

### Tuesday Nov 25: **SPEC RELEASE DAY** 🎉
- Update protocol version from "draft" to official version
- Deploy to production
- Announce compliance

---

## Success Criteria

✅ **Must Have (Release Blocking):**
1. Tasks API fully functional
2. Protocol version updated to draft/official
3. All tests passing
4. Enhanced error handling implemented

✅ **Should Have (High Value):**
5. Icons for all tools and resources
6. Authorization enhancements
7. Documentation complete

✅ **Nice to Have:**
8. Tool calling in sampling
9. Security audit complete

---

## Risk Mitigation

### Risk: SDK doesn't support draft features

**Mitigation:**
- v1.22.0 released Nov 13 includes many draft features
- Monitor SDK releases daily
- Prepare to upgrade if newer version releases

### Risk: Spec changes between now and Nov 25

**Mitigation:**
- Monitor GitHub spec repo daily
- Subscribe to notifications
- Keep implementation flexible

### Risk: Timeline too aggressive

**Mitigation:**
- Prioritize Tasks API (highest value)
- Icons can be added post-release
- Some features marked as "future enhancements"

---

## Post-Release (Week of Nov 26)

1. Monitor client compatibility
2. Gather feedback from users
3. Performance optimization
4. Consider implementing optional features:
   - URL elicitation
   - Resource subscriptions
   - Advanced pagination

---

## Resources

- Spec changelog: https://modelcontextprotocol.io/specification/draft/changelog
- Tasks API docs: https://modelcontextprotocol.io/specification/draft/basic/utilities/tasks
- SDK releases: https://github.com/modelcontextprotocol/typescript-sdk/releases
- Your migration tracker: `docs/MCP_SPEC_MIGRATION.md`

---

**Document Version:** 1.0
**Created:** November 17, 2025
**Owner:** CortexDx Development Team
**Next Review:** November 25, 2025 (after spec release)
