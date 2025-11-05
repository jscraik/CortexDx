import http from "node:http";

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  res.write("data: {\"ready\":true}\n\n");
  res.end();
});

server.listen(8089, () => console.log("broken-sse on :8089"));
