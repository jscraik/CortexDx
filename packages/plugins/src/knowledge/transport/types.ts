import type { KnowledgeRequest } from "@brainwav/cortexdx-core";

export enum TransportType {
    HTTP = "http",           // Standard request/response
    SSE = "sse",            // Server-Sent Events (streaming)
    WEBSOCKET = "websocket" // Bi-directional streaming
}

export interface ServerCapabilities {
    http: boolean;
    sse: boolean;
    websocket: boolean;
    http2: boolean;
    http3: boolean;
}

export interface TransportSelector {
    /**
     * Select optimal transport for a fetch request
     * @param request - Knowledge fetch request
     * @param capabilities - Server transport capabilities
     * @returns Selected transport type
     */
    selectTransport(
        request: KnowledgeRequest,
        capabilities: ServerCapabilities
    ): TransportType;

    /**
     * Detect server transport capabilities
     * @param endpoint - Server endpoint
     * @returns Available transports
     */
    detectCapabilities(endpoint: string): Promise<ServerCapabilities>;
}

export interface FetchInput {
    section: string;
    version: string;
    url: string;
    etag?: string;
    lastModified?: string;
}

export interface FetchResult {
    content?: string;
    metadata?: {
        url: string;
        fetchedAt: number;
        etag?: string;
        lastModified?: string;
    };
    notModified?: boolean;
}

export interface TransportAdapter {
    fetch(input: FetchInput): Promise<FetchResult>;
}
