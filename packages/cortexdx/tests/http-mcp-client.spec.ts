import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpMcpClient,
  asBearerToken,
  extractJsonPayload,
  sanitizeToolArgs,
} from "../src/providers/academic/http-mcp-client.js";

const originalFetch = globalThis.fetch;

describe("HttpMcpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).fetch;
    }
  });

  it("sends MCP request and parses JSON payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: "req-1",
        result: {
          content: [{ type: "text", text: '{"ok":true,"value":42}' }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpMcpClient({
      baseUrl: "https://context7.example/api",
      apiKey: "secret-token",
      headers: { "X-Test": "cortexdx" },
    });

    const result = await client.callToolJson<{ ok: boolean; value: number }>(
      "demo_tool",
      { topic: "mcp" },
    );

    expect(result).toEqual({ ok: true, value: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://context7.example/api/mcp");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret-token",
      "X-Test": "cortexdx",
    });
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.params.arguments).toEqual({ topic: "mcp" });
  });

  it("throws on JSON-RPC errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: "req-2",
        error: { code: 500, message: "boom" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpMcpClient({ baseUrl: "https://example.com" });
    await expect(client.callTool("broken", {})).rejects.toThrow("boom");
  });

  it("throws on HTTP failures with response body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "missing token",
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpMcpClient({ baseUrl: "https://example.com" });
    await expect(client.callTool("demo", {})).rejects.toThrow(
      "HTTP 401: missing token",
    );
  });
});

describe("HTTP MCP helpers", () => {
  it("sanitizes tool args", () => {
    expect(
      sanitizeToolArgs({
        ok: true,
        omit: undefined,
        nested: { x: 1 },
      }),
    ).toEqual({ ok: true, nested: { x: 1 } });
  });

  it("formats bearer tokens", () => {
    expect(asBearerToken("secret")).toBe("Bearer secret");
    expect(asBearerToken("Bearer Already")).toBe("Bearer Already");
  });

  it("extracts structured content", () => {
    const payload = extractJsonPayload<{ foo: string }>({
      content: [],
      structuredContent: [{ foo: "bar" }],
    });
    expect(payload.foo).toBe("bar");
  });
});
