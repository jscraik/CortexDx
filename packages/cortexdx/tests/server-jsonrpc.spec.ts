import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

let testServer: Server;
let baseUrl: string;
const ORIGINAL_ENV = process.env.NODE_ENV;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  const serverModule = await import("../src/server.js");
  testServer = serverModule.server;
  await new Promise<void>((resolve) => {
    testServer.listen(0, "127.0.0.1", () => {
      const address = testServer.address();
      if (address && typeof address === "object") {
        baseUrl = `http://127.0.0.1:${address.port}`;
      } else {
        throw new Error("Unable to determine server address");
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => testServer.close(() => resolve()));
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe("CortexDx JSON-RPC endpoint", () => {
  it("responds to rpc.ping on root path", async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "rpc.ping" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ jsonrpc: "2.0", result: { status: "ok" } });
    expect(typeof body.result.timestamp).toBe("string");
  });

  it("exposes tools/list with at least one tool", async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.result?.tools)).toBe(true);
    const first = body.result.tools[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("inputSchema");
  });
});
