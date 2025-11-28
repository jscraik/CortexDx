import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { HttpStreamableTransport } from "./http-streamable";
import { MCP_HEADERS, type RequestHandler } from "./types";

const decoder = new TextDecoder();

const getAvailablePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
      } else {
        reject(new Error("Failed to resolve port"));
      }
      server.close();
    });
    server.on("error", reject);
  });

describe("HttpStreamableTransport", () => {
  let transport: HttpStreamableTransport | null = null;

  afterEach(async () => {
    if (transport?.isRunning()) {
      await transport.stop();
    }
    transport = null;
  });

  it("handles JSON POST requests with configured CORS and protocol headers", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({
      port,
      cors: { allowedOrigins: ["http://allowed.test"] },
    });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://allowed.test",
        [MCP_HEADERS.SESSION_ID]: "session-post",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://allowed.test",
    );
    expect(response.headers.get(MCP_HEADERS.SESSION_ID.toLowerCase())).toBe(
      "session-post",
    );
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      id: "1",
      result: { ok: true },
    });
  });

  it("responds to OPTIONS preflight with merged CORS defaults", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "OPTIONS",
      headers: { origin: "http://localhost" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "Mcp-Session-Id",
    );
    expect(response.headers.get("access-control-max-age")).toBe("86400");
  });

  it("streams handler emissions over SSE and reflects session headers", async () => {
    const port = await getAvailablePort();
    const emitter = new EventEmitter();
    const handler: RequestHandler = Object.assign(
      async (request) => ({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: { ok: true },
      }),
      { events: emitter },
    );

    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/sse`, {
      headers: {
        accept: "text/event-stream",
        [MCP_HEADERS.SESSION_ID]: "sse-session",
      },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get(MCP_HEADERS.SESSION_ID.toLowerCase())).toBe(
      "sse-session",
    );

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Expected reader to be defined");
    emitter.emit("message", { jsonrpc: "2.0", id: null, result: "stream" });

    let payload = "";
    for (let i = 0; i < 3; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      payload += decoder.decode(value);
      if (payload.includes("data:")) break;
    }

    expect(payload).toMatch(/data: .*"stream"/);
    try {
      controller.abort();
      await reader.cancel();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        // Log unexpected errors during cleanup for better diagnostics
        console.error("Unexpected error during reader.cancel():", error);
        throw error;
      }
    }
  });

  it("returns 501 when SSE is requested but handler cannot emit events", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/sse`, {
      headers: { accept: "text/event-stream" },
    });

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({
      error: "SSE not supported for this handler",
    });
  });

  it("streams error events via SSE using forwardError", async () => {
    const port = await getAvailablePort();
    const emitter = new EventEmitter();
    const handler: RequestHandler = Object.assign(
      async (request) => ({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: { ok: true },
      }),
      { events: emitter },
    );

    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/sse`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Expected reader to be defined");
    emitter.emit("error", new Error("test error"));

    let payload = "";
    for (let i = 0; i < 3; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      payload += decoder.decode(value);
      if (payload.includes("event: error")) break;
    }

    expect(payload).toContain("event: error");
    expect(payload).toContain("test error");
    try {
      controller.abort();
      await reader.cancel();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Unexpected error during reader.cancel():", error);
        throw error;
      }
    }
  });

  it("returns 403 when strictOriginCheck is enabled and origin is invalid", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({
      port,
      strictOriginCheck: true,
      cors: { allowedOrigins: ["http://allowed.test"] },
    });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://evil.test",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Forbidden: Invalid origin",
    });
  });

  it("returns 400 when JSON-RPC request is a batch array", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: "1", method: "ping" },
        { jsonrpc: "2.0", id: "2", method: "pong" },
      ]),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error?.message).toContain("batching is not supported");
  });

  it("returns 400 when request body contains invalid JSON", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not valid json {{{",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it("handles SSE on /events endpoint", async () => {
    const port = await getAvailablePort();
    const emitter = new EventEmitter();
    const handler: RequestHandler = Object.assign(
      async (request) => ({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: { ok: true },
      }),
      { events: emitter },
    );

    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Expected reader to be defined");
    emitter.emit("message", { test: "events-path" });

    let payload = "";
    for (let i = 0; i < 3; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      payload += decoder.decode(value);
      if (payload.includes("data:")) break;
    }

    expect(payload).toMatch(/data: .*"events-path"/);
    try {
      controller.abort();
      await reader.cancel();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Unexpected error during reader.cancel():", error);
        throw error;
      }
    }
  });

  it("allows any origin when wildcard * is in allowedOrigins", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({
      port,
      strictOriginCheck: true,
      cors: { allowedOrigins: ["*"] },
    });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://any-origin.example.com",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping" }),
    });

    expect(response.status).toBe(200);
    // When wildcard is used, CORS spec requires '*' not echoed origin
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("allows subdomain origins when *.domain.com pattern is used", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({
      port,
      strictOriginCheck: true,
      cors: { allowedOrigins: ["*.example.com"] },
    });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://sub.example.com",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://sub.example.com",
    );
  });

  it("rejects subdomain origins that do not match the pattern", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({
      port,
      strictOriginCheck: true,
      cors: { allowedOrigins: ["*.example.com"] },
    });
    await transport.start(handler);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://evil.notexample.com",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Forbidden: Invalid origin",
    });
  });

  it("returns 405 for non-POST methods on non-SSE paths", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    // Test GET
    const getResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "GET",
    });
    expect(getResponse.status).toBe(405);
    expect(await getResponse.json()).toMatchObject({
      error: "Method not allowed",
    });

    // Test PUT
    const putResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping" }),
    });
    expect(putResponse.status).toBe(405);

    // Test DELETE
    const deleteResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(405);
  });

  it("preserves session headers in error responses", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    // Send invalid JSON - session header should still be present in error response
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [MCP_HEADERS.SESSION_ID]: "session-in-error",
      },
      body: "not valid json {{{",
    });

    expect(response.status).toBe(400);
    // Session header should still be present in error responses
    expect(response.headers.get(MCP_HEADERS.SESSION_ID.toLowerCase())).toBe(
      "session-in-error",
    );
  });

  it("returns 400 when request body exceeds size limit", async () => {
    const port = await getAvailablePort();
    const handler: RequestHandler = async (request) => ({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { ok: true },
    });
    transport = new HttpStreamableTransport({ port });
    await transport.start(handler);

    // Create a body larger than 1MB (default limit)
    const largeBody = "x".repeat(1024 * 1024 + 100);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: largeBody,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error?.message).toContain("too large");
  }, 15000); // Increase timeout for large body test
});
