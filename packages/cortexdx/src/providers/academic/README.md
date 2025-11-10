# Academic Research MCP Providers

This directory contains FASTMCP v3.22 compliant providers for academic research tools and services. These providers enable comprehensive research workflows including paper discovery, citation analysis, quality assessment, and contextual research analysis.

## Available Providers

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

### 2. OpenAlex Provider (`openalex.mcp.ts`)

**Capabilities**:

- Scholarly work discovery
- Author research metrics
- Institutional analysis
- Research impact assessment

**Key Tools**:

- `openalex_search_works` - Comprehensive work search
- `openalex_search_authors` - Author discovery with metrics
- `openalex_search_institutions` - Institutional research
- `openalex_get_work` - Detailed work information
- `openalex_get_author` - Author profiles with h-index

### 3. Wikidata Provider (`wikidata.mcp.ts`)

**Based on**: Wikidata API and inspired by [philippesaade-wmde/WikidataMCP](https://github.com/philippesaade-wmde/WikidataMCP)

**Capabilities**:

- SPARQL query execution
- Knowledge graph traversal
- Entity lookup and relationships
- Academic entity discovery

**Key Tools**:

- `wikidata_search` - Entity search
- `wikidata_entity` - Detailed entity information
- `wikidata_sparql` - Custom SPARQL queries
- `wikidata_academic_search` - Academic-focused search

### 4. arXiv Provider (`arxiv.mcp.ts`)

**Based on**: arXiv API v1.0 and inspired by [blazickjp/arxiv-mcp-server](https://github.com/blazickjp/arxiv-mcp-server)

**Capabilities**:

- Preprint search and discovery
- Category-based filtering
- Author publication tracking
- Metadata extraction

**Key Tools**:

- `arxiv_search` - Advanced preprint search
- `arxiv_get_paper` - Paper details by ID
- `arxiv_search_by_category` - Category-specific search
- `arxiv_search_by_author` - Author-based discovery
- `arxiv_get_categories` - Available categories

### 5. Vibe Check Provider (`vibe-check.mcp.ts`)

**Based on**: Research quality metrics and inspired by [PV-Bhat/vibe-check-mcp-server](https://github.com/PV-Bhat/vibe-check-mcp-server)

**Capabilities**:

- Research quality assessment
- Academic integrity validation
- Methodology review
- Predatory publisher detection

**Key Tools**:

- `vibe_check_assess_quality` - Comprehensive quality assessment
- `vibe_check_venue_assessment` - Publication venue evaluation
- `vibe_check_citation_analysis` - Citation pattern analysis
- `vibe_check_methodology_review` - Methodology validation

### 6. Context7 Provider (`context7.mcp.ts`)

**Based on**: Context7 API and inspired by [upstash/context7](https://github.com/upstash/context7)

**Capabilities**:

- Contextual research analysis
- Cross-reference discovery
- Citation context analysis
- Research trajectory tracking

**Key Tools**:

- `context7_analyze_paper` - Comprehensive contextual analysis
- `context7_find_related_papers` - Related work discovery
- `context7_citation_context` - Citation context analysis
- `context7_research_trajectory` - Research evolution tracking
- `context7_interdisciplinary_analysis` - Cross-field analysis

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

## References

- [Semantic Scholar API Documentation](https://api.semanticscholar.org/)
- [OpenAlex API Documentation](https://docs.openalex.org/)
- [Wikidata API Documentation](https://www.wikidata.org/w/api.php)
- [arXiv API Documentation](https://arxiv.org/help/api)
- [FASTMCP v3.22 Specification](https://spec.modelcontextprotocol.io/specification/)
