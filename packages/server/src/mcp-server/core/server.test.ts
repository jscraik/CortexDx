import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { JsonRpcResponse } from "../transports/types";
import type { ServerPlugin } from "../plugins/types";
import { McpServer } from "./server";

vi.mock("../../logging/logger", () => ({
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

interface CapturedResource {
  uri: string;
  mimeType?: string;
  load: () => Promise<unknown>;
}

interface CapturedResourceTemplate {
  load: (args: Record<string, unknown>) => Promise<unknown>;
}

const registeredTools: CapturedTool[] = [];
const registeredResources: CapturedResource[] = [];
const registeredResourceTemplates: CapturedResourceTemplate[] = [];

const mockWebsocketStart = vi.fn().mockResolvedValue(undefined);
const mockWebsocketStop = vi.fn().mockResolvedValue(undefined);
const mockWebsocketSetEvents = vi.fn();
const mockWebsocketSetProtocolVersion = vi.fn();
const mockWebsocketIsRunning = vi.fn(() => true);

vi.mock('fastmcp', () => {
  class MockFastMCP {
    public tools = registeredTools;
    public start = vi.fn();
    public stop = vi.fn();
    public on = vi.fn();
    public server?: { handleRequest?: (req: any) => Promise<JsonRpcResponse> };

    public resources = registeredResources;

    public resourceTemplates = registeredResourceTemplates;

    addTool(tool: CapturedTool) {
      this.tools.push(tool);
    }

    addResource(resource: CapturedResource) {
      this.resources.push(resource);
    }

    addResourceTemplate(template: CapturedResourceTemplate) {
      this.resourceTemplates.push(template);
    }
  }

  return { FastMCP: MockFastMCP };
});

vi.mock('../transports/websocket', () => {
  const transport = {
    start: mockWebsocketStart,
    stop: mockWebsocketStop,
    setEvents: mockWebsocketSetEvents,
    setProtocolVersion: mockWebsocketSetProtocolVersion,
    isRunning: mockWebsocketIsRunning,
  };

  return {
    createWebSocketTransport: vi.fn(() => transport),
    WebSocketTransport: vi.fn(() => transport),
  };
});

const createServer = () =>
  new McpServer({
    name: "test-server",
    version: "1.0.0",
    transport: { type: "stdio" },
  });

afterEach(() => {
  registeredTools.length = 0;
  registeredResources.length = 0;
  registeredResourceTemplates.length = 0;
});

describe("McpServer addTool plugin hooks", () => {
  it("returns plugin pre-call responses as objects", async () => {
    const preResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: "request-id",
      result: { status: "intercepted" },
    };

    const plugin: ServerPlugin = {
      name: "precall-plugin",
      async onToolCall() {
        return preResponse;
      },
    };

    const server = createServer();
    server.use(plugin);

    server.addTool({
      name: "sample",
      description: "test tool",
      parameters: z.object({}),
      async execute() {
        return { status: "should-not-run" };
      },
    });

    const tool = (server as unknown as { mcp: { tools: CapturedTool[] } }).mcp
      .tools[0];
    const result = await tool.execute({}, {});

    expect(result).toEqual(preResponse);
  });

  it("returns plugin error responses as objects", async () => {
    const errorResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: "error-id",
      error: { code: 500, message: "hook error" },
    };

    const plugin: ServerPlugin = {
      name: "error-plugin",
      async onError() {
        return errorResponse;
      },
    };

    const server = createServer();
    server.use(plugin);

    server.addTool({
      name: "failing-tool",
      description: "fails intentionally",
      parameters: z.object({}),
      async execute() {
        throw new Error("boom");
      },
    });

    const tool = (server as unknown as { mcp: { tools: CapturedTool[] } }).mcp
      .tools[0];
    const result = await tool.execute({}, {});

    expect(result).toEqual(errorResponse);
  });

  it('returns blob content and mime type from resource loaders', async () => {
    const binaryContent = new Uint8Array([1, 2, 3, 4]);

    const server = createServer();

    server.addResource({
      uri: 'file://binary',
      mimeType: 'application/octet-stream',
      async load() {
        return { blob: binaryContent };
      },
    });

    const resource = (
      server as unknown as {
        mcp: { resources: Array<{ load: () => Promise<unknown> }> };
      }
    ).mcp.resources[0];

    const result = await resource.load();

    expect(result).toEqual({
      uri: 'file://binary',
      mimeType: 'application/octet-stream',
      blob: Buffer.from(binaryContent).toString('base64'),
      text: undefined,
    });
  });
});
