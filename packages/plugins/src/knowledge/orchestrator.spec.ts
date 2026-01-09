import type { KnowledgeRequest } from "@brainwav/cortexdx-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransportType } from "./transport/types.js";

// Mock Cache Store
vi.mock("./cache-store.js", () => {
  class MemoryStore {
    private store = new Map<string, any>();

    constructor(_dbPath: string) {}

    upsert(entry: any): void {
      this.store.set(`${entry.version}::${entry.section} `, { ...entry });
    }

    get(section: string, version: string): any | null {
      return this.store.get(`${version}::${section} `) ?? null;
    }

    touch(): void {}

    stats() {
      const entries = Array.from(this.store.values());
      const now = Date.now();
      const sections = entries.map((e) => ({
        key: `${e.version}::${e.section} `,
        age: now - e.metadata.fetchedAt,
        ttl: e.ttl ?? 0,
      }));
      const avgAge =
        sections.length === 0
          ? 0
          : sections.reduce((sum, s) => sum + s.age, 0) / sections.length;
      return { entries: sections.length, avgAge, sections };
    }
  }

  return { SpecCacheStore: MemoryStore };
});

// Mock Transport Adapters
const mockFetch = vi.fn();
vi.mock("./transport/adapters.js", () => {
  return {
    HttpTransportAdapter: vi.fn().mockImplementation(() => ({
      fetch: mockFetch,
    })),
    SseTransportAdapter: vi.fn().mockImplementation(() => ({
      fetch: vi.fn(),
    })),
    WebSocketTransportAdapter: vi.fn().mockImplementation(() => ({
      fetch: vi.fn(),
    })),
  };
});

// Mock Transport Selector
const mockSelectTransport = vi.fn().mockReturnValue(TransportType.HTTP);
const mockDetectCapabilities = vi
  .fn()
  .mockResolvedValue({ http: true, sse: false, websocket: false });

vi.mock("./transport/selector.js", () => {
  return {
    DefaultTransportSelector: vi.fn().mockImplementation(() => ({
      selectTransport: mockSelectTransport,
      detectCapabilities: mockDetectCapabilities,
    })),
  };
});

import { createKnowledgeOrchestrator } from "./orchestrator.js";

function mockSpec(section: string, version: string, content: string) {
  return {
    section,
    version,
    content,
    metadata: {
      url: `https://example.com/${version}/${section}`,
      fetchedAt: Date.now(),
      etag: "etag-1",
    },
  };
}

function createTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "cortexdx-knowledge-"));
}

describe("KnowledgeOrchestrator", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockSelectTransport.mockReturnValue(TransportType.HTTP);
  });

  it("returns cached content when fresh", async () => {
    mockFetch.mockResolvedValue(
      mockSpec("authentication", "2025-06-18", "content-1"),
    );

    const orchestrator = createKnowledgeOrchestrator({
      baseUrl: "https://example.com",
      defaultVersion: "2025-06-18",
      cacheDir: createTempDir(),
      defaultTtlMs: 60_000,
    });

    const request: KnowledgeRequest = {
      section: "authentication",
      fallbackToCache: true,
    };

    const first = await orchestrator.get(request);
    const second = await orchestrator.get(request);

    expect(first.source).toBe("fetch");
    expect(second.source).toBe("cache");
    expect(second.fresh).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches when content is stale and updates cache", async () => {
    mockFetch
      .mockResolvedValueOnce(mockSpec("auth", "2025-06-18", "v1"))
      .mockResolvedValueOnce(mockSpec("auth", "2025-06-18", "v2"));

    const orchestrator = createKnowledgeOrchestrator({
      baseUrl: "https://example.com",
      defaultVersion: "2025-06-18",
      cacheDir: createTempDir(),
      defaultTtlMs: 10_000,
    });

    await orchestrator.get({ section: "auth", fallbackToCache: true });
    const result = await orchestrator.get({
      section: "auth",
      maxStaleness: 0,
      fallbackToCache: true,
    });

    expect(result.content.content).toBe("v2");
    expect(result.source).toBe("fetch");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to stale cache when fetch fails", async () => {
    mockFetch
      .mockResolvedValueOnce(mockSpec("handshake", "2025-06-18", "fresh"))
      .mockRejectedValueOnce(new Error("network down"));

    const orchestrator = createKnowledgeOrchestrator({
      baseUrl: "https://example.com",
      defaultVersion: "2025-06-18",
      cacheDir: createTempDir(),
      defaultTtlMs: 1,
    });

    await orchestrator.get({ section: "handshake", fallbackToCache: true });
    const result = await orchestrator.get({
      section: "handshake",
      maxStaleness: 0,
      fallbackToCache: true,
    });

    expect(result.source).toBe("cache");
    expect(result.fresh).toBe(false);
    expect(result.content.content).toBe("fresh");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent fetches for the same section", async () => {
    mockFetch.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return mockSpec("resources", "2025-06-18", "payload");
    });

    const orchestrator = createKnowledgeOrchestrator({
      baseUrl: "https://example.com",
      defaultVersion: "2025-06-18",
      cacheDir: createTempDir(),
      defaultTtlMs: 60_000,
    });

    const requests = [
      orchestrator.get({
        section: "resources",
        maxStaleness: 0,
        fallbackToCache: true,
      }),
      orchestrator.get({
        section: "resources",
        maxStaleness: 0,
        fallbackToCache: true,
      }),
    ];

    const [first, second] = await Promise.all(requests);

    if (!first || !second) throw new Error("Requests failed");

    expect(first.content.content).toBe("payload");
    expect(second.content.content).toBe("payload");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
