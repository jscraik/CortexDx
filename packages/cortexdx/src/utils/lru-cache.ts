/**
 * LRU (Least Recently Used) Cache Implementation
 * High-performance caching with automatic eviction and TTL support
 */

export interface CacheOptions {
  /**
   * Maximum number of items to store in cache
   * @default 1000
   */
  maxSize?: number;

  /**
   * Time-to-live in milliseconds
   * Items expire after this duration
   * @default 300000 (5 minutes)
   */
  ttl?: number;

  /**
   * Optional callback when items are evicted
   */
  onEvict?: (key: string, value: unknown) => void;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * Generic LRU Cache with TTL support
 */
export class LRUCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly onEvict?: (key: string, value: unknown) => void;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.onEvict = options.onEvict;
  }

  /**
   * Get value from cache
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Update access count and move to end (most recently used)
    entry.accessCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   * Evicts least recently used item if cache is full
   */
  set(key: string, value: T): void {
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const evicted = this.cache.get(oldestKey);
        if (this.onEvict && evicted) {
          this.onEvict(oldestKey, evicted.value);
        }
        this.cache.delete(oldestKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? this.hits / (this.hits + this.misses)
        : 0,
    };
  }

  /**
   * Get or compute value
   * If key exists and is not expired, returns cached value
   * Otherwise, calls fetcher and caches result
   */
  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const fresh = await fetcher();
    this.set(key, fresh);
    return fresh;
  }

  /**
   * Cleanup expired entries
   * Call this periodically to prevent memory leaks
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in cache
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * Export cache state for debugging
   */
  toJSON() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      stats: this.getStats(),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
      })),
    };
  }
}

/**
 * Create a cache key from arguments
 * Useful for caching function results based on parameters
 */
export function createCacheKey(...args: unknown[]): string {
  return JSON.stringify(args);
}

/**
 * Cache decorator for async functions
 * Automatically caches function results based on arguments
 */
export function cached<T>(
  cache: LRUCache<T>,
  keyFn?: (...args: unknown[]) => string
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const key = keyFn ? keyFn(...args) : createCacheKey(...args);
      return cache.getOrFetch(key, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Example usage:
 *
 * // Simple cache
 * const cache = new LRUCache<string>({ maxSize: 100, ttl: 60000 });
 * cache.set('key', 'value');
 * const value = cache.get('key');
 *
 * // With getOrFetch
 * const result = await cache.getOrFetch('api-key', async () => {
 *   return await fetch('/api/data').then(r => r.json());
 * });
 *
 * // Get statistics
 * console.log(cache.getStats());
 * // { size: 1, maxSize: 100, hits: 5, misses: 2, hitRate: 0.71 }
 */
