/**
 * Async Task CLI Utilities
 * Helpers for creating and polling async tasks from the CLI
 */

import type { TaskMetadata, TaskStatus } from '../tasks/types.js';

/**
 * Sleep helper for polling intervals
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call MCP JSON-RPC method
 */
async function callMcpMethod(
  endpoint: string,
  method: string,
  params?: unknown,
  headers?: Record<string, string>
): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`JSON-RPC Error ${result.error.code}: ${result.error.message}`);
  }

  return result.result;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format task status with color
 */
function formatTaskStatus(status: TaskStatus, noColor: boolean = false): string {
  if (noColor) return status;

  const colors = {
    working: '\x1b[33m',      // Yellow
    input_required: '\x1b[36m', // Cyan
    completed: '\x1b[32m',    // Green
    failed: '\x1b[31m',       // Red
    cancelled: '\x1b[90m'     // Gray
  };

  const reset = '\x1b[0m';
  const color = colors[status] || '';

  return `${color}${status}${reset}`;
}

/**
 * Execute diagnostic as async task with polling
 */
export async function executeDiagnoseAsync(options: {
  endpoint: string;
  diagnosticArgs: {
    endpoint?: string;
    suites?: string[];
    full?: boolean;
  };
  taskTtl: number;
  pollInterval: number;
  headers?: Record<string, string>;
  noColor?: boolean;
}): Promise<any> {
  const { endpoint, diagnosticArgs, taskTtl, pollInterval, headers, noColor } = options;

  console.log('🚀 Creating async diagnostic task...');
  console.log(`   Endpoint: ${diagnosticArgs.endpoint || endpoint}`);
  console.log(`   TTL: ${formatDuration(taskTtl)}`);
  console.log(`   Poll interval: ${formatDuration(pollInterval)}`);
  console.log('');

  // Create task
  const createResponse = await callMcpMethod(
    endpoint,
    'tools/call',
    {
      name: 'diagnose_mcp_server',
      arguments: diagnosticArgs,
      task: { ttl: taskTtl }
    },
    headers
  );

  const taskMetadata: TaskMetadata = createResponse.task;
  const { taskId, status, pollInterval: serverPollInterval } = taskMetadata;

  console.log(`✓ Task created: ${taskId}`);
  console.log(`  Status: ${formatTaskStatus(status, noColor)}`);
  console.log(`  Server suggests polling every ${formatDuration(serverPollInterval)}`);
  console.log('');

  // Use server's suggested poll interval
  const actualPollInterval = serverPollInterval || pollInterval;

  const startTime = Date.now();
  let lastStatus = status;
  let pollCount = 0;

  console.log('⏳ Waiting for task completion...');

  // Calculate maximum polling attempts (Critical #3)
  // Allow up to 2x TTL to account for processing time
  const maxPolls = Math.ceil((taskTtl * 2) / actualPollInterval);
  const absoluteTimeout = startTime + (taskTtl * 2);

  // Poll for completion with timeout
  for (let i = 0; i < maxPolls; i++) {
    // Check absolute timeout (Critical #3)
    if (Date.now() > absoluteTimeout) {
      throw new Error(`Task timed out after ${formatDuration(Date.now() - startTime)} (exceeded ${formatDuration(taskTtl * 2)})`);
    }

    await sleep(actualPollInterval);
    pollCount++;

    const statusResponse = await callMcpMethod(
      endpoint,
      'tasks/get',
      { taskId },
      headers
    );

    const currentStatus: TaskStatus = statusResponse.task.status;
    const statusMessage = statusResponse.task.statusMessage;

    // Only log if status changed
    if (currentStatus !== lastStatus) {
      const elapsed = Date.now() - startTime;
      console.log(`   [${formatDuration(elapsed)}] Status: ${formatTaskStatus(currentStatus, noColor)}${statusMessage ? ` - ${statusMessage}` : ''}`);
      lastStatus = currentStatus;
    }

    // Check for terminal states
    if (['completed', 'failed', 'cancelled'].includes(currentStatus)) {
      console.log('');

      if (currentStatus === 'completed') {
        console.log('✓ Task completed successfully');
        console.log(`  Total time: ${formatDuration(Date.now() - startTime)}`);
        console.log(`  Polls: ${pollCount}`);
        console.log('');
        console.log('📥 Retrieving results...');

        // Get results
        const resultResponse = await callMcpMethod(
          endpoint,
          'tasks/result',
          { taskId },
          headers
        );

        return resultResponse;

      } else if (currentStatus === 'failed') {
        console.error(`✗ Task failed after ${formatDuration(Date.now() - startTime)}`);

        // Always throw after failed status (High #8)
        try {
          await callMcpMethod(endpoint, 'tasks/result', { taskId }, headers);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Task failed: ${error.message}`);
          }
          throw error;
        }
        // If callMcpMethod succeeds without error, still throw
        throw new Error('Task failed');

      } else if (currentStatus === 'cancelled') {
        throw new Error(`Task was cancelled after ${formatDuration(Date.now() - startTime)}`);
      }

      break;
    }

    // Check for input_required (not supported in CLI yet)
    if (currentStatus === 'input_required') {
      console.warn(`⚠️  Task requires input (not supported in CLI mode)`);
      console.warn(`   Try cancelling and running synchronously instead`);
      throw new Error('Task requires user input - not supported in CLI');
    }
  }

  // If we exhausted maxPolls, throw timeout error
  throw new Error(`Task timed out after ${formatDuration(Date.now() - startTime)} (max ${maxPolls} polls)`);
}

/**
 * Cancel an async task
 */
export async function cancelTask(
  endpoint: string,
  taskId: string,
  headers?: Record<string, string>
): Promise<void> {
  console.log(`🛑 Cancelling task ${taskId}...`);

  await callMcpMethod(
    endpoint,
    'tasks/cancel',
    { taskId },
    headers
  );

  console.log('✓ Task cancelled');
}

/**
 * List all tasks
 */
export async function listTasks(
  endpoint: string,
  limit: number = 50,
  headers?: Record<string, string>
): Promise<void> {
  const response = await callMcpMethod(
    endpoint,
    'tasks/list',
    { limit },
    headers
  );

  const tasks: TaskMetadata[] = response.tasks;

  if (tasks.length === 0) {
    console.log('No tasks found');
    return;
  }

  console.log(`Found ${tasks.length} task(s):\n`);

  for (const task of tasks) {
    const age = Date.now() - new Date(task.createdAt).getTime();
    console.log(`  ${task.taskId}`);
    console.log(`    Status: ${task.status}`);
    console.log(`    Created: ${formatDuration(age)} ago`);
    console.log(`    TTL: ${formatDuration(task.ttl)}`);
    if (task.statusMessage) {
      console.log(`    Message: ${task.statusMessage}`);
    }
    console.log('');
  }
}
