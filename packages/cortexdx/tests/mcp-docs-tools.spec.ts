import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMcpDocsTools,
  executeMcpDocsTool,
} from "../src/tools/mcp-docs-tools.js";
import type { DevelopmentContext } from "../src/types.js";

const searchMcpDocs = vi.fn();
const lookupMcpDoc = vi.fn();
const listMcpDocsVersions = vi.fn();
const recordSearch = vi.fn();
const recordChunk = vi.fn();

vi.mock("../src/library/mcp-docs-service.js", () => ({
  searchMcpDocs: (...args: unknown[]) => searchMcpDocs(...args),
  lookupMcpDoc: (...args: unknown[]) => lookupMcpDoc(...args),
  listMcpDocsVersions: (...args: unknown[]) => listMcpDocsVersions(...args),
}));

vi.mock("../src/resources/mcp-docs-store.js", () => ({
  recordMcpDocsSearchResource: (...args: unknown[]) => recordSearch(...args),
  recordMcpDocsChunkResource: (...args: unknown[]) => recordChunk(...args),
}));

const ctx = {
  logger: () => undefined,
  deterministic: false,
} as unknown as DevelopmentContext;

describe("mcp docs tools", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    searchMcpDocs.mockReset();
    lookupMcpDoc.mockReset();
    listMcpDocsVersions.mockReset();
    recordSearch.mockReset();
    recordChunk.mockReset();
  });

  it("exposes three MCP docs tools", () => {
    const tools = createMcpDocsTools();
    expect(tools.map((t) => t.name)).toEqual([
      "cortexdx_mcp_docs_search",
      "cortexdx_mcp_docs_lookup",
      "cortexdx_mcp_docs_versions",
    ]);
  });

  it("executes search tool and records resource", async () => {
    searchMcpDocs.mockResolvedValue({
      version: "2025-06-18",
      matches: [{ chunkId: "spec-basic-0000", version: "2025-06-18" }],
    });
    recordSearch.mockReturnValue({ id: "abc123", type: "search", payload: {} });

    const tool = createMcpDocsTools()[0]!;
    const result = await executeMcpDocsTool(tool, { query: "policy" }, ctx);

    expect(searchMcpDocs).toHaveBeenCalledWith({
      query: "policy",
      topK: undefined,
      minSimilarity: undefined,
      version: undefined,
    });
    expect(recordSearch).toHaveBeenCalled();
    // structuredContent is now an object wrapping the array results
    expect(result.structuredContent).toMatchObject({
      resourceUri: expect.any(String),
      matches: expect.any(Array),
    });
  });

  it("executes lookup tool and records chunk resource", async () => {
    lookupMcpDoc.mockResolvedValue({
      chunkId: "spec-basic-0000",
      version: "2025-06-18",
      url: "https://example.com",
      sourceId: "spec-basic",
      text: "chunk",
      similarity: 1,
    });
    recordChunk.mockReturnValue({ id: "chunk123", type: "chunk", payload: {} });

    const tool = createMcpDocsTools()[1]!;
    const result = await executeMcpDocsTool(
      tool,
      { chunkId: "spec-basic-0000" },
      ctx,
    );

    expect(lookupMcpDoc).toHaveBeenCalledWith({ chunkId: "spec-basic-0000" });
    expect(recordChunk).toHaveBeenCalled();
    // structuredContent is now an object wrapping the result
    expect(result.structuredContent).toMatchObject({
      resourceUri: expect.any(String),
      chunk: expect.any(Object),
    });
  });

  it("lists versions", async () => {
    listMcpDocsVersions.mockResolvedValue([
      { version: "2025-06-18", scope: "staging" },
    ]);

    const tool = createMcpDocsTools()[2]!;
    const result = await executeMcpDocsTool(tool, {}, ctx);

    // structuredContent is now an object wrapping the versions array
    expect(result.structuredContent).toMatchObject({
      versions: expect.any(Array),
    });
    expect(result.structuredContent?.versions).toContainEqual({
      version: "2025-06-18",
      scope: "staging",
    });
  });
});
