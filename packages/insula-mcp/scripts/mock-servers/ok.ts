import http from "node:http";

const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" }));
    return;
  }
  res.end("ok");
});

server.listen(8088, () => console.log("ok server on :8088"));
