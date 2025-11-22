import { createParser } from "eventsource-parser";
import { WebSocket } from "ws";
import type { FetchInput, FetchResult, TransportAdapter } from "./types.js";

export class HttpTransportAdapter implements TransportAdapter {
    constructor(private baseUrl: string, private timeoutMs = 10_000) { }

    async fetch(input: FetchInput): Promise<FetchResult> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const headers: Record<string, string> = {
                "user-agent": "CortexDx-knowledge/1.0",
                "accept": "application/json, text/plain, */*"
            };
            if (input.etag) headers["If-None-Match"] = input.etag;
            if (input.lastModified) headers["If-Modified-Since"] = input.lastModified;

            const url = this.buildRequestUrl(input.url);
            const response = await fetch(url, {
                headers,
                signal: controller.signal,
            });

            if (response.status === 304) {
                return {
                    notModified: true,
                    metadata: {
                        url,
                        fetchedAt: Date.now(),
                        etag: input.etag,
                        lastModified: input.lastModified,
                    },
                };
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const body = await response.text();
            return {
                content: body,
                metadata: {
                    url,
                    fetchedAt: Date.now(),
                    etag: response.headers.get("etag") ?? undefined,
                    lastModified: response.headers.get("last-modified") ?? undefined,
                },
            };
        } finally {
            clearTimeout(timer);
        }
    }

    private buildRequestUrl(pathOnly: string): string {
        const trimmedBase = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
        return `${trimmedBase}${pathOnly}`;
    }
}

export class SseTransportAdapter implements TransportAdapter {
    constructor(private baseUrl: string, private timeoutMs = 10_000) { }

    async fetch(input: FetchInput): Promise<FetchResult> {
        // SSE is typically for streaming, but here we adapt it for a "fetch" operation
        // by connecting, waiting for the initial state/snapshot, and then disconnecting.
        // This assumes the server sends a "snapshot" or "content" event immediately.

        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timer = setTimeout(() => {
                controller.abort();
                reject(new Error("SSE timeout"));
            }, this.timeoutMs);

            const url = this.buildRequestUrl(input.url);

            fetch(url, {
                headers: {
                    "Accept": "text/event-stream",
                    "Cache-Control": "no-cache"
                },
                signal: controller.signal
            }).then(async (response) => {
                if (!response.ok) {
                    throw new Error(`SSE HTTP error ${response.status}`);
                }
                if (!response.body) {
                    throw new Error("No response body");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                const parser = createParser((event) => {
                    if (event.type === "event") {
                        // We assume the first event or a specific event type contains the content
                        // For now, let's take the first data payload
                        if (event.data) {
                            clearTimeout(timer);
                            controller.abort(); // Close connection
                            resolve({
                                content: event.data,
                                metadata: {
                                    url,
                                    fetchedAt: Date.now(),
                                    // SSE doesn't standardly provide ETag/Last-Modified for the stream itself easily
                                }
                            });
                        }
                    }
                });

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        parser.feed(decoder.decode(value));
                    }
                } catch (e: any) {
                    if (e.name !== 'AbortError') {
                        reject(e);
                    }
                }
            }).catch(reject);
        });
    }

    private buildRequestUrl(pathOnly: string): string {
        const trimmedBase = this.baseUrl.endsWith("/") ? this.baseUrl.slice(0, -1) : this.baseUrl;
        return `${trimmedBase}${pathOnly}`;
    }
}

export class WebSocketTransportAdapter implements TransportAdapter {
    constructor(private baseUrl: string, private timeoutMs = 10_000) { }

    async fetch(input: FetchInput): Promise<FetchResult> {
        return new Promise((resolve, reject) => {
            const wsUrl = this.buildWsUrl(input.url);
            const ws = new WebSocket(wsUrl);

            const timer = setTimeout(() => {
                ws.close();
                reject(new Error("WebSocket timeout"));
            }, this.timeoutMs);

            ws.on('open', () => {
                // Send a request message
                ws.send(JSON.stringify({
                    type: "fetch",
                    section: input.section,
                    version: input.version
                }));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    // Assume response format { type: 'content', data: ... }
                    if (message.type === 'content' || message.data) {
                        clearTimeout(timer);
                        ws.close();
                        resolve({
                            content: typeof message.data === 'string' ? message.data : JSON.stringify(message.data),
                            metadata: {
                                url: wsUrl,
                                fetchedAt: Date.now()
                            }
                        });
                    }
                } catch (e) {
                    // Ignore malformed messages or wait for next
                }
            });

            ws.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    private buildWsUrl(pathOnly: string): string {
        let base = this.baseUrl;
        if (base.startsWith("http")) {
            base = base.replace(/^http/, "ws");
        }
        const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
        return `${trimmedBase}${pathOnly}`;
    }
}
