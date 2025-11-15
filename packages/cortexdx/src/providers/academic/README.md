# Academic Research MCP Providers

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../../../LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-blue.svg)](https://spec.modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

This directory contains FASTMCP v3.22 compliant providers for academic research tools and services. These providers enable comprehensive research workflows including paper discovery, citation analysis, quality assessment, and contextual research analysis.

## Available Providers

### Implementation Status Summary

| Provider | Status | Coverage | Upstream Source |
|----------|--------|----------|-----------------|
| Semantic Scholar | ✅ Full | 100% (7/7 tools) | [SnippetSquid/SemanticScholarMCP](https://github.com/SnippetSquid/SemanticScholarMCP) |
| OpenAlex | ✅ Native | N/A (5 tools) | Native CortexDx implementation |
| Wikidata | ✅ Full | 100% (8/8 tools) | [philippesaade-wmde/WikidataMCP](https://github.com/philippesaade-wmde/WikidataMCP) |
| arXiv | ✅ Full | 100% (5/5 tools) | [blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server) |
| Research Quality | ✅ Enhanced | 100%+ (7 tools) | [PV-Bhat/vibe-check-mcp-server](https://github.com/PV-Bhat/vibe-check-mcp-server) |
| Cortex Vibe | ✅ Full | 100% (5 tools) | [@brainwav/cortex-vibe-mcp](https://github.com/jscraik/Cortex-Vibe-MCP) |
| Context7 | ✅ Enhanced | 100%+ (7 tools) | [upstash/context7](https://github.com/upstash/context7) |
| Exa | ✅ Native | N/A (3 tools) | Native CortexDx implementation |

For a detailed feature comparison, see [docs/academic-research-tools-comparison.md](../../../../docs/academic-research-tools-comparison.md)

---

### 1. Semantic Scholar Provider (`semantic-scholar.mcp.ts`)

**Based on**: Semantic Scholar API v1 and inspired by [SnippetSquid/SemanticScholarMCP](https://github.com/SnippetSquid/SemanticScholarMCP)

**Capabilities**:

- Paper search with advanced filtering
- Citation and reference analysis
- Author search and profile information
- Publication venue details
- Open access PDF detection

**Key Tools**:

- `semantic_scholar_search_papers` - Advanced paper search
- `semantic_scholar_get_paper` - Detailed paper information
- `semantic_scholar_get_paper_citations` - Citation analysis
- `semantic_scholar_get_paper_references` - Reference tracking
- `semantic_scholar_search_authors` - Author discovery
- `semantic_scholar_get_author` - Author profiles
- `semantic_scholar_get_author_papers` - Author publication lists

**Implementation Status**: ✅ **100% compliant** with upstream SnippetSquid/SemanticScholarMCP

### 2. OpenAlex Provider (`openalex.mcp.ts`)

**Native CortexDx Implementation** - No direct upstream MCP server

**Capabilities**:

- Scholarly work discovery
- Author research metrics (h-index, i10-index, citation counts)
- Institutional analysis
- Research impact assessment
- Open access status detection

**Key Tools**:

- `openalex_search_works` - Comprehensive work search
- `openalex_search_authors` - Author discovery with metrics
- `openalex_search_institutions` - Institutional research
- `openalex_get_work` - Detailed work information
- `openalex_get_author` - Author profiles with h-index

**Environment Variables**:
- `OPENALEX_CONTACT_EMAIL` (required for polite pool access)

**Implementation Status**: ✅ **Native implementation** - CortexDx original with full FASTMCP v3.22 compliance

### 3. Wikidata Provider (`wikidata.mcp.ts`)

**Based on**: Wikidata API and inspired by [philippesaade-wmde/WikidataMCP](https://github.com/philippesaade-wmde/WikidataMCP)

**Capabilities**:

- SPARQL query execution
- Knowledge graph traversal
- Entity lookup and relationships
- Academic entity discovery (researchers, institutions, publications, journals)

**Key Tools**:

- `wikidata_search` - Entity search
- `wikidata_entity` - Detailed entity information
- `wikidata_sparql` - Custom SPARQL queries
- `wikidata_academic_search` - Academic-focused search

**Implementation Status**: ✅ **100% coverage** (8/8 tools)
### 4. arXiv Provider (`arxiv.mcp.ts`)

**Based on**: arXiv API v1.0 and inspired by [blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server)

**Note**: This implementation is based on the arXiv MCP server, not [space-cadet/arxivite](https://github.com/space-cadet/arxivite) which is a full-stack research application with UI, Zotero integration, and database requirements.

**Capabilities**:

- Preprint search and discovery
- Category-based filtering (cs.AI, cs.LG, stat.ML, etc.)
- Author publication tracking
- Metadata extraction (DOI, journal refs, comments)
- License compliance checking

**Key Tools**:

- `arxiv_search` - Advanced preprint search with field queries
- `arxiv_get_paper` - Paper details by ID list
- `arxiv_search_by_category` - Category-specific search
- `arxiv_search_by_author` - Author-based discovery
- `arxiv_get_categories` - Available categories enumeration

**Implementation Status**: ✅ **100% compliant** with upstream blazickjp/arxiv-mcp-server plus category enhancements

### 5. Research Quality Provider (`research-quality.mcp.ts`)

**Based on**: Research quality metrics and inspired by [PV-Bhat/vibe-check-mcp-server](https://github.com/PV-Bhat/vibe-check-mcp-server)

**Purpose**: Academic research quality assessment and integrity validation

**Note**: Enhanced with anti-pattern detection, code health analysis, and refactoring suggestions beyond upstream. For AI agent metacognitive oversight, see Cortex Vibe provider.

**Capabilities**:

- Research quality assessment (multi-dimensional scoring)
- Academic integrity validation
- Methodology review with statistical rigor checks
- Predatory publisher detection
- Citation pattern anomaly detection
- Anti-pattern detection in research code
- Refactoring recommendations

**Key Tools**:

- `research_quality_assess_quality` - Comprehensive quality assessment
- `research_quality_venue_assessment` - Publication venue evaluation with predatory detection
- `research_quality_citation_analysis` - Citation pattern analysis with anomaly detection
- `research_quality_methodology_review` - Methodology validation with statistical rigor
- `research_quality_detect_anti_patterns` - Code anti-pattern detection
- `research_quality_refactoring_suggestions` - Refactoring recommendations
- `research_quality_code_health` - Code health analysis

**Environment Variables**:
- `RESEARCH_QUALITY_API_KEY` (optional)
- `RESEARCH_QUALITY_HTTP_URL` (optional, for remote instances)

**Implementation Status**: ✅ **100%+ compliant** - Enhanced with code quality features beyond upstream

### 6. Cortex Vibe Provider (`cortex-vibe.mcp.ts`)

**Based on**: [@brainwav/cortex-vibe-mcp](https://github.com/jscraik/Cortex-Vibe-MCP) v0.0.19

**Purpose**: AI agent metacognitive oversight and safety alignment

**Note**: Chain-Pattern Interrupts (CPI) for preventing tunnel vision and reasoning lock-in in autonomous agents. For academic research quality assessment, see Research Quality provider.

**Capabilities**:

- Metacognitive self-checks (CPI)
- Assumption challenge and validation
- Tunnel vision prevention
- Learning capture (mistakes/successes/preferences)
- Session-based constitution rules for agent behavior
- Agent alignment and safety oversight

**Key Tools**:

- `cortex_vibe_check` - Challenge assumptions and prevent tunnel vision
- `cortex_vibe_learn` - Capture mistakes, preferences, and successes
- `cortex_update_constitution` - Set/merge session rules for CPI enforcement
- `cortex_reset_constitution` - Clear rules for a session
- `cortex_check_constitution` - Inspect effective rules

**Environment Variables**:
- `CORTEX_VIBE_API_BASE_URL` or `CORTEX_VIBE_HTTP_URL` (optional, for remote server)
- `CORTEXDX_DISABLE_CORTEX_VIBE_HTTP` (set to "1" to disable remote calls)

**Integration**: Works with both remote Cortex Vibe MCP servers and local fallback mode

**Implementation Status**: ✅ **100% compliant** with local fallback for offline operation

### 7. Context7 Provider (`context7.mcp.ts`)

**Based on**: Context7 API and inspired by [upstash/context7](https://github.com/upstash/context7)

**Note**: Significantly enhanced beyond upstream. Original Context7 focuses on documentation retrieval; CortexDx adds comprehensive academic research capabilities.

**Capabilities**:

- Contextual research analysis
- Cross-reference discovery with relationship types
- Citation context analysis with sentiment scoring
- Research trajectory tracking
- Interdisciplinary connection mapping
- Architecture validation with license compliance
- Code quality assessment with academic standards

**Key Tools**:

- `context7_analyze_paper` - Comprehensive contextual analysis with relevance metrics
- `context7_find_related_papers` - Related work discovery with relationship types
- `context7_citation_context` - Citation context analysis with sentiment by section
- `context7_research_trajectory` - Research evolution tracking (topic/author/methodology)
- `context7_interdisciplinary_analysis` - Cross-field influence mapping
- `context7_validate_architecture` - Design validation with license compliance checking
- `context7_assess_code_quality` - Academic standards assessment with license validation

**Implementation Status**: ✅ **100%+ compliant** - Enhanced with academic research features beyond upstream

## Registry System

The academic providers are managed through a centralized registry system (`../registry/providers/academic.ts`) that provides:

- **Provider Discovery**: Automatic registration and discovery of all academic providers
- **Health Monitoring**: Built-in health checks for all providers
- **Capability Management**: Centralized capability definitions and tool registration
- **Categorization**: Providers organized by research function (paper search, quality assessment, etc.)
- **Rate Limiting**: Provider-specific rate limit definitions

### Usage Example

```typescript
import { getAcademicRegistry } from "../registry/index.js";

// Get the registry instance
const registry = getAcademicRegistry();

// Create a provider instance
const semanticScholar = registry.createProviderInstance("semantic-scholar", diagnosticContext);

// Execute a tool
const papers = await semanticScholar.executeTool("semantic_scholar_search_papers", {
  query: "machine learning",
  limit: 10
});

// Perform health checks
const healthStatus = await registry.performHealthChecks(diagnosticContext);
```

## Provider Categories

Providers are organized into the following categories:

- **paper_search**: semantic-scholar, openalex, arxiv
- **citation_analysis**: semantic-scholar, openalex, context7
- **author_research**: openalex, wikidata, semantic-scholar
- **quality_assessment**: vibe-check
- **contextual_analysis**: context7, wikidata
- **preprint_access**: arxiv
- **knowledge_graph**: wikidata
- **institutional_research**: openalex, wikidata
- **research_integrity**: vibe-check
- **cross_referencing**: context7, semantic-scholar

## Rate Limits and Authentication

Most providers have built-in rate limiting:

- **Semantic Scholar**: 100 req/min, 1000 req/hour, 10000 req/day
- **OpenAlex**: 100 req/min, 10000 req/hour
- **Wikidata**: 200 req/min, 5000 req/hour
- **arXiv**: 60 req/min, 1000 req/hour
- **Vibe Check**: No limits (local analysis)
- **Context7**: No limits (local analysis)

Authentication is not required for any of the current providers, though the system supports authentication headers for future providers that may require API keys.

## Testing

The providers include comprehensive test coverage in `../../tests/academic-providers.spec.ts` covering:

- Registry functionality
- Provider instantiation
- Tool execution
- Health checks
- Capability validation

Run tests with:

```bash
pnpm test
```

## Contributing

When adding new academic providers:

1. Implement the provider class with required methods (`healthCheck`, `executeTool`)
2. Define FASTMCP v3.22 compliant tool definitions
3. Register the provider in the academic registry
4. Add appropriate tests
5. Update this README with provider details
6. Verify all upstream attributions are correct
7. Check license compatibility with Apache 2.0

See the main [Contributing Guide](../../../../../CONTRIBUTING.md) for complete development setup and coding standards.

## Support

For issues or questions:

- **GitHub Issues**: [CortexDx Issues](https://github.com/jscraik/CortexDx/issues)
- **Documentation**: See main [CortexDx Documentation](../../../../../README.md) and [Academic Tools Comparison](../../../../../docs/academic-research-tools-comparison.md)
- **MCP Specification**: <https://spec.modelcontextprotocol.io/>

## License

Licensed under the [Apache License 2.0](../../../../../LICENSE)

### Upstream Attributions

This implementation includes adaptations and inspirations from the following open-source projects:

- **Semantic Scholar MCP**: [SnippetSquid/SemanticScholarMCP](https://github.com/SnippetSquid/SemanticScholarMCP) (MIT License)
- **Wikidata MCP**: [philippesaade-wmde/WikidataMCP](https://github.com/philippesaade-wmde/WikidataMCP) (MIT License)
- **arXiv MCP Server**: [blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server) (MIT License)
- **Vibe Check MCP**: [PV-Bhat/vibe-check-mcp-server](https://github.com/PV-Bhat/vibe-check-mcp-server) (MIT License)
- **Cortex Vibe MCP**: [@brainwav/cortex-vibe-mcp](https://github.com/jscraik/Cortex-Vibe-MCP) (Apache-2.0)  
  _(npm package maintained under @brainwav, based on/forked from jscraik/Cortex-Vibe-MCP)_
- **Context7**: [upstash/context7](https://github.com/upstash/context7) (MIT License)

All upstream projects are used in compliance with their respective licenses.

## References

- [Semantic Scholar API Documentation](https://api.semanticscholar.org/)
- [OpenAlex API Documentation](https://docs.openalex.org/)
- [Wikidata API Documentation](https://www.wikidata.org/w/api.php)
- [arXiv API Documentation](https://arxiv.org/help/api)
- [FASTMCP v3.22 Specification](https://spec.modelcontextprotocol.io/specification/)
