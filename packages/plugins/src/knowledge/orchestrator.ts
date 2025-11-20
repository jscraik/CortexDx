import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  CacheStatus,
  KnowledgeOrchestrator,
  KnowledgeRequest,
  KnowledgeResponse,
  SpecContent,
} from "@brainwav/cortexdx-core";
import { LRUCache } from "@brainwav/cortexdx-core/utils/lru-cache";
import { SpecCacheStore, type CacheEntry } from "./cache-store.js";

interface KnowledgeOrchestratorOptions {
  baseUrl: string;
  defaultVersion: string;
  cacheDir?: string;
  defaultTtlMs?: number;
  fetchTimeoutMs?: number;
  fetcher?: SpecFetcher;
  memoryCacheSize?: number;
}

interface FetchInput {
  section: string;
  version: string;
  url: string;
  etag?: string;
  lastModified?: string;
}

interface FetchResult {
  content?: string;
  metadata?: {
    url: string;
    fetchedAt: number;
    etag?: string;
    lastModified?: string;
  };
  notModified?: boolean;
}

type SpecFetcher = (input: FetchInput) => Promise<FetchResult>;

class KnowledgeOrchestratorImpl implements KnowledgeOrchestrator {
  private readonly defaultVersion: string;
  private readonly defaultTtl: number;
  private readonly cache: LRUCache<CacheEntry>;
  private readonly store: SpecCacheStore;
  private readonly fetcher: SpecFetcher;
  private readonly inflight = new Map<string, Promise<CacheEntry>>();

  constructor(options: KnowledgeOrchestratorOptions) {
    this.defaultVersion = options.defaultVersion;
    this.defaultTtl = options.defaultTtlMs ?? 24 * 60 * 60 * 1000;
    const cacheDir = options.cacheDir ?? path.resolve(process.cwd(), ".cortexdx/knowledge");
    mkdirSync(cacheDir, { recursive: true });
    this.store = new SpecCacheStore(path.join(cacheDir, "cache.db"));
    this.cache = new LRUCache<CacheEntry>({
      maxSize: options.memoryCacheSize ?? 500,
      ttl: this.defaultTtl,
    });
    this.fetcher = options.fetcher ?? createHttpFetcher(options.baseUrl, options.fetchTimeoutMs);
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
      const entry = await this.fetchOrQueue(cacheKey, request.section, version, cached);
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

  async prefetch(sections: string[]): Promise<void> {
    await Promise.all(
      sections.map((section) => this.get({ section, fallbackToCache: true }).catch(() => undefined)),
    );
  }

  async refresh(sections: string[]): Promise<void> {
    for (const section of sections) {
      await this.fetchAndPersist(section, this.defaultVersion, undefined, 0).catch(() => undefined);
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
    section: string,
    version: string,
    cached: CacheEntry | null,
  ): Promise<CacheEntry | null> {
    const pending = this.inflight.get(cacheKey);
    if (pending) {
      return pending;
    }
    const fetchPromise = this.fetchAndPersist(section, version, cached, this.defaultTtl)
      .catch((error) => {
        this.inflight.delete(cacheKey);
        throw error;
      })
      .finally(() => this.inflight.delete(cacheKey));

    this.inflight.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  private async fetchAndPersist(
    section: string,
    version: string,
    cached: CacheEntry | null,
    ttl: number,
  ): Promise<CacheEntry | null> {
    const fetchResult = await this.fetcher({
      section,
      version,
      url: buildSpecUrl(section, version, this.defaultVersion),
      etag: cached?.metadata.etag,
      lastModified: cached?.metadata.lastModified,
    });

    if (fetchResult.notModified && cached) {
      const refreshed = { ...cached, metadata: { ...cached.metadata, fetchedAt: Date.now() } };
      this.save(refreshed);
      return refreshed;
    }

    if (!fetchResult.content || !fetchResult.metadata) {
      return null;
    }

    const entry: CacheEntry = {
      section,
      version,
      content: fetchResult.content,
      metadata: fetchResult.metadata,
      ttl: ttl > 0 ? ttl : this.defaultTtl,
      accessCount: cached?.accessCount ?? 0,
    };

    this.save(entry);
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

function createHttpFetcher(baseUrl: string, timeoutMs = 10_000): SpecFetcher {
  return async (input: FetchInput): Promise<FetchResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        "user-agent": "CortexDx-knowledge/1.0",
      };
      if (input.etag) headers["If-None-Match"] = input.etag;
      if (input.lastModified) headers["If-Modified-Since"] = input.lastModified;

      const response = await fetch(buildRequestUrl(baseUrl, input.url), {
        headers,
        signal: controller.signal,
      });

      if (response.status === 304) {
        return {
          notModified: true,
          metadata: {
            url: buildRequestUrl(baseUrl, input.url),
            fetchedAt: Date.now(),
            etag: input.etag,
            lastModified: input.lastModified,
          },
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const body = await response.text();
      return {
        content: body,
        metadata: {
          url: buildRequestUrl(baseUrl, input.url),
          fetchedAt: Date.now(),
          etag: response.headers.get("etag") ?? undefined,
          lastModified: response.headers.get("last-modified") ?? undefined,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  };
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

function buildRequestUrl(baseUrl: string, pathOnly: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmedBase}${pathOnly}`;
}
