import { createServer } from "node:http";
import { handleSelfHealingAPI } from "./self-healing/server-handler.js";

const tools = [
  {
    name: "rpc.ping",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "tools/list",
    inputSchema: { type: "object", properties: {} },
  },
];

export const server = createServer((req, res) => {
  // Minimal self-healing API passthrough
  if (req.url?.startsWith("/api/self-healing")) {
    void handleSelfHealingAPI(req, res, req.url);
    return;
  }

  if (req.method !== "POST" || req.url !== "/") {
    res.statusCode = 404;
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const { method, id } = body ?? {};

      if (method === "rpc.ping") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { status: "ok", timestamp: new Date().toISOString() },
          }),
        );
        return;
      }

      if (method === "tools/list") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { tools } }));
        return;
      }

      res.writeHead(400, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" },
        }),
      );
    } catch (error) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: (error as Error).message },
        }),
      );
    }
  });
});

export { handleSelfHealingAPI };
