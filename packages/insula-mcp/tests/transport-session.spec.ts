import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/adapters/sse.js", () => {
  return {
    sseProbe: vi.fn(),
  };
});

import { sseProbe } from "../src/adapters/sse.js";
import { createInspectorSession } from "../src/context/inspector-session.js";

const originalFetch = globalThis.fetch;

function createResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: {
      get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null,
    } as Headers,
  } as Response;
}

describe("Inspector session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  it("records initialize transcript and reuses session id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse(
          { result: { serverInfo: { name: "FastMCP" } } },
          { "mcp-session-id": "session-123" },
        ),
      )
      .mockResolvedValueOnce(createResponse({ result: { tools: [] } }));

    globalThis.fetch = fetchMock as typeof fetch;

    const session = createInspectorSession("https://example.com/mcp");
    await session.jsonrpc("tools/list");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const transcript = session.transport.transcript();
    expect(transcript.sessionId).toBe("session-123");
    expect(transcript.initialize?.response?.result?.serverInfo?.name).toBe("FastMCP");
    expect(transcript.exchanges).toHaveLength(1);
    expect(transcript.exchanges[0].method).toBe("tools/list");
  });

  it("falls back to /sse alias when /events fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse(
          { result: { serverInfo: { name: "FastMCP" } } },
          { "mcp-session-id": "session-999" },
        ),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const sseProbeMock = sseProbe as unknown as ReturnType<typeof vi.fn>;
    sseProbeMock
      .mockResolvedValueOnce({ ok: false, reason: "HTTP 404", resolvedUrl: "http://x/events" })
      .mockResolvedValueOnce({ ok: true, firstEventMs: 12, resolvedUrl: "http://x/sse" });

    const session = createInspectorSession("http://example.com/mcp");
    const result = await session.sseProbe("http://example.com/events");

    expect(result.ok).toBe(true);
    expect(result.resolvedUrl).toMatch(/\/sse$/);
    expect(sseProbeMock).toHaveBeenCalledTimes(2);
  });
});
