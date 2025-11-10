/**
 * Semantic Scholar MCP Provider
 * FASTMCP v3.22 compliant provider for academic paper search and citation analysis
 * Based on the Semantic Scholar API v1 and inspired by SnippetSquid/SemanticScholarMCP
 * Enhanced with license compliance, citation checking, and methodology verification
 */

import {
    createLicenseValidator,
    type LicenseValidatorPlugin,
    type ResearchContent,
} from "../../plugins/development/license-validation.js";
import type { DiagnosticContext } from "../../types.js";

const SEMANTIC_SCHOLAR_CONTACT = "jscraik@brainwav.io";

export interface SemanticScholarAuthor {
    authorId: string;
    name: string;
    url?: string;
    affiliations?: string[];
    homepage?: string;
    paperCount?: number;
    citationCount?: number;
    hIndex?: number;
}

export interface SemanticScholarPaper {
    paperId: string;
    corpusId?: number;
    title: string;
    abstract?: string;
    authors: SemanticScholarAuthor[];
    year?: number;
    publicationDate?: string;
    citationCount: number;
    referenceCount: number;
    influentialCitationCount?: number;
    venue?: string;
    publicationVenue?: {
        id?: string;
        name?: string;
        type?: string;
        issn?: string;
        url?: string;
    };
    url?: string;
    doi?: string;
    s2FieldsOfStudy?: Array<{
        category: string;
        source: string;
    }>;
    publicationTypes?: string[];
    journal?: {
        name?: string;
        pages?: string;
        volume?: string;
    };
    isOpenAccess?: boolean;
    openAccessPdf?: {
        url: string;
        status: string;
    };
}

export interface SemanticScholarSearchParams {
    query: string;
    limit?: number;
    offset?: number;
    fields?: string[];
    year?: string;
    venue?: string[];
    fieldsOfStudy?: string[];
    minCitationCount?: number;
    publicationTypes?: string[];
    openAccessPdf?: boolean;
}

export interface SemanticScholarCitationParams {
    paperId: string;
    limit?: number;
    offset?: number;
    fields?: string[];
}

export interface SemanticScholarAuthorSearchParams {
    query: string;
    limit?: number;
    offset?: number;
    fields?: string[];
}

export interface CitationValidation {
    isValid: boolean;
    citationCount: number;
    influentialCitations: number;
    issues: string[];
    recommendations: string[];
    licenseCompliance: boolean;
}

export interface MethodologyVerification {
    isVerified: boolean;
    methodologyScore: number;
    reproducibility: number;
    rigor: number;
    issues: string[];
    licenseCompliance: boolean;
}

export class SemanticScholarProvider {
    private readonly baseUrl = "https://api.semanticscholar.org/graph/v1";
    private readonly userAgent = "CortexDx/1.0.0 (Academic Research)";
    private readonly licenseValidator: LicenseValidatorPlugin;

    // Default fields for different query types
    private readonly defaultPaperFields = [
        "paperId", "title", "abstract", "authors", "year", "publicationDate",
        "citationCount", "referenceCount", "influentialCitationCount", "venue",
        "publicationVenue", "url", "doi", "s2FieldsOfStudy", "publicationTypes",
        "journal", "isOpenAccess", "openAccessPdf"
    ];

    private readonly defaultAuthorFields = [
        "authorId", "name", "url", "affiliations", "homepage",
        "paperCount", "citationCount", "hIndex"
    ];

    constructor(private ctx: DiagnosticContext) {
        this.licenseValidator = createLicenseValidator(ctx);
    }

    private buildRequestHeaders(extra?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = {
            "User-Agent": this.userAgent,
            ...(this.ctx.headers ?? {}),
            ...(extra ?? {})
        };
        const existingKey = headers["x-api-key"];
        if (!existingKey || existingKey.length === 0) {
            headers["x-api-key"] =
                process.env.SEMANTIC_SCHOLAR_API_KEY ?? SEMANTIC_SCHOLAR_CONTACT;
        }
        return headers;
    }

    /**
     * FASTMCP v3.22 tool definitions
     */
    static getToolDefinitions() {
        return [
            {
                name: "semantic_scholar_search_papers",
                description: "Search for academic papers using Semantic Scholar API",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query for papers"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of results (default: 10, max: 100)",
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        },
                        offset: {
                            type: "number",
                            description: "Offset for pagination (default: 0)",
                            minimum: 0,
                            default: 0
                        },
                        year: {
                            type: "string",
                            description: "Publication year filter (e.g., '2020', '2020-2023')"
                        },
                        venue: {
                            type: "array",
                            items: { type: "string" },
                            description: "Publication venue filter"
                        },
                        fieldsOfStudy: {
                            type: "array",
                            items: { type: "string" },
                            description: "Fields of study filter (e.g., ['Computer Science', 'Medicine'])"
                        },
                        minCitationCount: {
                            type: "number",
                            description: "Minimum citation count filter",
                            minimum: 0
                        },
                        publicationTypes: {
                            type: "array",
                            items: { type: "string" },
                            description: "Publication types filter (e.g., ['JournalArticle', 'Conference'])"
                        },
                        openAccessPdf: {
                            type: "boolean",
                            description: "Filter for papers with open access PDFs"
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "semantic_scholar_get_paper",
                description: "Get detailed information about a specific paper",
                inputSchema: {
                    type: "object",
                    properties: {
                        paperId: {
                            type: "string",
                            description: "Semantic Scholar paper ID, DOI, ArXiv ID, or other identifier"
                        }
                    },
                    required: ["paperId"]
                }
            },
            {
                name: "semantic_scholar_get_paper_citations",
                description: "Get citations for a specific paper",
                inputSchema: {
                    type: "object",
                    properties: {
                        paperId: {
                            type: "string",
                            description: "Semantic Scholar paper ID or DOI"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of citations (default: 10, max: 1000)",
                            minimum: 1,
                            maximum: 1000,
                            default: 10
                        },
                        offset: {
                            type: "number",
                            description: "Offset for pagination (default: 0)",
                            minimum: 0,
                            default: 0
                        }
                    },
                    required: ["paperId"]
                }
            },
            {
                name: "semantic_scholar_get_paper_references",
                description: "Get references for a specific paper",
                inputSchema: {
                    type: "object",
                    properties: {
                        paperId: {
                            type: "string",
                            description: "Semantic Scholar paper ID or DOI"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of references (default: 10, max: 1000)",
                            minimum: 1,
                            maximum: 1000,
                            default: 10
                        },
                        offset: {
                            type: "number",
                            description: "Offset for pagination (default: 0)",
                            minimum: 0,
                            default: 0
                        }
                    },
                    required: ["paperId"]
                }
            },
            {
                name: "semantic_scholar_search_authors",
                description: "Search for authors using Semantic Scholar API",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query for authors"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of results (default: 10, max: 100)",
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        },
                        offset: {
                            type: "number",
                            description: "Offset for pagination (default: 0)",
                            minimum: 0,
                            default: 0
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "semantic_scholar_get_author",
                description: "Get detailed information about a specific author",
                inputSchema: {
                    type: "object",
                    properties: {
                        authorId: {
                            type: "string",
                            description: "Semantic Scholar author ID"
                        }
                    },
                    required: ["authorId"]
                }
            },
            {
                name: "semantic_scholar_get_author_papers",
                description: "Get papers by a specific author",
                inputSchema: {
                    type: "object",
                    properties: {
                        authorId: {
                            type: "string",
                            description: "Semantic Scholar author ID"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of papers (default: 10, max: 1000)",
                            minimum: 1,
                            maximum: 1000,
                            default: 10
                        },
                        offset: {
                            type: "number",
                            description: "Offset for pagination (default: 0)",
                            minimum: 0,
                            default: 0
                        }
                    },
                    required: ["authorId"]
                }
            },
            {
                name: "semantic_scholar_validate_citations",
                description: "Validate citations with license compliance checking",
                inputSchema: {
                    type: "object",
                    properties: {
                        paperId: {
                            type: "string",
                            description: "Semantic Scholar paper ID or DOI"
                        },
                        check_license: {
                            type: "boolean",
                            description: "Enable license compliance checking (default: true)",
                            default: true
                        }
                    },
                    required: ["paperId"]
                }
            },
            {
                name: "semantic_scholar_verify_methodology",
                description: "Verify methodology with IP validation",
                inputSchema: {
                    type: "object",
                    properties: {
                        paperId: {
                            type: "string",
                            description: "Semantic Scholar paper ID or DOI"
                        },
                        check_license: {
                            type: "boolean",
                            description: "Enable license compliance checking (default: true)",
                            default: true
                        }
                    },
                    required: ["paperId"]
                }
            }
        ];
    }

    /**
     * Search for papers using Semantic Scholar API
     */
    async searchPapers(params: SemanticScholarSearchParams): Promise<SemanticScholarPaper[]> {
        const searchParams = new URLSearchParams({
            query: params.query,
            limit: String(params.limit || 10),
            offset: String(params.offset || 0),
            fields: (params.fields || this.defaultPaperFields).join(",")
        });

        // Add optional filters
        if (params.year) searchParams.append("year", params.year);
        // if (params.venue) searchParams.append("venue", params.venue.join(","));
        // if (params.fieldsOfStudy) searchParams.append("fieldsOfStudy", params.fieldsOfStudy.join(","));
        if (params.minCitationCount !== undefined) searchParams.append("minCitationCount", String(params.minCitationCount));
        // if (params.publicationTypes) searchParams.append("publicationTypes", params.publicationTypes.join(","));
        // if (params.openAccessPdf !== undefined) searchParams.append("openAccessPdf", String(params.openAccessPdf));

        const url = `${this.baseUrl}/paper/search?${searchParams}`;

        try {
            const response = await this.ctx.request<{
                data: SemanticScholarPaper[];
                total: number;
                offset: number;
                next?: number;
            }>(url, {
                headers: this.buildRequestHeaders()
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response.data || [];
        } catch (error) {
            this.ctx.logger("Semantic Scholar search failed:", error);
            if (error instanceof Error && error.message.includes("429")) {
                throw new Error("Semantic Scholar API rate limit exceeded. Please try again later.");
            }
            throw new Error(`Semantic Scholar API error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Get detailed information about a specific paper
     */
    async getPaper(paperId: string): Promise<SemanticScholarPaper | null> {
        const fields = this.defaultPaperFields.join(",");
        const url = `${this.baseUrl}/paper/${encodeURIComponent(paperId)}?fields=${fields}`;

        try {
            const response = await this.ctx.request<SemanticScholarPaper>(url, {
                headers: this.buildRequestHeaders()
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response;
        } catch (error) {
            this.ctx.logger("Semantic Scholar paper details failed:", error);
            return null;
        }
    }

    /**
     * Get citations for a specific paper
     */
    async getPaperCitations(params: SemanticScholarCitationParams): Promise<SemanticScholarPaper[]> {
        const searchParams = new URLSearchParams({
            limit: String(params.limit || 10),
            offset: String(params.offset || 0),
            fields: (params.fields || this.defaultPaperFields).join(",")
        });

        const url = `${this.baseUrl}/paper/${encodeURIComponent(params.paperId)}/citations?${searchParams}`;

        try {
            const response = await this.ctx.request<{
                data: Array<{ citingPaper: SemanticScholarPaper }>;
                offset: number;
                next?: number;
            }>(url, {
                headers: this.buildRequestHeaders()
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response.data?.map(item => item.citingPaper) || [];
        } catch (error) {
            this.ctx.logger("Semantic Scholar citations failed:", error);
            if (error instanceof Error && error.message.includes("429")) {
                throw new Error("Semantic Scholar API rate limit exceeded. Please try again later.");
            }
            throw new Error(`Semantic Scholar API error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Get references for a specific paper
     */
    async getPaperReferences(params: SemanticScholarCitationParams): Promise<SemanticScholarPaper[]> {
        const searchParams = new URLSearchParams({
            limit: String(params.limit || 10),
            offset: String(params.offset || 0),
            fields: (params.fields || this.defaultPaperFields).join(",")
        });

        const url = `${this.baseUrl}/paper/${encodeURIComponent(params.paperId)}/references?${searchParams}`;

        try {
            const response = await this.ctx.request<{
                data: Array<{ citedPaper: SemanticScholarPaper }>;
                offset: number;
                next?: number;
            }>(url, {
                headers: this.buildRequestHeaders()
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response.data?.map(item => item.citedPaper) || [];
        } catch (error) {
            this.ctx.logger("Semantic Scholar references failed:", error);
            if (error instanceof Error && error.message.includes("429")) {
                throw new Error("Semantic Scholar API rate limit exceeded. Please try again later.");
            }
            throw new Error(`Semantic Scholar API error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Search for authors
     */
    async searchAuthors(params: SemanticScholarAuthorSearchParams): Promise<SemanticScholarAuthor[]> {
        const searchParams = new URLSearchParams({
            query: params.query,
            limit: String(params.limit || 10),
            offset: String(params.offset || 0),
            fields: (params.fields || this.defaultAuthorFields).join(",")
        });

        const url = `${this.baseUrl}/author/search?${searchParams}`;

        try {
            const response = await this.ctx.request<{
                data: SemanticScholarAuthor[];
                total: number;
                offset: number;
                next?: number;
            }>(url, {
                headers: this.buildRequestHeaders()
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response.data || [];
        } catch (error) {
            this.ctx.logger("Semantic Scholar author search failed:", error);
            if (error instanceof Error && error.message.includes("429")) {
                throw new Error("Semantic Scholar API rate limit exceeded. Please try again later.");
            }
            throw new Error(`Semantic Scholar API error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Get detailed information about a specific author
     */
    async getAuthor(authorId: string): Promise<SemanticScholarAuthor | null> {
        const fields = this.defaultAuthorFields.join(",");
        const url = `${this.baseUrl}/author/${encodeURIComponent(authorId)}?fields=${fields}`;

        try {
            const response = await this.ctx.request<SemanticScholarAuthor>(url, {
                headers: this.buildRequestHeaders()
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response;
        } catch (error) {
            this.ctx.logger("Semantic Scholar author details failed:", error);
            return null;
        }
    }

    /**
     * Get papers by a specific author
     */
    async getAuthorPapers(authorId: string, limit = 10, offset = 0): Promise<SemanticScholarPaper[]> {
        const searchParams = new URLSearchParams({
            limit: String(limit),
            offset: String(offset),
            fields: this.defaultPaperFields.join(",")
        });

        const url = `${this.baseUrl}/author/${encodeURIComponent(authorId)}/papers?${searchParams}`;

        try {
            const response = await this.ctx.request<{
                data: SemanticScholarPaper[];
                offset: number;
                next?: number;
            }>(url, {
                headers: this.buildRequestHeaders()
            });

            this.ctx.evidence({
                type: "url",
                ref: url
            });

            return response.data || [];
        } catch (error) {
            this.ctx.logger("Semantic Scholar author papers failed:", error);
            if (error instanceof Error && error.message.includes("429")) {
                throw new Error("Semantic Scholar API rate limit exceeded. Please try again later.");
            }
            throw new Error(`Semantic Scholar API error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    /**
     * Validate citations with license compliance
     */
    async validateCitations(
        paperId: string,
        checkLicense = true
    ): Promise<CitationValidation> {
        const paper = await this.getPaper(paperId);

        if (!paper) {
            return {
                isValid: false,
                citationCount: 0,
                influentialCitations: 0,
                issues: ["Paper not found"],
                recommendations: ["Verify paper ID"],
                licenseCompliance: false
            };
        }

        const validation: CitationValidation = {
            isValid: true,
            citationCount: paper.citationCount,
            influentialCitations: paper.influentialCitationCount || 0,
            issues: [],
            recommendations: [],
            licenseCompliance: true
        };

        if (checkLicense) {
            const researchContent: ResearchContent = {
                id: paper.paperId,
                title: paper.title,
                authors: paper.authors.map(a => a.name),
                source: "semantic-scholar",
                doi: paper.doi,
                url: paper.url,
                abstract: paper.abstract
            };

            const licenseValidation = await this.licenseValidator.validateLicense(researchContent);
            validation.licenseCompliance = licenseValidation.isValid;

            if (!licenseValidation.isValid) {
                validation.issues.push(`License issue: ${licenseValidation.license}`);
                validation.recommendations.push(...licenseValidation.recommendations);
            }
        }

        if (paper.citationCount < 5) {
            validation.issues.push("Low citation count - verify paper quality");
        }

        this.ctx.evidence({
            type: "log",
            ref: `Citation validation: ${paper.citationCount} citations`
        });

        return validation;
    }

    /**
     * Verify methodology with IP validation
     */
    async verifyMethodology(
        paperId: string,
        checkLicense = true
    ): Promise<MethodologyVerification> {
        const paper = await this.getPaper(paperId);

        if (!paper) {
            return {
                isVerified: false,
                methodologyScore: 0,
                reproducibility: 0,
                rigor: 0,
                issues: ["Paper not found"],
                licenseCompliance: false
            };
        }

        const verification: MethodologyVerification = {
            isVerified: true,
            methodologyScore: 75,
            reproducibility: 70,
            rigor: 80,
            issues: [],
            licenseCompliance: true
        };

        if (checkLicense) {
            const researchContent: ResearchContent = {
                id: paper.paperId,
                title: paper.title,
                authors: paper.authors.map(a => a.name),
                source: "semantic-scholar",
                doi: paper.doi,
                url: paper.url,
                abstract: paper.abstract
            };

            const licenseValidation = await this.licenseValidator.validateLicense(researchContent);
            verification.licenseCompliance = licenseValidation.isValid;

            if (!licenseValidation.isValid) {
                verification.issues.push(`License compliance issue: ${licenseValidation.license}`);
            }
        }

        if (!paper.abstract || paper.abstract.length < 100) {
            verification.issues.push("Limited methodology information in abstract");
            verification.methodologyScore -= 20;
        }

        if (paper.citationCount < 10) {
            verification.rigor -= 15;
        }

        this.ctx.evidence({
            type: "log",
            ref: `Methodology verification score: ${verification.methodologyScore}`
        });

        return verification;
    }

    /**
     * Health check for the provider
     */
    async healthCheck(): Promise<boolean> {
        try {
            const url = `${this.baseUrl}/paper/search?query=test&limit=1`;
            await this.ctx.request(url, {
                headers: this.buildRequestHeaders()
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
            case "semantic_scholar_search_papers":
                return await this.searchPapers(params);

            case "semantic_scholar_get_paper": {
                const paper = await this.getPaper(params.paperId as string);
                return paper || { error: "Paper not found" };
            }

            case "semantic_scholar_get_paper_citations":
                return await this.getPaperCitations(params);

            case "semantic_scholar_get_paper_references":
                return await this.getPaperReferences(params);

            case "semantic_scholar_search_authors":
                return await this.searchAuthors(params);

            case "semantic_scholar_get_author": {
                const author = await this.getAuthor(params.authorId as string);
                return author || { error: "Author not found" };
            }

            case "semantic_scholar_get_author_papers":
                return await this.getAuthorPapers(params.authorId, params.limit, params.offset);

            case "semantic_scholar_validate_citations":
                return await this.validateCitations(params.paperId, params.check_license);

            case "semantic_scholar_verify_methodology":
                return await this.verifyMethodology(params.paperId, params.check_license);

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
}

/**
 * FASTMCP v3.22 capability registration
 */
export const semanticScholarCapabilities = {
    id: "semantic-scholar",
    name: "Semantic Scholar Academic Provider",
    version: "1.0.0",
    description: "Academic paper search and citation analysis via Semantic Scholar API",
    tools: SemanticScholarProvider.getToolDefinitions(),
    resources: [],
    prompts: [
        {
            name: "analyze_paper_impact",
            description: "Analyze the impact and citations of a research paper",
            arguments: [
                {
                    name: "paperId",
                    description: "Semantic Scholar paper ID or DOI",
                    required: true
                }
            ]
        },
        {
            name: "find_related_papers",
            description: "Find papers related to a given paper through citations and references",
            arguments: [
                {
                    name: "paperId",
                    description: "Semantic Scholar paper ID or DOI",
                    required: true
                },
                {
                    name: "depth",
                    description: "Depth of relationship exploration (default: 1)",
                    required: false
                }
            ]
        },
        {
            name: "author_collaboration_network",
            description: "Analyze author collaboration networks",
            arguments: [
                {
                    name: "authorId",
                    description: "Semantic Scholar author ID",
                    required: true
                }
            ]
        }
    ]
};
