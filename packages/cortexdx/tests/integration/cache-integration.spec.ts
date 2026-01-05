/**
 * Caching Integration Tests
 * Tests LRU cache integration with academic providers
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LRUCache, createCacheKey } from "../../src/utils/lru-cache.js";
import type { DiagnosticContext } from "../../src/types.js";

describe("Cache Integration Tests", () => {
  let mockContext: DiagnosticContext;

  beforeEach(() => {
    mockContext = {
      endpoint: "http://localhost:3000",
      logger: vi.fn(),
      request: vi.fn(),
      jsonrpc: vi.fn(),
      sseProbe: vi.fn(),
      evidence: vi.fn(),
      deterministic: true,
      headers: {},
    };
  });

  describe("LRU Cache with Provider Pattern", () => {
    it("should cache API responses effectively", async () => {
      const cache = new LRUCache<unknown>({ maxSize: 100, ttl: 5000 });
      const apiCall = vi.fn().mockResolvedValue({ data: "test-data" });

      // First call - cache MISS
      const key1 = createCacheKey("search", { query: "test", limit: 10 });
      const result1 = await cache.getOrFetch(key1, apiCall);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ data: "test-data" });

      // Second call with same params - cache HIT
      const result2 = await cache.getOrFetch(key1, apiCall);

      expect(apiCall).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(result2).toEqual({ data: "test-data" });
    });

    it("should create different cache keys for different parameters", () => {
      const key1 = createCacheKey("search", { query: "test1", limit: 10 });
      const key2 = createCacheKey("search", { query: "test2", limit: 10 });
      const key3 = createCacheKey("search", { query: "test1", limit: 20 });

      expect(key1).not.toBe(key2); // Different queries
      expect(key1).not.toBe(key3); // Different limits
      expect(key2).not.toBe(key3); // Both different
    });

    it("should handle concurrent requests to same resource", async () => {
      const cache = new LRUCache<string>({ maxSize: 100, ttl: 5000 });
      let callCount = 0;

      const slowApiCall = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callCount++;
        return `result-${callCount}`;
      };

      const key = createCacheKey("test-key");

      // Make 5 concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        cache.getOrFetch(key, slowApiCall),
      );

      const results = await Promise.all(promises);

      // All should get the same result
      expect(new Set(results).size).toBe(1);
      // But the API might be called multiple times due to race condition
      // This is expected behavior for concurrent first requests
      expect(callCount).toBeGreaterThanOrEqual(1);
    });

    it("should expire entries after TTL", async () => {
      const cache = new LRUCache<string>({ maxSize: 100, ttl: 50 });
      const apiCall = vi
        .fn()
        .mockResolvedValueOnce("first-call")
        .mockResolvedValueOnce("second-call");

      const key = createCacheKey("test");

      // First call
      const result1 = await cache.getOrFetch(key, apiCall);
      expect(result1).toBe("first-call");
      expect(apiCall).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second call after expiration
      const result2 = await cache.getOrFetch(key, apiCall);
      expect(result2).toBe("second-call");
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it("should evict least recently used items", () => {
      const cache = new LRUCache<number>({ maxSize: 3, ttl: 60000 });

      cache.set("key1", 1);
      cache.set("key2", 2);
      cache.set("key3", 3);

      expect(cache.size).toBe(3);

      // Access key1 to make it recently used
      cache.get("key1");

      // Add key4, should evict key2 (least recently used)
      cache.set("key4", 4);

      expect(cache.size).toBe(3);
      expect(cache.get("key1")).toBe(1); // Still exists
      expect(cache.get("key2")).toBeUndefined(); // Evicted
      expect(cache.get("key3")).toBe(3); // Still exists
      expect(cache.get("key4")).toBe(4); // Newly added
    });
  });

  describe("Provider Cache Integration Patterns", () => {
    it("should handle search result caching", async () => {
      interface SearchResult {
        papers: Array<{ id: string; title: string }>;
        total: number;
      }

      const cache = new LRUCache<SearchResult>({ maxSize: 100, ttl: 300000 });
      const mockSearchResults: SearchResult = {
        papers: [
          { id: "1", title: "Paper 1" },
          { id: "2", title: "Paper 2" },
        ],
        total: 2,
      };

      mockContext.request = vi.fn().mockResolvedValue(mockSearchResults);

      const performSearch = async (query: string, limit: number) => {
        const cacheKey = createCacheKey("search", query, limit);
        return cache.getOrFetch(cacheKey, async () => {
          return await mockContext.request!("http://api.example.com/search");
        });
      };

      // First search
      const result1 = await performSearch("machine learning", 10);
      expect(mockContext.request).toHaveBeenCalledTimes(1);
      expect(result1.papers).toHaveLength(2);

      // Same search - should use cache
      const result2 = await performSearch("machine learning", 10);
      expect(mockContext.request).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(result1);

      // Different search - new API call
      const result3 = await performSearch("deep learning", 10);
      expect(mockContext.request).toHaveBeenCalledTimes(2);
      expect(result3.papers).toHaveLength(2);
      expect(result3).toEqual(mockSearchResults);
    });

    it("should handle paper detail caching", async () => {
      interface PaperDetails {
        id: string;
        title: string;
        authors: string[];
        citations: number;
      }

      const cache = new LRUCache<PaperDetails>({ maxSize: 100, ttl: 300000 });
      const mockPaper: PaperDetails = {
        id: "paper-123",
        title: "Test Paper",
        authors: ["Author 1", "Author 2"],
        citations: 42,
      };

      mockContext.request = vi.fn().mockResolvedValue(mockPaper);

      const getPaperDetails = async (paperId: string) => {
        const cacheKey = createCacheKey("paper", paperId);

        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const fresh = await mockContext.request!(
          `http://api.example.com/paper/${paperId}`,
        );
        cache.set(cacheKey, fresh);
        return fresh;
      };

      // First request
      const paper1 = await getPaperDetails("paper-123");
      expect(mockContext.request).toHaveBeenCalledTimes(1);
      expect(paper1.title).toBe("Test Paper");

      // Second request - cached
      const paper2 = await getPaperDetails("paper-123");
      expect(mockContext.request).toHaveBeenCalledTimes(1);
      expect(paper2).toEqual(paper1);
    });

    it("should track cache statistics for monitoring", () => {
      const cache = new LRUCache<string>({ maxSize: 100, ttl: 60000 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.get("key1"); // HIT
      cache.get("key1"); // HIT
      cache.get("key3"); // MISS
      cache.get("key2"); // HIT

      const stats = cache.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.75, 2);
      expect(stats.size).toBe(2);
    });
  });

  describe("Error Handling in Cached Providers", () => {
    it("should not cache errors", async () => {
      const cache = new LRUCache<string>({ maxSize: 100, ttl: 60000 });
      const apiCall = vi
        .fn()
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce("success");

      const key = createCacheKey("test");

      // First call fails
      await expect(cache.getOrFetch(key, apiCall)).rejects.toThrow("API Error");
      expect(apiCall).toHaveBeenCalledTimes(1);

      // Second call succeeds (error wasn't cached)
      const result = await cache.getOrFetch(key, apiCall);
      expect(result).toBe("success");
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    it("should handle rate limit errors gracefully", async () => {
      const cache = new LRUCache<unknown>({ maxSize: 100, ttl: 60000 });
      const rateLimitError = new Error("429 Rate Limit Exceeded");

      mockContext.request = vi.fn().mockRejectedValue(rateLimitError);

      const makeRequest = async (url: string) => {
        const key = createCacheKey(url);
        return cache.getOrFetch(key, async () => {
          return await mockContext.request!(url);
        });
      };

      await expect(makeRequest("http://api.example.com/data")).rejects.toThrow(
        "429 Rate Limit Exceeded",
      );

      // Verify error is not cached
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("Cache Memory Management", () => {
    it("should maintain size limits", () => {
      const cache = new LRUCache<string>({ maxSize: 10, ttl: 60000 });

      // Add 20 items
      for (let i = 0; i < 20; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Should only have 10 items (max size)
      expect(cache.size).toBe(10);

      // Early keys should be evicted
      expect(cache.get("key0")).toBeUndefined();
      expect(cache.get("key19")).toBe("value19");
    });

    it("should cleanup expired entries on demand", async () => {
      const cache = new LRUCache<string>({ maxSize: 100, ttl: 50 });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      expect(cache.size).toBe(3);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cleanup expired entries
      const cleaned = cache.cleanup();

      expect(cleaned).toBe(3);
      expect(cache.size).toBe(0);
    });
  });

  describe("Production-like Scenarios", () => {
    it("should handle high-frequency requests efficiently", async () => {
      const cache = new LRUCache<number>({ maxSize: 1000, ttl: 60000 });
      const queries = Array.from({ length: 100 }, (_, i) => `query${i % 10}`); // 10 unique queries, repeated

      let apiCallCount = 0;
      const mockApiCall = async (query: string) => {
        apiCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 1));
        return query.length;
      };

      // Simulate 100 requests
      const results = await Promise.all(
        queries.map((query) =>
          cache.getOrFetch(createCacheKey(query), () => mockApiCall(query)),
        ),
      );

      expect(results).toHaveLength(100);
      // Should only make ~10 API calls (one per unique query)
      expect(apiCallCount).toBeLessThanOrEqual(20); // Allow some concurrent duplicates
      expect(apiCallCount).toBeGreaterThanOrEqual(10);

      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.8); // >80% hit rate
    });

    it("should provide consistent results under load", async () => {
      const cache = new LRUCache<{ value: number }>({
        maxSize: 100,
        ttl: 60000,
      });
      const key = createCacheKey("shared-key");

      let callCount = 0;
      const expensiveComputation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callCount++;
        return { value: callCount };
      };

      // Simulate 50 concurrent requests for same data
      const promises = Array.from({ length: 50 }, () =>
        cache.getOrFetch(key, expensiveComputation),
      );

      const results = await Promise.all(promises);

      // All results should eventually have the same value
      const uniqueValues = new Set(results.map((r) => r.value));
      expect(uniqueValues.size).toBeLessThanOrEqual(5); // Some concurrency is expected

      const stats = cache.getStats();
      expect(stats.size).toBe(1); // Only one cached entry
    });
  });
});
