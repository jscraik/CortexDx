/**
 * HTTP Streamable Transport
 * Implements MCP over HTTP with streaming support
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createLogger } from '../../logging/logger';
import { DEFAULT_PROTOCOL_VERSION } from '../core/protocol';
import { MCP_ERRORS, formatJsonRpcError, McpError } from '../core/errors';
import {
  DEFAULT_CORS_CONFIG,
  type CorsConfig,
  type HttpStreamableConfig,
  type RequestHandler,
  type Transport,
  type TransportEvents,
} from './types';

const logger = createLogger({ component: 'http-streamable-transport' });

export class HttpStreamableTransport implements Transport {
  readonly type = 'httpStreamable' as const;

  private server: Server | null = null;
  private protocolVersion = DEFAULT_PROTOCOL_VERSION;
  private running = false;
  private events: TransportEvents = {};

  constructor(private config: HttpStreamableConfig) {}

  async start(handler: RequestHandler): Promise<void> {
    const { port, host = '127.0.0.1', cors, strictOriginCheck = true } = this.config;

    this.server = createServer(async (req, res) => {
      // Handle CORS
      const corsConfig = cors ?? DEFAULT_CORS_CONFIG;

      const origin = req.headers.origin?.toLowerCase();

      // Check origin (MCP spec 2025-06-18: return 403 for invalid origins)
      if (origin) {
        const isAllowed = corsConfig.allowedOrigins.some(
          (allowed) => origin === allowed.toLowerCase()
        );

        if (!isAllowed && strictOriginCheck) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden: Invalid origin' }));
          return;
        }

        if (isAllowed) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      }

      res.setHeader('Access-Control-Allow-Methods', corsConfig.allowedMethods?.join(', ') || 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders?.join(', ') || 'Content-Type');

      // Set protocol version header
      res.setHeader('MCP-Protocol-Version', this.protocolVersion);

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Only accept POST for JSON-RPC
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      // Parse body
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      try {
        const request = JSON.parse(body);

        // Validate not a batch (MCP spec 2025-06-18)
        if (Array.isArray(request)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(formatJsonRpcError(null, new McpError(
            MCP_ERRORS.PROTOCOL_VERSION_MISMATCH,
            'JSON-RPC batching is not supported'
          ))));
          return;
        }

        const response = await handler(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        logger.error({ error }, 'Request handling error');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatJsonRpcError(
          null,
          error instanceof Error ? error : new Error(String(error))
        )));
      }
    });

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
}

/**
 * Create HTTP Streamable transport
 */
export function createHttpStreamableTransport(config: HttpStreamableConfig): Transport {
  return new HttpStreamableTransport(config);
}
