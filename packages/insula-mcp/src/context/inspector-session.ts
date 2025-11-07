import { randomUUID } from "node:crypto";
import { sseProbe } from "../adapters/sse.js";
import type {
  SseProbeOptions,
  SseResult,
  TransportExchange,
  TransportState,
  TransportTranscript,
} from "../types.js";

interface InspectorSession {
  jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;
  sseProbe: (url: string, opts?: SseProbeOptions) => Promise<SseResult>;
  transport: TransportState;
}

interface HeadersMap {
  [key: string]: string;
}

export function createInspectorSession(endpoint: string, base?: HeadersMap): InspectorSession {
  const sessionHeaders: HeadersMap = {
    "content-type": "application/json",
    accept: "application/json",
    ...(base ?? {}),
  };

  const transcript: TransportTranscript = {
    exchanges: [],
  };

  const transportState: TransportState = {
    transcript: () => ({
      sessionId: transcript.sessionId,
      initialize: transcript.initialize ? { ...transcript.initialize } : undefined,
      exchanges: transcript.exchanges.map((exchange) => ({ ...exchange })),
    }),
    headers: () => ({ ...sessionHeaders }),
  };

  let initialized = false;
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
      randomUUID();

    sessionHeaders["mcp-session-id"] = sessionId;
    sessionHeaders.accept = "application/json, text/event-stream";
    transcript.sessionId = sessionId;
    transportState.sessionId = sessionId;
    transcript.initialize = buildExchange("initialize", initRequest, body, response.status);

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
    const headers = {
      "mcp-session-id": transcript.sessionId ?? "",
      accept: "text/event-stream",
      ...(opts?.headers ?? {}),
    };
    const mergedOptions: SseProbeOptions = { ...(opts ?? {}), headers };
    const initial = await sseProbe(url, mergedOptions);
    if (initial.ok || !url.endsWith("/events")) {
      return initial;
    }
    const fallbackUrl = `${url.replace(/\/events$/, "")}/sse`;
    const fallback = await sseProbe(fallbackUrl, mergedOptions);
    return fallback;
  };

  return {
    jsonrpc,
    sseProbe: probeStream,
    transport: transportState,
  };
}

async function safeJsonParse(response: Response): Promise<any> {
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
