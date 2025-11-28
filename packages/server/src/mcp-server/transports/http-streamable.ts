/**
 * HTTP Streamable Transport
 * Implements MCP over HTTP with streaming support
 */

import type { EventEmitter } from "node:events";
import {
  type IncomingMessage,
  type Server,
  type ServerResponse,
  createServer,
} from "node:http";
import { createLogger } from "../../logging/logger.js";
import { MCP_ERRORS, McpError, formatJsonRpcError } from "../core/errors";
import { DEFAULT_PROTOCOL_VERSION } from "../core/protocol";
import { DEFAULT_CORS_CONFIG, MCP_HEADERS } from "./types";
import type {
  CorsConfig,
  HttpStreamableConfig,
  RequestHandler,
  Transport,
  TransportEvents,
} from "./types";

const logger = createLogger({ component: "http-streamable-transport" });

export class HttpStreamableTransport implements Transport {
  readonly type = "httpStreamable" as const;

  private server: Server | null = null;
  private protocolVersion = DEFAULT_PROTOCOL_VERSION;
  private running = false;
  private events: TransportEvents = {};

  constructor(private config: HttpStreamableConfig) {}

  async start(handler: RequestHandler): Promise<void> {
    const {
      port,
      host = "127.0.0.1",
      cors,
      strictOriginCheck = true,
    } = this.config;

    this.server = createServer(async (req, res) => {
      const corsConfig = this.mergeCorsConfig(cors);
      const origin = req.headers.origin?.toLowerCase();

      if (
        origin &&
        !this.isOriginAllowed(origin, corsConfig.allowedOrigins) &&
        strictOriginCheck
      ) {
        this.respondJson(res, 403, { error: "Forbidden: Invalid origin" });
        return;
      }

      this.setCorsHeaders(res, corsConfig, origin);
      res.setHeader(MCP_HEADERS.PROTOCOL_VERSION, this.protocolVersion);

      const sessionId = this.getSessionId(req);
      if (sessionId) {
        res.setHeader(MCP_HEADERS.SESSION_ID, sessionId);
      }

      const pathname = this.getPathname(req.url);

      if (req.method === "OPTIONS") {
        this.handleOptions(res);
        return;
      }

      if (this.isSsePath(pathname)) {
        await this.handleSse(req, res, handler);
        return;
      }

      if (req.method !== "POST") {
        this.respondJson(res, 405, { error: "Method not allowed" });
        return;
      }

      await this.handleJsonRpc(req, res, handler);
    });

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
        // Ensure there's a subdomain and the match is at a domain boundary
        return prefixLength > 0 && origin[prefixLength - 1] === ".";
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
}

/**
 * Create HTTP Streamable transport
 */
export function createHttpStreamableTransport(
  config: HttpStreamableConfig,
): Transport {
  return new HttpStreamableTransport(config);
}
