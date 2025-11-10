import http from "node:http";

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "POST") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" }));
    return;
  }
  res.end("ok");
});

server.listen(8091, () => console.log("bad-cors on :8091"));
