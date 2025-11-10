import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse as parseUrl } from "node:url";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import type { ReportFormat, ReportManager } from "../storage/report-manager.js";

const gzipAsync = promisify(gzip);

export interface ReportServerOptions {
    port?: number;
    host?: string;
    enableCaching?: boolean;
    enableCompression?: boolean;
    cacheMaxAge?: number;
}

const DEFAULT_OPTIONS: Required<ReportServerOptions> = {
    port: 5001,
    host: "localhost",
    enableCaching: true,
    enableCompression: true,
    cacheMaxAge: 3600, // 1 hour
};

export class ReportServer {
    private server: ReturnType<typeof createServer> | null = null;
    private options: Required<ReportServerOptions>;
    private reportManager: ReportManager;
    private cache: Map<string, { content: string; compressed: Buffer; timestamp: number }> = new Map();

    constructor(reportManager: ReportManager, options?: ReportServerOptions) {
        this.reportManager = reportManager;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    async start(): Promise<void> {
        this.server = createServer((req, res) => {
            void this.handleRequest(req, res);
        });

        const server = this.server;
        if (!server) {
            throw new Error("Failed to initialize report server");
        }

        return new Promise((resolve, reject) => {
            server.listen(this.options.port, this.options.host, () => {
                console.log(`Report server listening on http://${this.options.host}:${this.options.port}`);
                resolve();
            });

            server.on("error", reject);
        });
    }

    async stop(): Promise<void> {
        if (!this.server) {
            return;
        }

        const server = this.server;

        return new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    this.server = null;
                    resolve();
                }
            });
        });
    }

    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            const url = parseUrl(req.url || "", true);
            const pathname = url.pathname || "/";

            // CORS headers
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Accept-Encoding");

            if (req.method === "OPTIONS") {
                res.writeHead(204);
                res.end();
                return;
            }

            if (req.method !== "GET") {
                this.sendError(res, 405, "Method Not Allowed");
                return;
            }

            // Parse report ID from path: /reports/{reportId}
            const match = pathname.match(/^\/reports\/([a-f0-9-]+)$/);
            if (!match?.[1]) {
                this.sendError(res, 404, "Not Found");
                return;
            }

            const reportId = match[1];

            // Determine format from Accept header or query parameter
            const format = this.negotiateFormat(req, url.query.format as string | undefined);

            // Check cache
            const cacheKey = `${reportId}:${format}`;
            if (this.options.enableCaching) {
                const cached = this.cache.get(cacheKey);
                if (cached) {
                    const age = Date.now() - cached.timestamp;

                    if (age < this.options.cacheMaxAge * 1000) {
                        this.sendCachedResponse(res, cached, format, req);
                        return;
                    }
                    this.cache.delete(cacheKey);
                }
            }

            // Retrieve report
            const content = await this.reportManager.retrieveReport(reportId, format);

            // Cache the response
            if (this.options.enableCaching) {
                const compressed = await gzipAsync(Buffer.from(content, "utf-8"));
                this.cache.set(cacheKey, {
                    content,
                    compressed,
                    timestamp: Date.now(),
                });
            }

            // Send response
            await this.sendResponse(res, content, format, req);

        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes("not found")) {
                    this.sendError(res, 404, "Report not found");
                } else if (error.message.includes("format not available")) {
                    this.sendError(res, 406, "Format not available");
                } else {
                    console.error("Error handling request:", error);
                    this.sendError(res, 500, "Internal Server Error");
                }
            } else {
                this.sendError(res, 500, "Internal Server Error");
            }
        }
    }

    private negotiateFormat(req: IncomingMessage, queryFormat?: string): ReportFormat {
        // Query parameter takes precedence
        if (queryFormat) {
            const normalized = queryFormat.toLowerCase();
            if (normalized === "json" || normalized === "markdown" || normalized === "html") {
                return normalized;
            }
        }

        // Content negotiation via Accept header
        const accept = req.headers.accept || "";

        if (accept.includes("application/json")) {
            return "json";
        }
        if (accept.includes("text/html")) {
            return "html";
        }
        if (accept.includes("text/markdown")) {
            return "markdown";
        }

        // Default to JSON
        return "json";
    }

    private async sendResponse(
        res: ServerResponse,
        content: string,
        format: ReportFormat,
        req: IncomingMessage
    ): Promise<void> {
        const contentType = this.getContentType(format);

        res.setHeader("Content-Type", contentType);

        // Caching headers
        if (this.options.enableCaching) {
            res.setHeader("Cache-Control", `public, max-age=${this.options.cacheMaxAge}`);
            res.setHeader("ETag", this.generateETag(content));
        }

        // Compression
        const acceptEncoding = req.headers["accept-encoding"] || "";
        if (this.options.enableCompression && acceptEncoding.includes("gzip")) {
            const compressed = await gzipAsync(Buffer.from(content, "utf-8"));
            res.setHeader("Content-Encoding", "gzip");
            res.setHeader("Content-Length", compressed.length);
            res.writeHead(200);
            res.end(compressed);
        } else {
            res.setHeader("Content-Length", Buffer.byteLength(content, "utf-8"));
            res.writeHead(200);
            res.end(content, "utf-8");
        }
    }

    private sendCachedResponse(
        res: ServerResponse,
        cached: { content: string; compressed: Buffer; timestamp: number },
        format: ReportFormat,
        req: IncomingMessage
    ): void {
        const contentType = this.getContentType(format);

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", `public, max-age=${this.options.cacheMaxAge}`);
        res.setHeader("ETag", this.generateETag(cached.content));
        res.setHeader("X-Cache", "HIT");

        const acceptEncoding = req.headers["accept-encoding"] || "";
        if (this.options.enableCompression && acceptEncoding.includes("gzip")) {
            res.setHeader("Content-Encoding", "gzip");
            res.setHeader("Content-Length", cached.compressed.length);
            res.writeHead(200);
            res.end(cached.compressed);
        } else {
            res.setHeader("Content-Length", Buffer.byteLength(cached.content, "utf-8"));
            res.writeHead(200);
            res.end(cached.content, "utf-8");
        }
    }

    private sendError(res: ServerResponse, statusCode: number, message: string): void {
        const body = JSON.stringify({ error: message });
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Length", Buffer.byteLength(body, "utf-8"));
        res.writeHead(statusCode);
        res.end(body, "utf-8");
    }

    private getContentType(format: ReportFormat): string {
        switch (format) {
            case "json":
                return "application/json; charset=utf-8";
            case "markdown":
                return "text/markdown; charset=utf-8";
            case "html":
                return "text/html; charset=utf-8";
            default:
                return "text/plain; charset=utf-8";
        }
    }

    private generateETag(content: string): string {
        // Simple hash-based ETag
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `"${Math.abs(hash).toString(36)}"`;
    }

    clearCache(): void {
        this.cache.clear();
    }

    getCacheSize(): number {
        return this.cache.size;
    }
}
