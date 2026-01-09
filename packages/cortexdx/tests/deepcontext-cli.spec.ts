import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runDeepContextClear,
  runDeepContextIndex,
  runDeepContextSearch,
  runDeepContextStatus,
} from "../src/commands/deepcontext.js";

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

describe("DeepContext CLI commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndex.mockResolvedValue("indexed");
    mockSearch.mockResolvedValue({ text: "results", matches: [] });
    mockStatus.mockResolvedValue("status");
    mockClear.mockResolvedValue("cleared");
  });

  it("indexes codebases with force flag", async () => {
    const exitCode = await runDeepContextIndex("packages/cortexdx", {
      force: true,
    });
    expect(exitCode).toBe(0);
    expect(mockIndex).toHaveBeenCalledWith(
      expect.stringContaining("packages/cortexdx"),
      true,
    );
  });

  it("searches indexed codebases", async () => {
    mockSearch.mockResolvedValueOnce({
      text: "ok",
      matches: [{ file_path: "a.ts", start_line: 1, end_line: 2 }],
    });
    const exitCode = await runDeepContextSearch(
      "packages/cortexdx",
      "handshake",
      { maxResults: "7" },
    );
    expect(exitCode).toBe(0);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.stringContaining("packages/cortexdx"),
      "handshake",
      7,
    );
  });

  it("prints status output for explicit codebase", async () => {
    const exitCode = await runDeepContextStatus("packages/cortexdx");
    expect(exitCode).toBe(0);
    expect(mockStatus).toHaveBeenCalledWith(
      expect.stringContaining("packages/cortexdx"),
    );
  });

  it("clears indexes", async () => {
    const exitCode = await runDeepContextClear("/tmp/repo");
    expect(exitCode).toBe(0);
    expect(mockClear).toHaveBeenCalledWith(
      expect.stringContaining("/tmp/repo"),
    );
  });
});
