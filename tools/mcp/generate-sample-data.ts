#!/usr/bin/env tsx
/**
 * MCP Docs Sample Data Generator
 *
 * Creates sample documentation data for testing when network is unavailable.
 * This populates the knowledge pack with realistic MCP documentation examples.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DocChunk, DocManifest } from "../../packages/mcp/mcp-docs-adapter/src/contracts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sample documentation chunks
const sampleChunks: DocChunk[] = [
  {
    id: "intro-chunk-0",
    pageId: "intro",
    url: "https://modelcontextprotocol.io/docs/getting-started/intro",
    title: "Introduction to MCP",
    text: "The Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs. Think of MCP like a USB-C port for AI applications. Just as USB-C provides a standardized way to connect your devices to various peripherals and accessories, MCP provides a standardized way to connect AI models to different data sources and tools.",
    headings: ["Introduction"],
  },
  {
    id: "intro-chunk-1",
    pageId: "intro",
    url: "https://modelcontextprotocol.io/docs/getting-started/intro#core-concepts",
    title: "Introduction to MCP",
    text: "MCP defines a client-server architecture where a host application can connect to multiple servers. Each server can provide resources, tools, and prompts that extend the capabilities of the AI model. The protocol uses JSON-RPC 2.0 for message exchange and supports multiple transport mechanisms including stdio and HTTP with SSE.",
    anchor: "core-concepts",
    headings: ["Introduction", "Core Concepts"],
  },
  {
    id: "handshake-chunk-0",
    pageId: "lifecycle",
    url: "https://modelcontextprotocol.io/docs/concepts/lifecycle#initialization",
    title: "Lifecycle and Initialization",
    text: "The MCP handshake process begins with the client sending an initialize request to the server. This request includes the protocol version, client capabilities, and client information. The server responds with its protocol version, capabilities, and server information. Both parties must negotiate a compatible protocol version to proceed.",
    anchor: "initialization",
    headings: ["Lifecycle", "Initialization"],
  },
  {
    id: "capabilities-chunk-0",
    pageId: "capabilities",
    url: "https://modelcontextprotocol.io/docs/concepts/capabilities",
    title: "Capabilities",
    text: "Capabilities in MCP allow clients and servers to declare what features they support. The main capability categories are: tools (executable functions), resources (data sources), and prompts (templated interactions). Servers declare their capabilities during initialization, and clients can discover and use these capabilities dynamically.",
    headings: ["Capabilities"],
  },
  {
    id: "tools-chunk-0",
    pageId: "tools",
    url: "https://modelcontextprotocol.io/docs/concepts/tools",
    title: "Tools",
    text: "Tools are executable functions that servers expose to clients. Each tool has a name, description, and input schema defined using JSON Schema. Clients can discover available tools via the tools/list method and execute them via tools/call. Tool results can include text, images, or embedded resources.",
    headings: ["Tools"],
  },
  {
    id: "resources-chunk-0",
    pageId: "resources",
    url: "https://modelcontextprotocol.io/docs/concepts/resources",
    title: "Resources",
    text: "Resources represent data sources that servers can provide to clients. Each resource has a URI, name, optional description, and MIME type. Resources can be listed via resources/list and read via resources/read. Common resource types include files, database records, and API responses.",
    headings: ["Resources"],
  },
  {
    id: "protocol-version-chunk-0",
    pageId: "spec",
    url: "https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/",
    title: "Protocol Version and Specification",
    text: "MCP protocol versions follow the YYYY-MM-DD format. The current specification version is 2025-03-26. Clients and servers must negotiate a compatible protocol version during initialization. Version negotiation ensures backward compatibility and allows for protocol evolution over time.",
    headings: ["Specification", "Protocol Version"],
  },
  {
    id: "jsonrpc-chunk-0",
    pageId: "spec",
    url: "https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/#json-rpc",
    title: "JSON-RPC 2.0",
    text: "MCP uses JSON-RPC 2.0 as its message format. All requests must include: jsonrpc (set to '2.0'), method (the RPC method name), and id (a unique request identifier). Responses include: jsonrpc, id (matching the request), and either result or error. Notifications omit the id field.",
    anchor: "json-rpc",
    headings: ["Specification", "JSON-RPC"],
  },
  {
    id: "auth-chunk-0",
    pageId: "authentication",
    url: "https://modelcontextprotocol.io/docs/concepts/authentication",
    title: "Authentication",
    text: "MCP supports multiple authentication mechanisms. For stdio transport, authentication typically relies on OS-level process permissions. For HTTP transport with SSE, servers can implement OAuth 2.0, API keys, or custom authentication schemes. Authentication credentials should be passed via HTTP headers rather than query parameters.",
    headings: ["Authentication"],
  },
  {
    id: "server-info-chunk-0",
    pageId: "server-info",
    url: "https://modelcontextprotocol.io/docs/concepts/server",
    title: "Server Information",
    text: "During initialization, servers provide information about themselves including name and version. The server name should be between 3-100 characters and use semantic versioning (e.g., '1.0.0' or '1.0'). Server info helps clients identify and diagnose issues with specific MCP server implementations.",
    headings: ["Server Information"],
  },
];

const sampleManifest: DocManifest = {
  version: "v2025-06-18",
  createdAt: new Date().toISOString(),
  commit: "sample-data",
  pages: [
    {
      id: "intro",
      url: "https://modelcontextprotocol.io/docs/getting-started/intro",
      title: "Introduction to MCP",
      sha256: "sample-intro-sha256",
      anchors: ["#core-concepts"],
    },
    {
      id: "lifecycle",
      url: "https://modelcontextprotocol.io/docs/concepts/lifecycle",
      title: "Lifecycle and Initialization",
      sha256: "sample-lifecycle-sha256",
      anchors: ["#initialization"],
    },
    {
      id: "capabilities",
      url: "https://modelcontextprotocol.io/docs/concepts/capabilities",
      title: "Capabilities",
      sha256: "sample-capabilities-sha256",
      anchors: [],
    },
    {
      id: "tools",
      url: "https://modelcontextprotocol.io/docs/concepts/tools",
      title: "Tools",
      sha256: "sample-tools-sha256",
      anchors: [],
    },
    {
      id: "resources",
      url: "https://modelcontextprotocol.io/docs/concepts/resources",
      title: "Resources",
      sha256: "sample-resources-sha256",
      anchors: [],
    },
    {
      id: "spec",
      url: "https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/",
      title: "MCP Specification",
      sha256: "sample-spec-sha256",
      anchors: ["#json-rpc"],
    },
    {
      id: "authentication",
      url: "https://modelcontextprotocol.io/docs/concepts/authentication",
      title: "Authentication",
      sha256: "sample-auth-sha256",
      anchors: [],
    },
    {
      id: "server-info",
      url: "https://modelcontextprotocol.io/docs/concepts/server",
      title: "Server Information",
      sha256: "sample-server-info-sha256",
      anchors: [],
    },
  ],
};

async function main(): Promise<void> {
  console.log("[sample-data] Generating sample MCP documentation data...");

  const { DocsStore } = await import(
    "../../packages/mcp/mcp-docs-adapter/src/lib/store.js"
  );

  const dbPath = path.join(
    __dirname,
    "../../data/knowledge/mcp-docs/v2025-06-18/mcp-docs.sqlite"
  );

  const store = new DocsStore(dbPath);

  // Clear existing data
  store.clear();
  console.log("[sample-data] Cleared existing data");

  // Insert sample chunks
  store.insertChunks(sampleChunks);
  console.log(`[sample-data] Inserted ${sampleChunks.length} sample chunks`);

  // Store manifest
  store.setManifest(sampleManifest);
  console.log("[sample-data] Stored sample manifest");

  const stats = store.getStats();
  console.log(`[sample-data] Database stats: ${stats.totalChunks} chunks, ${stats.totalPages} pages`);

  // Test search
  const searchResults = store.search("handshake", 3);
  console.log(`[sample-data] Test search for 'handshake': ${searchResults.length} results`);
  if (searchResults.length > 0) {
    console.log(`[sample-data]   Top result: ${searchResults[0]?.title}`);
  }

  store.close();
  console.log("[sample-data] ✅ Sample data generation complete!");
}

main().catch((error) => {
  console.error("❌ Sample data generation failed:", error);
  process.exit(1);
});
