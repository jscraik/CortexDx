/**
 * Integration tests for academic research tools
 * Tests against actual provider implementations
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ArxivProvider } from "../src/providers/academic/arxiv.mcp.js";
import { Context7Provider } from "../src/providers/academic/context7.mcp.js";
import { WikidataProvider } from "../src/providers/academic/wikidata.mcp.js";
import type { DiagnosticContext } from "../src/types.js";

// Mock diagnostic context for testing
function createMockDiagnosticContext(): DiagnosticContext {
  return {
    logger: (...args: unknown[]) => console.log("[TEST]", ...args),
    evidence: () => {},
    request: async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
      const response = await fetch(input as string, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
      }
      return (await response.text()) as T;
    },
    headers: {},
  };
}

describe("WikidataMCP Integration Tests", () => {
  let provider: WikidataProvider;
  let ctx: DiagnosticContext;

  beforeEach(() => {
    ctx = createMockDiagnosticContext();
    provider = new WikidataProvider(ctx);
  });

  it("should perform keyword search for entities", async () => {
    const results = await provider.searchEntities({
      search: "Albert Einstein",
      limit: 5,
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("label");
  });

  it("should get entity details", async () => {
    // Q42 is Douglas Adams in Wikidata
    const entity = await provider.getEntity("Q42", "en");

    expect(entity).toBeDefined();
    expect(entity?.id).toBe("Q42");
    expect(entity?.label).toBeDefined();
    expect(entity?.description).toBeDefined();
  });

  it("should execute SPARQL query", async () => {
    const query = `
      SELECT ?item ?itemLabel WHERE {
        ?item wdt:P31 wd:Q5.
        ?item wdt:P106 wd:Q1650915.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT 5
    `;

    const result = await provider.executeSparql(query);

    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("should search for academic entities (researchers)", async () => {
    const results = await provider.searchAcademicEntities(
      "Einstein",
      "researcher",
      5,
    );

    expect(results).toBeDefined();
    expect(typeof results).toBe("object");
  });

  it("should perform vector search for items (with fallback)", async () => {
    const results = await provider.vectorSearchItems(
      "physicist working on relativity",
      5,
    );

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("score");
  });

  it("should perform vector search for properties (with fallback)", async () => {
    const results = await provider.vectorSearchProperties("date of birth", 5);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("score");
  });

  it("should get entity claims in triplet format", async () => {
    // Q42 is Douglas Adams
    const claims = await provider.getEntityClaims("Q42", undefined, "en");

    expect(claims).toBeDefined();
    expect(Array.isArray(claims)).toBe(true);
    expect(claims.length).toBeGreaterThan(0);

    const firstClaim = claims[0];
    expect(firstClaim).toHaveProperty("subject");
    expect(firstClaim).toHaveProperty("property");
    expect(firstClaim).toHaveProperty("value");
    expect(firstClaim?.subject).toBe("Q42");
  });

  it("should get entity claims with property filter", async () => {
    // Q42 is Douglas Adams, P31 is "instance of"
    const claims = await provider.getEntityClaims("Q42", ["P31"], "en");

    expect(claims).toBeDefined();
    expect(Array.isArray(claims)).toBe(true);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((c) => c.property === "P31")).toBe(true);
  });

  it("should get claim values with qualifiers and references", async () => {
    // Q42 is Douglas Adams, P31 is "instance of"
    const claimValues = await provider.getClaimValues("Q42", "P31", "en");

    expect(claimValues).toBeDefined();
    expect(Array.isArray(claimValues)).toBe(true);
    expect(claimValues.length).toBeGreaterThan(0);

    const firstClaim = claimValues[0];
    expect(firstClaim).toHaveProperty("property");
    expect(firstClaim).toHaveProperty("value");
    expect(firstClaim).toHaveProperty("rank");
    expect(firstClaim?.property).toBe("P31");
  });

  it("should execute all tools via executeTool method", async () => {
    // Test wikidata_search
    const searchResult = await provider.executeTool("wikidata_search", {
      search: "Einstein",
      limit: 5,
    });
    expect(searchResult).toBeDefined();

    // Test wikidata_entity
    const entityResult = await provider.executeTool("wikidata_entity", {
      id: "Q42",
      language: "en",
    });
    expect(entityResult).toBeDefined();

    // Test wikidata_get_entity_claims
    const claimsResult = await provider.executeTool(
      "wikidata_get_entity_claims",
      {
        entity_id: "Q42",
        language: "en",
      },
    );
    expect(claimsResult).toBeDefined();

    // Test wikidata_get_claim_values
    const claimValuesResult = await provider.executeTool(
      "wikidata_get_claim_values",
      {
        entity_id: "Q42",
        property_id: "P31",
        language: "en",
      },
    );
    expect(claimValuesResult).toBeDefined();
  });

  it("should pass health check", async () => {
    const isHealthy = await provider.healthCheck();
    expect(isHealthy).toBe(true);
  });
});

describe("arXiv Integration Tests", () => {
  let provider: ArxivProvider;
  let ctx: DiagnosticContext;

  beforeEach(() => {
    ctx = createMockDiagnosticContext();
    provider = new ArxivProvider(ctx);
  });

  it("should search for papers", async () => {
    const results = await provider.searchPapers({
      search_query: "machine learning",
      max_results: 5,
    });

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("authors");
  });

  it("should search by category", async () => {
    const results = await provider.searchByCategory("cs.AI", 5);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.categories).toContain("cs.AI");
  });

  it("should search by author", async () => {
    const results = await provider.searchByAuthor("LeCun", 5);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("should get papers by ID", async () => {
    const results = await provider.getPapers(["1706.03762"]);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
    expect(results[0]?.id).toContain("1706.03762");
  });

  it("should return available categories", async () => {
    const categories = provider.getCategories();

    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.some((cat) => cat.id === "cs.AI")).toBe(true);
  });

  it("should filter categories by group", async () => {
    const csCategories = provider.getCategories("Computer Science");

    expect(csCategories).toBeDefined();
    expect(Array.isArray(csCategories)).toBe(true);
    expect(csCategories.every((cat) => cat.group === "Computer Science")).toBe(
      true,
    );
  });

  it("should pass health check", async () => {
    const isHealthy = await provider.healthCheck();
    expect(isHealthy).toBe(true);
  });
});

describe("Context7 Integration Tests", () => {
  let provider: Context7Provider;
  let ctx: DiagnosticContext;

  beforeEach(() => {
    ctx = createMockDiagnosticContext();
    provider = new Context7Provider(ctx);
  });

  it("should analyze paper context", async () => {
    const analysis = await provider.analyzePaper({
      title: "Attention Is All You Need",
      abstract:
        "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
      keywords: ["transformer", "attention", "neural networks"],
      analysis_depth: "medium",
    });

    expect(analysis).toBeDefined();
    expect(analysis).toHaveProperty("context_score");
    expect(analysis).toHaveProperty("relevance_metrics");
    expect(analysis).toHaveProperty("thematic_analysis");
    expect(analysis.thematic_analysis.primary_themes).toContain("transformer");
  });

  it("should analyze citation context", async () => {
    const citations = await provider.analyzeCitationContext("test-paper-id", {
      includeSentiment: true,
      maxCitations: 10,
    });

    expect(citations).toBeDefined();
    expect(Array.isArray(citations)).toBe(true);

    if (citations.length > 0) {
      expect(citations[0]).toHaveProperty("citing_paper_id");
      expect(citations[0]).toHaveProperty("citation_type");
      expect(citations[0]).toHaveProperty("sentiment_score");
    }
  });

  it("should validate architecture with license compliance", async () => {
    const result = await provider.validateArchitecture(
      {
        components: ["api", "database", "frontend"],
        interfaces: ["REST API", "GraphQL"],
        dataModels: { user: {}, paper: {} },
      },
      undefined,
      true,
    );

    expect(result).toBeDefined();
    expect(result).toHaveProperty("isValid");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("licenseCompliance");
    expect(typeof result.score).toBe("number");
  });

  it("should assess code quality", async () => {
    const code = `
      /**
       * Calculate the sum of two numbers
       * @param a - First number
       * @param b - Second number
       * @returns The sum
       */
      function add(a: number, b: number): number {
        return a + b;
      }
    `;

    const assessment = await provider.assessCodeQuality(
      code,
      "typescript",
      undefined,
      true,
    );

    expect(assessment).toBeDefined();
    expect(assessment).toHaveProperty("overallScore");
    expect(assessment).toHaveProperty("maintainability");
    expect(assessment).toHaveProperty("documentation");
    expect(assessment).toHaveProperty("licenseCompliance");
    expect(typeof assessment.overallScore).toBe("number");
  });

  it("should pass health check", async () => {
    const isHealthy = await provider.healthCheck();
    expect(isHealthy).toBe(true);
  });
});

describe("Tool Definitions Compliance", () => {
  it("WikidataProvider should expose all 8 tools", () => {
    const tools = WikidataProvider.getToolDefinitions();

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(8);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("wikidata_search");
    expect(toolNames).toContain("wikidata_vector_search_items");
    expect(toolNames).toContain("wikidata_vector_search_properties");
    expect(toolNames).toContain("wikidata_entity");
    expect(toolNames).toContain("wikidata_sparql");
    expect(toolNames).toContain("wikidata_academic_search");
    expect(toolNames).toContain("wikidata_get_entity_claims");
    expect(toolNames).toContain("wikidata_get_claim_values");
  });

  it("ArxivProvider should expose all 5 tools", () => {
    const tools = ArxivProvider.getToolDefinitions();

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(5);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("arxiv_search");
    expect(toolNames).toContain("arxiv_get_paper");
    expect(toolNames).toContain("arxiv_search_by_category");
    expect(toolNames).toContain("arxiv_search_by_author");
    expect(toolNames).toContain("arxiv_get_categories");
  });

  it("Context7Provider should expose all 7 tools", () => {
    const tools = Context7Provider.getToolDefinitions();

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(7);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("context7_analyze_paper");
    expect(toolNames).toContain("context7_find_related_papers");
    expect(toolNames).toContain("context7_citation_context");
    expect(toolNames).toContain("context7_research_trajectory");
    expect(toolNames).toContain("context7_interdisciplinary_analysis");
    expect(toolNames).toContain("context7_validate_architecture");
    expect(toolNames).toContain("context7_assess_code_quality");
  });

  it("All tool definitions should have FASTMCP v3.22 compliant schemas", () => {
    const allTools = [
      ...WikidataProvider.getToolDefinitions(),
      ...ArxivProvider.getToolDefinitions(),
      ...Context7Provider.getToolDefinitions(),
    ];

    for (const tool of allTools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
      expect(tool.inputSchema).toHaveProperty("type");
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema).toHaveProperty("properties");
    }
  });
});
