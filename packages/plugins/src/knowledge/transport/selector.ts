import type { KnowledgeRequest } from "@brainwav/cortexdx-core";
import { WebSocket } from "ws";
import { type ServerCapabilities, type TransportSelector, TransportType } from "./types.js";

export class DefaultTransportSelector implements TransportSelector {
    selectTransport(
        request: KnowledgeRequest,
        capabilities: ServerCapabilities
    ): TransportType {
        // 1. Static content (specs, docs) → HTTP
        if (this.isStaticContent(request.section)) {
            return TransportType.HTTP;
        }

        // 2. Real-time updates (changelog, live specs) → SSE
        if (this.requiresRealTimeUpdates(request.section) && capabilities.sse) {
            return TransportType.SSE;
        }

        // 3. Interactive queries (search, RAG) → WebSocket
        // Note: We'll assume 'search' or 'validation' actions imply interactivity
        // This logic might need refinement as KnowledgeRequest evolves
        if (this.isInteractiveQuery(request) && capabilities.websocket) {
            return TransportType.WEBSOCKET;
        }

        // 4. Default fallback → HTTP
        return TransportType.HTTP;
    }

    async detectCapabilities(endpoint: string): Promise<ServerCapabilities> {
        const capabilities: ServerCapabilities = {
            http: true,  // Always assume HTTP
            sse: false,
            websocket: false,
            http2: false,
            http3: false,
        };

        // 1. Check HTTP version via ALPN (simulated via HEAD request headers for now)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

            const response = await fetch(endpoint, {
                method: "HEAD",
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            // Note: Browser/Node fetch APIs often hide protocol details, 
            // but some servers might send custom headers or we might infer from response
            // For now, we'll check a custom header if present, or default to false
            // In a real Node environment with raw sockets we could check ALPN
            const protocol = response.headers.get("x-protocol-version");
            capabilities.http2 = protocol?.includes("h2") ?? false;
            capabilities.http3 = protocol?.includes("h3") ?? false;
        } catch (e) {
            // Ignore errors for capability detection
        }

        // 2. Check SSE support via Accept header
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(endpoint, {
                method: "HEAD", // Use HEAD to avoid downloading body
                headers: { Accept: "text/event-stream" },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            // Some servers might only indicate SSE support on GET, but let's try HEAD first
            // or check if they advertise it in headers
            capabilities.sse = response.headers.get("content-type")?.includes("text/event-stream") ?? false;
        } catch (e) {
            // Ignore
        }

        // 3. Check WebSocket via Upgrade header logic
        // Note: In a browser/Node environment, we can try to open a socket
        try {
            // Simple heuristic: replace http/https with ws/wss
            const wsUrl = endpoint.replace(/^http/, "ws");
            // We'll wrap this in a promise to timeout quickly
            await new Promise<void>((resolve, reject) => {
                const ws = new WebSocket(wsUrl);
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error("Timeout"));
                }, 1000);

                ws.onopen = () => {
                    capabilities.websocket = true;
                    clearTimeout(timeout);
                    ws.close();
                    resolve();
                };

                ws.onerror = (err) => {
                    clearTimeout(timeout);
                    // Don't reject, just fail to set capability
                    resolve();
                };
            });
        } catch (e) {
            // Ignore
        }

        return capabilities;
    }

    private isStaticContent(section: string): boolean {
        const staticSections = [
            "authentication",
            "handshake",
            "resources",
            "prompts",
            "tools",
            "sampling"
        ];
        return staticSections.includes(section.toLowerCase());
    }

    private requiresRealTimeUpdates(section: string): boolean {
        const realtimeSections = ["changelog", "notifications", "live-status"];
        return realtimeSections.includes(section.toLowerCase());
    }

    private isInteractiveQuery(request: KnowledgeRequest): boolean {
        // If the request explicitly asks for high priority or is a search (if we had that field)
        // For now, we'll use a heuristic on the section name or priority
        if (request.priority === "high") return true;

        const interactiveSections = ["search", "validation", "chat"];
        return interactiveSections.includes(request.section.toLowerCase());
    }
}
