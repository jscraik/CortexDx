import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpStreamableTransport } from './http-streamable';
import { MCP_HEADERS, type RequestHandler } from './types';

const decoder = new TextDecoder();

const getAvailablePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        resolve(address.port);
      } else {
        reject(new Error('Failed to resolve port'));
      }
      server.close();
    });
    server.on('error', reject);
  });

describe('HttpStreamableTransport', () => {
  let transport: HttpStreamableTransport | null = null;

  afterEach(async () => {
    if (transport?.isRunning()) {
      await transport.stop();
    }
    transport = null;
  });

  it('handles JSON POST requests with configured CORS and protocol headers', async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({
      port,
      cors: { allowedOrigins: ['http://allowed.test'] },
    });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://allowed.test',
        [MCP_HEADERS.SESSION_ID]: 'session-post',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'ping' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://allowed.test');
    expect(response.headers.get(MCP_HEADERS.SESSION_ID.toLowerCase())).toBe('session-post');
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: '1',
      result: { ok: true },
    });
  });

  it('responds to OPTIONS preflight with merged CORS defaults', async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toContain('Mcp-Session-Id');
    expect(response.headers.get('access-control-max-age')).toBe('86400');
  });

  it('streams handler emissions over SSE and reflects session headers', async () => {
    const port = await getAvailablePort();
    const emitter = new EventEmitter();
    const handler: RequestHandler = Object.assign(
      async (request) => ({
        jsonrpc: '2.0',
        id: request.id ?? null,
        result: { ok: true },
      }),
      { events: emitter }
    );

    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/sse`, {
      headers: {
        accept: 'text/event-stream',
        [MCP_HEADERS.SESSION_ID]: 'sse-session',
      },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get(MCP_HEADERS.SESSION_ID.toLowerCase())).toBe('sse-session');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    emitter.emit('message', { jsonrpc: '2.0', id: null, result: 'stream' });

    let payload = '';
    for (let i = 0; i < 3; i++) {
      const { done, value } = await reader!.read();
      if (done) break;
      payload += decoder.decode(value);
      if (payload.includes('data:')) break;
    }

    expect(payload).toMatch(/data: .*"stream"/);
    try {
      controller.abort();
      await reader?.cancel();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        // Log unexpected errors during cleanup for better diagnostics
        console.error('Unexpected error during reader.cancel():', error);
        throw error;
      }
    }
  });

  it('returns 501 when SSE is requested but handler cannot emit events', async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/sse`, {
      headers: { accept: 'text/event-stream' },
    });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ error: 'SSE not supported for this handler' });
  });
});
