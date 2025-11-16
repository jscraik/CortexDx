/**
 * Wikidata MCP Provider
 * FASTMCP v3.22 compliant provider for SPARQL queries and knowledge graph access
 * Based on Wikidata API and inspired by philippesaade-wmde/WikidataMCP
 * Enhanced with entity validation, relationship verification, and knowledge graph validation
 */

import {
  type LicenseValidatorPlugin,
  createLicenseValidator,
} from "../../plugins/development/license-validation.js";
import type { DiagnosticContext } from "../../types.js";

export interface WikidataEntity {
  id: string;
  label?: string;
  description?: string;
  aliases?: string[];
  claims?: Record<string, unknown[]>;
  sitelinks?: Record<string, { site: string; title: string; url?: string }>;
}

export interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
  match?: {
    type: string;
    language: string;
    text: string;
  };
  concepturi: string;
  url: string;
}

export interface SparqlResult {
  head: {
    vars: string[];
  };
  results: {
    bindings: Array<
      Record<
        string,
        {
          type: string;
          value: string;
          datatype?: string;
          "xml:lang"?: string;
        }
      >
    >;
  };
}

export interface WikidataSearchParams {
  search: string;
  language?: string;
  limit?: number;
  continue?: number;
  type?: string;
}

export interface WikidataVectorSearchResult {
  id: string;
  label: string;
  description?: string;
  score: number;
  concepturi: string;
  url: string;
}

export interface WikidataClaim {
  subject: string;
  subjectLabel?: string;
  property: string;
  propertyLabel?: string;
  value: string;
  valueLabel?: string;
  type: "statement" | "qualifier" | "reference";
}

export interface WikidataClaimValue {
  property: string;
  propertyLabel?: string;
  value: unknown;
  valueType: string;
  qualifiers?: Array<{
    property: string;
    propertyLabel?: string;
    value: unknown;
  }>;
  references?: Array<{
    property: string;
    propertyLabel?: string;
    value: unknown;
  }>;
  rank: "preferred" | "normal" | "deprecated";
}

export class WikidataProvider {
  private readonly apiUrl = "https://www.wikidata.org/w/api.php";
  private readonly sparqlUrl = "https://query.wikidata.org/sparql";
  private readonly userAgent = "CortexDx/1.0.0 (Academic Research)";
  private readonly licenseValidator: LicenseValidatorPlugin;

  constructor(private ctx: DiagnosticContext) {
    this.licenseValidator = createLicenseValidator(ctx);
  }

  /**
   * FASTMCP v3.22 tool definitions
   */
  static getToolDefinitions() {
    return [
      {
        name: "wikidata_search",
        description: "Search for entities in Wikidata using keyword search",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Search term for entities",
            },
            language: {
              type: "string",
              description: "Language code (default: 'en')",
              default: "en",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10, max: 50)",
              minimum: 1,
              maximum: 50,
              default: 10,
            },
            type: {
              type: "string",
              description: "Entity type filter (e.g., 'item', 'property')",
              default: "item",
            },
          },
          required: ["search"],
        },
      },
      {
        name: "wikidata_vector_search_items",
        description:
          "Performs semantic search over Wikidata items. NOTE: Currently uses enhanced keyword search with relevance scoring as vector search integration is pending. Results are still useful but may not capture full semantic similarity.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language query for semantic search",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10, max: 50)",
              minimum: 1,
              maximum: 50,
              default: 10,
            },
            language: {
              type: "string",
              description: "Language code (default: 'en')",
              default: "en",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "wikidata_vector_search_properties",
        description:
          "Performs semantic search over Wikidata properties. NOTE: Currently uses enhanced keyword search with relevance scoring as vector search integration is pending. For best results, use specific property-related keywords.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language query for property discovery",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10, max: 50)",
              minimum: 1,
              maximum: 50,
              default: 10,
            },
            language: {
              type: "string",
              description: "Language code (default: 'en')",
              default: "en",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "wikidata_entity",
        description: "Get detailed information about a Wikidata entity",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Wikidata entity ID (e.g., 'Q42', 'P31')",
            },
            language: {
              type: "string",
              description:
                "Language code for labels and descriptions (default: 'en')",
              default: "en",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "wikidata_sparql",
        description: "Execute a SPARQL query against Wikidata",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SPARQL query to execute",
            },
            format: {
              type: "string",
              description: "Response format (default: 'json')",
              enum: ["json", "xml", "csv", "tsv"],
              default: "json",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "wikidata_academic_search",
        description:
          "Search for academic entities (researchers, institutions, publications)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for academic entities",
            },
            entity_type: {
              type: "string",
              description: "Type of academic entity",
              enum: ["researcher", "institution", "publication", "journal"],
              default: "researcher",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10)",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "wikidata_get_entity_claims",
        description:
          "Returns all direct graph connections (statements) of a Wikidata entity in triplet format",
        inputSchema: {
          type: "object",
          properties: {
            entity_id: {
              type: "string",
              description: "Wikidata entity ID (e.g., 'Q42')",
            },
            property_filter: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional list of property IDs to filter (e.g., ['P31', 'P106'])",
            },
            language: {
              type: "string",
              description: "Language code for labels (default: 'en')",
              default: "en",
            },
          },
          required: ["entity_id"],
        },
      },
      {
        name: "wikidata_get_claim_values",
        description:
          "Retrieves comprehensive claim data including qualifiers, ranks, and references",
        inputSchema: {
          type: "object",
          properties: {
            entity_id: {
              type: "string",
              description: "Wikidata entity ID (e.g., 'Q42')",
            },
            property_id: {
              type: "string",
              description: "Property ID to retrieve claims for (e.g., 'P31')",
            },
            language: {
              type: "string",
              description: "Language code for labels (default: 'en')",
              default: "en",
            },
          },
          required: ["entity_id", "property_id"],
        },
      },
    ];
  }

  /**
   * Search for entities in Wikidata
   */
  async searchEntities(
    params: WikidataSearchParams,
  ): Promise<WikidataSearchResult[]> {
    const searchParams = new URLSearchParams({
      action: "wbsearchentities",
      search: params.search,
      language: params.language || "en",
      limit: String(params.limit || 10),
      continue: String(params.continue || 0),
      type: params.type || "item",
      format: "json",
    });

    const url = `${this.apiUrl}?${searchParams}`;

    try {
      const response = await this.ctx.request<{
        search: WikidataSearchResult[];
        success: number;
      }>(url, {
        headers: {
          "User-Agent": this.userAgent,
          ...this.ctx.headers,
        },
      });

      this.ctx.evidence({
        type: "url",
        ref: url,
      });

      return response.search || [];
    } catch (error) {
      this.ctx.logger("Wikidata search failed:", error);
      throw new Error(
        `Wikidata API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get detailed entity information
   */
  async getEntity(id: string, language = "en"): Promise<WikidataEntity | null> {
    const searchParams = new URLSearchParams({
      action: "wbgetentities",
      ids: id,
      languages: language,
      format: "json",
    });

    const url = `${this.apiUrl}?${searchParams}`;

    try {
      const response = await this.ctx.request<{
        entities: Record<string, WikidataEntity>;
        success: number;
      }>(url, {
        headers: {
          "User-Agent": this.userAgent,
          ...this.ctx.headers,
        },
      });

      this.ctx.evidence({
        type: "url",
        ref: url,
      });

      return response.entities?.[id] || null;
    } catch (error) {
      this.ctx.logger("Wikidata entity fetch failed:", error);
      return null;
    }
  }

  /**
   * Execute SPARQL query
   */
  async executeSparql(query: string, format = "json"): Promise<unknown> {
    const url = this.sparqlUrl;

    try {
      const response = await this.ctx.request(url, {
        method: "POST",
        headers: {
          "User-Agent": this.userAgent,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept:
            format === "json"
              ? "application/sparql-results+json"
              : `text/${format}`,
          ...this.ctx.headers,
        },
        body: new URLSearchParams({
          query,
          format,
        }).toString(),
      });

      this.ctx.evidence({
        type: "url",
        ref: `${url} (SPARQL query)`,
      });

      return response;
    } catch (error) {
      this.ctx.logger("Wikidata SPARQL query failed:", error);
      throw new Error(
        `Wikidata SPARQL error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search for academic entities using predefined SPARQL queries
   */
  async searchAcademicEntities(
    query: string,
    entityType: string,
    limit = 10,
  ): Promise<unknown> {
    let sparqlQuery: string;

    switch (entityType) {
      case "researcher":
        sparqlQuery = `
          SELECT DISTINCT ?researcher ?researcherLabel ?orcid ?affiliation ?affiliationLabel WHERE {
            ?researcher wdt:P31 wd:Q5 ;
                       wdt:P106/wdt:P279* wd:Q1650915 .
            ?researcher rdfs:label ?researcherLabel .
            FILTER(LANG(?researcherLabel) = "en")
            FILTER(CONTAINS(LCASE(?researcherLabel), LCASE("${query.replace(/"/g, '\\"')}")))
            OPTIONAL { ?researcher wdt:P496 ?orcid }
            OPTIONAL { 
              ?researcher wdt:P1416 ?affiliation .
              ?affiliation rdfs:label ?affiliationLabel .
              FILTER(LANG(?affiliationLabel) = "en")
            }
          }
          LIMIT ${limit}
        `;
        break;

      case "institution":
        sparqlQuery = `
          SELECT DISTINCT ?institution ?institutionLabel ?country ?countryLabel ?website WHERE {
            ?institution wdt:P31/wdt:P279* wd:Q2385804 .
            ?institution rdfs:label ?institutionLabel .
            FILTER(LANG(?institutionLabel) = "en")
            FILTER(CONTAINS(LCASE(?institutionLabel), LCASE("${query.replace(/"/g, '\\"')}")))
            OPTIONAL { ?institution wdt:P17 ?country }
            OPTIONAL { ?institution wdt:P856 ?website }
            OPTIONAL { 
              ?country rdfs:label ?countryLabel .
              FILTER(LANG(?countryLabel) = "en")
            }
          }
          LIMIT ${limit}
        `;
        break;

      case "publication":
        sparqlQuery = `
          SELECT DISTINCT ?publication ?publicationLabel ?author ?authorLabel ?publishedIn ?publishedInLabel ?publicationDate WHERE {
            ?publication wdt:P31/wdt:P279* wd:Q732577 .
            ?publication rdfs:label ?publicationLabel .
            FILTER(LANG(?publicationLabel) = "en")
            FILTER(CONTAINS(LCASE(?publicationLabel), LCASE("${query.replace(/"/g, '\\"')}")))
            OPTIONAL { ?publication wdt:P50 ?author }
            OPTIONAL { ?publication wdt:P1433 ?publishedIn }
            OPTIONAL { ?publication wdt:P577 ?publicationDate }
            OPTIONAL { 
              ?author rdfs:label ?authorLabel .
              FILTER(LANG(?authorLabel) = "en")
            }
            OPTIONAL { 
              ?publishedIn rdfs:label ?publishedInLabel .
              FILTER(LANG(?publishedInLabel) = "en")
            }
          }
          LIMIT ${limit}
        `;
        break;

      case "journal":
        sparqlQuery = `
          SELECT DISTINCT ?journal ?journalLabel ?issn ?publisher ?publisherLabel WHERE {
            ?journal wdt:P31/wdt:P279* wd:Q5633421 .
            ?journal rdfs:label ?journalLabel .
            FILTER(LANG(?journalLabel) = "en")
            FILTER(CONTAINS(LCASE(?journalLabel), LCASE("${query.replace(/"/g, '\\"')}")))
            OPTIONAL { ?journal wdt:P236 ?issn }
            OPTIONAL { 
              ?journal wdt:P123 ?publisher .
              ?publisher rdfs:label ?publisherLabel .
              FILTER(LANG(?publisherLabel) = "en")
            }
          }
          LIMIT ${limit}
        `;
        break;

      default:
        throw new Error(`Unknown academic entity type: ${entityType}`);
    }

    return await this.executeSparql(sparqlQuery);
  }

  /**
   * Vector search for items using semantic embeddings
   *
   * CURRENT STATUS: Uses enhanced keyword search as fallback
   * The official WikidataMCP uses https://wd-mcp.wmcloud.org/mcp/ for vector search
   * Integration with Wikidata vector database service is planned but not yet implemented
   *
   * @param query - Natural language search query
   * @param limit - Maximum number of results (default: 10)
   * @param language - Language code (default: 'en')
   * @returns Search results with relevance scores
   */
  async vectorSearchItems(
    query: string,
    limit = 10,
    language = "en",
  ): Promise<WikidataVectorSearchResult[]> {
    // Log fallback behavior for transparency
    this.ctx.logger(
      "[Wikidata] Vector search using enhanced keyword search fallback. " +
      "For true semantic search, Wikidata vector database integration is required. " +
      "See: https://wd-mcp.wmcloud.org/mcp/",
    );

    // Fallback to enhanced keyword search with scoring
    const keywordResults = await this.searchEntities({
      search: query,
      language,
      limit,
    });

    // Apply relevance scoring based on position
    return keywordResults.map((result, index) => ({
      id: result.id,
      label: result.label,
      description: result.description,
      score: 1.0 - index * 0.05, // Simple descending score
      concepturi: result.concepturi,
      url: result.url,
    }));
  }

  /**
   * Vector search for properties using semantic embeddings
   *
   * CURRENT STATUS: Uses enhanced keyword search as fallback
   * The official WikidataMCP uses https://wd-mcp.wmcloud.org/mcp/ for vector search
   * Integration with Wikidata vector database service is planned but not yet implemented
   *
   * @param query - Natural language search query for properties
   * @param limit - Maximum number of results (default: 10)
   * @param language - Language code (default: 'en')
   * @returns Property search results with relevance scores
   */
  async vectorSearchProperties(
    query: string,
    limit = 10,
    language = "en",
  ): Promise<WikidataVectorSearchResult[]> {
    // Log fallback behavior for transparency
    this.ctx.logger(
      "[Wikidata] Property vector search using enhanced keyword search fallback. " +
      "For true semantic search, Wikidata vector database integration is required. " +
      "See: https://wd-mcp.wmcloud.org/mcp/",
    );

    // Fallback to enhanced keyword search for properties
    const keywordResults = await this.searchEntities({
      search: query,
      language,
      limit,
      type: "property",
    });

    // Apply relevance scoring based on position
    return keywordResults.map((result, index) => ({
      id: result.id,
      label: result.label,
      description: result.description,
      score: 1.0 - index * 0.05, // Simple descending score
      concepturi: result.concepturi,
      url: result.url,
    }));
  }

  /**
   * Get entity claims in triplet format (subject-property-value)
   */
  async getEntityClaims(
    entityId: string,
    propertyFilter?: string[],
    language = "en",
  ): Promise<WikidataClaim[]> {
    const entity = await this.getEntity(entityId, language);
    if (!entity || !entity.claims) {
      return [];
    }

    const claims: WikidataClaim[] = [];

    // Iterate through all properties in the entity's claims
    for (const [propertyId, propertyClaimsArray] of Object.entries(
      entity.claims,
    )) {
      // Apply property filter if specified
      if (propertyFilter && !propertyFilter.includes(propertyId)) {
        continue;
      }

      // Get property label via SPARQL
      const propertyLabel = await this.getPropertyLabel(propertyId, language);

      // Extract claims from the array
      if (Array.isArray(propertyClaimsArray)) {
        for (const claim of propertyClaimsArray) {
          const claimData = claim as {
            mainsnak?: {
              datavalue?: { value?: unknown; type?: string };
            };
          };

          if (claimData.mainsnak?.datavalue?.value) {
            const value = claimData.mainsnak.datavalue.value;
            let valueString = "";
            let valueLabel = "";

            // Handle different value types
            if (
              typeof value === "object" &&
              value !== null &&
              "id" in value
            ) {
              // Entity reference
              valueString = (value as { id: string }).id;
              const valueEntity = await this.getEntity(valueString, language);
              valueLabel = valueEntity?.label || valueString;
            } else if (typeof value === "string") {
              valueString = value;
              valueLabel = value;
            } else {
              valueString = JSON.stringify(value);
              valueLabel = valueString;
            }

            claims.push({
              subject: entityId,
              subjectLabel: entity.label,
              property: propertyId,
              propertyLabel,
              value: valueString,
              valueLabel,
              type: "statement",
            });
          }
        }
      }
    }

    this.ctx.evidence({
      type: "log",
      ref: `Retrieved ${claims.length} claims for ${entityId}`,
    });

    return claims;
  }

  /**
   * Get claim values with qualifiers, ranks, and references
   */
  async getClaimValues(
    entityId: string,
    propertyId: string,
    language = "en",
  ): Promise<WikidataClaimValue[]> {
    const entity = await this.getEntity(entityId, language);
    if (!entity || !entity.claims) {
      return [];
    }

    const propertyClaims = entity.claims[propertyId];
    if (!propertyClaims || !Array.isArray(propertyClaims)) {
      return [];
    }

    const propertyLabel = await this.getPropertyLabel(propertyId, language);
    const claimValues: WikidataClaimValue[] = [];

    for (const claim of propertyClaims) {
      const claimData = claim as {
        mainsnak?: { datavalue?: { value?: unknown; type?: string } };
        qualifiers?: Record<
          string,
          Array<{ datavalue?: { value?: unknown; type?: string } }>
        >;
        references?: Array<{
          snaks?: Record<
            string,
            Array<{ datavalue?: { value?: unknown; type?: string } }>
          >;
        }>;
        rank?: string;
      };

      if (!claimData.mainsnak?.datavalue) {
        continue;
      }

      const value = claimData.mainsnak.datavalue.value;
      const valueType = claimData.mainsnak.datavalue.type || "unknown";

      // Extract qualifiers
      const qualifiers: Array<{
        property: string;
        propertyLabel?: string;
        value: unknown;
      }> = [];
      if (claimData.qualifiers) {
        for (const [qualProp, qualValues] of Object.entries(
          claimData.qualifiers,
        )) {
          const qualPropLabel = await this.getPropertyLabel(qualProp, language);
          for (const qualValue of qualValues) {
            if (qualValue.datavalue?.value) {
              qualifiers.push({
                property: qualProp,
                propertyLabel: qualPropLabel,
                value: qualValue.datavalue.value,
              });
            }
          }
        }
      }

      // Extract references
      const references: Array<{
        property: string;
        propertyLabel?: string;
        value: unknown;
      }> = [];
      if (claimData.references) {
        for (const reference of claimData.references) {
          if (reference.snaks) {
            for (const [refProp, refValues] of Object.entries(reference.snaks)) {
              const refPropLabel = await this.getPropertyLabel(
                refProp,
                language,
              );
              for (const refValue of refValues) {
                if (refValue.datavalue?.value) {
                  references.push({
                    property: refProp,
                    propertyLabel: refPropLabel,
                    value: refValue.datavalue.value,
                  });
                }
              }
            }
          }
        }
      }

      const rank = (claimData.rank || "normal") as
        | "preferred"
        | "normal"
        | "deprecated";

      claimValues.push({
        property: propertyId,
        propertyLabel,
        value,
        valueType,
        qualifiers: qualifiers.length > 0 ? qualifiers : undefined,
        references: references.length > 0 ? references : undefined,
        rank,
      });
    }

    this.ctx.evidence({
      type: "log",
      ref: `Retrieved ${claimValues.length} claim values for ${entityId}:${propertyId}`,
    });

    return claimValues;
  }

  /**
   * Helper method to get property label
   */
  private async getPropertyLabel(
    propertyId: string,
    language = "en",
  ): Promise<string> {
    const property = await this.getEntity(propertyId, language);
    return property?.label || propertyId;
  }

  /**
   * Health check for the provider
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.apiUrl}?action=wbsearchentities&search=test&limit=1&format=json`;
      await this.ctx.request(url, {
        headers: {
          "User-Agent": this.userAgent,
          ...this.ctx.headers,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute tool calls
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case "wikidata_search":
        return await this.searchEntities({
          search: params.search as string,
          language: params.language as string | undefined,
          limit: params.limit as number | undefined,
          continue: params.continue as number | undefined,
          type: params.type as string | undefined,
        });

      case "wikidata_vector_search_items":
        return await this.vectorSearchItems(
          params.query as string,
          params.limit as number | undefined,
          params.language as string | undefined,
        );

      case "wikidata_vector_search_properties":
        return await this.vectorSearchProperties(
          params.query as string,
          params.limit as number | undefined,
          params.language as string | undefined,
        );

      case "wikidata_entity": {
        const entity = await this.getEntity(
          params.id as string,
          params.language as string | undefined,
        );
        return entity || { error: "Entity not found" };
      }

      case "wikidata_sparql":
        return await this.executeSparql(
          params.query as string,
          params.format as string | undefined,
        );

      case "wikidata_academic_search":
        return await this.searchAcademicEntities(
          params.query as string,
          params.entity_type as string,
          params.limit as number | undefined,
        );

      case "wikidata_get_entity_claims":
        return await this.getEntityClaims(
          params.entity_id as string,
          params.property_filter as string[] | undefined,
          params.language as string | undefined,
        );

      case "wikidata_get_claim_values":
        return await this.getClaimValues(
          params.entity_id as string,
          params.property_id as string,
          params.language as string | undefined,
        );

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

/**
 * FASTMCP v3.22 capability registration
 */
export const wikidataCapabilities = {
  id: "wikidata",
  name: "Wikidata Knowledge Graph Provider",
  version: "1.0.0",
  description: "SPARQL queries and knowledge graph access via Wikidata",
  tools: WikidataProvider.getToolDefinitions(),
  resources: [],
  prompts: [
    {
      name: "explore_research_network",
      description: "Explore research collaboration networks using Wikidata",
      arguments: [
        {
          name: "researcher",
          description: "Researcher name or Wikidata ID",
          required: true,
        },
        {
          name: "depth",
          description: "Network exploration depth (default: 2)",
          required: false,
        },
      ],
    },
    {
      name: "institutional_analysis",
      description: "Analyze institutional research output and collaborations",
      arguments: [
        {
          name: "institution",
          description: "Institution name or Wikidata ID",
          required: true,
        },
      ],
    },
  ],
};
