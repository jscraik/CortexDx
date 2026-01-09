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
import { DEFAULT_CORS_CONFIG } from './types';

const logger = createLogger({ component: "http-streamable-transport" });

export class HttpStreamableTransport implements Transport {
  readonly type = "httpStreamable" as const;

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

    this.server = createServer(async (req, res) => {
      // Handle CORS
      const corsConfig = cors ?? DEFAULT_CORS_CONFIG;

    return new Promise((resolve, reject) => {
      this.server?.listen(port, host, () => {
        this.running = true;
        logger.info({ port, host }, "HTTP Streamable transport started");
        resolve();
      });

      this.server?.on("error", (error) => {
        this.events.onError?.(error);
        reject(error);
      });
    });
  }

  private mergeCorsConfig(cors?: Partial<CorsConfig>): CorsConfig {
    return {
      allowedOrigins:
        cors?.allowedOrigins ?? DEFAULT_CORS_CONFIG.allowedOrigins,
      allowedMethods:
        cors?.allowedMethods ?? DEFAULT_CORS_CONFIG.allowedMethods,
      allowedHeaders:
        cors?.allowedHeaders ?? DEFAULT_CORS_CONFIG.allowedHeaders,
      maxAge: cors?.maxAge ?? DEFAULT_CORS_CONFIG.maxAge,
    };
  }

  private isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    return allowedOrigins.some((allowed) => {
      if (allowed === "*") return true;
      const normalized = allowed.toLowerCase();
      if (normalized.startsWith("*.")) {
        const suffix = normalized.slice(1); // ".example.com"
        if (!origin.endsWith(suffix)) return false;
        const prefixLength = origin.length - suffix.length;
        // Ensure there's a subdomain before the suffix
        return prefixLength > 0;
      }
      return origin === normalized;
    });
  }

  private setCorsHeaders(
    res: ServerResponse,
    corsConfig: CorsConfig,
    origin?: string,
  ): void {
    if (corsConfig.allowedOrigins.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (
      origin &&
      this.isOriginAllowed(origin, corsConfig.allowedOrigins)
    ) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      corsConfig.allowedMethods?.join(", ") ?? "GET, POST, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      corsConfig.allowedHeaders?.join(", ") ?? "Content-Type",
    );
    if (corsConfig.maxAge !== undefined) {
      res.setHeader("Access-Control-Max-Age", corsConfig.maxAge.toString());
    }
  }

  private handleOptions(res: ServerResponse): void {
    res.writeHead(200);
    res.end();
  }

  private getPathname(url?: string | null): string {
    try {
      return url ? new URL(url, "http://localhost").pathname : "/";
    } catch (error) {
      logger.warn({ url, error }, "Failed to parse request URL");
      return "/";
    }
  }

  private isSsePath(pathname: string): boolean {
    // Only match exact SSE endpoints; avoids false positives from suffix matching.
    return pathname === "/sse" || pathname === "/events";
  }

  private getSessionId(req: IncomingMessage): string | undefined {
    const headerKey = MCP_HEADERS.SESSION_ID.toLowerCase();
    const sessionHeader = req.headers[headerKey];
    if (Array.isArray(sessionHeader)) {
      return sessionHeader[0];
    }
    return sessionHeader;
  }

  private async readBody(
    req: IncomingMessage,
    maxSize = 1024 * 1024,
  ): Promise<string> {
    let body = "";
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxSize) {
        throw new McpError(
          MCP_ERRORS.INVALID_REQUEST,
          `Request body too large (max ${maxSize} bytes)`,
        );
      }
      body += chunk;
    }
    return body;
  }

  private respondJson(
    res: ServerResponse,
    status: number,
    body: unknown,
  ): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  private hasEmitterMethods(candidate: unknown): candidate is EventEmitter {
    return (
      typeof (candidate as EventEmitter | undefined)?.on === "function" &&
      typeof (candidate as EventEmitter | undefined)?.off === "function"
    );
  }

  private async handleJsonRpc(
    req: IncomingMessage,
    res: ServerResponse,
    handler: RequestHandler,
  ): Promise<void> {
    try {
      const body = await this.readBody(req);
      const request = JSON.parse(body);
      if (Array.isArray(request)) {
        this.respondJson(
          res,
          400,
          formatJsonRpcError(
            null,
            new McpError(
              MCP_ERRORS.PROTOCOL_VERSION_MISMATCH,
              "JSON-RPC batching is not supported",
            ),
          ),
        );
        return;
      }
      const response = await handler(request);
      this.respondJson(res, 200, response);
    } catch (error) {
      logger.error({ error }, "Request handling error");
      this.respondJson(
        res,
        400,
        formatJsonRpcError(
          null,
          error instanceof Error ? error : new Error(String(error)),
        ),
      );
    }
  }

  private getHandlerEmitter(handler: RequestHandler): EventEmitter | null {
    const candidate = handler as unknown as EventEmitter;
    if (this.hasEmitterMethods(candidate)) {
      return candidate;
    }
    const nested = (handler as { events?: unknown }).events;
    return this.hasEmitterMethods(nested) ? (nested as EventEmitter) : null;
  }

  private async handleSse(
    req: IncomingMessage,
    res: ServerResponse,
    handler: RequestHandler,
  ): Promise<void> {
    const emitter = this.getHandlerEmitter(handler);
    if (!emitter) {
      this.respondJson(res, 501, {
        error: "SSE not supported for this handler",
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");

    const forwardMessage = (payload: unknown): void => {
      if (res.writableEnded) return;
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        logger.warn("SSE res.write() failed in forwardMessage", { error: err });
      }
    };
    const forwardError = (error: unknown): void => {
      if (res.writableEnded) return;
      try {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })}\n\n`,
        );
      } catch (err) {
        logger.warn("SSE res.write() failed in forwardError", { error: err });
      }
    };

    emitter.on("message", forwardMessage);
    emitter.on("error", forwardError);

    const close = (): void => {
      emitter.off("message", forwardMessage);
      emitter.off("error", forwardError);
      req.off("close", close);
      req.off("aborted", close);
      res.end();
    };

    req.on("close", close);
    req.on("aborted", close);
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.running = false;
          logger.info("HTTP Streamable transport stopped");
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
export function createHttpStreamableTransport(
  config: HttpStreamableConfig,
): Transport {
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
