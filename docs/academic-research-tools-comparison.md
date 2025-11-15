# Academic Research Tools: Implementation Comparison Matrix

This document provides a comprehensive comparison between the upstream MCP servers and the CortexDx implementation, documenting feature coverage, enhancements, and intentional design decisions.

## Executive Summary

| Provider | Upstream Source | Implementation Status | Coverage | Notes |
|----------|----------------|----------------------|----------|-------|
| **DeepContext** | [Wildcard-Official/deepcontext-mcp](https://github.com/Wildcard-Official/deepcontext-mcp) | ✅ **Full Compliance** | 100% (4/4 tools) | All features implemented |
| **WikidataMCP** | [philippesaade-wmde/WikidataMCP](https://github.com/philippesaade-wmde/WikidataMCP) | ⚠️ **Partial** | 57% (4/7 tools) | Missing vector search & claims |
| **arXiv** | [blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server) | ✅ **Full Compliance** | 100% (5/5 tools) | Enhanced with categories |
| **Context7** | [upstash/context7](https://github.com/upstash/context7) | ✅ **Enhanced** | 100%+ (7 tools) | Additional academic features |
| **Semantic Scholar** | [SnippetSquid/SemanticScholarMCP](https://github.com/SnippetSquid/SemanticScholarMCP) | ✅ **Full Compliance** | 100% (7/7 tools) | Complete implementation |
| **Vibe Check** | [PV-Bhat/vibe-check-mcp-server](https://github.com/PV-Bhat/vibe-check-mcp-server) | ✅ **Enhanced** | 100%+ (4 tools) | Academic integrity focus |
| **OpenAlex** | Native implementation | ✅ **Native** | N/A (5 tools) | CortexDx original |

---

## Detailed Tool Comparison

### 1. DeepContext (Wildcard AI)

**Upstream Repository:** https://github.com/Wildcard-Official/deepcontext-mcp
**Implementation File:** `packages/cortexdx/src/deepcontext/client.ts`

| Upstream Tool | CortexDx Tool | Status | Notes |
|---------------|---------------|--------|-------|
| `index_codebase` | `cortexdx_deepcontext_index` | ✅ Full | Symbol-aware indexing |
| `search_codebase` | `cortexdx_deepcontext_search` | ✅ Full | Semantic code search |
| `get_indexing_status` | `cortexdx_deepcontext_status` | ✅ Full | Status tracking with persistence |
| `clear_index` | `cortexdx_deepcontext_clear` | ✅ Full | Index management |

**Environment Variables:**
- ✅ `WILDCARD_API_KEY` (primary)
- ✅ `DEEPCONTEXT_API_KEY` (fallback)
- ✅ `DEEPCONTEXT_API_TOKEN` (fallback)
- ✅ `DEEPCONTEXT_TOKEN` (fallback)
- ✅ `JINA_API_KEY` (self-hosted)
- ✅ `TURBOPUFFER_API_KEY` (self-hosted)

**Additional Features:**
- Integration with CortexDx diagnostic context
- CLI commands for all operations
- Status persistence layer
- CI/CD integration scripts

**Compliance:** ✅ **100% - Fully compliant with enhancements**

---

### 2. WikidataMCP

**Upstream Repository:** https://github.com/philippesaade-wmde/WikidataMCP
**Implementation File:** `packages/cortexdx/src/providers/academic/wikidata.mcp.ts`

| Upstream Tool | CortexDx Tool | Status | Notes |
|---------------|---------------|--------|-------|
| `vector_search_items` | ❌ Not implemented | ❌ Missing | Semantic search via embeddings |
| `keyword_search_items` | `wikidata_search` | ⚠️ Partial | Basic entity search (simplified) |
| `vector_search_properties` | ❌ Not implemented | ❌ Missing | Property discovery via embeddings |
| `keyword_search_properties` | ❌ Not implemented | ❌ Missing | Property keyword search |
| `get_entity_claims` | ❌ Not implemented | ❌ Missing | Direct graph connections (triplets) |
| `get_claim_values` | ❌ Not implemented | ❌ Missing | Claims with qualifiers/ranks/refs |
| `execute_sparql` | `wikidata_sparql` | ✅ Full | Custom SPARQL queries |

**Additional CortexDx Tools:**
- `wikidata_entity` - Detailed entity information retrieval
- `wikidata_academic_search` - Academic-focused entity search (researchers, institutions, publications, journals)

**Environment Variables:**
- No API keys required (public Wikidata API)

**Missing Capabilities:**
- ❌ Vector-based semantic search (requires embeddings integration)
- ❌ Property-focused queries
- ❌ Claims-based graph traversal with qualifiers and references
- ❌ Textifier service integration

**Compliance:** ⚠️ **57% - Missing advanced features**

**Recommendation:** Implement missing tools to achieve full parity with upstream WikidataMCP server.

---

### 3. arXiv Provider

**Upstream Repository:** [blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server)
**Implementation File:** `packages/cortexdx/src/providers/academic/arxiv.mcp.ts`

**Note:** Documentation previously incorrectly referenced [space-cadet/arxivite](https://github.com/space-cadet/arxivite), which is a full-stack research application, not a simple MCP server.

| Upstream Tool | CortexDx Tool | Status | Notes |
|---------------|---------------|--------|-------|
| `arxiv_search` | `arxiv_search` | ✅ Full | Advanced search with field queries |
| `arxiv_get_paper` | `arxiv_get_paper` | ✅ Full | Paper details by ID list |
| `arxiv_search_by_category` | `arxiv_search_by_category` | ✅ Full | Category-specific search |
| `arxiv_search_by_author` | `arxiv_search_by_author` | ✅ Full | Author-based discovery |
| (Enhancement) | `arxiv_get_categories` | ✅ Enhanced | Category enumeration (CortexDx addition) |

**Environment Variables:**
- No API keys required (public arXiv API)

**Additional Features:**
- Comprehensive category definitions (cs.AI, cs.LG, stat.ML, etc.)
- XML parsing with error handling
- License compliance checking for preprints
- Metadata extraction (DOI, journal refs, comments)

**Compliance:** ✅ **100% - Fully compliant with enhancements**

---

### 4. Context7

**Upstream Repository:** https://github.com/upstash/context7
**Implementation File:** `packages/cortexdx/src/providers/academic/context7.mcp.ts`

Context7's upstream is primarily a documentation retrieval tool. CortexDx has **significantly enhanced** it for academic research workflows.

| Capability | Upstream | CortexDx | Status | Notes |
|------------|----------|----------|--------|-------|
| Documentation retrieval | ✅ Core | ✅ Supported | Full | Version-specific docs |
| Code examples | ✅ Core | ✅ Supported | Full | Working code samples |
| Paper analysis | ❌ Not available | ✅ Implemented | Enhanced | `context7_analyze_paper` |
| Related papers | ❌ Not available | ✅ Implemented | Enhanced | `context7_find_related_papers` |
| Citation context | ❌ Not available | ✅ Implemented | Enhanced | `context7_citation_context` |
| Research trajectory | ❌ Not available | ✅ Implemented | Enhanced | `context7_research_trajectory` |
| Interdisciplinary | ❌ Not available | ✅ Implemented | Enhanced | `context7_interdisciplinary_analysis` |
| Architecture validation | ❌ Not available | ✅ Implemented | Enhanced | `context7_validate_architecture` |
| Code quality assessment | ❌ Not available | ✅ Implemented | Enhanced | `context7_assess_code_quality` |

**CortexDx-Specific Tools (7 total):**
1. `context7_analyze_paper` - Comprehensive contextual analysis with relevance metrics
2. `context7_find_related_papers` - Cross-reference discovery with relationship types
3. `context7_citation_context` - Citation sentiment analysis by section
4. `context7_research_trajectory` - Topic/author/methodology evolution tracking
5. `context7_interdisciplinary_analysis` - Cross-field influence mapping
6. `context7_validate_architecture` - Design validation with license compliance
7. `context7_assess_code_quality` - Academic standards assessment with license checking

**Environment Variables:**
- ✅ `CONTEXT7_API_KEY` (optional, for remote server)
- ✅ `CONTEXT7_API_BASE_URL` (optional, for remote server)
- ✅ `CONTEXT7_PROFILE` (optional)
- ✅ `CORTEXDX_DISABLE_CONTEXT7_HTTP` (disable remote fallback)

**Additional Features:**
- HTTP MCP client for remote Context7 servers
- Fallback to local analysis when remote unavailable
- License compliance validation integrated
- Thematic analysis with methodology extraction
- Relevance scoring and context metrics

**Compliance:** ✅ **100%+ - Enhanced beyond upstream**

---

### 5. Semantic Scholar

**Upstream Repository:** [SnippetSquid/SemanticScholarMCP](https://github.com/SnippetSquid/SemanticScholarMCP)
**Implementation File:** `packages/cortexdx/src/providers/academic/semantic-scholar.mcp.ts`

| Upstream Tool | CortexDx Tool | Status | Notes |
|---------------|---------------|--------|-------|
| `semantic_scholar_search_papers` | `semantic_scholar_search_papers` | ✅ Full | Advanced paper search |
| `semantic_scholar_get_paper` | `semantic_scholar_get_paper` | ✅ Full | Detailed paper info |
| `semantic_scholar_get_paper_citations` | `semantic_scholar_get_paper_citations` | ✅ Full | Citation analysis |
| `semantic_scholar_get_paper_references` | `semantic_scholar_get_paper_references` | ✅ Full | Reference tracking |
| `semantic_scholar_search_authors` | `semantic_scholar_search_authors` | ✅ Full | Author discovery |
| `semantic_scholar_get_author` | `semantic_scholar_get_author` | ✅ Full | Author profiles |
| `semantic_scholar_get_author_papers` | `semantic_scholar_get_author_papers` | ✅ Full | Author publications |

**Environment Variables:**
- ⚠️ `SEMANTIC_SCHOLAR_API_KEY` (optional but recommended)

**Rate Limits:**
- 100 requests/minute
- 1000 requests/hour
- 10000 requests/day

**Compliance:** ✅ **100% - Fully compliant**

---

### 6. Vibe Check

**Upstream Repository:** [PV-Bhat/vibe-check-mcp-server](https://github.com/PV-Bhat/vibe-check-mcp-server)
**Implementation File:** `packages/cortexdx/src/providers/academic/vibe-check.mcp.ts`

| Upstream Tool | CortexDx Tool | Status | Notes |
|---------------|---------------|--------|-------|
| Quality assessment | `vibe_check_assess_quality` | ✅ Enhanced | Multi-dimensional quality scoring |
| Venue assessment | `vibe_check_venue_assessment` | ✅ Enhanced | Predatory publisher detection |
| Citation analysis | `vibe_check_citation_analysis` | ✅ Enhanced | Pattern anomaly detection |
| Methodology review | `vibe_check_methodology_review` | ✅ Enhanced | Standards validation |

**Environment Variables:**
- ✅ `VIBE_CHECK_API_KEY` (optional)
- ✅ `VIBE_CHECK_HTTP_URL` (for remote instances)

**Additional Features:**
- License compliance integration
- Academic integrity validation
- Research methodology review
- Multi-factor quality scoring

**Compliance:** ✅ **100%+ - Enhanced with academic integrity focus**

---

### 7. OpenAlex

**Implementation File:** `packages/cortexdx/src/providers/academic/openalex.mcp.ts`

This is a **native CortexDx implementation** with no direct upstream MCP server.

**Tools (5 total):**
1. `openalex_search_works` - Comprehensive scholarly work search
2. `openalex_search_authors` - Author discovery with metrics (h-index, citation counts)
3. `openalex_search_institutions` - Institutional research output
4. `openalex_get_work` - Detailed work information
5. `openalex_get_author` - Author profiles with impact metrics

**Environment Variables:**
- ⚠️ `OPENALEX_CONTACT_EMAIL` (required for polite pool access)

**Rate Limits:**
- 100 requests/minute
- 10000 requests/hour

**Features:**
- Research impact assessment
- Institutional analysis
- Author metrics (h-index, i10-index)
- Open access status detection

**Status:** ✅ **Native implementation - no upstream comparison**

---

## Feature Coverage Summary

### Implemented Features Across All Providers

| Feature Category | Providers Supporting |
|-----------------|---------------------|
| Paper search | Semantic Scholar, OpenAlex, arXiv |
| Citation analysis | Semantic Scholar, OpenAlex, Context7 |
| Author research | OpenAlex, Wikidata, Semantic Scholar |
| Quality assessment | Vibe Check |
| Contextual analysis | Context7, Wikidata |
| Preprint access | arXiv |
| Knowledge graph | Wikidata (partial) |
| Code search | DeepContext |
| License compliance | Context7, Vibe Check, all providers via validation plugin |

### Missing Features (WikidataMCP)

| Feature | Priority | Impact | Implementation Effort |
|---------|----------|--------|----------------------|
| Vector search (items) | High | Semantic entity discovery | Medium |
| Vector search (properties) | Medium | Enhanced property discovery | Medium |
| Get entity claims | High | Graph traversal with triplets | Low |
| Get claim values | High | Comprehensive claim data | Low |

---

## Integration Architecture

### Provider Registry System

All academic providers are managed through a centralized registry:

**Location:** `packages/cortexdx/src/registry/providers/academic.ts`

**Features:**
- Automatic provider discovery
- Health monitoring
- Capability management
- Rate limiting enforcement
- License validation integration

### HTTP MCP Client

For remote MCP server connections:

**Location:** `packages/cortexdx/src/providers/academic/http-mcp-client.ts`

**Capabilities:**
- Bearer token authentication
- Tool argument sanitization
- Header management
- Error handling with fallbacks

---

## Testing Coverage

### Test Files

1. `packages/cortexdx/tests/academic-providers.spec.ts` - Provider registry tests
2. `packages/cortexdx/tests/academic-research-tool.spec.ts` - Integration tests
3. `packages/cortexdx/tests/academic-researcher.spec.ts` - Researcher workflow tests
4. `packages/cortexdx/tests/deepcontext-*.spec.ts` - DeepContext-specific tests (4 files)
5. `tests/mcp-evals/cortexdx-basic.evals.mjs` - MCP evaluation harness
6. `tests/mcp-evals/client-routing.evals.mjs` - Client routing tests

### Coverage Areas

- ✅ Provider instantiation
- ✅ Tool execution
- ✅ Health checks
- ✅ Capability validation
- ✅ Registry functionality
- ⚠️ Missing: Integration tests against live upstream servers

---

## Authentication & Configuration

### Required Environment Variables

| Provider | Required | Optional | Notes |
|----------|----------|----------|-------|
| DeepContext | `WILDCARD_API_KEY` | `JINA_API_KEY`, `TURBOPUFFER_API_KEY` | Self-hosted needs additional keys |
| WikidataMCP | None | None | Public API |
| arXiv | None | None | Public API |
| Context7 | None | `CONTEXT7_API_KEY`, `CONTEXT7_API_BASE_URL` | Remote server optional |
| Semantic Scholar | None | `SEMANTIC_SCHOLAR_API_KEY` | Higher rate limits with key |
| Vibe Check | None | `VIBE_CHECK_API_KEY`, `VIBE_CHECK_HTTP_URL` | Remote optional |
| OpenAlex | `OPENALEX_CONTACT_EMAIL` | None | Polite pool access |

---

## Recommendations

### Immediate Actions (High Priority)

1. **Implement Missing WikidataMCP Tools**
   - Add `vector_search_items` and `vector_search_properties`
   - Add `get_entity_claims` and `get_claim_values`
   - Integrate with Wikidata vector database service

2. **Add Integration Tests**
   - Create tests against live upstream servers
   - Add mock servers for offline testing
   - Validate tool compatibility

3. **Update Documentation**
   - Correct arXiv reference (already fixed in this document)
   - Add implementation status badges to README

### Future Enhancements (Medium Priority)

1. **Add Exa Provider Integration**
   - Currently implemented but not in upstream comparison
   - Document capabilities and coverage

2. **Expand Context7 Remote Features**
   - Add more remote server capabilities
   - Implement caching layer for remote responses

3. **Add Provider Health Dashboard**
   - Real-time health monitoring UI
   - Historical uptime tracking
   - Rate limit usage visualization

---

## Changelog

### 2025-11-15 - Initial Comparison Matrix

- Created comprehensive comparison between upstream and CortexDx implementations
- Identified WikidataMCP partial implementation (57% coverage)
- Corrected arXiv documentation (now references blazickjp/arxiv-mcp-server)
- Documented Context7 enhancements beyond upstream
- Confirmed DeepContext full compliance

---

## References

### Upstream Repositories

- [Wildcard-Official/deepcontext-mcp](https://github.com/Wildcard-Official/deepcontext-mcp)
- [philippesaade-wmde/WikidataMCP](https://github.com/philippesaade-wmde/WikidataMCP)
- [blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server)
- [upstash/context7](https://github.com/upstash/context7)
- [SnippetSquid/SemanticScholarMCP](https://github.com/SnippetSquid/SemanticScholarMCP)
- [PV-Bhat/vibe-check-mcp-server](https://github.com/PV-Bhat/vibe-check-mcp-server)

### API Documentation

- [Semantic Scholar API](https://api.semanticscholar.org/)
- [OpenAlex API](https://docs.openalex.org/)
- [Wikidata API](https://www.wikidata.org/w/api.php)
- [arXiv API](https://arxiv.org/help/api)
- [FASTMCP Specification](https://spec.modelcontextprotocol.io/)

### CortexDx Documentation

- [MCP Evaluation Harness](../docs/mcp-evals.md)
- [Academic Providers README](../packages/cortexdx/src/providers/academic/README.md)
- [MCP Implementation Planning](../.cortexdx/context/protocols/network/mcp.md)
