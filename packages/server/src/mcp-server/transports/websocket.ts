/**
 * WebSocket Transport
 * Implements MCP over WebSocket for real-time communication
 */

import { WebSocketServer, type WebSocket } from 'ws';
import { createLogger } from '../../logging/logger.js';
import { DEFAULT_PROTOCOL_VERSION } from '../core/protocol.js';
import { formatJsonRpcError, McpError, MCP_ERRORS } from '../core/errors.js';
import type { Transport, RequestHandler, TransportEvents, WebSocketConfig } from './types.js';

const logger = createLogger({ component: 'websocket-transport' });

export class WebSocketTransport implements Transport {
  readonly type = 'websocket' as const;

  private wss: WebSocketServer | null = null;
  private protocolVersion = DEFAULT_PROTOCOL_VERSION;
  private running = false;
  private events: TransportEvents = {};
  private clients = new Map<string, WebSocket>();
  private clientCounter = 0;

  constructor(private config: WebSocketConfig) {}

  async start(handler: RequestHandler): Promise<void> {
    const { port, host = '127.0.0.1', path = '/mcp' } = this.config;

    this.wss = new WebSocketServer({ port, host, path });

    this.wss.on('connection', (ws) => {
      const clientId = `ws-${++this.clientCounter}`;
      this.clients.set(clientId, ws);
      this.events.onConnect?.(clientId);
      logger.debug({ clientId }, 'WebSocket client connected');

      ws.on('message', async (data) => {
        try {
          const request = JSON.parse(data.toString());

          // Validate not a batch
          if (Array.isArray(request)) {
            const errorResponse = formatJsonRpcError(
              null,
              new McpError(MCP_ERRORS.PROTOCOL_VERSION_MISMATCH, 'JSON-RPC batching is not supported')
            );
            ws.send(JSON.stringify(errorResponse));
            return;
          }

          const response = await handler(request);
          ws.send(JSON.stringify(response));
        } catch (error) {
          logger.error({ error, clientId }, 'WebSocket message error');
          const errorResponse = formatJsonRpcError(
            null,
            error instanceof Error ? error : new Error(String(error))
          );
          ws.send(JSON.stringify(errorResponse));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.events.onDisconnect?.(clientId);
        logger.debug({ clientId }, 'WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error({ error, clientId }, 'WebSocket client error');
        this.events.onError?.(error);
      });
    });

    this.wss.on('error', (error) => {
      this.events.onError?.(error);
    });

    this.running = true;
    logger.info({ port, host, path }, 'WebSocket transport started');
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all client connections
        for (const [clientId, ws] of this.clients) {
          ws.close();
          this.events.onDisconnect?.(clientId);
        }
        this.clients.clear();

        this.wss.close(() => {
          this.wss = null;
          this.running = false;
          logger.info('WebSocket transport stopped');
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

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const ws of this.clients.values()) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Send message to specific client
   */
  sendTo(clientId: string, message: unknown): boolean {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

/**
 * Create WebSocket transport
 */
export function createWebSocketTransport(config: WebSocketConfig): WebSocketTransport {
  return new WebSocketTransport(config);
}
