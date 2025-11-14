import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DevelopmentContext } from "../src/types.js";
import { createDeepContextTools, executeDeepContextTool } from "../src/tools/deepcontext-tools.js";

const mockIndex = vi.fn();
const mockSearch = vi.fn();
const mockStatus = vi.fn();
const mockClear = vi.fn();

vi.mock("../src/deepcontext/client.js", () => ({
  DeepContextClient: vi.fn().mockImplementation(() => ({
    indexCodebase: mockIndex,
    searchCodebase: mockSearch,
    getIndexingStatus: mockStatus,
    clearIndex: mockClear,
  })),
}));

const baseCtx: DevelopmentContext = {
  endpoint: "http://localhost",
  logger: vi.fn(),
  request: async <T>() => ({} as T),
  jsonrpc: async <T>() => ({} as T),
  sseProbe: async () => ({ ok: true }),
  evidence: () => undefined,
  sessionId: "test-session",
  userExpertiseLevel: "expert",
  conversationHistory: [],
};

describe("DeepContext MCP tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndex.mockResolvedValue("indexed");
    mockSearch.mockResolvedValue({ text: "ok", matches: [] });
    mockStatus.mockResolvedValue("status");
    mockClear.mockResolvedValue("cleared");
  });

  it("indexes via MCP tool", async () => {
    const tool = createDeepContextTools().find((t) => t.name === "cortexdx_deepcontext_index");
    expect(tool).toBeDefined();
    const result = await executeDeepContextTool(tool!, { codebasePath: "/repo", force: true }, baseCtx);
    expect(result.content[0]?.type).toBe("text");
    expect(mockIndex).toHaveBeenCalledWith(expect.stringContaining("/repo"), true);
  });

  it("searches via MCP tool", async () => {
    mockSearch.mockResolvedValueOnce({
      text: "found",
      matches: [{ file_path: "/repo/file.ts", start_line: 10, end_line: 20 }],
    });
    const tool = createDeepContextTools().find((t) => t.name === "cortexdx_deepcontext_search");
    expect(tool).toBeDefined();
    const result = await executeDeepContextTool(
      tool!,
      { codebasePath: "/repo", query: "handshake", maxResults: 3 },
      baseCtx,
    );
    expect(mockSearch).toHaveBeenCalledWith(expect.stringContaining("/repo"), "handshake", 3);
    expect(result.structuredContent).toHaveLength(1);
  });

  it("reports status via MCP tool", async () => {
    const tool = createDeepContextTools().find((t) => t.name === "cortexdx_deepcontext_status");
    expect(tool).toBeDefined();
    await executeDeepContextTool(tool!, {}, baseCtx);
    expect(mockStatus).toHaveBeenCalledWith(undefined);
  });

  it("clears via MCP tool", async () => {
    const tool = createDeepContextTools().find((t) => t.name === "cortexdx_deepcontext_clear");
    expect(tool).toBeDefined();
    await executeDeepContextTool(tool!, { codebasePath: "/repo" }, baseCtx);
    expect(mockClear).toHaveBeenCalledWith(expect.stringContaining("/repo"));
  });
});
