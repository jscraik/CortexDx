/**
 * STDIO Transport
 * Implements MCP over standard input/output
 */

import * as readline from 'node:readline';
import { createLogger } from '../../logging/logger';
import { DEFAULT_PROTOCOL_VERSION } from '../core/protocol';
import { formatJsonRpcError, McpError, MCP_ERRORS } from '../core/errors';
import type { Transport, RequestHandler, TransportEvents } from './types';

const logger = createLogger({ component: 'stdio-transport' });

export class StdioTransport implements Transport {
  readonly type = 'stdio' as const;

  private rl: readline.Interface | null = null;
  private protocolVersion = DEFAULT_PROTOCOL_VERSION;
  private running = false;
  private events: TransportEvents = {};

  async start(handler: RequestHandler): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', async (line) => {
      if (!line.trim()) return;

      try {
        const request = JSON.parse(line);

        // Validate not a batch
        if (Array.isArray(request)) {
          const errorResponse = formatJsonRpcError(
            null,
            new McpError(MCP_ERRORS.PROTOCOL_VERSION_MISMATCH, 'JSON-RPC batching is not supported')
          );
          console.log(JSON.stringify(errorResponse));
          return;
        }

        const response = await handler(request);
        console.log(JSON.stringify(response));
      } catch (error) {
        logger.error({ error, line }, 'STDIO request error');
        const errorResponse = formatJsonRpcError(
          null,
          error instanceof Error ? error : new Error(String(error))
        );
        console.log(JSON.stringify(errorResponse));
      }
    });

    this.rl.on('close', () => {
      this.running = false;
      logger.info('STDIO transport closed');
    });

    this.rl.on('error', (error) => {
      this.events.onError?.(error);
    });

    this.running = true;
    logger.info('STDIO transport started');
  }

  async stop(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.running = false;
    logger.info('STDIO transport stopped');
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
 * Create STDIO transport
 */
export function createStdioTransport(): Transport {
  return new StdioTransport();
}
