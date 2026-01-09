import { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpStreamableTransport } from './http-streamable';
import type { HttpStreamableConfig, JsonRpcRequest, JsonRpcResponse } from './types';

vi.mock('../../logging/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const activeTransports: HttpStreamableTransport[] = [];

afterEach(async () => {
  await Promise.all(activeTransports.map((transport) => transport.stop()));
  activeTransports.length = 0;
});

const startTransport = async (
  config: HttpStreamableConfig,
  handler: (request: JsonRpcRequest) => Promise<JsonRpcResponse>
) => {
  const transport = new HttpStreamableTransport(config);
  await transport.start(handler);
  activeTransports.push(transport);
  return transport;
};

const getUrl = (transport: HttpStreamableTransport, path: string) => {
  const server = (transport as unknown as { server: { address(): AddressInfo } | null }).server;
  if (!server) {
    throw new Error('Transport server not started');
  }

  const address = server.address();
  return `http://127.0.0.1:${address.port}${path}`;
};

describe('HttpStreamableTransport endpoint handling', () => {
  it('accepts requests on the configured endpoint', async () => {
    const handler = vi.fn(async (request: JsonRpcRequest) => ({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: 'ok',
    }));

    const transport = await startTransport({ port: 0, endpoint: '/custom' }, handler);

    const response = await fetch(getUrl(transport, '/custom'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'ping' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jsonrpc: '2.0', id: '1', result: 'ok' });
    expect(handler).toHaveBeenCalledOnce();
    expect(response.headers.get('mcp-stateless')).toBe('false');
  });

  it('rejects requests on non-matching endpoints', async () => {
    const handler = vi.fn(async (request: JsonRpcRequest) => ({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: 'ok',
    }));

    const transport = await startTransport({ port: 0, endpoint: '/expected' }, handler);

    const response = await fetch(getUrl(transport, '/other'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'ping' }),
    });

    expect(response.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it('only allows preflight on the configured endpoint', async () => {
    const handler = vi.fn(async (request: JsonRpcRequest) => ({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: 'ok',
    }));

    const transport = await startTransport({ port: 0, endpoint: '/mcp' }, handler);

    const matchingResponse = await fetch(getUrl(transport, '/mcp'), {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost' },
    });

    const nonMatchingResponse = await fetch(getUrl(transport, '/wrong'), {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost' },
    });

    expect(matchingResponse.status).toBe(200);
    expect(nonMatchingResponse.status).toBe(404);
  });
});

describe('HttpStreamableTransport stateless mode', () => {
  it('marks responses as stateless and processes requests without sessions', async () => {
    const handler = vi.fn(async (request: JsonRpcRequest) => ({
      jsonrpc: '2.0',
      id: request.id ?? null,
      result: 'ok',
    }));

    const transport = await startTransport({ port: 0, endpoint: '/mcp', stateless: true }, handler);

    const response = await fetch(getUrl(transport, '/mcp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'abc', method: 'ping' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jsonrpc: '2.0', id: 'abc', result: 'ok' });
    expect(handler).toHaveBeenCalledOnce();
    expect(response.headers.get('mcp-stateless')).toBe('true');
    expect(response.headers.get('mcp-stateless-note')).toContain('Stateless mode enabled');
  });
});
