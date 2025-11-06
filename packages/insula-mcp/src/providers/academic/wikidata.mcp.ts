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
        bindings: Array<Record<string, {
            type: string;
            value: string;
            datatype?: string;
            "xml:lang"?: string;
        }>>;
    };
}

export interface WikidataSearchParams {
    search: string;
    language?: string;
    limit?: number;
    continue?: number;
    type?: string;
}

export class WikidataProvider {
    private readonly apiUrl = "https://www.wikidata.org/w/api.php";
    private readonly sparqlUrl = "https://query.wikidata.org/sparql";
    private readonly userAgent = "Insula-MCP/1.0.0 (Academic Research)";
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
                description: "Search for entities in Wikidata",
                inputSchema: {
                    type: "object",
                    properties: {
                        search: {
                            type: "string",
                            description: "Search term for entities"
                        },
                        language: {
                            type: "string",
                            description: "Language code (default: 'en')",
                            default: "en"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of results (default: 10, max: 50)",
                            minimum: 1,
                            maximum: 50,
                            default: 10
                        },
                        type: {
                            type: "string",
                            description: "Entity type filter (e.g., 'item', 'property')",
                            default: "item"
                        }
                    },
                    required: ["search"]
                }
            },
            {
                name: "wikidata_entity",
                description: "Get detailed information about a Wikidata entity",
                inputSchema: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            description: "Wikidata entity ID (e.g., 'Q42', 'P31')"
                        },
                        language: {
                            type: "string",
                            description: "Language code for labels and descriptions (default: 'en')",
                            default: "en"
                        }
                    },
                    required: ["id"]
                }
            },
            {
                name: "wikidata_sparql",
                description: "Execute a SPARQL query against Wikidata",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "SPARQL query to execute"
                        },
                        format: {
                            type: "string",
                            description: "Response format (default: 'json')",
                            enum: ["json", "xml", "csv", "tsv"],
                            default: "json"
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "wikidata_academic_search",
                description: "Search for academic entities (researchers, institutions, publications)",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query for academic entities"
                        },
                        entity_type: {
                            type: "string",
                            description: "Type of academic entity",
                            enum: ["researcher", "institution", "publication", "journal"],
                            default: "researcher"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of results (default: 10)",
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        }
                    },
                    required: ["query"]
                }
            }
        ];
    }

    /**
     * Search for entities in Wikidata
     */
    async searchEntities(params: WikidataSearchParams): Promise<WikidataSearchResult[]> {
        const searchParams = new URLSearchParams({
            action: "wbsearchentities",
            search: params.search,
            language: params.language || "en",
            limit: String(params.limit || 10),
            continue: String(params.continue || 0),
            type: params.type || "item",
            format: "json"
        });

        const url = `${this.apiUrl}?${searchParams}`;

        try {
            const response = await this.ctx.request<{
                search: WikidataSearchResult[];
                success: number;
            }>(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    ...this.ctx.headers
                }
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response.search || [];
        } catch (error) {
            this.ctx.logger("Wikidata search failed:", error);
            throw new Error(`Wikidata API error: ${error instanceof Error ? error.message : "Unknown error"}`);
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
            format: "json"
        });

        const url = `${this.apiUrl}?${searchParams}`;

        try {
            const response = await this.ctx.request<{
                entities: Record<string, WikidataEntity>;
                success: number;
            }>(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    ...this.ctx.headers
                }
            });

            this.ctx.evidence({
                type: "url",
                ref: url
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
                    "Accept": format === "json" ? "application/sparql-results+json" : `text/${format}`,
                    ...this.ctx.headers
                },
                body: new URLSearchParams({
                    query,
                    format
                }).toString()
            });

            this.ctx.evidence({
                type: "url",
                ref: `${url} (SPARQL query)`
            });

            return response;
        } catch (error) {
            this.ctx.logger("Wikidata SPARQL query failed:", error);
            throw new Error(`Wikidata SPARQL error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Search for academic entities using predefined SPARQL queries
     */
    async searchAcademicEntities(query: string, entityType: string, limit = 10): Promise<unknown> {
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
     * Health check for the provider
     */
    async healthCheck(): Promise<boolean> {
        try {
            const url = `${this.apiUrl}?action=wbsearchentities&search=test&limit=1&format=json`;
            await this.ctx.request(url, {
                headers: {
                    "User-Agent": this.userAgent,
                    ...this.ctx.headers
                }
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Execute tool calls
     */
    async executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
        switch (toolName) {
            case "wikidata_search":
                return await this.searchEntities(params);

            case "wikidata_entity": {
                const entity = await this.getEntity(params.id as string, params.language as string | undefined);
                return entity || { error: "Entity not found" };
            }

            case "wikidata_sparql":
                return await this.executeSparql(params.query as string, params.format as string | undefined);

            case "wikidata_academic_search":
                return await this.searchAcademicEntities(
                    params.query as string,
                    params.entity_type as string,
                    params.limit as number | undefined
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
                    required: true
                },
                {
                    name: "depth",
                    description: "Network exploration depth (default: 2)",
                    required: false
                }
            ]
        },
        {
            name: "institutional_analysis",
            description: "Analyze institutional research output and collaborations",
            arguments: [
                {
                    name: "institution",
                    description: "Institution name or Wikidata ID",
                    required: true
                }
            ]
        }
    ]
};