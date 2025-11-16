# Research Tools Setup Guide

This guide helps you configure CortexDx's academic research tools for optimal performance.

## Overview

CortexDx integrates with multiple academic research providers:

| Provider | Status | API Key Required | Public API | Rate Limits |
|----------|--------|------------------|------------|-------------|
| **ArXiv** | ✅ Ready | No | Yes | 60/min |
| **Wikidata** | ✅ Ready | No | Yes | 200/min |
| **OpenAlex** | ⚠️ Recommended Config | No | Yes | 100/min (1000/min with email) |
| **Context7** | ⚠️ Optional Remote | Optional | Local+Remote | N/A |
| **DeepContext** | ❌ API Key Required | **Yes** | No | Varies |
| **Semantic Scholar** | ✅ Ready | No | Yes | 100/min |

---

## Quick Start (No Configuration)

These tools work immediately without any setup:

```bash
# Test ArXiv (preprint papers)
npm run dev research "machine learning" --providers arxiv --limit 3

# Test Wikidata (knowledge graph)
npm run dev research "neural networks" --providers wikidata --limit 3

# Test OpenAlex (scholarly works - will work but with lower rate limits)
npm run dev research "API design" --providers openalex --limit 3
```

---

## Provider-Specific Setup

### 1. ArXiv ✅

**Status:** Ready to use
**Configuration:** None required
**Features:**
- Preprint paper search
- Category filtering (cs.AI, cs.LG, etc.)
- Author search
- Full metadata extraction

**Example:**
```bash
npm run dev research "transformer architecture" --providers arxiv --limit 5
```

**Rate Limits:** 60 requests/minute

---

### 2. Wikidata ✅

**Status:** Ready to use (keyword search)
**Configuration:** None required
**Features:**
- Entity search (researchers, institutions, publications)
- SPARQL queries
- Knowledge graph relationships
- Academic entity discovery

**Current Limitations:**
- Vector search tools (`wikidata_vector_search_items`, `wikidata_vector_search_properties`) currently use enhanced keyword search as fallback
- True semantic vector search requires integration with https://wd-mcp.wmcloud.org/mcp/ (planned)

**Example:**
```bash
npm run dev research "Albert Einstein" --providers wikidata --limit 5
```

**Rate Limits:** 200 requests/minute

---

### 3. OpenAlex ⚠️

**Status:** Works without config, **recommended to configure for 10x performance**

#### Without Configuration
- Works immediately
- Rate limit: 100 requests/minute
- No authentication needed

#### Recommended Configuration (Polite Pool)

**Performance Impact:** 10x higher rate limits (1000 req/min)

**Setup:**
```bash
export OPENALEX_CONTACT_EMAIL=your.email@example.com
```

**Why this matters:**
- OpenAlex gives priority to users who identify themselves
- Called the "polite pool" - dramatically higher rate limits
- **1000 requests/minute** vs 100 requests/minute
- No registration required, just provide your email

**Verification:**
When configured correctly, you'll see:
```
[OpenAlex] Using polite pool with contact email: your.email@example.com (1000 req/min rate limit)
```

**Example:**
```bash
export OPENALEX_CONTACT_EMAIL=researcher@university.edu
npm run dev research "distributed systems" --providers openalex --limit 10
```

**Features:**
- Scholarly work search
- Author metrics (h-index, i10-index, citation counts)
- Institutional analysis
- Open access status detection
- Citation network analysis

---

### 4. Context7 ⚠️

**Status:** Local implementation ready, remote optional

#### Local Mode (Default)
- No configuration required
- Uses built-in contextual analysis
- Limited features but functional

#### Remote Mode (Enhanced)

**Setup for Remote MCP Server:**
```bash
export CONTEXT7_API_BASE_URL=https://your-context7-server.com
export CONTEXT7_API_KEY=your_api_key_here
export CONTEXT7_PROFILE=default  # Optional
```

**Disable remote (force local only):**
```bash
export CORTEXDX_DISABLE_CONTEXT7_HTTP=1
```

**Features:**
- Contextual research analysis
- Cross-reference discovery
- Citation context analysis with sentiment scoring
- Thematic pattern extraction
- Research trajectory analysis
- Interdisciplinary connection mapping

**Verification:**
```
[Context7] Remote MCP server configured. Will attempt remote analysis with local fallback.
```
or
```
[Context7] Using local contextual analysis implementation.
```

**Example:**
```bash
npm run dev research "microservices architecture" \
  --providers context7 \
  --question "scalability patterns"
```

---

### 5. DeepContext ❌

**Status:** Requires API key - critical for semantic code search

#### API Key Required

**Priority Order:**
1. `WILDCARD_API_KEY` (recommended)
2. `DEEPCONTEXT_API_KEY`
3. `DEEPCONTEXT_API_TOKEN`
4. `DEEPCONTEXT_TOKEN`

**Setup:**
```bash
# Get API key from https://wildcard.ai
export WILDCARD_API_KEY=wc_your_api_key_here
```

**Optional Additional Keys:**
```bash
export JINA_API_KEY=your_jina_key          # For enhanced embeddings
export TURBOPUFFER_API_KEY=your_tp_key     # For vector storage
```

**Features:**
- Symbol-aware semantic code search
- Codebase indexing
- Context-aware search results
- Custom vector indices

**Commands:**
```bash
# Check status
npm run dev deepcontext status

# Index codebase
npm run dev deepcontext index /path/to/codebase

# Search indexed code
npm run dev deepcontext search "authentication logic"

# Clear index
npm run dev deepcontext clear
```

**Verification:**
```
DeepContext configured with API key
```

**Error Without Key:**
```
DeepContext API key is required but not configured.

To use DeepContext, set one of these environment variables (in priority order):
  1. WILDCARD_API_KEY     (recommended)
  2. DEEPCONTEXT_API_KEY
  3. DEEPCONTEXT_API_TOKEN
  4. DEEPCONTEXT_TOKEN

To obtain an API key:
  1. Visit https://wildcard.ai
  2. Sign up or log in
  3. Generate an API key from your dashboard
  4. Set the environment variable: export WILDCARD_API_KEY=your_key_here
```

---

### 6. Semantic Scholar ✅

**Status:** Ready to use
**Configuration:** None required
**Features:**
- Academic paper search
- Citation analysis
- Author discovery
- Paper recommendations
- Influence metrics

**Example:**
```bash
npm run dev research "graph neural networks" --providers semantic-scholar --limit 5
```

**Rate Limits:** 100 requests/minute

---

## Complete Configuration Example

Create a `.env` file in your project root:

```bash
# OpenAlex (Recommended for 10x performance)
OPENALEX_CONTACT_EMAIL=your.email@example.com

# DeepContext (Required for code search)
WILDCARD_API_KEY=wc_your_api_key_here
JINA_API_KEY=your_jina_key_optional
TURBOPUFFER_API_KEY=your_turbopuffer_key_optional

# Context7 (Optional remote server)
CONTEXT7_API_BASE_URL=https://your-context7-server.com
CONTEXT7_API_KEY=your_context7_key
CONTEXT7_PROFILE=default

# Or disable Context7 remote
# CORTEXDX_DISABLE_CONTEXT7_HTTP=1

# Rate limit tuning (optional)
OPENALEX_THROTTLE_MS=200  # Delay between requests
```

---

## Testing Your Setup

### Health Check

Run all providers with a simple query:

```bash
npm run dev research "test query" --limit 1
```

You should see output like:
```
[OpenAlex] Using polite pool with contact email: you@example.com (1000 req/min rate limit)
[Context7] Remote MCP server configured. Will attempt remote analysis with local fallback.
[Wikidata] Vector search using enhanced keyword search fallback.
DeepContext configured with API key

Providers: 5/5 • Findings: 5
```

### Smoke Tests

Enable comprehensive smoke tests:

```bash
# Test all configured providers
CORTEXDX_RESEARCH_SMOKE=1 npm run research:smoke

# Test specific providers
CORTEXDX_RESEARCH_SMOKE=1 \
CORTEXDX_RESEARCH_SMOKE_PROVIDERS=arxiv,openalex,wikidata \
npm run research:smoke
```

### Individual Provider Tests

```bash
# ArXiv - should always work
npm run dev research "neural networks" --providers arxiv --limit 2

# OpenAlex - check for polite pool message
npm run dev research "machine learning" --providers openalex --limit 2

# Wikidata - check for fallback message
npm run dev research "Alan Turing" --providers wikidata --limit 2

# DeepContext - requires API key
npm run dev deepcontext status
```

---

## Troubleshooting

### "DeepContext API key is required but not configured"

**Solution:** Set `WILDCARD_API_KEY`:
```bash
export WILDCARD_API_KEY=your_key_here
```

Get a key from https://wildcard.ai

---

### OpenAlex is slow

**Problem:** You're hitting the standard rate limit (100 req/min)

**Solution:** Set your contact email for polite pool access:
```bash
export OPENALEX_CONTACT_EMAIL=your.email@example.com
```

This gives you 1000 requests/minute (10x faster).

---

### Wikidata vector search not working as expected

**Expected Behavior:** This is normal! Wikidata vector search currently uses enhanced keyword search as a fallback. You'll see this message:

```
[Wikidata] Vector search using enhanced keyword search fallback.
For true semantic search, Wikidata vector database integration is required.
```

**Status:** Integration with Wikidata's vector database service is planned but not yet implemented. The current keyword-based fallback still provides useful results.

---

### Context7 always uses local implementation

**Check Configuration:**
```bash
echo $CONTEXT7_API_BASE_URL
echo $CONTEXT7_API_KEY
```

If both are set and you still see local mode:
```
[Context7] Using local contextual analysis implementation.
```

**Possible Causes:**
1. `CORTEXDX_DISABLE_CONTEXT7_HTTP=1` is set (disables remote)
2. API base URL is not reachable
3. Check logs for connection errors

**Force Local Mode:**
```bash
export CORTEXDX_DISABLE_CONTEXT7_HTTP=1
```

---

### ArXiv returns no results

**Common Causes:**
1. Too specific query - try broader terms
2. Wrong category - use `arxiv_get_categories` to see valid categories
3. Rate limit hit - wait a minute and retry

**Example:**
```bash
# Get available categories
npm run dev -- -c 'console.log(JSON.stringify(require("./dist/providers/academic/arxiv.mcp.js").ArxivProvider.getToolDefinitions()))'

# Or use general search
npm run dev research "machine learning" --providers arxiv
```

---

## Environment Variable Reference

### Required for Specific Features

| Variable | Required For | Impact if Missing |
|----------|-------------|-------------------|
| `WILDCARD_API_KEY` | DeepContext code search | Feature completely disabled |

### Recommended for Performance

| Variable | Provider | Impact if Missing |
|----------|----------|-------------------|
| `OPENALEX_CONTACT_EMAIL` | OpenAlex | 10x slower rate limits |

### Optional Enhancements

| Variable | Provider | Purpose |
|----------|----------|---------|
| `CONTEXT7_API_BASE_URL` | Context7 | Enable remote MCP server |
| `CONTEXT7_API_KEY` | Context7 | Authenticate with remote server |
| `CONTEXT7_PROFILE` | Context7 | Select configuration profile |
| `JINA_API_KEY` | DeepContext | Enhanced embeddings |
| `TURBOPUFFER_API_KEY` | DeepContext | Vector storage backend |
| `OPENALEX_THROTTLE_MS` | OpenAlex | Custom rate limiting |

### Disable Flags

| Variable | Effect |
|----------|--------|
| `CORTEXDX_DISABLE_CONTEXT7_HTTP=1` | Force Context7 local mode |
| `CORTEXDX_DISABLE_OPENALEX_HTTP=1` | Disable OpenAlex HTTP client |

---

## Performance Optimization

### Best Practices

1. **Set OpenAlex email** - 10x performance boost
   ```bash
   export OPENALEX_CONTACT_EMAIL=you@example.com
   ```

2. **Use specific providers** - Don't query all providers if you only need specific data
   ```bash
   # Good - specific providers
   npm run dev research "topic" --providers arxiv,openalex

   # Less efficient - all providers
   npm run dev research "topic"
   ```

3. **Limit results appropriately** - Default is 10 per provider
   ```bash
   npm run dev research "topic" --limit 3  # Faster
   ```

4. **Save results** - Use `--out` to avoid re-querying
   ```bash
   npm run dev research "topic" --out ./research-cache --json
   ```

### Rate Limit Management

```bash
# Slow down OpenAlex requests if needed
export OPENALEX_THROTTLE_MS=500  # 500ms between requests
```

---

## Integration Examples

### Research Before Orchestration

```bash
npm run dev orchestrate "build authentication system" \
  --research \
  --research-providers openalex,arxiv \
  --research-limit 5
```

### Multiple Provider Query

```bash
npm run dev research "microservices patterns" \
  --providers openalex,arxiv,wikidata,context7 \
  --question "scalability and resilience" \
  --limit 5 \
  --out ./research-output
```

### Batch Research

```bash
#!/bin/bash
TOPICS=("neural networks" "distributed systems" "API design patterns")

for topic in "${TOPICS[@]}"; do
  npm run dev research "$topic" \
    --providers openalex,arxiv \
    --limit 3 \
    --out "./research/${topic// /_}"
done
```

---

## Getting API Keys

### DeepContext / Wildcard

1. Visit https://wildcard.ai
2. Sign up or log in
3. Navigate to API Keys section
4. Generate new API key
5. Copy and set: `export WILDCARD_API_KEY=wc_...`

### Context7 (Optional)

Context7 is typically self-hosted or enterprise. Contact your organization's Context7 administrator for:
- API base URL
- API key
- Profile configuration

---

## Next Steps

1. **Test basic functionality** - Run ArXiv and Wikidata tests (no config needed)
2. **Configure OpenAlex email** - Get 10x performance boost
3. **Set up DeepContext** - If you need code search
4. **Try combined research** - Use multiple providers together
5. **Check the diagnostic report** - See `/RESEARCH_TOOLS_DIAGNOSTIC_REPORT.md` for detailed status

---

## Support

- **Documentation:** `/packages/cortexdx/src/providers/academic/README.md`
- **Provider Comparison:** `/docs/academic-research-tools-comparison.md`
- **Diagnostic Report:** `/RESEARCH_TOOLS_DIAGNOSTIC_REPORT.md`
- **Issues:** GitHub Issues

---

**Last Updated:** 2025-11-16
**Version:** 1.0.0
**Status:** Production Ready
