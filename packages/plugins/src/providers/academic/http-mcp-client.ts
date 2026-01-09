import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import { randomUUID } from "node:crypto";
import type { McpToolResult } from "@brainwav/cortexdx-core";

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number;
  result: McpToolResult;
}

interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export interface HttpMcpClientOptions {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  userAgent?: string;
}

export class HttpMcpClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(private readonly options: HttpMcpClientOptions) {
    if (!options.baseUrl) {
      throw new Error("baseUrl is required to initialize HttpMcpClient");
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.userAgent ? { "User-Agent": options.userAgent } : {}),
      ...(options.headers ?? {}),
    };
    if (options.apiKey) {
      const value = options.apiKey.startsWith("Bearer ")
        ? options.apiKey
        : `Bearer ${options.apiKey}`;
      this.headers.Authorization = value;
    }
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: randomUUID(),
          method: "tools/call",
          params: {
            name,
            arguments: args,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await safeReadText(response);
        throw new Error(
          `HTTP ${response.status}: ${detail || response.statusText}`,
        );
      }

      const payload = (await response.json()) as JsonRpcResponse;
      if ("error" in payload) {
        throw new Error(
          `MCP error ${payload.error.code}: ${payload.error.message || "unknown error"}`,
        );
      }
      return payload.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async callToolJson<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const result = await this.callTool(name, args);
    return extractJsonPayload<T>(result);
  }
}

export function extractJsonPayload<T>(result: McpToolResult): T {
  // Handle structured content (new pattern: object, old pattern: array for compatibility)
  if (result.structuredContent) {
    // New pattern: structuredContent is an object matching outputSchema
    if (Array.isArray(result.structuredContent)) {
      // Old pattern: structuredContent is an array (external MCP servers)
      if (result.structuredContent.length > 0) {
        return result.structuredContent[0] as T;
      }
    } else {
      // New pattern: structuredContent is already an object
      return result.structuredContent as T;
    }
  }
  // Fallback to parsing text content
  const textual = (result.content ?? [])
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim())
    .filter((chunk): chunk is string => Boolean(chunk))
    .join("\n")
    .trim();
  if (!textual) {
    throw new Error(
      "Remote MCP tool returned no structured or textual JSON payload",
    );
  }
  try {
    return safeParseJson(textual) as T;
  } catch (error) {
    throw new Error(`Failed to parse MCP response as JSON: ${String(error)}`);
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function sanitizeToolArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    filtered[key] = value;
  }
  return filtered;
}

export function asBearerToken(value: string): string {
  return value.toLowerCase().startsWith("bearer ") ? value : `Bearer ${value}`;
}
