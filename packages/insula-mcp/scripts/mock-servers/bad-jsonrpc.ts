import http from "node:http";

const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        if (Array.isArray(parsed)) {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ jsonrpc: "2.0", id: "oops", result: "not-array" }));
          return;
        }
      } catch {
        // ignore parse errors
      }
      res.statusCode = 400;
      res.end("bad request");
    });
    return;
  }
  res.end("ok");
});

server.listen(8090, () => console.log("bad-jsonrpc on :8090"));
