import { type ServerResponse, createServer } from "node:http";
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

const sendJson = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

const sendError = (res: ServerResponse, id: string | number | null, code: number, message: string) => {
  sendJson(res, 400, {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
};

export const server = createServer(async (req, res) => {
  try {
    // Minimal self-healing API passthrough
    if (req.url?.startsWith("/api/self-healing") || req.url?.startsWith("/api/v1")) {
      await handleSelfHealingAPI(req, res, req.url);
      return;
    }

    if (req.method !== "POST" || req.url !== "/") {
      res.statusCode = 404;
      res.end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    let body: { method?: string; id?: unknown } | undefined;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      sendError(res, null, -32700, "Parse error");
      return;
    }

    const { method, id } = body ?? {};

    if (method === "rpc.ping") {
      sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: { status: "ok", timestamp: new Date().toISOString() },
      });
      return;
    }

    if (method === "tools/list") {
      sendJson(res, 200, {
        jsonrpc: "2.0",
        id,
        result: { tools },
      });
      return;
    }

    sendError(res, id, -32601, "Method not found");

  } catch (error) {
    sendError(res, null, -32603, (error as Error).message);
  }
});

export { handleSelfHealingAPI };
