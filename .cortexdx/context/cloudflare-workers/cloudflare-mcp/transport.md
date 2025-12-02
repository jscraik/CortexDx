---
title: Transport · Cloudflare Agents docs
description: "The Model Context Protocol (MCP) specification defines two
  standard transport mechanisms for communication between clients and servers:"
lastUpdated: 2025-11-27T20:01:09.000Z
chatbotDeprioritize: false
tags: MCP
source_url:
  html: https://developers.cloudflare.com/agents/model-context-protocol/transport/
  md: https://developers.cloudflare.com/agents/model-context-protocol/transport/index.md
---

The Model Context Protocol (MCP) specification defines two standard [transport mechanisms](https://spec.modelcontextprotocol.io/specification/draft/basic/transports/) for communication between clients and servers:

1. **stdio** — Communication over standard in and standard out, designed for local MCP connections.
2. **Streamable HTTP** — The standard transport method for remote MCP connections, [introduced](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) in March 2025. It uses a single HTTP endpoint for bidirectional messaging.

Note

Server-Sent Events (SSE) was previously used for remote MCP connections but has been deprecated in favor of Streamable HTTP. If you need SSE support for legacy clients, use the [`McpAgent`](https://developers.cloudflare.com/agents/model-context-protocol/mcp-agent-api/) class.

MCP servers built with the [Agents SDK](https://developers.cloudflare.com/agents) use [`createMcpHandler`](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/) to handle Streamable HTTP transport.

## Implementing remote MCP transport

Use [`createMcpHandler`](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api/) to create an MCP server that handles Streamable HTTP transport. This is the recommended approach for new MCP servers.

#### Get started quickly

You can use the "Deploy to Cloudflare" button to create a remote MCP server.

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/agents/tree/main/examples/mcp-worker)

#### Remote MCP server (without authentication)

Create an MCP server using `createMcpHandler`. View the [complete example on GitHub](https://github.com/cloudflare/agents/tree/main/examples/mcp-worker).

* JavaScript

  ```js
  import { createMcpHandler } from "agents/mcp";
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";


  const server = new McpServer({
    name: "My MCP Server",
    version: "1.0.0",
  });


  server.registerTool(
    "hello",
    {
      description: "Returns a greeting message",
      inputSchema: { name: z.string().optional() },
    },
    async ({ name }) => {
      return {
        content: [{ text: `Hello, ${name ?? "World"}!`, type: "text" }],
      };
    },
  );


  export default {
    fetch: (request, env, ctx) => {
      return createMcpHandler(server)(request, env, ctx);
    },
  };
  ```

* TypeScript

  ```ts
  import { createMcpHandler } from "agents/mcp";
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";


  const server = new McpServer({
    name: "My MCP Server",
    version: "1.0.0",
  });


  server.registerTool(
    "hello",
    {
      description: "Returns a greeting message",
      inputSchema: { name: z.string().optional() },
    },
    async ({ name }) => {
      return {
        content: [{ text: `Hello, ${name ?? "World"}!`, type: "text" }],
      };
    },
  );


  export default {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
      return createMcpHandler(server)(request, env, ctx);
    },
  };
  ```

#### MCP server with authentication

If your MCP server implements authentication & authorization using the [Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider) library, use `createMcpHandler` with the `apiRoute` and `apiHandler` properties. View the [complete example on GitHub](https://github.com/cloudflare/agents/tree/main/examples/mcp-worker-authenticated).

* JavaScript

  ```js
  export default new OAuthProvider({
    apiRoute: "/mcp",
    apiHandler: {
      fetch: (request, env, ctx) => {
        return createMcpHandler(server)(request, env, ctx);
      },
    },
    // ... other OAuth configuration
  });
  ```

* TypeScript

  ```ts
  export default new OAuthProvider({
    apiRoute: "/mcp",
    apiHandler: {
      fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
        return createMcpHandler(server)(request, env, ctx);
      },
    },
    // ... other OAuth configuration
  });
  ```

### Stateful MCP servers

If your MCP server needs to maintain state across requests, use `createMcpHandler` with a `WorkerTransport` inside an [Agent](https://developers.cloudflare.com/agents/) class. This allows you to persist session state in Durable Object storage and use advanced MCP features like [elicitation](https://modelcontextprotocol.io/specification/draft/client/elicitation) and [sampling](https://modelcontextprotocol.io/specification/draft/client/sampling).

See [Stateful MCP Servers](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api#stateful-mcp-servers) for implementation details.

### Migrating from McpAgent

If you have an existing MCP server using the `McpAgent` class:

* **Not using state?** Replace your `McpAgent` class with `McpServer` from `@modelcontextprotocol/sdk` and use `createMcpHandler(server)` in a Worker `fetch` handler.
* **Using state?** Use `createMcpHandler` with a `WorkerTransport` inside an [Agent](https://developers.cloudflare.com/agents/) class. See [Stateful MCP Servers](https://developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api#stateful-mcp-servers) for details.
* **Need SSE support?** Continue using `McpAgent` with `serveSSE()` for legacy client compatibility. See the [McpAgent API reference](https://developers.cloudflare.com/agents/model-context-protocol/mcp-agent-api/).

### Testing with MCP clients

You can test your MCP server using an MCP client that supports remote connections, or use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote), an adapter that lets MCP clients that only support local connections work with remote MCP servers.

Follow [this guide](https://developers.cloudflare.com/agents/guides/test-remote-mcp-server/) for instructions on how to connect to your remote MCP server to Claude Desktop, Cursor, Windsurf, and other MCP clients.
