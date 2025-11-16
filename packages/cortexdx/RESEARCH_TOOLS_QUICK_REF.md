# Research Tools Quick Reference Card

**Last Updated:** 2025-11-16 | **Version:** 1.0.0

---

## 🚀 Quick Start Commands

### One-Line Tests (No Configuration Needed)

```bash
# ArXiv - Preprint papers
npm run dev research "neural networks" --providers arxiv --limit 3

# Wikidata - Knowledge graph
npm run dev research "machine learning" --providers wikidata --limit 3

# OpenAlex - Works but slower without email
npm run dev research "distributed systems" --providers openalex --limit 3

# All public providers at once
npm run dev research "API design" --providers arxiv,wikidata,openalex --limit 2
```

---

## 📋 Research Command Syntax

```bash
npm run dev research "<topic>" [options]

# Core Options
--providers <csv>           # Comma-separated provider IDs
--limit <number>            # Results per provider (default: 10)
--question <text>           # Additional context/question
--out <dir>                 # Save results to directory
--json                      # Output as JSON
--no-license                # Skip license metadata

# Advanced Options
--credential <key:value>    # Pass credentials (e.g., exa:API_KEY)
--header <key:value>        # Custom headers
```

---

## 🔍 Provider-Specific Commands

### ArXiv (Preprints)

```bash
# General search
npm run dev research "transformer models" --providers arxiv --limit 5

# By category
npm run dev -- -c 'import("./dist/providers/academic/arxiv.mcp.js").then(m => console.log(m.ArxivProvider.getToolDefinitions()[2]))'

# By author
npm run dev research "Hinton" --providers arxiv --question "deep learning" --limit 3

# Recent papers only
npm run dev research "large language models" --providers arxiv --limit 10
```

**Categories:** cs.AI, cs.LG, cs.CL, cs.CV, cs.SE, stat.ML, math.ST

---

### OpenAlex (Scholarly Works)

```bash
# Basic search
npm run dev research "microservices architecture" --providers openalex --limit 5

# With polite pool (10x faster)
OPENALEX_CONTACT_EMAIL=you@example.com npm run dev research "neural networks" --providers openalex --limit 10

# Author search
npm run dev research "Geoffrey Hinton" --providers openalex --limit 5

# Recent high-impact papers
npm run dev research "graph neural networks" --providers openalex --limit 10
```

**Performance Tip:** Set `OPENALEX_CONTACT_EMAIL` for 1000 req/min instead of 100 req/min

---

### Wikidata (Knowledge Graph)

```bash
# Entity search
npm run dev research "Alan Turing" --providers wikidata --limit 5

# Researchers
npm run dev research "machine learning researchers" --providers wikidata --limit 10

# Institutions
npm run dev research "MIT" --providers wikidata --limit 3

# Academic concepts
npm run dev research "artificial intelligence" --providers wikidata --limit 5
```

**Note:** Vector search uses keyword fallback (still works, just not semantic)

---

### Context7 (Contextual Analysis)

```bash
# Basic analysis
npm run dev research "microservices" --providers context7 --question "scalability patterns"

# With remote server (if configured)
CONTEXT7_API_BASE_URL=https://api.context7.com \
CONTEXT7_API_KEY=your_key \
npm run dev research "distributed systems" --providers context7 --limit 5

# Force local mode
CORTEXDX_DISABLE_CONTEXT7_HTTP=1 npm run dev research "API design" --providers context7
```

---

### DeepContext (Code Search)

```bash
# Check configuration
npm run dev deepcontext status

# Index codebase
npm run dev deepcontext index /path/to/codebase

# Search indexed code
npm run dev deepcontext search "authentication logic"

# Search with limit
npm run dev deepcontext search "error handling" --limit 10

# Clear index
npm run dev deepcontext clear
```

**Requires:** `WILDCARD_API_KEY` environment variable

---

## 🎯 Common Use Cases

### Research Before Implementation

```bash
# Research a topic, then orchestrate
npm run dev orchestrate "build JWT authentication" \
  --research \
  --research-providers openalex,arxiv \
  --research-limit 5
```

### Multi-Provider Deep Dive

```bash
# Query all providers with context
npm run dev research "consensus algorithms" \
  --providers openalex,arxiv,wikidata,context7 \
  --question "distributed systems resilience" \
  --limit 5 \
  --out ./research/consensus
```

### Quick Paper Lookup

```bash
# Find recent papers on a topic
npm run dev research "attention mechanisms" \
  --providers arxiv \
  --limit 10 \
  --json > attention-papers.json
```

### Knowledge Graph Exploration

```bash
# Explore academic entities
npm run dev research "neural network pioneers" \
  --providers wikidata \
  --limit 20
```

### Code Pattern Research

```bash
# Index your codebase
npm run dev deepcontext index .

# Find authentication patterns
npm run dev deepcontext search "JWT authentication implementation"

# Find error handling patterns
npm run dev deepcontext search "try-catch error handling"
```

---

## 🔧 Environment Setup

### Minimal Setup (Public APIs)

```bash
# .env (optional but recommended)
OPENALEX_CONTACT_EMAIL=you@example.com   # 10x rate limit boost
```

### Full Setup (All Features)

```bash
# Required for DeepContext
WILDCARD_API_KEY=wc_your_key_here

# Recommended for performance
OPENALEX_CONTACT_EMAIL=you@example.com

# Optional: Context7 remote server
CONTEXT7_API_BASE_URL=https://api.context7.com
CONTEXT7_API_KEY=your_context7_key

# Optional: Exa enhanced search
EXA_API_KEY=your_exa_key
```

### Quick Environment Check

```bash
# Check what's configured
env | grep -E "(WILDCARD|OPENALEX|CONTEXT7|EXA)"

# Test basic functionality
npm run dev research "test" --providers arxiv --limit 1
```

---

## 🧪 Testing & Validation

### Smoke Test (All Providers)

```bash
# Test all configured providers
CORTEXDX_RESEARCH_SMOKE=1 npm run research:smoke

# Test specific providers
CORTEXDX_RESEARCH_SMOKE=1 \
CORTEXDX_RESEARCH_SMOKE_PROVIDERS=arxiv,openalex,wikidata \
npm run research:smoke
```

### Health Checks

```bash
# DeepContext status
npm run dev deepcontext status

# Test each provider individually
npm run dev research "test" --providers arxiv --limit 1
npm run dev research "test" --providers openalex --limit 1
npm run dev research "test" --providers wikidata --limit 1
```

### Check Configuration

```bash
# See what providers respond
npm run dev research "machine learning" --limit 1 2>&1 | grep -E "\[.*\]"

# You should see:
# [OpenAlex] Using polite pool with contact email: ... (GOOD)
# [OpenAlex] PERFORMANCE WARNING: ... (needs email)
# [Context7] Remote MCP server configured (or local)
# [Wikidata] Vector search using enhanced keyword search fallback
# DeepContext configured with API key (or error)
```

---

## 📊 Output Formats

### Console (Default)

```bash
npm run dev research "neural networks" --providers arxiv --limit 3

# Output:
# [INFO] Academic research for neural networks
# Providers: 1/1 • Findings: 3
# Provider: arXiv Preprint Provider
# [INFO] Paper Title — Description...
```

### JSON

```bash
npm run dev research "topic" --providers openalex --limit 5 --json

# Outputs structured JSON with:
# - topic, timestamp
# - providers array with findings
# - summary with totals and errors
```

### Saved Artifacts

```bash
npm run dev research "microservices" --providers openalex,arxiv --out ./research-out

# Creates:
# ./research-out/
#   ├── research-report.md      # Markdown report
#   └── research-report.json    # JSON data
```

---

## 🐛 Troubleshooting Quick Checks

### Provider Not Working?

```bash
# Check if configured
env | grep PROVIDER_NAME

# See error messages
npm run dev research "test" --providers PROVIDER --limit 1 2>&1

# Check logs for:
# - "PERFORMANCE WARNING" → needs configuration
# - "not configured" → missing API key
# - "using enhanced keyword search fallback" → expected behavior
```

### DeepContext Issues?

```bash
# Check API key
env | grep WILDCARD_API_KEY

# Check status
npm run dev deepcontext status

# Re-index if needed
npm run dev deepcontext clear
npm run dev deepcontext index .
```

### OpenAlex Slow?

```bash
# Add contact email for 10x speedup
export OPENALEX_CONTACT_EMAIL=you@example.com

# Verify it's working
npm run dev research "test" --providers openalex --limit 1 2>&1 | grep "polite pool"
```

### No Results?

```bash
# Too specific → try broader terms
npm run dev research "machine learning" --providers arxiv --limit 5

# Wrong provider → ArXiv for preprints, OpenAlex for published papers
npm run dev research "topic" --providers arxiv,openalex --limit 5

# Check rate limits → wait a minute or reduce --limit
npm run dev research "topic" --providers openalex --limit 2
```

---

## 🎓 Advanced Usage

### Batch Research Script

```bash
#!/bin/bash
# research-batch.sh

TOPICS=(
  "neural networks"
  "distributed systems"
  "consensus algorithms"
)

for topic in "${TOPICS[@]}"; do
  echo "Researching: $topic"
  npm run dev research "$topic" \
    --providers openalex,arxiv \
    --limit 5 \
    --out "./research/${topic// /-}" \
    --json
done
```

### Custom Provider Mix

```bash
# Papers + context
npm run dev research "API design patterns" \
  --providers openalex,arxiv,context7 \
  --question "scalability and resilience" \
  --limit 3

# Knowledge graph + papers
npm run dev research "Geoffrey Hinton" \
  --providers wikidata,openalex \
  --limit 10

# Preprints only (latest research)
npm run dev research "large language models" \
  --providers arxiv \
  --limit 20
```

### Integration with Code

```bash
# Research → Code → Test flow
npm run dev research "JWT authentication best practices" \
  --providers openalex,arxiv \
  --out ./research/jwt

# Then use research to guide implementation
npm run dev orchestrate "implement JWT auth" \
  --research \
  --research-out ./research/jwt
```

---

## 📚 Provider Comparison

| Provider | Best For | Config Required | Rate Limit |
|----------|----------|-----------------|------------|
| **ArXiv** | Latest preprints | ❌ None | 60/min |
| **OpenAlex** | Published papers, citations | ⚠️ Email recommended | 100/min (1000 with email) |
| **Wikidata** | Entities, knowledge graph | ❌ None | 200/min |
| **Context7** | Contextual analysis | ⚠️ Optional remote | N/A |
| **DeepContext** | Code search | ✅ API key required | Varies |
| **Semantic Scholar** | Papers, citations | ❌ None | 100/min |

---

## 🔗 Quick Links

- **Full Setup Guide:** `/packages/cortexdx/docs/RESEARCH_TOOLS_SETUP.md`
- **Diagnostic Report:** `/RESEARCH_TOOLS_DIAGNOSTIC_REPORT.md`
- **Provider Details:** `/packages/cortexdx/src/providers/academic/README.md`
- **Tool Comparison:** `/docs/academic-research-tools-comparison.md`

---

## 💡 Pro Tips

1. **Combine providers** for comprehensive results
   ```bash
   npm run dev research "topic" --providers openalex,arxiv,wikidata --limit 5
   ```

2. **Use --out for caching** to avoid re-querying
   ```bash
   npm run dev research "topic" --out ./cache --json
   ```

3. **Set OPENALEX_CONTACT_EMAIL** for 10x performance
   ```bash
   export OPENALEX_CONTACT_EMAIL=you@example.com
   ```

4. **Start with ArXiv/Wikidata** (no config needed) for quick tests

5. **Use --limit 2** for fast experiments, increase for real research

6. **Check provider logs** for configuration status on first run

---

## 📞 Support

**Error Messages:** All tools now provide clear error messages with setup instructions

**Configuration Issues:** See `/packages/cortexdx/docs/RESEARCH_TOOLS_SETUP.md`

**Still Stuck?** Check `/RESEARCH_TOOLS_DIAGNOSTIC_REPORT.md` for detailed troubleshooting

---

**Quick Command Summary:**
```bash
# Test public APIs (no config)
npm run dev research "test" --providers arxiv,wikidata,openalex --limit 1

# Test DeepContext (needs API key)
npm run dev deepcontext status

# Full smoke test
CORTEXDX_RESEARCH_SMOKE=1 npm run research:smoke
```
