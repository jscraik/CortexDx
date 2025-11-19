# Knowledge Crawler Analysis: Errors, Pain Points & Opportunities

**Date:** 2025-11-19  
**Scope:** CortexDx Knowledge Crawler & RAG Integration  
**Status:** 🔴 Critical Issues Identified

---

## Executive Summary

The current implementation has **significant architectural misalignment** with your stated requirements. While the crawler exists and functions, it operates as a **scheduled batch process** rather than the **on-demand, agent-triggered system** you described.

### Critical Gaps
1. ❌ **No on-demand fetching** - Crawler must be manually run via `pnpm docs:mcp:index`
2. ❌ **No agent-triggered updates** - Agents cannot trigger spec fetches when needed
3. ⚠️ **Stale data risk** - Relies on pre-indexed snapshots, not live fetching
4. ⚠️ **Missing baseline rules** - No clear separation between structural checks and spec-based checks

---

## 1. Architecture Mismatch 🔴

### What You Described
> "You prefer **on-demand fetching**: The agent doing checks triggers the spec fetch when needed, rather than relying purely on scheduled crawls."

### What Actually Exists

```typescript
// Current: Manual batch indexing
// Location: /tools/mcp/docs-index.ts
// Run via: pnpm docs:mcp:index

async function main(): Promise<void> {
  // Step 1: Fetch pages (ALL at once)
  const pages = await fetchPages(PAGES);
  
  // Step 2: Normalize and chunk
  const allChunks: DocChunk[] = [];
  
  // Step 3: Build manifest
  const manifest = buildManifest(pages, allChunks);
  
  // Step 4: Write to disk (static snapshot)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  // Step 5: Build SQLite database (offline)
  await buildDatabase(allChunks, manifest);
}
```

**Problem:** This is a **pre-indexing batch job**, not an on-demand system.

---

## 2. Pain Points by Category

### 2.1 On-Demand Fetching ❌ MISSING

**Current State:**
- Crawler runs manually: `pnpm docs:mcp:index`
- Produces static snapshots in `.cortexdx/library/mcp-docs/{version}/`
- Agents query **pre-indexed data only**

**What's Missing:**
```typescript
// DOES NOT EXIST: On-demand fetch capability
interface OnDemandFetcher {
  // Fetch specific spec section when agent needs it
  fetchSpecSection(section: string, version?: string): Promise<SpecContent>;
  
  // Check if local cache is stale
  isCacheStale(section: string, maxAge: number): boolean;
  
  // Trigger refresh for specific content
  refreshContent(urls: string[]): Promise<void>;
}
```

**Impact:**
- 🔴 Agents work with potentially **stale documentation**
- 🔴 No way to get **latest spec changes** without manual re-indexing
- 🔴 Cannot **validate against current spec** in real-time

---

### 2.2 Baseline Rules vs. Live Spec Knowledge ⚠️ UNCLEAR

**Your Requirement:**
> "Uses **baked-in baseline rules** for stable, structural checks"  
> "Uses **live spec knowledge** for specific fields and behaviours that may change"

**Current State:**
```typescript
// Location: /packages/plugins/src/plugins/*.ts
// Example: handshake.ts, security.ts, etc.

// ALL rules are hardcoded - no distinction between:
// 1. Stable structural checks (baseline)
// 2. Spec-dependent checks (live knowledge)

async run(ctx) {
  // Hardcoded check - is this baseline or spec-dependent?
  const tools = await ctx.jsonrpc<unknown>("tools/list");
  
  // Hardcoded validation - should this come from spec?
  if (!tools || typeof tools !== "object") {
    return [createFinding("tools.list.invalid")];
  }
}
```

**What's Missing:**
1. **No classification** of which checks are "baseline" vs "spec-dependent"
2. **No mechanism** to fetch current spec requirements
3. **No fallback** when spec knowledge is unavailable

**Recommendation:**
```typescript
// PROPOSED: Clear separation
interface DiagnosticPlugin {
  // Stable, structural checks (never change)
  baselineChecks: Check[];
  
  // Spec-dependent checks (may evolve)
  specChecks: SpecCheck[];
  
  // Fetch latest spec requirements
  async refreshSpecKnowledge(): Promise<void>;
}
```

---

### 2.3 RAG Pipeline Integration ⚠️ PARTIAL

**Current State:**
```typescript
// Location: /packages/plugins/src/learning/rag-system.ts
// RAG system EXISTS but is for problem/solution learning, NOT spec knowledge

export class RagSystem {
  // Used for: Similar problems, solutions, patterns
  async findSimilarProblems(problem: Problem): Promise<RagSearchResult[]>
  async findSimilarSolutions(solution: Solution): Promise<RagSearchResult[]>
  
  // NOT used for: Spec knowledge, documentation lookup
}
```

**Gap:**
- RAG is for **learning from diagnostics**, not **spec knowledge retrieval**
- MCP docs search is **separate** from RAG pipeline
- No unified knowledge retrieval system

**Opportunity:**
```typescript
// PROPOSED: Unified knowledge system
interface UnifiedKnowledgeSystem {
  // Spec knowledge (current crawler)
  specKnowledge: SpecKnowledgeRetriever;
  
  // Problem/solution learning (current RAG)
  experientialKnowledge: RagSystem;
  
  // Combined retrieval
  async query(context: DiagnosticContext): Promise<Knowledge[]>;
}
```

---

### 2.4 Stale Data Risk 🔴 HIGH

**Current Flow:**
```
1. Developer runs: pnpm docs:mcp:index
2. Crawler fetches docs (e.g., 2025-11-19)
3. Snapshot saved to: .cortexdx/library/mcp-docs/2025-06-18/
4. Agents use this snapshot indefinitely
5. MCP spec updates (e.g., 2025-12-01)
6. Agents still using OLD snapshot ❌
```

**No Mechanism For:**
- ✗ Detecting spec updates
- ✗ Auto-refreshing stale content
- ✗ Alerting when using outdated spec
- ✗ Partial updates (must re-index everything)

**Risk:**
- Agents may give **incorrect advice** based on outdated spec
- **False positives/negatives** in diagnostics
- **Compliance issues** if spec has security updates

---

### 2.5 Configuration & Discoverability ⚠️ MODERATE

**Current Config:**
```json
// Location: /config/mcp-docs-sources.json
{
  "staticPages": [...],
  "spec": {
    "baseUrl": "https://modelcontextprotocol.io",
    "defaultVersion": "2025-06-18",  // ⚠️ Hardcoded version
    "initialSlugs": ["basic", "changelog", ...]
  },
  "gitRepos": [...]
}
```

**Issues:**
1. **Version hardcoded** - no auto-detection of latest spec version
2. **Manual slug management** - must update config for new spec sections
3. **No validation** - can't verify sources are still valid

**Opportunity:**
```typescript
// PROPOSED: Auto-discovery
interface SpecDiscovery {
  // Detect latest spec version
  async getLatestVersion(): Promise<string>;
  
  // Discover all spec sections
  async discoverSections(version: string): Promise<string[]>;
  
  // Validate source availability
  async validateSources(): Promise<ValidationResult>;
}
```

---

## 3. Missed Opportunities

### 3.1 Incremental Updates ⭐ HIGH VALUE

**Current:** Full re-index every time  
**Opportunity:** Delta updates

```typescript
// PROPOSED: Incremental crawler
interface IncrementalCrawler {
  // Only fetch changed content
  async updateChangedSections(
    since: Date,
    sections?: string[]
  ): Promise<UpdateResult>;
  
  // Compare with cached version
  async detectChanges(url: string): Promise<ChangeDetection>;
}
```

**Benefits:**
- ⚡ Faster updates (seconds vs minutes)
- 💰 Reduced bandwidth
- 🔄 More frequent refreshes possible

---

### 3.2 Agent-Triggered Refresh ⭐⭐ CRITICAL

**Your Requirement:**
> "The agent doing checks triggers the spec fetch when needed"

**Implementation:**
```typescript
// PROPOSED: Agent-triggered fetching
interface AgentTriggeredFetcher {
  // Agent requests specific knowledge
  async fetchOnDemand(request: {
    section: string;
    maxStaleness: number;  // e.g., 24 hours
    fallbackToCache: boolean;
  }): Promise<SpecContent>;
  
  // Background refresh queue
  queueRefresh(sections: string[]): void;
}

// Usage in diagnostic plugin:
async run(ctx: DiagnosticContext) {
  // Agent triggers fetch if needed
  const authSpec = await ctx.knowledge.fetchOnDemand({
    section: "authentication",
    maxStaleness: 86400000,  // 24 hours
    fallbackToCache: true
  });
  
  // Use latest spec for validation
  return validateAgainstSpec(ctx, authSpec);
}
```

---

### 3.3 Spec Version Negotiation ⭐ MEDIUM VALUE

**Current:** Single version snapshot  
**Opportunity:** Multi-version support

```typescript
// PROPOSED: Version-aware knowledge
interface VersionAwareKnowledge {
  // Get spec for specific version
  async getSpec(version: string): Promise<SpecContent>;
  
  // Compare versions
  async compareVersions(v1: string, v2: string): Promise<SpecDiff>;
  
  // Recommend version for server
  async recommendVersion(serverInfo: ServerInfo): Promise<string>;
}
```

**Use Case:**
- Server advertises protocol version `2024-11-05`
- Agent fetches **that specific version** of spec
- Validates against **correct requirements**

---

### 3.4 Caching Strategy ⚠️ NEEDS IMPROVEMENT

**Current:**
```typescript
// Static file cache only
.cortexdx/library/mcp-docs/2025-06-18/
├── manifest.json
├── chunks.jsonl
└── (no TTL, no validation)
```

**Opportunity:**
```typescript
// PROPOSED: Smart caching
interface SmartCache {
  // Cache with TTL
  set(key: string, value: any, ttl: number): void;
  
  // Conditional fetch (HTTP 304)
  async fetchIfModified(url: string, etag?: string): Promise<Response>;
  
  // Cache warming
  async warmCache(sections: string[]): Promise<void>;
}
```

---

### 3.5 Observability ⚠️ LIMITED

**Current:**
```typescript
// Minimal logging during index
console.log(`✅ Fetched ${pages.length} pages`);
console.log(`Total chunks: ${allChunks.length}`);
```

**Opportunity:**
```typescript
// PROPOSED: Rich telemetry
interface CrawlerTelemetry {
  // Track fetch performance
  recordFetch(url: string, duration: number, status: number): void;
  
  // Monitor staleness
  reportStaleness(section: string, age: number): void;
  
  // Alert on failures
  alertFetchFailure(url: string, error: Error): void;
}
```

---

## 4. Recommended Remediation Plan

### Phase 1: On-Demand Fetching (CRITICAL) 🔴

**Goal:** Enable agents to trigger spec fetches

**Tasks:**
1. Create `OnDemandSpecFetcher` service
   ```typescript
   // Location: /packages/plugins/src/library/on-demand-fetcher.ts
   export class OnDemandSpecFetcher {
     async fetch(section: string, options?: FetchOptions): Promise<SpecContent>
     async isCacheValid(section: string, maxAge: number): boolean
     async refreshSection(section: string): Promise<void>
   }
   ```

2. Integrate with `DiagnosticContext`
   ```typescript
   interface DiagnosticContext {
     // Add knowledge fetcher
     knowledge: OnDemandSpecFetcher;
   }
   ```

3. Update plugins to use on-demand fetching
   ```typescript
   // Example: authentication plugin
   async run(ctx: DiagnosticContext) {
     const authSpec = await ctx.knowledge.fetch("authentication");
     return validateAuth(ctx, authSpec);
   }
   ```

**Acceptance Criteria:**
- ✅ Agents can fetch spec sections on-demand
- ✅ Cache respected with configurable TTL
- ✅ Fallback to cached data if fetch fails
- ✅ < 2s latency for cached content
- ✅ < 5s latency for fresh fetch

---

### Phase 2: Baseline vs. Spec Rules (HIGH) ⚠️

**Goal:** Separate stable checks from spec-dependent checks

**Tasks:**
1. Classify existing checks
   ```typescript
   // Audit all plugins
   const classification = {
     baseline: [
       "handshake.initialize.required",
       "security.https.required",
       // ... stable structural checks
     ],
     specDependent: [
       "handshake.protocol.version",
       "capabilities.tools.schema",
       // ... may change with spec
     ]
   };
   ```

2. Create check registry
   ```typescript
   // Location: /packages/plugins/src/registry/check-registry.ts
   export const CheckRegistry = {
     baseline: new Map<string, BaselineCheck>(),
     specDependent: new Map<string, SpecCheck>()
   };
   ```

3. Implement spec-aware validation
   ```typescript
   class SpecCheck {
     async validate(ctx: DiagnosticContext): Promise<Finding[]> {
       const spec = await ctx.knowledge.fetch(this.specSection);
       return this.validateAgainstSpec(ctx, spec);
     }
   }
   ```

**Acceptance Criteria:**
- ✅ All checks classified as baseline or spec-dependent
- ✅ Spec checks fetch latest requirements
- ✅ Baseline checks never fetch (always cached)
- ✅ Documentation updated with classification

---

### Phase 3: Incremental Updates (MEDIUM) ⭐

**Goal:** Enable delta updates instead of full re-index

**Tasks:**
1. Implement change detection
   ```typescript
   async detectChanges(url: string): Promise<ChangeDetection> {
     const cached = await this.cache.get(url);
     const response = await fetch(url, {
       headers: { 'If-None-Match': cached?.etag }
     });
     return {
       changed: response.status !== 304,
       etag: response.headers.get('etag'),
       lastModified: response.headers.get('last-modified')
     };
   }
   ```

2. Implement partial updates
   ```typescript
   async updateSection(section: string): Promise<void> {
     const changes = await this.detectChanges(section);
     if (changes.changed) {
       await this.fetchAndIndex(section);
     }
   }
   ```

**Acceptance Criteria:**
- ✅ Can update single section without full re-index
- ✅ Uses HTTP conditional requests (ETags)
- ✅ < 10s to update single section
- ✅ Preserves unchanged sections

---

### Phase 4: Version Management (LOW) ⭐

**Goal:** Support multiple spec versions

**Tasks:**
1. Auto-detect latest version
2. Store multiple versions
3. Version-aware queries

**Acceptance Criteria:**
- ✅ Can query specific spec version
- ✅ Auto-detects latest version
- ✅ Maintains 3 most recent versions

---

## 5. Quick Wins (Immediate Actions)

### 5.1 Add Staleness Warnings ⚡ 1 hour

```typescript
// Location: /packages/plugins/src/library/mcp-docs-service.ts
export async function searchMcpDocs(options: McpDocsSearchOptions) {
  const manifest = await loadManifest();
  const age = Date.now() - new Date(manifest.createdAt).getTime();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  if (age > maxAge) {
    console.warn(
      `⚠️  MCP docs are ${Math.floor(age / 86400000)} days old. ` +
      `Run 'pnpm docs:mcp:index' to refresh.`
    );
  }
  
  // ... rest of search
}
```

---

### 5.2 Document Current Limitations ⚡ 30 minutes

Add to `/packages/mcp/mcp-docs-adapter/README.md`:

```markdown
## ⚠️ Current Limitations

1. **Static Snapshots Only**: Docs must be manually re-indexed via `pnpm docs:mcp:index`
2. **No On-Demand Fetching**: Agents cannot trigger spec updates
3. **Stale Data Risk**: No automatic detection of spec changes
4. **Full Re-Index Required**: Cannot update individual sections

## 🚧 Planned Improvements

See `.analysis/knowledge-crawler-analysis.md` for roadmap.
```

---

### 5.3 Add Version Check Command ⚡ 2 hours

```typescript
// Location: /packages/cortexdx/src/commands/knowledge.ts
export async function checkKnowledgeStatus(): Promise<void> {
  const manifest = await loadManifest();
  const age = Date.now() - new Date(manifest.createdAt).getTime();
  
  console.log("📚 Knowledge Base Status");
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Created: ${manifest.createdAt}`);
  console.log(`   Age: ${Math.floor(age / 86400000)} days`);
  console.log(`   Sources: ${manifest.sources.length}`);
  console.log(`   Chunks: ${manifest.chunkCount}`);
  
  if (age > 7 * 86400000) {
    console.warn("⚠️  Knowledge base is over 7 days old. Consider refreshing.");
  }
}
```

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stale spec data causes incorrect diagnostics | HIGH | HIGH | Implement staleness warnings (Quick Win 5.1) |
| Agent cannot access latest spec changes | HIGH | MEDIUM | Implement on-demand fetching (Phase 1) |
| No distinction between baseline/spec checks | MEDIUM | MEDIUM | Classify checks (Phase 2) |
| Full re-index is slow and disruptive | LOW | LOW | Implement incremental updates (Phase 3) |

---

## 7. Success Metrics

### Before (Current State)
- ❌ Manual indexing required
- ❌ No staleness detection
- ❌ Full re-index only (5-10 minutes)
- ❌ No on-demand fetching
- ⚠️ No baseline/spec separation

### After (Target State)
- ✅ Agents trigger fetches on-demand
- ✅ Staleness warnings at 7 days
- ✅ Incremental updates (< 10s per section)
- ✅ < 2s for cached, < 5s for fresh fetch
- ✅ Clear baseline vs. spec check classification

---

## 8. Conclusion

The current knowledge crawler is **functional but architecturally misaligned** with your requirements. The most critical gap is the **lack of on-demand fetching** - agents cannot trigger spec updates when needed.

### Immediate Actions (This Week)
1. ✅ Add staleness warnings (Quick Win 5.1)
2. ✅ Document limitations (Quick Win 5.2)
3. ✅ Add version check command (Quick Win 5.3)

### Next Sprint (Phase 1)
1. Implement `OnDemandSpecFetcher`
2. Integrate with `DiagnosticContext`
3. Update 2-3 plugins to use on-demand fetching
4. Measure performance (< 5s target)

### Future Roadmap
- Phase 2: Baseline vs. Spec classification
- Phase 3: Incremental updates
- Phase 4: Multi-version support

---

**Questions for Clarification:**

1. What is acceptable staleness for spec knowledge? (24 hours? 7 days?)
2. Should on-demand fetching be **always-on** or **opt-in per plugin**?
3. Do you want to maintain **multiple spec versions** or just latest?
4. What's the priority: **speed** (aggressive caching) or **freshness** (frequent fetches)?
