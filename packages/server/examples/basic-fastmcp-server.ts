/**
 * Basic FastMCP-aligned Server Example
 * Demonstrates using FastMCP features with plugin support
 */

import { z } from 'zod';
import { McpServer } from '../src/mcp-server/index.js';
import type { AuthSession } from '../src/mcp-server/index.js';

// Create server with FastMCP options
const server = new McpServer({
  name: 'Example FastMCP Server',
  version: '1.0.0',

  // FastMCP native options
  instructions: `
    Example MCP server demonstrating FastMCP alignment.

    Available tools:
    - hello: Simple greeting tool
    - stream_data: Demonstrates streaming output
    - progress_task: Demonstrates progress reporting
  `,

  // Optional authentication
  authenticate: async (req: Request) => {
    const apiKey = req.headers.get('x-api-key');

    // Simple demo authentication
    if (!apiKey) {
      throw new Response('Missing API key', { status: 401 });
    }

    if (apiKey === 'demo-key') {
      return {
        userId: 'demo-user',
        role: 'admin',
      } as AuthSession;
    }

    if (apiKey === 'user-key') {
      return {
        userId: 'regular-user',
        role: 'user',
      } as AuthSession;
    }

    throw new Response('Invalid API key', { status: 401 });
  },

  // Transport configuration
  transport: {
    type: 'httpStreamable',
    httpStreamable: {
      port: 3000,
      endpoint: '/mcp',
      stateless: false, // Set to true for serverless
    },
  },
});

// Access FastMCP features directly
server.fastMCP.on('connect', (event) => {
  console.log('Client connected:', event.session?.id);
});

server.fastMCP.on('disconnect', (event) => {
  console.log('Client disconnected:', event.session?.id);
});

// Add a simple tool with outputSchema
server.addTool({
  name: 'hello',
  description: 'Simple greeting tool',
  parameters: z.object({
    name: z.string().describe('Name to greet'),
  }),
  outputSchema: {
    type: 'object',
    properties: {
      greeting: { type: 'string', description: 'Personalized greeting message' },
      timestamp: { type: 'string', format: 'date-time', description: 'ISO 8601 timestamp' },
    },
    required: ['greeting', 'timestamp'],
  },
  annotations: {
    readOnlyHint: true,
    title: 'Hello Greeting',
  },
  execute: async (args, ctx) => {
    ctx.log.info('Hello tool called', { name: args.name });
    return {
      greeting: `Hello, ${args.name}!`,
      timestamp: new Date().toISOString(),
    };
  },
});

// Add a tool with streaming
server.addTool({
  name: 'stream_data',
  description: 'Demonstrates streaming output',
  parameters: z.object({
    count: z.number().min(1).max(10).describe('Number of items to stream'),
  }),
  outputSchema: {
    type: 'object',
    properties: {
      streamed: { type: 'number', description: 'Number of items streamed' },
      items: {
        type: 'array',
        description: 'List of streamed item numbers',
        items: { type: 'integer' },
      },
    },
    required: ['streamed', 'items'],
  },
  annotations: {
    streamingHint: true,
    title: 'Stream Data',
  },
  execute: async (args, ctx) => {
    ctx.log.info('Streaming data', { count: args.count });
    const items: number[] = [];

    for (let i = 1; i <= args.count; i++) {
      items.push(i);
      await ctx.streamContent?.({
        type: 'text',
        text: `Item ${i} of ${args.count}`,
      });

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return { streamed: args.count, items };
  },
});

// Add a tool with progress reporting
server.addTool({
  name: 'progress_task',
  description: 'Demonstrates progress reporting',
  parameters: z.object({
    duration: z.number().min(1).max(30).describe('Task duration in seconds'),
  }),
  outputSchema: {
    type: 'object',
    properties: {
      completed: { type: 'boolean', description: 'Whether task completed successfully' },
      duration: { type: 'number', description: 'Actual duration in seconds' },
      steps: { type: 'integer', description: 'Number of steps completed' },
    },
    required: ['completed', 'duration', 'steps'],
  },
  annotations: {
    title: 'Progress Task',
    idempotentHint: true,
  },
  execute: async (args, ctx) => {
    ctx.log.info('Starting long-running task', { duration: args.duration });

    const steps = 10;
    const stepDuration = (args.duration * 1000) / steps;

    for (let i = 0; i <= steps; i++) {
      await ctx.reportProgress?.({
        progress: (i / steps) * 100,
        total: 100,
      });

      if (i < steps) {
        await new Promise((resolve) => setTimeout(resolve, stepDuration));
      }
    }

    ctx.log.info('Task completed');
    return { completed: true, duration: args.duration, steps };
  },
});

// Add an admin-only tool
server.addTool({
  name: 'admin_action',
  description: 'Admin-only action',
  parameters: z.object({
    action: z.string().describe('Action to execute'),
  }),
  outputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'The action that was executed' },
      status: { type: 'string', description: 'Execution status' },
      timestamp: { type: 'string', format: 'date-time', description: 'When the action was executed' },
    },
    required: ['action', 'status', 'timestamp'],
  },
  canAccess: (session) => {
    // Per-tool authorization
    return session?.role === 'admin';
  },
  execute: async (args, ctx) => {
    ctx.log.info('Admin action executed', { action: args.action });
    return {
      action: args.action,
      status: 'executed',
      timestamp: new Date().toISOString(),
    };
  },
});

// Start server
server.start().then(() => {
  console.log('Server started on http://localhost:3000/mcp');
  console.log('');
  console.log('Try these API keys:');
  console.log('  - demo-key (admin role)');
  console.log('  - user-key (user role)');
  console.log('');
  console.log('Example request:');
  console.log('  curl -X POST http://localhost:3000/mcp \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -H "x-api-key: demo-key" \\');
  console.log('    -d \'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hello","arguments":{"name":"World"}}}\'');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await server.stop();
  process.exit(0);
});
