# Knowledge Crawler Specification v1.0

**Status:** Draft  
**Date:** 2025-11-19  
**Target:** CortexDx MCP Documentation & Spec Knowledge System

---

## 1. Overview

### 1.1 Purpose

A hybrid knowledge acquisition system that combines:
- **On-demand fetching** for real-time spec validation
- **Intelligent caching** for performance
- **RAG-enhanced retrieval** for contextual knowledge
- **Multi-version support** for protocol evolution

### 1.2 Industry Standards (Nov 2025)

- **HTTP/2+** with connection pooling
- **ETags & Conditional Requests** (RFC 7232)
- **Semantic versioning** for spec versions
- **OpenTelemetry** for observability
- **Vector embeddings** (1536-dim, cosine similarity)
- **SQLite FTS5** for full-text search
- **JSON-LD** for structured metadata

---

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Layer                          │
│  (Diagnostic Plugins, Self-Healing, Validation)         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Knowledge Orchestrator                      │
│  • Query routing                                         │
│  • Cache strategy                                        │
│  • Fallback handling                                     │
└──┬──────────────┬──────────────┬────────────────────────┘
   │              │              │
   ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│On-Demand │  │  Cache   │  │ RAG Pipeline │
│ Fetcher  │  │  Layer   │  │  (Semantic)  │
└──────────┘  └──────────┘  └──────────────┘
   │              │              │
   └──────────────┴──────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Storage Layer   │
         │ • Vector DB     │
         │ • SQLite FTS    │
         │ • File Cache    │
         └─────────────────┘
```

### 2.2 Data Flow

```typescript
// Agent requests knowledge
const spec = await ctx.knowledge.get({
  section: "authentication",
  maxStaleness: 3600000,  // 1 hour
  fallbackToCache: true
});

// Orchestrator decides:
// 1. Check cache validity
// 2. Fetch on-demand if stale
// 3. Fallback to cached if fetch fails
// 4. Update vector embeddings async
```

---

## 3. Core Capabilities

### 3.1 On-Demand Fetching

**Requirements:**
- ✅ Agent-triggered fetch
- ✅ < 5s latency for fresh fetch
- ✅ < 500ms for cached content
- ✅ Graceful degradation on failure
- ✅ Concurrent request deduplication

**Implementation:**

```typescript
interface OnDemandFetcher {
  /**
   * Fetch spec content with cache-aware strategy
   * @param request - Fetch request with staleness tolerance
   * @returns Spec content with metadata
   */
  fetch(request: FetchRequest): Promise<SpecContent>;
  
  /**
   * Batch fetch multiple sections
   * @param sections - Array of section identifiers
   * @returns Map of section to content
   */
  fetchBatch(sections: string[]): Promise<Map<string, SpecContent>>;
  
  /**
   * Prefetch sections for cache warming
   * @param sections - Sections to prefetch
   */
  prefetch(sections: string[]): Promise<void>;
}

interface FetchRequest {
  section: string;           // e.g., "authentication"
  version?: string;          // Specific version or "latest"
  maxStaleness?: number;     // Max age in ms (default: 3600000)
  fallbackToCache: boolean;  // Use cache if fetch fails
  priority?: "high" | "normal" | "low";
}

interface SpecContent {
  section: string;
  version: string;
  content: string;
  metadata: {
    url: string;
    fetchedAt: number;
    etag?: string;
    lastModified?: string;
  };
}
```

**Best Practices:**
- Use **HTTP/2 multiplexing** for parallel fetches
- Implement **request coalescing** (dedupe concurrent requests)
- Apply **exponential backoff** on failures
- Track **fetch metrics** (latency, cache hit rate)

---

### 3.2 Intelligent Caching

**Strategy:** Multi-tier cache with TTL and validation

```typescript
interface CacheStrategy {
  // L1: In-memory (hot data, < 1MB)
  memory: LRUCache<string, SpecContent>;
  
  // L2: SQLite (warm data, < 100MB)
  sqlite: SQLiteCache;
  
  // L3: File system (cold data, unlimited)
  filesystem: FileCache;
}

interface CacheEntry {
  key: string;
  value: SpecContent;
  ttl: number;              // Time-to-live in ms
  etag?: string;            // For conditional requests
  lastValidated: number;    // Last validation timestamp
  accessCount: number;      // For LRU eviction
}
```

**TTL Policies:**
- **Spec sections:** 24 hours (stable content)
- **Changelog:** 6 hours (frequently updated)
- **GitHub repos:** 12 hours (moderate change rate)
- **Examples:** 7 days (rarely change)

**Validation:**
- Use **ETags** for conditional GET (HTTP 304)
- Validate on access if > 50% of TTL elapsed
- Background refresh at 80% of TTL

---

### 3.3 RAG Integration

**Purpose:** Semantic search over spec knowledge

```typescript
interface RAGPipeline {
  /**
   * Semantic search across spec content
   * @param query - Natural language query
   * @param options - Search options
   * @returns Ranked results with similarity scores
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  /**
   * Index new content for semantic search
   * @param content - Spec content to index
   */
  index(content: SpecContent): Promise<void>;
  
  /**
   * Hybrid search (semantic + keyword)
   * @param query - Search query
   * @returns Combined results
   */
  hybridSearch(query: string): Promise<SearchResult[]>;
}

interface SearchOptions {
  topK?: number;              // Max results (default: 5)
  minSimilarity?: number;     // Min cosine similarity (default: 0.6)
  version?: string;           // Filter by spec version
  sections?: string[];        // Filter by sections
  rerank?: boolean;           // Apply reranking (default: true)
}

interface SearchResult {
  content: string;
  section: string;
  version: string;
  similarity: number;         // Cosine similarity [0-1]
  rank: number;               // Final rank after reranking
  metadata: {
    url: string;
    title: string;
    headings: string[];
  };
}
```

**Embedding Strategy:**
- **Model:** `text-embedding-3-small` (OpenAI) or `nomic-embed-text` (local)
- **Dimensions:** 1536 (OpenAI) or 768 (Nomic)
- **Chunking:** 512 tokens with 50-token overlap
- **Normalization:** L2 normalization for cosine similarity

**Hybrid Search:**
```typescript
// Combine semantic + keyword search
const results = await rag.hybridSearch("OAuth 2.1 flow");

// Weights: 70% semantic, 30% keyword
const finalScore = 0.7 * semanticScore + 0.3 * keywordScore;
```

---

### 3.4 Version Management

**Requirements:**
- Support multiple spec versions simultaneously
- Auto-detect latest version
- Version-specific queries
- Migration assistance

```typescript
interface VersionManager {
  /**
   * Get latest spec version
   * @returns Latest version identifier
   */
  getLatestVersion(): Promise<string>;
  
  /**
   * List all available versions
   * @returns Array of version identifiers
   */
  listVersions(): Promise<string[]>;
  
  /**
   * Compare two spec versions
   * @param v1 - First version
   * @param v2 - Second version
   * @returns Diff summary
   */
  compareVersions(v1: string, v2: string): Promise<VersionDiff>;
  
  /**
   * Recommend version for server
   * @param serverInfo - Server metadata
   * @returns Recommended spec version
   */
  recommendVersion(serverInfo: ServerInfo): Promise<string>;
}

interface VersionDiff {
  added: string[];      // New sections
  removed: string[];    // Deprecated sections
  modified: string[];   // Changed sections
  breaking: boolean;    // Has breaking changes
}
```

**Version Format:** `YYYY-MM-DD` (e.g., `2025-06-18`)

---

### 3.5 Baseline vs. Spec Rules

**Classification System:**

```typescript
enum CheckType {
  BASELINE = "baseline",        // Stable, never changes
  SPEC_DEPENDENT = "spec"       // May evolve with spec
}

interface DiagnosticCheck {
  id: string;
  type: CheckType;
  specSection?: string;         // Required if type=SPEC_DEPENDENT
  
  // Baseline checks: hardcoded validation
  validate?(ctx: DiagnosticContext): Promise<Finding[]>;
  
  // Spec checks: fetch latest requirements
  validateAgainstSpec?(
    ctx: DiagnosticContext,
    spec: SpecContent
  ): Promise<Finding[]>;
}
```

**Examples:**

```typescript
// BASELINE: Structural requirements (never change)
const baselineChecks = [
  "handshake.initialize.required",
  "security.https.required",
  "jsonrpc.version.2.0",
  "response.structure.valid"
];

// SPEC_DEPENDENT: May evolve with spec
const specChecks = [
  "handshake.protocol.version",      // Spec: supported versions
  "capabilities.tools.schema",       // Spec: tool schema format
  "authentication.oauth.flow",       // Spec: OAuth requirements
  "resources.uri.format"             // Spec: URI conventions
];
```

---

### 3.6 Transport Selection Logic

**Purpose:** Intelligently select the optimal transport mechanism for fetching spec knowledge based on content characteristics, latency requirements, and server capabilities.

```typescript
enum TransportType {
  HTTP = "http",           // Standard request/response
  SSE = "sse",            // Server-Sent Events (streaming)
  WEBSOCKET = "websocket" // Bi-directional streaming
}

interface TransportSelector {
  /**
   * Select optimal transport for a fetch request
   * @param request - Knowledge fetch request
   * @param capabilities - Server transport capabilities
   * @returns Selected transport type
   */
  selectTransport(
    request: KnowledgeRequest,
    capabilities: ServerCapabilities
  ): TransportType;
  
  /**
   * Detect server transport capabilities
   * @param endpoint - Server endpoint
   * @returns Available transports
   */
  detectCapabilities(endpoint: string): Promise<ServerCapabilities>;
}

interface ServerCapabilities {
  http: boolean;
  sse: boolean;
  websocket: boolean;
  http2: boolean;
  http3: boolean;
}
```

**Selection Strategy:**

```typescript
// Decision tree for transport selection
function selectTransport(
  request: KnowledgeRequest,
  capabilities: ServerCapabilities
): TransportType {
  // 1. Static content (specs, docs) → HTTP
  if (isStaticContent(request.section)) {
    return TransportType.HTTP;
  }
  
  // 2. Real-time updates (changelog, live specs) → SSE
  if (requiresRealTimeUpdates(request.section) && capabilities.sse) {
    return TransportType.SSE;
  }
  
  // 3. Interactive queries (search, RAG) → WebSocket
  if (isInteractiveQuery(request) && capabilities.websocket) {
    return TransportType.WEBSOCKET;
  }
  
  // 4. Default fallback → HTTP
  return TransportType.HTTP;
}
```

**Content Type Classification:**

| Content Type | Transport | Rationale |
|--------------|-----------|-----------|
| Spec sections (auth, handshake) | HTTP | Static, cacheable, infrequent updates |
| Changelog | SSE | Real-time updates, append-only |
| Examples | HTTP | Static, rarely change |
| GitHub repos | HTTP | Periodic updates, cacheable |
| Search queries | HTTP | Request/response pattern |
| RAG streaming | SSE | Incremental results |
| Live spec validation | WebSocket | Bi-directional, interactive |

**Transport-Specific Optimizations:**

```typescript
// HTTP Transport
interface HttpTransportConfig {
  http2: boolean;              // Enable HTTP/2 multiplexing
  keepAlive: boolean;          // Connection pooling
  maxConnections: number;      // Connection limit
  compression: boolean;        // gzip/brotli
  conditionalRequests: boolean; // ETags, If-Modified-Since
}

// SSE Transport
interface SseTransportConfig {
  reconnect: boolean;          // Auto-reconnect on disconnect
  reconnectDelay: number;      // Delay between reconnects (ms)
  lastEventId: boolean;        // Resume from last event
  heartbeat: number;           // Heartbeat interval (ms)
}

// WebSocket Transport
interface WebSocketTransportConfig {
  pingInterval: number;        // Keep-alive ping (ms)
  maxFrameSize: number;        // Max message size
  compression: boolean;        // Per-message deflate
  subprotocol?: string;        // WebSocket subprotocol
}
```

**Fallback Strategy:**

```typescript
// Graceful degradation
const TRANSPORT_FALLBACK_CHAIN = [
  TransportType.WEBSOCKET,  // Most capable
  TransportType.SSE,        // Streaming only
  TransportType.HTTP        // Always available
];

async function fetchWithFallback(
  request: KnowledgeRequest,
  capabilities: ServerCapabilities
): Promise<SpecContent> {
  for (const transport of TRANSPORT_FALLBACK_CHAIN) {
    if (isSupported(transport, capabilities)) {
      try {
        return await fetchViaTransport(request, transport);
      } catch (error) {
        logger.warn(`Transport ${transport} failed, trying next`, { error });
        continue;
      }
    }
  }
  throw new Error("All transports failed");
}
```

**Performance Characteristics:**

| Transport | Latency | Throughput | Overhead | Use Case |
|-----------|---------|------------|----------|----------|
| HTTP/2 | Low (50-200ms) | High | Low | Bulk fetches, static content |
| SSE | Medium (100-500ms) | Medium | Medium | Real-time updates, streaming |
| WebSocket | Very Low (10-50ms) | Very High | High | Interactive, bi-directional |

**Implementation Example:**

```typescript
class AdaptiveKnowledgeFetcher implements OnDemandFetcher {
  private transports: Map<TransportType, TransportAdapter>;
  private selector: TransportSelector;
  
  async fetch(request: FetchRequest): Promise<SpecContent> {
    // Detect server capabilities (cached)
    const capabilities = await this.selector.detectCapabilities(
      request.endpoint
    );
    
    // Select optimal transport
    const transport = this.selector.selectTransport(
      request,
      capabilities
    );
    
    // Fetch via selected transport with fallback
    return this.fetchWithFallback(request, transport, capabilities);
  }
  
  private async fetchWithFallback(
    request: FetchRequest,
    preferredTransport: TransportType,
    capabilities: ServerCapabilities
  ): Promise<SpecContent> {
    const adapter = this.transports.get(preferredTransport);
    
    try {
      return await adapter.fetch(request);
    } catch (error) {
      // Fallback to HTTP
      if (preferredTransport !== TransportType.HTTP) {
        logger.warn(`Falling back to HTTP`, { error });
        return this.transports.get(TransportType.HTTP).fetch(request);
      }
      throw error;
    }
  }
}
```

**Capability Detection:**

```typescript
async function detectCapabilities(
  endpoint: string
): Promise<ServerCapabilities> {
  const capabilities: ServerCapabilities = {
    http: true,  // Always assume HTTP
    sse: false,
    websocket: false,
    http2: false,
    http3: false,
  };
  
  // 1. Check HTTP version via ALPN
  try {
    const response = await fetch(endpoint, { method: "HEAD" });
    const protocol = response.headers.get("x-protocol-version");
    capabilities.http2 = protocol?.includes("h2") ?? false;
    capabilities.http3 = protocol?.includes("h3") ?? false;
  } catch {}
  
  // 2. Check SSE support via Accept header
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "text/event-stream" }
    });
    capabilities.sse = response.headers
      .get("content-type")
      ?.includes("text/event-stream") ?? false;
  } catch {}
  
  // 3. Check WebSocket via Upgrade header
  try {
    const wsUrl = endpoint.replace(/^http/, "ws");
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        capabilities.websocket = true;
        ws.close();
        resolve(true);
      };
      ws.onerror = reject;
      setTimeout(reject, 1000);
    });
  } catch {}
  
  return capabilities;
}
```

**Monitoring & Metrics:**

```typescript
// Track transport performance
interface TransportMetrics {
  transport: TransportType;
  requests: number;
  failures: number;
  avgLatency: number;
  p95Latency: number;
  bytesTransferred: number;
}

// Adaptive selection based on metrics
class MetricsBasedSelector implements TransportSelector {
  selectTransport(
    request: KnowledgeRequest,
    capabilities: ServerCapabilities
  ): TransportType {
    const metrics = this.getMetrics();
    
    // Prefer transport with best performance
    const ranked = metrics
      .filter(m => capabilities[m.transport])
      .sort((a, b) => {
        const scoreA = this.calculateScore(a);
        const scoreB = this.calculateScore(b);
        return scoreB - scoreA;
      });
    
    return ranked[0]?.transport ?? TransportType.HTTP;
  }
  
  private calculateScore(metrics: TransportMetrics): number {
    const successRate = 1 - (metrics.failures / metrics.requests);
    const latencyScore = 1000 / metrics.avgLatency;
    return successRate * 0.7 + latencyScore * 0.3;
  }
}
```

---

## 4. Performance Requirements

### 4.1 Latency Targets

| Operation | Target | P95 | P99 |
|-----------|--------|-----|-----|
| Cache hit (memory) | < 10ms | < 20ms | < 50ms |
| Cache hit (SQLite) | < 100ms | < 200ms | < 500ms |
| Fresh fetch (HTTP) | < 2s | < 5s | < 10s |
| Semantic search | < 500ms | < 1s | < 2s |
| Batch fetch (5 sections) | < 5s | < 10s | < 15s |

### 4.2 Throughput

- **Concurrent fetches:** 10+ simultaneous requests
- **Cache capacity:** 1000+ entries (memory), 10,000+ (SQLite)
- **Search throughput:** 100+ queries/second

### 4.3 Reliability

- **Cache hit rate:** > 80% for repeated queries
- **Fetch success rate:** > 99% (with retries)
- **Graceful degradation:** 100% (always fallback to cache)

---

## 5. Data Model

### 5.1 Storage Schema

```sql
-- Spec content cache
CREATE TABLE spec_cache (
  section TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL,
  etag TEXT,
  last_modified TEXT,
  fetched_at INTEGER NOT NULL,
  ttl INTEGER NOT NULL,
  access_count INTEGER DEFAULT 0
);

CREATE INDEX idx_version ON spec_cache(version);
CREATE INDEX idx_fetched_at ON spec_cache(fetched_at);

-- Vector embeddings
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  version TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding BLOB NOT NULL,  -- Serialized float array
  metadata TEXT NOT NULL    -- JSON
);

CREATE INDEX idx_section_version ON embeddings(section, version);

-- Full-text search
CREATE VIRTUAL TABLE spec_fts USING fts5(
  section,
  version,
  content,
  tokenize='porter unicode61'
);
```

### 5.2 Manifest Format

```json
{
  "version": "2025-06-18",
  "createdAt": "2025-11-19T22:00:00Z",
  "sources": [
    {
      "id": "spec-authentication",
      "type": "spec",
      "url": "https://modelcontextprotocol.io/specification/2025-06-18/authentication",
      "sha256": "abc123...",
      "chunks": 15,
      "metadata": {
        "title": "Authentication",
        "lastModified": "2025-11-15T10:00:00Z",
        "etag": "\"xyz789\""
      }
    }
  ],
  "stats": {
    "totalSources": 25,
    "totalChunks": 450,
    "totalSize": 2500000
  }
}
```

---

## 6. API Specification

### 6.1 Knowledge Orchestrator API

```typescript
interface KnowledgeOrchestrator {
  /**
   * Get spec content (cache-aware)
   */
  get(request: KnowledgeRequest): Promise<KnowledgeResponse>;
  
  /**
   * Search across spec knowledge
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  /**
   * Check cache status
   */
  status(): Promise<CacheStatus>;
  
  /**
   * Refresh specific sections
   */
  refresh(sections: string[]): Promise<RefreshResult>;
  
  /**
   * Clear cache
   */
  clear(options?: ClearOptions): Promise<void>;
}

interface KnowledgeRequest {
  section: string;
  version?: string;
  maxStaleness?: number;
  fallbackToCache?: boolean;
  priority?: "high" | "normal" | "low";
}

interface KnowledgeResponse {
  content: SpecContent;
  source: "cache" | "fetch";
  age: number;              // Age in ms
  fresh: boolean;           // Within maxStaleness
}

interface CacheStatus {
  entries: number;
  hitRate: number;          // Last 1000 requests
  avgAge: number;           // Average age in ms
  staleSections: string[];  // Sections exceeding TTL
}
```

### 6.2 Diagnostic Context Integration

```typescript
interface DiagnosticContext {
  // Existing properties
  endpoint: string;
  headers: Record<string, string>;
  logger: Logger;
  
  // NEW: Knowledge access
  knowledge: KnowledgeOrchestrator;
}

// Usage in plugins
async run(ctx: DiagnosticContext): Promise<Finding[]> {
  // Fetch latest auth spec
  const authSpec = await ctx.knowledge.get({
    section: "authentication",
    maxStaleness: 3600000,  // 1 hour
    fallbackToCache: true
  });
  
  // Validate against current spec
  return validateAuth(ctx, authSpec);
}
```

---

## 7. Observability

### 7.1 Metrics (OpenTelemetry)

```typescript
// Fetch metrics
const fetchDuration = histogram("knowledge.fetch.duration", {
  unit: "ms",
  description: "Time to fetch spec content"
});

const cacheHitRate = gauge("knowledge.cache.hit_rate", {
  unit: "percent",
  description: "Cache hit rate (last 1000 requests)"
});

const staleSections = gauge("knowledge.stale_sections", {
  unit: "count",
  description: "Number of sections exceeding TTL"
});

// Search metrics
const searchLatency = histogram("knowledge.search.latency", {
  unit: "ms",
  description: "Semantic search latency"
});
```

### 7.2 Logging

```typescript
// Structured logging
logger.info("Fetching spec section", {
  section: "authentication",
  version: "2025-06-18",
  cached: false,
  staleness: 7200000  // 2 hours
});

logger.warn("Spec content is stale", {
  section: "authentication",
  age: 86400000,      // 24 hours
  ttl: 3600000        // 1 hour
});
```

### 7.3 Alerts

- **Stale content:** Alert if > 20% of sections exceed TTL
- **Fetch failures:** Alert if success rate < 95%
- **Cache pressure:** Alert if hit rate < 70%
- **Latency:** Alert if P95 > 10s

---

## 8. Security & Privacy

### 8.1 Security Requirements

- ✅ **HTTPS only** for all fetches
- ✅ **Certificate validation** (no self-signed)
- ✅ **Rate limiting** (max 100 req/min per source)
- ✅ **User-Agent** identification
- ✅ **No sensitive data** in cache keys
- ✅ **Cache encryption** for sensitive content

### 8.2 Privacy

- ✅ **No telemetry** to external services
- ✅ **Local-first** processing
- ✅ **Opt-in** for cloud embeddings
- ✅ **Data retention** policies (max 30 days)

---

## 9. Configuration

### 9.1 Configuration Schema

```typescript
interface KnowledgeConfig {
  // Cache settings
  cache: {
    memory: {
      maxSize: number;        // Max entries (default: 1000)
      ttl: number;            // Default TTL in ms (default: 3600000)
    };
    sqlite: {
      path: string;           // DB path
      maxSize: number;        // Max entries (default: 10000)
    };
    filesystem: {
      path: string;           // Cache directory
      maxSize: number;        // Max size in bytes
    };
  };
  
  // Fetch settings
  fetch: {
    timeout: number;          // Request timeout (default: 10000)
    retries: number;          // Max retries (default: 3)
    userAgent: string;        // User-Agent header
    rateLimit: {
      maxRequests: number;    // Max requests per window
      windowMs: number;       // Rate limit window
    };
  };
  
  // RAG settings
  rag: {
    embeddingModel: string;   // Model name
    dimensions: number;       // Embedding dimensions
    chunkSize: number;        // Chunk size in tokens
    chunkOverlap: number;     // Overlap in tokens
  };
  
  // Version settings
  version: {
    default: string;          // Default version
    autoDetect: boolean;      // Auto-detect latest
    maxVersions: number;      // Max cached versions
  };
}
```

### 9.2 Example Configuration

```json
{
  "cache": {
    "memory": {
      "maxSize": 1000,
      "ttl": 3600000
    },
    "sqlite": {
      "path": ".cortexdx/knowledge/cache.db",
      "maxSize": 10000
    }
  },
  "fetch": {
    "timeout": 10000,
    "retries": 3,
    "userAgent": "CortexDx/1.0",
    "rateLimit": {
      "maxRequests": 100,
      "windowMs": 60000
    }
  },
  "rag": {
    "embeddingModel": "nomic-embed-text",
    "dimensions": 768,
    "chunkSize": 512,
    "chunkOverlap": 50
  }
}
```

---

## 10. Migration Path

### 10.1 Phase 1: Foundation (Week 1-2)

- [ ] Implement `OnDemandFetcher`
- [ ] Add cache layer with TTL
- [ ] Integrate with `DiagnosticContext`
- [ ] Add observability (metrics, logging)

### 10.2 Phase 2: Intelligence (Week 3-4)

- [ ] Implement RAG pipeline
- [ ] Add semantic search
- [ ] Implement hybrid search
- [ ] Add reranking

### 10.3 Phase 3: Optimization (Week 5-6)

- [ ] Implement request coalescing
- [ ] Add prefetching
- [ ] Optimize cache eviction
- [ ] Add background refresh
- [ ] **Implement transport selection logic**
- [ ] **Add capability detection**
- [ ] **Create transport adapters (HTTP, SSE, WebSocket)**

### 10.4 Phase 4: Advanced Features (Week 7-8)

- [ ] Multi-version support
- [ ] Version comparison
- [ ] Migration assistance
- [ ] Advanced analytics

### 10.5 Phase 5: Transport Optimization (Week 9-10)

- [ ] Metrics-based transport selection
- [ ] Adaptive transport switching
- [ ] Connection pooling optimization
- [ ] HTTP/2 and HTTP/3 support
- [ ] Transport performance monitoring

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
describe("OnDemandFetcher", () => {
  it("should fetch fresh content when cache is stale", async () => {
    const fetcher = new OnDemandFetcher(config);
    const result = await fetcher.fetch({
      section: "authentication",
      maxStaleness: 0  // Force fresh fetch
    });
    expect(result.metadata.fetchedAt).toBeGreaterThan(Date.now() - 1000);
  });
  
  it("should use cache when content is fresh", async () => {
    // Test cache hit
  });
  
  it("should fallback to cache on fetch failure", async () => {
    // Test graceful degradation
  });
});
```

### 11.2 Integration Tests

- Test end-to-end fetch → cache → retrieval
- Test concurrent requests (deduplication)
- Test cache invalidation
- Test version switching
- **Test transport selection logic**
- **Test transport fallback (WebSocket → SSE → HTTP)**
- **Test capability detection**
- **Test transport-specific optimizations (HTTP/2, SSE reconnect, WebSocket ping)**

### 11.3 Performance Tests

- Benchmark cache hit latency (< 100ms)
- Benchmark fresh fetch latency (< 5s)
- Load test (100+ concurrent requests)
- Stress test cache eviction
- **Benchmark transport latency (HTTP vs SSE vs WebSocket)**
- **Test connection pooling efficiency**
- **Measure transport overhead**

### 11.4 Transport Selection Tests

```typescript
describe("TransportSelector", () => {
  it("should select HTTP for static content", async () => {
    const selector = new TransportSelector();
    const transport = selector.selectTransport(
      { section: "authentication" },
      { http: true, sse: true, websocket: true }
    );
    expect(transport).toBe(TransportType.HTTP);
  });
  
  it("should select SSE for real-time updates", async () => {
    const selector = new TransportSelector();
    const transport = selector.selectTransport(
      { section: "changelog", realtime: true },
      { http: true, sse: true, websocket: false }
    );
    expect(transport).toBe(TransportType.SSE);
  });
  
  it("should fallback to HTTP when preferred transport unavailable", async () => {
    const selector = new TransportSelector();
    const transport = selector.selectTransport(
      { section: "changelog", realtime: true },
      { http: true, sse: false, websocket: false }
    );
    expect(transport).toBe(TransportType.HTTP);
  });
  
  it("should detect server capabilities", async () => {
    const selector = new TransportSelector();
    const capabilities = await selector.detectCapabilities(
      "https://modelcontextprotocol.io"
    );
    expect(capabilities.http).toBe(true);
  });
});

---

## 12. Success Criteria

### 12.1 Functional

- ✅ Agents can fetch spec on-demand
- ✅ Cache hit rate > 80%
- ✅ Graceful degradation on failures
- ✅ Multi-version support
- ✅ Semantic search accuracy > 90%

### 12.2 Performance

- ✅ Cache hit latency < 100ms (P95)
- ✅ Fresh fetch latency < 5s (P95)
- ✅ Search latency < 500ms (P95)
- ✅ Throughput > 100 req/s

### 12.3 Reliability

- ✅ Fetch success rate > 99%
- ✅ Zero data loss
- ✅ 100% fallback coverage

### 12.4 Transport Selection

- ✅ Automatic transport selection based on content type
- ✅ Capability detection < 1s
- ✅ Transport fallback success rate > 99%
- ✅ Optimal transport selected > 95% of the time
- ✅ HTTP/2 multiplexing for parallel fetches
- ✅ SSE reconnection < 5s
- ✅ WebSocket ping/pong < 30s interval

---

## Appendix A: Industry Standards Reference

- **HTTP Caching:** RFC 7234
- **Conditional Requests:** RFC 7232
- **ETags:** RFC 7232 Section 2.3
- **Semantic Versioning:** semver.org
- **OpenTelemetry:** opentelemetry.io
- **Vector Search:** FAISS, Pinecone, Weaviate patterns
- **SQLite FTS5:** sqlite.org/fts5.html
- **HTTP/2:** RFC 9113
- **HTTP/3:** RFC 9114
- **Server-Sent Events (SSE):** W3C EventSource API
- **WebSocket:** RFC 6455
- **ALPN (Application-Layer Protocol Negotiation):** RFC 7301
- **Connection Pooling:** HTTP/1.1 RFC 7230 Section 6.3

## Appendix B: Glossary

- **TTL:** Time-to-live
- **ETag:** Entity tag for cache validation
- **RAG:** Retrieval-Augmented Generation
- **FTS:** Full-text search
- **LRU:** Least Recently Used (cache eviction)
- **P95/P99:** 95th/99th percentile latency
- **SSE:** Server-Sent Events (one-way streaming)
- **WebSocket:** Full-duplex communication protocol
- **ALPN:** Application-Layer Protocol Negotiation
- **HTTP/2:** Binary protocol with multiplexing
- **HTTP/3:** QUIC-based HTTP protocol
- **Transport:** Communication mechanism (HTTP, SSE, WebSocket)
- **Capability Detection:** Discovering server transport support
- **Fallback Chain:** Ordered list of transport alternatives

