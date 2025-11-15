/**
 * MCP Docs Adapter Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DocsStore } from "../lib/store.js";
import { McpDocsAdapter } from "../server.js";
import type { DocChunk, DocManifest } from "../contracts.js";

describe("DocsStore", () => {
  let tempDir: string;
  let store: DocsStore;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "mcp-docs-test-"));
    const dbPath = path.join(tempDir, "test.sqlite");
    store = new DocsStore(dbPath);
  });

  afterAll(async () => {
    store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should insert and search chunks", () => {
    const chunks: DocChunk[] = [
      {
        id: "test-1",
        pageId: "intro",
        url: "https://example.com/intro",
        title: "Introduction to MCP",
        text: "The Model Context Protocol (MCP) provides a standardized way for AI systems to access context.",
        headings: ["Introduction"],
      },
      {
        id: "test-2",
        pageId: "intro",
        url: "https://example.com/intro",
        title: "Introduction to MCP",
        text: "MCP enables seamless handshake between clients and servers.",
        headings: ["Handshake"],
      },
    ];

    store.insertChunks(chunks);

    const results = store.search("handshake", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe("test-2");
  });

  it("should lookup chunk by ID", () => {
    const chunk = store.lookup("test-1");
    expect(chunk).not.toBeNull();
    expect(chunk?.title).toBe("Introduction to MCP");
  });

  it("should return null for non-existent chunk", () => {
    const chunk = store.lookup("non-existent");
    expect(chunk).toBeNull();
  });

  it("should store and retrieve manifest", () => {
    const manifest: DocManifest = {
      version: "v2025-06-18",
      createdAt: new Date().toISOString(),
      commit: "test-commit",
      pages: [
        {
          id: "intro",
          url: "https://example.com/intro",
          title: "Introduction",
          sha256: "abc123",
          anchors: ["#introduction", "#handshake"],
        },
      ],
    };

    store.setManifest(manifest);
    const retrieved = store.getManifest();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.version).toBe("v2025-06-18");
    expect(retrieved?.commit).toBe("test-commit");
  });

  it("should provide accurate stats", () => {
    const stats = store.getStats();
    expect(stats.totalChunks).toBeGreaterThanOrEqual(2);
    expect(stats.totalPages).toBeGreaterThanOrEqual(1);
  });
});

describe("McpDocsAdapter", () => {
  it("should validate search input", async () => {
    const adapter = new McpDocsAdapter();

    await expect(adapter.search({ query: "a" })).rejects.toThrow(
      "Query must be at least 2 characters",
    );
  });

  it("should validate lookup input", async () => {
    const adapter = new McpDocsAdapter();

    await expect(adapter.lookup({ id: "" })).rejects.toThrow(
      "Chunk ID is required",
    );
  });
});
