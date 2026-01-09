import { FastMCP } from "fastmcp";

const mcp = new FastMCP({ name: "test", version: "1.0" });
console.log("FastMCP keys:", Object.keys(mcp));
console.log(
  "FastMCP prototype keys:",
  Object.getOwnPropertyNames(Object.getPrototypeOf(mcp)),
);

// Check if we can access the server
// @ts-ignore
if (mcp.server) console.log("Has server property");
// @ts-ignore
if (mcp.app) console.log("Has app property");
