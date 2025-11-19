/**
 * LRU Cache Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { LRUCache, createCacheKey } from "../../src/utils/lru-cache.js";

describe("LRUCache", () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({ maxSize: 3, ttl: 1000 });
  });

  describe("basic operations", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return undefined for non-existent keys", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should delete values", () => {
      cache.set("key1", "value1");
      expect(cache.delete("key1")).toBe(true);
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should check if key exists", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
    });

    it("should clear all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get("key1")).toBeUndefined();
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used item when full", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      // Cache is now full (maxSize: 3)
      expect(cache.size).toBe(3);

      // Adding a 4th item should evict key1 (least recently used)
      cache.set("key4", "value4");

      expect(cache.size).toBe(3);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("should update LRU order on access", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      // Access key1, making it most recently used
      cache.get("key1");

      // Add key4, should evict key2 (now least recently used)
      cache.set("key4", "value4");

      expect(cache.get("key1")).toBe("value1"); // Still exists
      expect(cache.get("key2")).toBeUndefined(); // Evicted
      expect(cache.get("key3")).toBe("value3");
      expect(cache.get("key4")).toBe("value4");
    });

    it("should call onEvict callback", () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>({
        maxSize: 2,
        ttl: 1000,
        onEvict,
      });

      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3"); // Triggers eviction

      expect(onEvict).toHaveBeenCalledWith("key1", "value1");
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      const shortCache = new LRUCache<string>({
        maxSize: 10,
        ttl: 50, // 50ms TTL
      });

      shortCache.set("key1", "value1");
      expect(shortCache.get("key1")).toBe("value1");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(shortCache.get("key1")).toBeUndefined();
    });

    it("should not return expired entries in has()", async () => {
      const shortCache = new LRUCache<string>({
        maxSize: 10,
        ttl: 50,
      });

      shortCache.set("key1", "value1");
      expect(shortCache.has("key1")).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(shortCache.has("key1")).toBe(false);
    });

    it("should cleanup expired entries", async () => {
      const shortCache = new LRUCache<string>({
        maxSize: 10,
        ttl: 50,
      });

      shortCache.set("key1", "value1");
      shortCache.set("key2", "value2");
      shortCache.set("key3", "value3");

      expect(shortCache.size).toBe(3);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const cleaned = shortCache.cleanup();
      expect(cleaned).toBe(3);
      expect(shortCache.size).toBe(0);
    });
  });

  describe("getOrFetch", () => {
    it("should fetch value if not cached", async () => {
      const fetcher = vi.fn(async () => "fetched-value");

      const result = await cache.getOrFetch("key1", fetcher);

      expect(result).toBe("fetched-value");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("should return cached value without fetching", async () => {
      const fetcher = vi.fn(async () => "fetched-value");

      cache.set("key1", "cached-value");
      const result = await cache.getOrFetch("key1", fetcher);

      expect(result).toBe("cached-value");
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("should cache fetched value", async () => {
      const fetcher = vi.fn(async () => "fetched-value");

      await cache.getOrFetch("key1", fetcher);
      const result = await cache.getOrFetch("key1", fetcher);

      expect(result).toBe("fetched-value");
      expect(fetcher).toHaveBeenCalledTimes(1); // Only called once
    });

    it("should deduplicate concurrent fetches", async () => {
      const fetcher = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "deduped-value";
      });

      const [valueA, valueB] = await Promise.all([
        cache.getOrFetch("key-dedupe", fetcher),
        cache.getOrFetch("key-dedupe", fetcher),
      ]);

      expect(valueA).toBe("deduped-value");
      expect(valueB).toBe("deduped-value");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe("statistics", () => {
    it("should track hits and misses", () => {
      cache.set("key1", "value1");

      cache.get("key1"); // Hit
      cache.get("key2"); // Miss
      cache.get("key1"); // Hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it("should reset stats on clear", () => {
      cache.set("key1", "value1");
      cache.get("key1");
      cache.get("key2");

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("utility methods", () => {
    it("should return all keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const keys = cache.keys();
      expect(keys).toEqual(["key1", "key2"]);
    });

    it("should return all values", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const values = cache.values();
      expect(values).toEqual(["value1", "value2"]);
    });

    it("should export to JSON", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const json = cache.toJSON();
      expect(json.size).toBe(2);
      expect(json.maxSize).toBe(3);
      expect(json.entries).toHaveLength(2);
      expect(json.stats.hits).toBeDefined();
    });
  });

  describe("complex data types", () => {
    it("should handle objects", () => {
      const objCache = new LRUCache<{ name: string; age: number }>({
        maxSize: 5,
        ttl: 1000,
      });

      const obj = { name: "Alice", age: 30 };
      objCache.set("user1", obj);

      expect(objCache.get("user1")).toEqual(obj);
    });

    it("should handle arrays", () => {
      const arrCache = new LRUCache<number[]>({ maxSize: 5, ttl: 1000 });

      arrCache.set("numbers", [1, 2, 3, 4, 5]);

      expect(arrCache.get("numbers")).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe("createCacheKey", () => {
  it("should create consistent keys for same arguments", () => {
    const key1 = createCacheKey("search", { query: "test", limit: 10 });
    const key2 = createCacheKey("search", { query: "test", limit: 10 });

    expect(key1).toBe(key2);
  });

  it("should create different keys for different arguments", () => {
    const key1 = createCacheKey("search", { query: "test", limit: 10 });
    const key2 = createCacheKey("search", { query: "test", limit: 20 });

    expect(key1).not.toBe(key2);
  });

  it("should handle multiple arguments", () => {
    const key = createCacheKey("method", "arg1", 42, { nested: true });
    expect(key).toBe(JSON.stringify(["method", "arg1", 42, { nested: true }]));
  });
});
