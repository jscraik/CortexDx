import type {
  CacheStatus,
  KnowledgeOrchestrator,
  KnowledgeRequest,
  KnowledgeResponse,
  KnowledgeSearchResult,
  SpecContent,
} from "@brainwav/cortexdx-core";
import { LRUCache } from "@brainwav/cortexdx-core/utils/lru-cache";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { EmbeddingAdapter } from "../adapters/embedding.js";
import type { IVectorStorage } from "../storage/vector-storage.js";
import { SpecCacheStore, type CacheEntry } from "./cache-store.js";
import { createKnowledgeRag } from "./rag/rag.js";
import type { KnowledgeRAG, SearchResult } from "./rag/types.js";
import { HttpTransportAdapter, SseTransportAdapter, WebSocketTransportAdapter } from "./transport/adapters.js";
import { DefaultTransportSelector } from "./transport/selector.js";
import { TransportType, type FetchInput, type FetchResult, type TransportAdapter } from "./transport/types.js";

interface KnowledgeOrchestratorOptions {
  baseUrl: string;
  defaultVersion: string;
  cacheDir?: string;
  defaultTtlMs?: number;
  fetchTimeoutMs?: number;
  memoryCacheSize?: number;
  rag?: {
    storage: IVectorStorage;
    embedding: EmbeddingAdapter;
  };
}

class KnowledgeOrchestratorImpl implements KnowledgeOrchestrator {
  private readonly defaultVersion: string;
  private readonly defaultTtl: number;
  private readonly cache: LRUCache<CacheEntry>;
  private readonly store: SpecCacheStore;
  private readonly inflight = new Map<string, Promise<CacheEntry>>();

  private readonly transportSelector = new DefaultTransportSelector();
  private readonly transports = new Map<TransportType, TransportAdapter>();
  private readonly baseUrl: string;
  private readonly rag?: KnowledgeRAG;

  constructor(options: KnowledgeOrchestratorOptions) {
    this.defaultVersion = options.defaultVersion;
    this.defaultTtl = options.defaultTtlMs ?? 24 * 60 * 60 * 1000;
    this.baseUrl = options.baseUrl;

    const cacheDir = options.cacheDir ?? path.resolve(process.cwd(), ".cortexdx/knowledge");
    mkdirSync(cacheDir, { recursive: true });
    this.store = new SpecCacheStore(path.join(cacheDir, "cache.db"));
    this.cache = new LRUCache<CacheEntry>({
      maxSize: options.memoryCacheSize ?? 500,
      ttl: this.defaultTtl,
    });

    // Initialize transports
    const timeout = options.fetchTimeoutMs ?? 10_000;
    this.transports.set(TransportType.HTTP, new HttpTransportAdapter(options.baseUrl, timeout));
    this.transports.set(TransportType.SSE, new SseTransportAdapter(options.baseUrl, timeout));
    this.transports.set(TransportType.WEBSOCKET, new WebSocketTransportAdapter(options.baseUrl, timeout));

    // Initialize RAG if configured
    if (options.rag) {
      this.rag = createKnowledgeRag({
        storage: options.rag.storage,
        embedding: options.rag.embedding,
      });
    }
  }

  async get(request: KnowledgeRequest): Promise<KnowledgeResponse> {
    const version = request.version ?? this.defaultVersion;
    const maxAge = request.maxStaleness ?? this.defaultTtl;
    const cacheKey = makeKey(version, request.section);
    const cached = await this.loadFromCache(cacheKey);

    if (cached && isFresh(cached, maxAge)) {
      return toResponse(cached, "cache", maxAge);
    }

    try {
      const entry = await this.fetchOrQueue(cacheKey, request, version, cached);
      if (entry) {
        return toResponse(entry, cached && entry === cached ? "cache" : "fetch", maxAge);
      }
    } catch (error) {
      if (request.fallbackToCache !== false && cached) {
        return toResponse(cached, "cache", maxAge, false);
      }
      throw error;
    }

    if (request.fallbackToCache !== false && cached) {
      return toResponse(cached, "cache", maxAge, false);
    }

    throw new Error(`Unable to load section ${request.section} (${version})`);
  }

  async search(query: string, options?: { limit?: number; minSimilarity?: number }): Promise<KnowledgeSearchResult[]> {
    if (!this.rag) {
      return [];
    }
    const results = await this.rag.search(query, options);
    return results.map((r: SearchResult) => ({
      chunk: r.chunk,
      similarity: r.similarity,
      rank: r.rank
    }));
  }

  async prefetch(sections: string[]): Promise<void> {
    await Promise.all(
      sections.map((section) => this.get({ section, fallbackToCache: true }).catch(() => undefined)),
    );
  }

  async refresh(sections: string[]): Promise<void> {
    for (const section of sections) {
      // Create a dummy request for refresh
      const request: KnowledgeRequest = { section, version: this.defaultVersion, fallbackToCache: false };
      await this.fetchAndPersist(request, this.defaultVersion, undefined, 0).catch(() => undefined);
    }
  }

  async status(): Promise<CacheStatus> {
    const stats = this.cache.getStats();
    const storeStats = this.store.stats();
    const stale = storeStats.sections
      .filter((entry) => entry.age > this.defaultTtl)
      .map((entry) => entry.key);

    return {
      entries: storeStats.entries,
      hitRate: stats.hitRate,
      avgAge: storeStats.avgAge,
      staleSections: stale,
    };
  }

  private async fetchOrQueue(
    cacheKey: string,
    request: KnowledgeRequest,
    version: string,
    cached: CacheEntry | null,
  ): Promise<CacheEntry | null> {
    const pending = this.inflight.get(cacheKey);
    if (pending) {
      return pending;
    }
    const fetchPromise = this.fetchAndPersist(request, version, cached, this.defaultTtl)
      .catch((error) => {
        this.inflight.delete(cacheKey);
        throw error;
      })
      .finally(() => this.inflight.delete(cacheKey));

    this.inflight.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  private async fetchAndPersist(
    request: KnowledgeRequest,
    version: string,
    cached: CacheEntry | null,
    ttl: number,
  ): Promise<CacheEntry | null> {
    // Detect capabilities (cached internally by selector if needed, or we could cache here)
    // For now, we detect on every fetch or rely on selector optimization
    const capabilities = await this.transportSelector.detectCapabilities(this.baseUrl);

    const selectedTransport = this.transportSelector.selectTransport(request, capabilities);

    const fetchInput: FetchInput = {
      section: request.section,
      version,
      url: buildSpecUrl(request.section, version, this.defaultVersion),
      etag: cached?.metadata.etag,
      lastModified: cached?.metadata.lastModified,
    };

    let fetchResult: FetchResult;

    try {
      const adapter = this.transports.get(selectedTransport);
      if (!adapter) throw new Error(`Transport ${selectedTransport} not initialized`);
      fetchResult = await adapter.fetch(fetchInput);
    } catch (e) {
      // Fallback to HTTP if we tried something else and it failed
      if (selectedTransport !== TransportType.HTTP) {
        const httpAdapter = this.transports.get(TransportType.HTTP);
        if (httpAdapter) {
          fetchResult = await httpAdapter.fetch(fetchInput);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }

    if (fetchResult.notModified && cached) {
      const refreshed = { ...cached, metadata: { ...cached.metadata, fetchedAt: Date.now() } };
      this.save(refreshed);
      return refreshed;
    }

    if (!fetchResult.content || !fetchResult.metadata) {
      return null;
    }

    const entry: CacheEntry = {
      section: request.section,
      version,
      content: fetchResult.content,
      metadata: fetchResult.metadata,
      ttl: ttl > 0 ? ttl : this.defaultTtl,
      accessCount: cached?.accessCount ?? 0,
    };

    this.save(entry);

    // Index content in RAG if available
    if (this.rag) {
      // Fire and forget indexing to avoid blocking response
      this.rag.indexSpec({
        section: entry.section,
        version: entry.version,
        content: entry.content,
        metadata: entry.metadata
      }).catch((err: unknown) => {
        // TODO: Log error properly
        console.error(`Failed to index spec section ${entry.section}:`, err);
      });
    }

    return entry;
  }

  private async loadFromCache(cacheKey: string): Promise<CacheEntry | null> {
    const memory = this.cache.get(cacheKey);
    if (memory) {
      return memory;
    }
    const [version, section] = splitKey(cacheKey);
    const entry = this.store.get(section, version);
    if (!entry) return null;
    this.cache.set(cacheKey, entry);
    this.store.touch(section, version);
    return entry;
  }

  private save(entry: CacheEntry): void {
    const key = makeKey(entry.version, entry.section);
    this.cache.set(key, entry);
    this.store.upsert(entry);
  }
}

export function createKnowledgeOrchestrator(
  options: KnowledgeOrchestratorOptions,
): KnowledgeOrchestrator {
  return new KnowledgeOrchestratorImpl(options);
}

function toResponse(entry: CacheEntry, source: "cache" | "fetch", maxAge: number, freshOverride?: boolean): KnowledgeResponse {
  const age = Date.now() - entry.metadata.fetchedAt;
  const fresh = typeof freshOverride === "boolean" ? freshOverride : age <= maxAge;
  const content: SpecContent = {
    section: entry.section,
    version: entry.version,
    content: entry.content,
    metadata: entry.metadata,
  };
  return { content, source, age, fresh };
}

function isFresh(entry: CacheEntry, maxAge: number): boolean {
  if (maxAge <= 0) return false;
  return Date.now() - entry.metadata.fetchedAt <= maxAge;
}

function makeKey(version: string, section: string): string {
  return `${version}::${section}`;
}

function splitKey(key: string): [string, string] {
  const [version, section] = key.split("::");
  return [version, section];
}

function buildSpecUrl(section: string, version: string, fallbackVersion: string): string {
  const resolvedVersion = version || fallbackVersion;
  return `/specification/${resolvedVersion}/${section}`;
}
