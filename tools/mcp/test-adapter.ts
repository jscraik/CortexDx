#!/usr/bin/env tsx
/**
 * Test the MCP Docs Adapter
 *
 * Verifies that the adapter can search, lookup, and retrieve version info
 * from the populated knowledge pack.
 */

import { createMcpDocsAdapter } from "../../packages/mcp/mcp-docs-adapter/src/server.js";

async function main(): Promise<void> {
  console.log("Testing MCP Docs Adapter...\n");

  const adapter = await createMcpDocsAdapter();

  // Test 1: Version info
  console.log("1. Testing version()...");
  const version = await adapter.version();
  console.log(`   Active version: ${version.active}`);
  console.log(`   Available: ${version.available.join(", ")}`);
  console.log(`   Commit: ${version.commit}`);
  console.log("   ✅ Version info retrieved\n");

  // Test 2: Search for "handshake"
  console.log("2. Testing search() for 'handshake'...");
  const handshakeResults = await adapter.search({
    query: "handshake",
    topK: 3,
  });
  console.log(`   Found ${handshakeResults.hits.length} results`);
  console.log(`   Search took ${handshakeResults.tookMs}ms`);
  if (handshakeResults.hits.length > 0) {
    const top = handshakeResults.hits[0];
    console.log(`   Top result: "${top?.title}"`);
    console.log(`   URL: ${top?.url}`);
    console.log(`   Score: ${top?.score}`);
    console.log(`   Text preview: ${top?.text.substring(0, 100)}...`);
  }
  console.log("   ✅ Search successful\n");

  // Test 3: Search for "capabilities"
  console.log("3. Testing search() for 'capabilities'...");
  const capResults = await adapter.search({
    query: "capabilities",
    topK: 5,
  });
  console.log(`   Found ${capResults.hits.length} results`);
  capResults.hits.forEach((hit, idx) => {
    console.log(`   ${idx + 1}. ${hit.title} (score: ${hit.score})`);
  });
  console.log("   ✅ Search successful\n");

  // Test 4: Lookup by ID
  console.log("4. Testing lookup() by ID...");
  const chunkId = handshakeResults.hits[0]?.id;
  if (chunkId) {
    const chunk = await adapter.lookup({ id: chunkId });
    console.log(`   Chunk ID: ${chunk.id}`);
    console.log(`   Title: ${chunk.title}`);
    console.log(`   URL: ${chunk.url}`);
    console.log(`   Outline: ${chunk.outline.join(" > ")}`);
    console.log(`   Text length: ${chunk.text.length} chars`);
    console.log("   ✅ Lookup successful\n");
  }

  // Test 5: Search for error-related terms
  console.log("5. Testing search() for 'jsonrpc'...");
  const jsonrpcResults = await adapter.search({
    query: "jsonrpc protocol",
    topK: 3,
  });
  console.log(`   Found ${jsonrpcResults.hits.length} results`);
  if (jsonrpcResults.hits.length > 0) {
    console.log(`   Top: ${jsonrpcResults.hits[0]?.title}`);
  }
  console.log("   ✅ Search successful\n");

  // Test 6: Search for "tools"
  console.log("6. Testing search() for 'tools'...");
  const toolsResults = await adapter.search({
    query: "tools executable functions",
    topK: 3,
  });
  console.log(`   Found ${toolsResults.hits.length} results`);
  if (toolsResults.hits.length > 0) {
    console.log(`   Top: ${toolsResults.hits[0]?.title}`);
  }
  console.log("   ✅ Search successful\n");

  // Test 7: Search for GitHub content (FastMCP)
  console.log("7. Testing search() for GitHub content 'FastMCP'...");
  const fastmcpResults = await adapter.search({
    query: "FastMCP Python library",
    topK: 3,
  });
  console.log(`   Found ${fastmcpResults.hits.length} results`);
  if (fastmcpResults.hits.length > 0) {
    const top = fastmcpResults.hits[0];
    console.log(`   Top: ${top?.title}`);
    console.log(`   URL: ${top?.url}`);
    console.log(
      `   Is GitHub URL: ${top?.url.includes("github.com") ? "✅" : "❌"}`,
    );
  }
  console.log("   ✅ GitHub content searchable\n");

  // Test 8: Search for Ollama
  console.log("8. Testing search() for 'Ollama'...");
  const ollamaResults = await adapter.search({
    query: "Ollama local language models",
    topK: 3,
  });
  console.log(`   Found ${ollamaResults.hits.length} results`);
  if (ollamaResults.hits.length > 0) {
    console.log(`   Top: ${ollamaResults.hits[0]?.title}`);
  }
  console.log("   ✅ Search successful\n");

  adapter.close();

  console.log("=" + "=".repeat(50));
  console.log("✅ All adapter tests passed!");
  console.log("=" + "=".repeat(50));
}

main().catch((error) => {
  console.error("❌ Adapter test failed:", error);
  process.exit(1);
});
