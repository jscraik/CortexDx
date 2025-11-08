import { randomUUID } from "node:crypto";
import { sseProbe } from "../adapters/sse.js";
import type {
  SseProbeOptions,
  SseResult,
  TransportExchange,
  TransportState,
  TransportTranscript,
} from "../types.js";

export interface SharedSessionState {
  sessionId?: string;
  initialize?: TransportExchange;
  initialized: boolean;
}

interface InspectorSessionOptions {
  preinitialized?: boolean;
  sharedState?: SharedSessionState;
}

interface InspectorSession {
  jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;
  sseProbe: (url: string, opts?: SseProbeOptions) => Promise<SseResult>;
  transport: TransportState;
}

interface HeadersMap {
  [key: string]: string;
}

export function createInspectorSession(
  endpoint: string,
  base?: HeadersMap,
  options?: InspectorSessionOptions,
): InspectorSession {
  const sessionHeaders: HeadersMap = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(base ?? {}),
  };
  const shared = options?.sharedState;
  const providedSessionId = shared?.sessionId;

  const transcript: TransportTranscript = {
    exchanges: [],
    sessionId: providedSessionId,
    initialize: shared?.initialize ? { ...shared.initialize } : undefined,
  };

  const transportState: TransportState = {
    transcript: () => ({
      sessionId: transcript.sessionId,
      initialize: transcript.initialize ? { ...transcript.initialize } : undefined,
      exchanges: transcript.exchanges.map((exchange) => ({ ...exchange })),
    }),
    headers: () => ({ ...sessionHeaders }),
  };

  if (providedSessionId) {
    transportState.sessionId = providedSessionId;
  }

  if (providedSessionId) {
    transportState.sessionId = providedSessionId;
  }

  let initialized = Boolean(options?.preinitialized && providedSessionId);
  let requestCounter = 1;

  const rpcCache = new Map<string, unknown>();
  const cacheableMethods = new Set(["tools/list"]);

  const ensureSession = async () => {
    if (initialized) return;
    const initRequest = {
      jsonrpc: "2.0",
      id: "__insula_init__",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "insula-mcp-inspector",
          version: "0.1.0",
        },
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify(initRequest),
    });

    const body = await safeJsonParse(response);
    const sessionId =
      response.headers.get("mcp-session-id") ||
      response.headers.get("Mcp-Session-Id") ||
      sessionHeaders["mcp-session-id"] ||
      randomUUID();

    sessionHeaders.accept = "application/json, text/event-stream";
    transcript.sessionId = sessionId;
    transportState.sessionId = sessionId;
    transcript.initialize = buildExchange("initialize", initRequest, body, response.status);
    if (shared) {
      shared.sessionId = sessionId;
      shared.initialize = transcript.initialize ? { ...transcript.initialize } : undefined;
      shared.initialized = true;
    }

    initialized = true;
  };

  const jsonrpc = async <T>(method: string, params?: unknown): Promise<T> => {
    await ensureSession();
    const cacheKey = cacheableMethods.has(method)
      ? JSON.stringify({ method, params })
      : undefined;
    if (cacheKey && rpcCache.has(cacheKey)) {
      return rpcCache.get(cacheKey) as T;
    }
    const payload = { jsonrpc: "2.0", id: requestCounter++, method, params };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify(payload),
    });
    const body = await safeJsonParse(response);
    transcript.exchanges.push(buildExchange(method, payload, body, response.status));
    if (body?.error) {
      const { code, message } = body.error;
      throw new Error(`JSON-RPC error ${code}: ${message}`);
    }
    const result = body?.result as T;
    if (cacheKey) rpcCache.set(cacheKey, result);
    return result;
  };

  const probeStream = async (url: string, opts?: SseProbeOptions): Promise<SseResult> => {
    await ensureSession();
    const authHeaders = Object.fromEntries(
      Object.entries(sessionHeaders).filter(([key]) => key.toLowerCase() !== "content-type"),
    );
    const sessionId = transcript.sessionId;
    const headers = {
      ...authHeaders,
      accept: "text/event-stream",
      ...(sessionId
        ? { "mcp-session-id": sessionId, "Mcp-Session-Id": sessionId }
        : {}),
      ...(opts?.headers ?? {}),
    };
    const mergedOptions: SseProbeOptions = { ...(opts ?? {}), headers };
    const candidates = [url];
    if (url.endsWith("/events")) {
      candidates.push(`${url.replace(/\/events$/, "")}/sse`);
    }

    let lastResult: SseResult | undefined;
    for (const candidate of candidates) {
      const primary = await sseProbe(candidate, mergedOptions);
      if (primary.ok) return primary;
      lastResult = primary;
      if (!sessionId) continue;
      const separator = candidate.includes("?") ? "&" : "?";
      const withQuery = `${candidate}${separator}mcp-session-id=${encodeURIComponent(sessionId)}`;
      const withSession = await sseProbe(withQuery, mergedOptions);
      if (withSession.ok) return withSession;
      lastResult = withSession;
    }
    return lastResult ?? { ok: false, reason: "probe failed", resolvedUrl: url };
  };

  return {
    jsonrpc,
    sseProbe: probeStream,
    transport: transportState,
  };
}

async function safeJsonParse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { error: { code: response.status, message: "Invalid JSON" } };
  }
}

function buildExchange(
  method: string,
  request: unknown,
  response: unknown,
  status?: number,
): TransportExchange {
  return {
    method,
    request,
    response,
    status,
    timestamp: new Date().toISOString(),
  };
}
