/**
 * Academic Research Providers Registry
 * FASTMCP v3.22 compliant provider registry for academic research tools
 */

import {
  ArxivProvider,
  arxivCapabilities,
} from "../../providers/academic/arxiv.mcp.js";
import {
  Context7Provider,
  context7Capabilities,
} from "../../providers/academic/context7.mcp.js";
import {
  ExaProvider,
  exaCapabilities,
} from "../../providers/academic/exa.mcp.js";
import {
  OpenAlexProvider,
  openAlexCapabilities,
} from "../../providers/academic/openalex.mcp.js";
import {
  SemanticScholarProvider,
  semanticScholarCapabilities,
} from "../../providers/academic/semantic-scholar.mcp.js";
import {
  ResearchQualityProvider,
  researchQualityCapabilities,
} from "../../providers/academic/research-quality.mcp.js";
import {
  CortexVibeProvider,
  cortexVibeCapabilities,
} from "../../providers/academic/cortex-vibe.mcp.js";
import {
  WikidataProvider,
  wikidataCapabilities,
} from "../../providers/academic/wikidata.mcp.js";
import type { DiagnosticContext } from "../../types.js";

export interface ProviderCapability {
  id: string;
  name: string;
  version: string;
  description: string;
  tools: unknown[];
  resources: unknown[];
  prompts: unknown[];
}

export interface ProviderInstance {
  executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<unknown>;
  healthCheck?(): Promise<boolean>;
}

export interface ProviderRegistration {
  id: string;
  name: string;
  description: string;
  provider_class: unknown;
  capabilities: ProviderCapability;
  health_check_endpoint?: string;
  requires_auth?: boolean;
  rate_limits?: {
    requests_per_minute?: number;
    requests_per_hour?: number;
    requests_per_day?: number;
  };
  tags: string[];
}

export interface AcademicProviderRegistry {
  providers: Record<string, ProviderRegistration>;
  categories: Record<string, string[]>;
  discovery_endpoints: string[];
}

/**
 * Academic Research Providers Registry
 * Centralized registry for all academic research MCP providers
 */
export class AcademicRegistry {
  private static instance: AcademicRegistry;
  private registry: AcademicProviderRegistry;

  private constructor() {
    this.registry = {
      providers: {},
      categories: {
        paper_search: ["semantic-scholar", "openalex", "arxiv"],
        citation_analysis: ["semantic-scholar", "openalex", "context7"],
        author_research: ["openalex", "wikidata", "semantic-scholar"],
        quality_assessment: ["research-quality"],
        contextual_analysis: ["context7", "wikidata"],
        preprint_access: ["arxiv"],
        knowledge_graph: ["wikidata"],
        institutional_research: ["openalex", "wikidata"],
        research_integrity: ["research-quality"],
        cross_referencing: ["context7", "semantic-scholar"],
        agent_oversight: ["cortex-vibe"],
      },
      discovery_endpoints: [
        "/api/v1/providers/academic/discover",
        "/api/v1/providers/academic/health",
        "/api/v1/providers/academic/capabilities",
      ],
    };

    this.registerAllProviders();
  }

  public static getInstance(): AcademicRegistry {
    if (!AcademicRegistry.instance) {
      AcademicRegistry.instance = new AcademicRegistry();
    }
    return AcademicRegistry.instance;
  }

  /**
   * Register all academic providers
   */
  private registerAllProviders(): void {
    // Register Semantic Scholar provider
    this.registerProvider({
      id: "semantic-scholar",
      name: "Semantic Scholar Academic Provider",
      description:
        "Academic paper search and citation analysis via Semantic Scholar API",
      provider_class: SemanticScholarProvider,
      capabilities: semanticScholarCapabilities,
      health_check_endpoint:
        "https://api.semanticscholar.org/graph/v1/paper/search?query=test&limit=1",
      requires_auth: false,
      rate_limits: {
        requests_per_minute: 100,
        requests_per_hour: 1000,
        requests_per_day: 10000,
      },
      tags: ["papers", "citations", "authors", "academic", "search"],
    });

    // Register OpenAlex provider
    this.registerProvider({
      id: "openalex",
      name: "OpenAlex Academic Provider",
      description: "Scholarly work and author research via OpenAlex API",
      provider_class: OpenAlexProvider,
      capabilities: openAlexCapabilities,
      health_check_endpoint: "https://api.openalex.org/works?per-page=1",
      requires_auth: false,
      rate_limits: {
        requests_per_minute: 100,
        requests_per_hour: 10000,
      },
      tags: ["works", "authors", "institutions", "academic", "metrics"],
    });

    // Register Wikidata provider
    this.registerProvider({
      id: "wikidata",
      name: "Wikidata Knowledge Graph Provider",
      description: "SPARQL queries and knowledge graph access via Wikidata",
      provider_class: WikidataProvider,
      capabilities: wikidataCapabilities,
      health_check_endpoint:
        "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=test&limit=1&format=json",
      requires_auth: false,
      rate_limits: {
        requests_per_minute: 200,
        requests_per_hour: 5000,
      },
      tags: [
        "knowledge-graph",
        "sparql",
        "entities",
        "academic",
        "researchers",
      ],
    });

    // Register arXiv provider
    this.registerProvider({
      id: "arxiv",
      name: "arXiv Preprint Provider",
      description: "Preprint search and metadata extraction via arXiv API",
      provider_class: ArxivProvider,
      capabilities: arxivCapabilities,
      health_check_endpoint:
        "http://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=1",
      requires_auth: false,
      rate_limits: {
        requests_per_minute: 60,
        requests_per_hour: 1000,
      },
      tags: ["preprints", "papers", "categories", "academic", "search"],
    });

    // Register Research Quality provider
    this.registerProvider({
      id: "research-quality",
      name: "Research Quality Assessment Provider",
      description:
        "Academic research quality assessment and integrity validation with code health analysis",
      provider_class: ResearchQualityProvider,
      capabilities: researchQualityCapabilities,
      requires_auth: false,
      tags: ["quality", "integrity", "assessment", "academic", "validation"],
    });

    // Register Cortex Vibe provider
    this.registerProvider({
      id: "cortex-vibe",
      name: "Cortex Vibe Metacognitive Oversight Provider",
      description:
        "AI agent metacognitive oversight and safety alignment with Chain-Pattern Interrupts (CPI)",
      provider_class: CortexVibeProvider,
      capabilities: cortexVibeCapabilities,
      requires_auth: false,
      tags: ["metacognition", "cpi", "agent-safety", "alignment", "oversight"],
    });

    // Register Context7 provider
    this.registerProvider({
      id: "context7",
      name: "Context7 Contextual Research Provider",
      description: "Contextual research analysis and cross-reference discovery",
      provider_class: Context7Provider,
      capabilities: context7Capabilities,
      requires_auth: false,
      tags: [
        "context",
        "analysis",
        "cross-reference",
        "academic",
        "relationships",
      ],
    });

    // Register Exa provider
    this.registerProvider({
      id: "exa",
      name: "Exa Advanced Search Provider",
      description:
        "Advanced search validation and content analysis with relevance scoring",
      provider_class: ExaProvider,
      capabilities: exaCapabilities,
      health_check_endpoint: "https://api.exa.ai/search",
      requires_auth: true,
      rate_limits: {
        requests_per_minute: 60,
        requests_per_hour: 1000,
      },
      tags: [
        "search",
        "validation",
        "content-analysis",
        "academic",
        "relevance",
      ],
    });
  }

  /**
   * Register a single provider
   */
  public registerProvider(registration: ProviderRegistration): void {
    this.registry.providers[registration.id] = registration;
  }

  /**
   * Get provider by ID
   */
  public getProvider(id: string): ProviderRegistration | undefined {
    return this.registry.providers[id];
  }

  /**
   * Get all providers
   */
  public getAllProviders(): Record<string, ProviderRegistration> {
    return this.registry.providers;
  }

  /**
   * Get providers by category
   */
  public getProvidersByCategory(category: string): ProviderRegistration[] {
    const providerIds = this.registry.categories[category] || [];
    return providerIds
      .map((id) => this.registry.providers[id])
      .filter((provider) => provider !== undefined);
  }

  /**
   * Get all categories
   */
  public getCategories(): Record<string, string[]> {
    return this.registry.categories;
  }

  /**
   * Create provider instance
   */
  public createProviderInstance(
    id: string,
    ctx: DiagnosticContext,
  ): ProviderInstance {
    const registration = this.getProvider(id);
    if (!registration) {
      throw new Error(`Provider not found: ${id}`);
    }

    // biome-ignore lint/suspicious/noExplicitAny: Provider class is dynamically instantiated
    return new (registration.provider_class as any)(ctx);
  }

  /**
   * Get provider capabilities
   */
  public getProviderCapabilities(id: string): ProviderCapability | undefined {
    const registration = this.getProvider(id);
    return registration?.capabilities;
  }

  /**
   * Get all capabilities
   */
  public getAllCapabilities(): Record<string, ProviderCapability> {
    const capabilities: Record<string, ProviderCapability> = {};

    for (const [id, registration] of Object.entries(this.registry.providers)) {
      capabilities[id] = registration.capabilities;
    }

    return capabilities;
  }

  /**
   * Health check for all providers
   */
  public async performHealthChecks(
    ctx: DiagnosticContext,
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [id, registration] of Object.entries(this.registry.providers)) {
      try {
        const provider = this.createProviderInstance(id, ctx);
        results[id] = provider.healthCheck
          ? await provider.healthCheck()
          : false;
      } catch (error) {
        ctx.logger(`Health check failed for provider ${id}:`, error);
        results[id] = false;
      }
    }

    return results;
  }

  /**
   * Search providers by tags
   */
  public searchProvidersByTags(tags: string[]): ProviderRegistration[] {
    return Object.values(this.registry.providers).filter((provider) =>
      tags.some((tag) => provider.tags.includes(tag)),
    );
  }

  /**
   * Get discovery endpoints
   */
  public getDiscoveryEndpoints(): string[] {
    return this.registry.discovery_endpoints;
  }

  /**
   * Export registry for external use
   */
  public exportRegistry(): AcademicProviderRegistry {
    return JSON.parse(JSON.stringify(this.registry));
  }
}

/**
 * Convenience function to get the academic registry instance
 */
export function getAcademicRegistry(): AcademicRegistry {
  return AcademicRegistry.getInstance();
}

/**
 * FASTMCP v3.22 registry capabilities
 */
export const academicRegistryCapabilities = {
  id: "academic-registry",
  name: "Academic Research Provider Registry",
  version: "1.0.0",
  description:
    "Centralized registry for academic research MCP providers with discovery and health check capabilities",
  tools: [
    {
      name: "registry_list_providers",
      description: "List all registered academic providers",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Filter by provider category (optional)",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Filter by provider tags (optional)",
          },
        },
      },
    },
    {
      name: "registry_get_capabilities",
      description: "Get capabilities for a specific provider or all providers",
      inputSchema: {
        type: "object",
        properties: {
          provider_id: {
            type: "string",
            description: "Provider ID (optional, returns all if not specified)",
          },
        },
      },
    },
    {
      name: "registry_health_check",
      description: "Perform health checks on academic providers",
      inputSchema: {
        type: "object",
        properties: {
          provider_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "Specific provider IDs to check (optional, checks all if not specified)",
          },
        },
      },
    },
  ],
  resources: [],
  prompts: [],
};

// Export all provider capabilities for easy access
export {
  arxivCapabilities,
  context7Capabilities,
  cortexVibeCapabilities,
  exaCapabilities,
  openAlexCapabilities,
  researchQualityCapabilities,
  semanticScholarCapabilities,
  wikidataCapabilities,
};
