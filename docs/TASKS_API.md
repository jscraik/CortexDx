# MCP Tasks API - Async Execution Guide

## Overview

The Tasks API (SEP-1686) is a new feature in the MCP draft specification that enables **asynchronous, long-running operations** with polling-based status tracking. This is particularly useful for operations that take several minutes to complete, such as comprehensive diagnostics.

## Key Concepts

### Task Lifecycle

Tasks follow a well-defined state machine:

```
working → completed/failed/cancelled
   ↓
input_required (optional)
```

- **working**: Initial state when task is accepted and executing
- **input_required**: Task needs additional input from requestor (not yet supported in CLI)
- **completed**: Task finished successfully; results are available
- **failed**: Task execution failed; error details available
- **cancelled**: Task was explicitly stopped by requestor

### Task Metadata

Each task has the following metadata:
- `taskId`: Unique cryptographically secure identifier (UUID)
- `status`: Current lifecycle state
- `statusMessage`: Optional human-readable status description
- `createdAt`: ISO 8601 timestamp of creation
- `ttl`: Time-to-live in milliseconds (how long task results are retained)
- `pollInterval`: Server's suggested polling interval in milliseconds

## CLI Usage

### Running Async Diagnostics

Use the `--async` flag to execute diagnostics as an asynchronous task:

```bash
# Basic async diagnostic
cortexdx diagnose https://your-mcp-server.com --async

# With custom TTL (10 minutes) and poll interval (10 seconds)
cortexdx diagnose https://your-mcp-server.com \
  --async \
  --task-ttl 600000 \
  --poll-interval 10000

# Full diagnostic suite with async
cortexdx diagnose https://your-mcp-server.com \
  --full \
  --async \
  --task-ttl 900000
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--async` | Enable async task execution with polling | `false` |
| `--task-ttl <ms>` | Task time-to-live in milliseconds | `300000` (5 min) |
| `--poll-interval <ms>` | Initial polling interval (server may override) | `5000` (5 sec) |
| `--no-color` | Disable colored output | `false` |

### What Happens During Async Execution

1. **Task Creation**: CLI sends a `tools/call` request with `task` parameter
2. **Immediate Response**: Server returns task metadata immediately
3. **Background Execution**: Server executes diagnostic in background
4. **Polling Loop**: CLI polls task status at specified intervals
5. **Status Updates**: CLI displays status changes as they occur
6. **Result Retrieval**: When completed, CLI fetches and displays results
7. **Report Generation**: CLI generates same reports as synchronous mode

### Example Output

```
🚀 Creating async diagnostic task...
   Endpoint: https://your-mcp-server.com
   TTL: 5.0m
   Poll interval: 5.0s

✓ Task created: 550e8400-e29b-41d4-a716-446655440000
  Status: working
  Server suggests polling every 5.0s

⏳ Waiting for task completion...
   [12.5s] Status: working - Running security suite
   [28.3s] Status: working - Running performance suite
   [45.1s] Status: completed

✓ Task completed successfully
  Total time: 45.1s
  Polls: 9

📥 Retrieving results...

✅ Async diagnostic complete
   Reports written to: reports
```

## Programmatic Usage

### Creating Tasks via JSON-RPC

Any MCP method that supports task augmentation can be executed asynchronously by including a `task` parameter:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "diagnose_mcp_server",
    "arguments": {
      "endpoint": "https://your-mcp-server.com",
      "full": true
    },
    "task": {
      "ttl": 300000
    }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "task": {
      "taskId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "working",
      "createdAt": "2025-11-17T21:00:00.000Z",
      "ttl": 300000,
      "pollInterval": 5000
    }
  }
}
```

### Polling Task Status

Use `tasks/get` to check task status:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "task": {
      "taskId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "createdAt": "2025-11-17T21:00:00.000Z",
      "ttl": 300000,
      "pollInterval": 5000
    }
  }
}
```

### Retrieving Task Results

When status is `completed`, use `tasks/result` to get the result:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tasks/result",
  "params": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Response includes the original tool result:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"findings\": [...], \"summary\": {...}}"
    }]
  }
}
```

### Cancelling Tasks

Cancel a running task with `tasks/cancel`:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/cancel",
  "params": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Listing Tasks

Get all active tasks with `tasks/list`:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/list",
  "params": {
    "limit": 50,
    "cursor": "optional-cursor-for-pagination"
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "tasks": [
      {
        "taskId": "550e8400-e29b-41d4-a716-446655440000",
        "status": "working",
        "statusMessage": "Running diagnostics",
        "createdAt": "2025-11-17T21:00:00.000Z",
        "ttl": 300000,
        "pollInterval": 5000
      }
    ],
    "nextCursor": "optional-cursor-for-next-page"
  }
}
```

## Server Implementation Details

### Task Storage

Tasks are persisted in SQLite with the following features:
- **Cryptographically secure IDs**: Using `crypto.randomUUID()`
- **Automatic expiration**: Tasks are pruned after TTL expires
- **Cursor-based pagination**: Efficient listing of large task sets
- **User-based access control**: Tasks can be scoped to specific users

### Task Executor

Background task execution is handled by the `TaskExecutor` class:
- Executes tasks asynchronously without blocking the main thread
- Supports multiple task types: `tools/call`, `sampling/createMessage` (future), `elicitation/create` (future)
- Automatic error handling and result storage
- Status updates throughout execution

### Supported Tools

Currently, the following tools support task augmentation:
- `diagnose_mcp_server`: Run comprehensive diagnostics
- Future: `cortexdx_academic_research`, `cortexdx_deepcontext_index`, etc.

### Database Schema

```sql
CREATE TABLE tasks (
  taskId TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  params TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('working', 'input_required', 'completed', 'failed', 'cancelled')),
  statusMessage TEXT,
  createdAt TEXT NOT NULL,
  ttl INTEGER NOT NULL,
  pollInterval INTEGER NOT NULL,
  result TEXT,
  error TEXT,
  userId TEXT,
  expiresAt INTEGER NOT NULL
);
```

### Cleanup and Maintenance

Tasks are automatically cleaned up:
- **Expired tasks pruned every 5 minutes**: Removes tasks past their TTL
- **No manual cleanup required**: All handled by server
- **Configurable database location**: Via `CORTEXDX_TASKS_DB` environment variable

## Best Practices

### When to Use Async Mode

Use async mode for:
- **Long-running diagnostics** (> 30 seconds)
- **Full diagnostic suites** with multiple test categories
- **CI/CD pipelines** where you want to start a task and poll later
- **Interactive applications** that need to remain responsive

Use synchronous mode for:
- **Quick diagnostics** (< 10 seconds)
- **Single test suites**
- **Interactive debugging sessions**

### Polling Strategies

- **Respect server's suggested poll interval**: Don't poll more frequently than `pollInterval`
- **Implement exponential backoff**: For very long tasks, increase interval over time
- **Set reasonable TTLs**: Don't create tasks with excessive TTLs that waste resources
- **Handle terminal states**: Stop polling when task reaches completed/failed/cancelled

### Error Handling

Always handle these scenarios:
- **Task not found**: Task may have expired before you retrieved it
- **Failed status**: Check error details in `tasks/result` response
- **Network errors**: Implement retry logic for polling
- **Timeout**: Set client-side timeout in addition to server TTL

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CORTEXDX_TASKS_DB` | Path to SQLite database for task storage | `.cortexdx/tasks.db` |

## Troubleshooting

### Task Not Found

If you get "Task not found or expired":
- Check if task TTL has passed
- Verify you're using the correct `taskId`
- Ensure you have access (if user-scoped tasks are enabled)

### Task Stuck in "working" State

- Check server logs for errors during execution
- Verify server has sufficient resources
- Consider cancelling and retrying with longer timeout

### High Polling Load

- Increase poll interval to reduce server load
- Use server's suggested `pollInterval` value
- Implement exponential backoff for long-running tasks

## Migration from Synchronous to Async

Existing code using synchronous diagnostics can be migrated gradually:

```typescript
// Before (synchronous)
const { findings } = await runPlugins({
  endpoint,
  headers,
  suites,
  full: true,
  deterministic: false,
  budgets: { timeMs: 5000, memMb: 96 }
});

// After (asynchronous)
const { executeDiagnoseAsync } = await import('./commands/async-task-utils.js');

const result = await executeDiagnoseAsync({
  endpoint,
  diagnosticArgs: { endpoint, suites, full: true },
  taskTtl: 300000,
  pollInterval: 5000,
  headers
});

const findings = JSON.parse(result.content[0].text).findings;
```

## Compliance

This implementation follows:
- **MCP Draft Specification** (releasing Nov 25, 2025)
- **SEP-1686**: Tasks API specification
- **SEP-1303**: Enhanced error handling (validation errors returned as tool results)

## See Also

- [MCP Specification - Tasks API](https://modelcontextprotocol.io/specification/draft/server/tasks)
- [MCP Draft Implementation Plan](./MCP_DRAFT_SPEC_IMPLEMENTATION_PLAN.md)
- [MCP Spec Review](./MCP_SPEC_REVIEW_2024-11-05.md)
- [Enhanced Error Handling](../packages/cortexdx/src/utils/validation.ts)
