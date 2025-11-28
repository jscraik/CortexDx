import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { JsonRpcResponse } from '../transports/types';
import type { ServerPlugin } from '../plugins/types';
import { McpServer } from './server';

vi.mock('../../logging/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

interface CapturedTool {
  execute: (args: unknown, ctx: unknown) => Promise<unknown>;
}

const registeredTools: CapturedTool[] = [];

vi.mock('fastmcp', () => {
  class MockFastMCP {
    public tools = registeredTools;

    addTool(tool: CapturedTool) {
      this.tools.push(tool);
    }
  }

  return { FastMCP: MockFastMCP };
});

const createServer = () =>
  new McpServer({
    name: 'test-server',
    version: '1.0.0',
    transport: { type: 'stdio' },
  });

afterEach(() => {
  registeredTools.length = 0;
});

describe('McpServer addTool plugin hooks', () => {
  it('returns plugin pre-call responses as objects', async () => {
    const preResponse: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 'request-id',
      result: { status: 'intercepted' },
    };

    const plugin: ServerPlugin = {
      name: 'precall-plugin',
      async onToolCall() {
        return preResponse;
      },
    };

    const server = createServer();
    server.use(plugin);

    server.addTool({
      name: 'sample',
      description: 'test tool',
      parameters: z.object({}),
      async execute() {
        return { status: 'should-not-run' };
      },
    });

    const tool = (server as unknown as { mcp: { tools: CapturedTool[] } }).mcp
      .tools[0];
    const result = await tool.execute({}, {});

    expect(result).toEqual(preResponse);
  });

  it('returns plugin error responses as objects', async () => {
    const errorResponse: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 'error-id',
      error: { code: 500, message: 'hook error' },
    };

    const plugin: ServerPlugin = {
      name: 'error-plugin',
      async onError() {
        return errorResponse;
      },
    };

    const server = createServer();
    server.use(plugin);

    server.addTool({
      name: 'failing-tool',
      description: 'fails intentionally',
      parameters: z.object({}),
      async execute() {
        throw new Error('boom');
      },
    });

    const tool = (server as unknown as { mcp: { tools: CapturedTool[] } }).mcp
      .tools[0];
    const result = await tool.execute({}, {});

    expect(result).toEqual(errorResponse);
  });

  it('produces deterministic request ids when deterministic mode is enabled', async () => {
    const capturedIds: string[] = [];

    const server = new McpServer({
      name: 'deterministic-server',
      version: '1.0.0',
      deterministic: true,
      deterministicSeed: 5,
      transport: { type: 'stdio' },
    });

    server.use({
      name: 'capture-plugin',
      async onToolCall(ctx) {
        capturedIds.push(ctx.request.id);
        return undefined;
      },
    });

    server.addTool({
      name: 'deterministic-tool',
      description: 'captures ids',
      parameters: z.object({}),
      async execute() {
        return { status: 'ok' };
      },
    });

    const tool = (server as unknown as { mcp: { tools: CapturedTool[] } }).mcp
      .tools[0];

    await tool.execute({}, {});
    await tool.execute({}, {});

    expect(capturedIds).toEqual(['det-6', 'det-7']);
  });

  it('generates unique request ids under concurrent execution', async () => {
    const ids = new Set<string>();

    const server = createServer();

    server.use({
      name: 'concurrent-capture',
      async onToolCall(ctx) {
        ids.add(ctx.request.id);
        return undefined;
      },
    });

    server.addTool({
      name: 'concurrent-tool',
      description: 'runs concurrently',
      parameters: z.object({}),
      async execute() {
        return { status: 'ok' };
      },
    });

    const tool = (server as unknown as { mcp: { tools: CapturedTool[] } }).mcp
      .tools[0];

    await Promise.all(Array.from({ length: 25 }, () => tool.execute({}, {})));

    expect(ids.size).toBe(25);
  });
});
