/**
 * HTTP Streamable Transport
 * Implements MCP over HTTP with streaming support
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLogger } from '../../logging/logger';
import { DEFAULT_PROTOCOL_VERSION } from '../core/protocol';
import { MCP_ERRORS, formatJsonRpcError, McpError } from '../core/errors';
import type {
  Transport,
  RequestHandler,
  TransportEvents,
  HttpStreamableConfig,
  CorsConfig,
} from './types';
import { DEFAULT_CORS_CONFIG } from './types';

const logger = createLogger({ component: 'http-streamable-transport' });

export class HttpStreamableTransport implements Transport {
  readonly type = 'httpStreamable' as const;

  private server: Server | null = null;
  private protocolVersion = DEFAULT_PROTOCOL_VERSION;
  private running = false;
  private events: TransportEvents = {};
  private readonly endpoint: string;
  private readonly stateless: boolean;

  constructor(private config: HttpStreamableConfig) {
    this.endpoint = normalizeEndpoint(config.endpoint ?? '/mcp');
    this.stateless = config.stateless ?? false;
  }

  async start(handler: RequestHandler): Promise<void> {
    const { port, host = '127.0.0.1', cors, strictOriginCheck = true } = this.config;
    const corsConfig = cors ?? DEFAULT_CORS_CONFIG;

    this.server = createServer(async (req, res) =>
      this.handleRequest(req, res, handler, corsConfig, strictOriginCheck)
    );

    return new Promise((resolve, reject) => {
      this.server!.listen(port, host, () => {
        this.running = true;
        logger.info({ port, host }, 'HTTP Streamable transport started');
        resolve();
      });

      this.server!.on('error', (error) => {
        this.events.onError?.(error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.running = false;
          logger.info('HTTP Streamable transport stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  setProtocolVersion(version: string): void {
    this.protocolVersion = version as typeof this.protocolVersion;
  }

  getProtocolVersion(): string {
    return this.protocolVersion;
  }

  setEvents(events: TransportEvents): void {
    this.events = events;
  }

  isRunning(): boolean {
    return this.running;
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    handler: RequestHandler,
    corsConfig: CorsConfig,
    strictOriginCheck: boolean
  ): Promise<void> {
    if (this.getRequestPath(req) !== this.endpoint) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    if (!this.applyCors(req, res, corsConfig, strictOriginCheck)) {
      return;
    }

    res.setHeader('MCP-Protocol-Version', this.protocolVersion);
    res.setHeader('MCP-Stateless', this.stateless ? 'true' : 'false');
    if (this.stateless) {
      res.setHeader('MCP-Stateless-Note', 'Stateless mode enabled; session headers are ignored.');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    await this.handleJsonRpcRequest(req, res, handler);
  }

  private getRequestPath(req: IncomingMessage): string {
    const url = req.url ? new URL(req.url, 'http://localhost') : null;
    return normalizeEndpoint(url?.pathname ?? '/');
  }

  private applyCors(
    req: IncomingMessage,
    res: ServerResponse,
    corsConfig: CorsConfig,
    strictOriginCheck: boolean
  ): boolean {
    const origin = req.headers.origin?.toLowerCase();
    if (origin) {
      const isAllowed = corsConfig.allowedOrigins.some(
        (allowed) => origin === allowed.toLowerCase()
      );

      if (!isAllowed && strictOriginCheck) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: Invalid origin' }));
        return false;
      }

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }

    res.setHeader('Access-Control-Allow-Methods', corsConfig.allowedMethods?.join(', ') || 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders?.join(', ') || 'Content-Type');

    return true;
  }

  private async handleJsonRpcRequest(
    req: IncomingMessage,
    res: ServerResponse,
    handler: RequestHandler
  ): Promise<void> {
    try {
      const request = JSON.parse(await this.readRequestBody(req));

      if (Array.isArray(request)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            formatJsonRpcError(
              null,
              new McpError(
                MCP_ERRORS.PROTOCOL_VERSION_MISMATCH,
                'JSON-RPC batching is not supported'
              )
            )
          )
        );
        return;
      }

      const response = await handler(request);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      logger.error({ error }, 'Request handling error');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          formatJsonRpcError(
            null,
            error instanceof Error ? error : new Error(String(error))
          )
        )
      );
    }
  }

  private async readRequestBody(req: IncomingMessage): Promise<string> {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    return body;
  }
}

/**
 * Create HTTP Streamable transport
 */
export function createHttpStreamableTransport(config: HttpStreamableConfig): Transport {
  return new HttpStreamableTransport(config);
}

function normalizeEndpoint(endpoint: string): string {
  if (!endpoint.startsWith('/')) {
    return `/${endpoint}`;
  }

  if (endpoint.length > 1 && endpoint.endsWith('/')) {
    return endpoint.slice(0, -1);
  }

  return endpoint;
}
