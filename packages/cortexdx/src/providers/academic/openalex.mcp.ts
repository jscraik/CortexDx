/**
 * OpenAlex MCP Provider
 * FASTMCP v3.22 compliant provider for scholarly work and author research
 * Enhanced with license validation, research trend analysis, and IP compliance
 */

import {
  type LicenseValidatorPlugin,
  createLicenseValidator,
} from "../../plugins/development/license-validation.js";
import type { DiagnosticContext } from "../../types.js";
import { HttpMcpClient, sanitizeToolArgs } from "./http-mcp-client.js";

export interface OpenAlexWork {
  id: string;
  title: string;
  display_name: string;
  publication_year?: number;
  publication_date?: string;
  type: string;
  cited_by_count: number;
  is_oa: boolean;
  doi?: string;
  authorships: Array<{
    author: {
      id: string;
      display_name: string;
      orcid?: string;
    };
    institutions: Array<{
      id: string;
      display_name: string;
      country_code?: string;
    }>;
  }>;
  host_venue?: {
    id?: string;
    display_name?: string;
    issn_l?: string;
    is_oa?: boolean;
  };
  concepts: Array<{
    id: string;
    display_name: string;
    level: number;
    score: number;
  }>;
  abstract_inverted_index?: Record<string, number[]>;
}

export interface OpenAlexAuthor {
  id: string;
  display_name: string;
  orcid?: string;
  works_count: number;
  cited_by_count: number;
  h_index: number;
  i10_index: number;
  last_known_institution?: {
    id: string;
    display_name: string;
    country_code?: string;
  };
  concepts: Array<{
    id: string;
    display_name: string;
    level: number;
    score: number;
  }>;
  counts_by_year: Array<{
    year: number;
    works_count: number;
    cited_by_count: number;
  }>;
}

export interface OpenAlexInstitution {
  id: string;
  display_name: string;
  country_code?: string;
  type?: string;
  homepage_url?: string;
  works_count: number;
  cited_by_count: number;
  h_index: number;
  counts_by_year: Array<{
    year: number;
    works_count: number;
    cited_by_count: number;
  }>;
}

export interface OpenAlexSearchParams {
  query?: string;
  filter?: string;
  sort?: string;
  page?: number;
  per_page?: number;
  select?: string[];
}

export class OpenAlexProvider {
  private readonly baseUrl = "https://api.openalex.org";
  private readonly userAgent = "CortexDx/1.0.0 (Academic Research)";
  private readonly licenseValidator: LicenseValidatorPlugin;
  private readonly remoteClient?: HttpMcpClient;
  private readonly contactEmail?: string;

  constructor(private ctx: DiagnosticContext) {
    this.licenseValidator = createLicenseValidator(ctx);
    this.remoteClient = initializeOpenAlexClient(ctx);
    const headerContact = ctx.headers?.["x-openalex-contact"] as string | undefined;
    const envContact = process.env.OPENALEX_CONTACT_EMAIL;
    this.contactEmail = (headerContact ?? envContact ?? "").trim().toLowerCase() || undefined;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      "User-Agent": this.userAgent,
      Accept: "application/json",
      ...(this.ctx.headers ?? {}),
      ...(extra ?? {}),
    };
  }

  private withMailto(url: string): string {
    if (!this.contactEmail) {
      return url;
    }
    try {
      const target = new URL(url);
      target.searchParams.set("mailto", this.contactEmail);
      return target.toString();
    } catch {
      return url;
    }
  }

  /**
   * FASTMCP v3.22 tool definitions
   */
  static getToolDefinitions() {
    return [
      {
        name: "openalex_search_works",
        description: "Search for scholarly works using OpenAlex API",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for works",
            },
            filter: {
              type: "string",
              description:
                "Filter criteria (e.g., 'publication_year:2020-2023')",
            },
            sort: {
              type: "string",
              description:
                "Sort order (e.g., 'cited_by_count:desc', 'publication_date:desc')",
              default: "cited_by_count:desc",
            },
            page: {
              type: "number",
              description: "Page number for pagination (default: 1)",
              minimum: 1,
              default: 1,
            },
            per_page: {
              type: "number",
              description: "Results per page (default: 25, max: 200)",
              minimum: 1,
              maximum: 200,
              default: 25,
            },
          },
        },
      },
      {
        name: "openalex_search_authors",
        description: "Search for authors using OpenAlex API",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for authors",
            },
            filter: {
              type: "string",
              description:
                "Filter criteria (e.g., 'last_known_institution.country_code:US')",
            },
            sort: {
              type: "string",
              description:
                "Sort order (e.g., 'cited_by_count:desc', 'works_count:desc')",
              default: "cited_by_count:desc",
            },
            page: {
              type: "number",
              description: "Page number for pagination (default: 1)",
              minimum: 1,
              default: 1,
            },
            per_page: {
              type: "number",
              description: "Results per page (default: 25, max: 200)",
              minimum: 1,
              maximum: 200,
              default: 25,
            },
          },
        },
      },
      {
        name: "openalex_search_institutions",
        description: "Search for institutions using OpenAlex API",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for institutions",
            },
            filter: {
              type: "string",
              description:
                "Filter criteria (e.g., 'country_code:US', 'type:education')",
            },
            sort: {
              type: "string",
              description:
                "Sort order (e.g., 'works_count:desc', 'cited_by_count:desc')",
              default: "works_count:desc",
            },
            page: {
              type: "number",
              description: "Page number for pagination (default: 1)",
              minimum: 1,
              default: 1,
            },
            per_page: {
              type: "number",
              description: "Results per page (default: 25, max: 200)",
              minimum: 1,
              maximum: 200,
              default: 25,
            },
          },
        },
      },
      {
        name: "openalex_get_work",
        description: "Get detailed information about a specific work",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "OpenAlex work ID or DOI",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "openalex_get_author",
        description: "Get detailed information about a specific author",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "OpenAlex author ID or ORCID",
            },
          },
          required: ["id"],
        },
      },
    ];
  }

  /**
   * Search for works
   */
  async searchWorks(
    params: OpenAlexSearchParams,
  ): Promise<{ results: OpenAlexWork[]; meta: unknown }> {
    const searchParams = new URLSearchParams();

    if (params.query) searchParams.append("search", params.query);
    if (params.filter) searchParams.append("filter", params.filter);
    if (params.sort) searchParams.append("sort", params.sort);
    if (params.page) searchParams.append("page", String(params.page));
    if (params.per_page)
      searchParams.append("per-page", String(params.per_page));

    const url = `${this.baseUrl}/works?${searchParams}`;
    const target = this.withMailto(url);

    try {
      const response = await this.ctx.request<{
        results: OpenAlexWork[];
        meta: unknown;
      }>(target, {
        headers: this.buildHeaders(),
      });

      this.ctx.evidence({
        type: "url",
        ref: target,
      });

      return response;
    } catch (error) {
      this.ctx.logger("OpenAlex works search failed:", error);
      throw new Error(
        `OpenAlex API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search for authors
   */
  async searchAuthors(
    params: OpenAlexSearchParams,
  ): Promise<{ results: OpenAlexAuthor[]; meta: unknown }> {
    const searchParams = new URLSearchParams();

    if (params.query) searchParams.append("search", params.query);
    if (params.filter) searchParams.append("filter", params.filter);
    if (params.sort) searchParams.append("sort", params.sort);
    if (params.page) searchParams.append("page", String(params.page));
    if (params.per_page)
      searchParams.append("per-page", String(params.per_page));

    const url = `${this.baseUrl}/authors?${searchParams}`;
    const target = this.withMailto(url);

    try {
      const response = await this.ctx.request<{
        results: OpenAlexAuthor[];
        meta: unknown;
      }>(target, {
        headers: this.buildHeaders(),
      });

      this.ctx.evidence({
        type: "url",
        ref: target,
      });

      return response;
    } catch (error) {
      this.ctx.logger("OpenAlex authors search failed:", error);
      throw new Error(
        `OpenAlex API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search for institutions
   */
  async searchInstitutions(
    params: OpenAlexSearchParams,
  ): Promise<{ results: OpenAlexInstitution[]; meta: unknown }> {
    const searchParams = new URLSearchParams();

    if (params.query) searchParams.append("search", params.query);
    if (params.filter) searchParams.append("filter", params.filter);
    if (params.sort) searchParams.append("sort", params.sort);
    if (params.page) searchParams.append("page", String(params.page));
    if (params.per_page)
      searchParams.append("per-page", String(params.per_page));

    const url = `${this.baseUrl}/institutions?${searchParams}`;
    const target = this.withMailto(url);

    try {
      const response = await this.ctx.request<{
        results: OpenAlexInstitution[];
        meta: unknown;
      }>(target, {
        headers: this.buildHeaders(),
      });

      this.ctx.evidence({
        type: "url",
        ref: target,
      });

      return response;
    } catch (error) {
      this.ctx.logger("OpenAlex institutions search failed:", error);
      throw new Error(
        `OpenAlex API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get detailed work information
   */
  async getWork(id: string): Promise<OpenAlexWork | null> {
    const workId = id.startsWith("https://openalex.org/")
      ? id
      : `https://openalex.org/${id}`;
    const url = `${this.baseUrl}/works/${encodeURIComponent(workId)}`;
    const target = this.withMailto(url);

    try {
      const response = await this.ctx.request<OpenAlexWork>(target, {
        headers: this.buildHeaders(),
      });

      this.ctx.evidence({
        type: "url",
        ref: target,
      });

      return response;
    } catch (error) {
      this.ctx.logger("OpenAlex work details failed:", error);
      return null;
    }
  }

  /**
   * Get detailed author information
   */
  async getAuthor(id: string): Promise<OpenAlexAuthor | null> {
    const authorId = id.startsWith("https://openalex.org/")
      ? id
      : `https://openalex.org/${id}`;
    const url = `${this.baseUrl}/authors/${encodeURIComponent(authorId)}`;
    const target = this.withMailto(url);

    try {
      const response = await this.ctx.request<OpenAlexAuthor>(target, {
        headers: this.buildHeaders(),
      });

      this.ctx.evidence({
        type: "url",
        ref: target,
      });

      return response;
    } catch (error) {
      this.ctx.logger("OpenAlex author details failed:", error);
      return null;
    }
  }

  /**
   * Health check for the provider
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/works?per-page=1`;
      await this.ctx.request(this.withMailto(url), {
        headers: this.buildHeaders(),
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize HTTP MCP client for OpenAlex
   */
  async initializeHttpMcpClient(): Promise<HttpMcpClient | undefined> {
    if (process.env.CORTEXDX_DISABLE_OPENALEX_HTTP === "1") {
      return undefined;
    }

    // OpenAlex doesn't require authentication for basic access
    // But we can support it if needed
    const baseUrl = "https://api.openalex.org";

    try {
      return new HttpMcpClient({
        baseUrl,
        headers: {
          "User-Agent": "CortexDx/1.0.0 (Academic Research)",
        },
      });
    } catch (error) {
      console.warn("[OpenAlex] Failed to initialize HTTP MCP client:", error);
      return undefined;
    }
  }

  /**
   * Call remote tool if available
   */
  private async callRemoteTool<T>(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<T | undefined> {
    if (!this.remoteClient) {
      return undefined;
    }

    try {
      const result = await this.remoteClient.callToolJson<T>(
        toolName,
        sanitizeToolArgs(params),
      );
      this.ctx.evidence({
        type: "log",
        ref: `OpenAlex remote tool call: ${toolName}`,
      });
      return result;
    } catch (error) {
      this.ctx.logger?.(
        `[OpenAlex] Remote tool call failed for ${toolName}:`,
        error,
      );
      return undefined;
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
      case "openalex_search_works":
        return await this.searchWorks(params as OpenAlexSearchParams);

      case "openalex_search_authors":
        return await this.searchAuthors(params as OpenAlexSearchParams);

      case "openalex_search_institutions":
        return await this.searchInstitutions(params as OpenAlexSearchParams);

      case "openalex_get_work": {
        const work = await this.getWork(params.id as string);
        return work || { error: "Work not found" };
      }

      case "openalex_get_author": {
        const author = await this.getAuthor(params.id as string);
        return author || { error: "Author not found" };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

/**
 * Initialize HTTP MCP client for OpenAlex
 */
function initializeOpenAlexClient(
  ctx: DiagnosticContext,
): HttpMcpClient | undefined {
  if (process.env.CORTEXDX_DISABLE_OPENALEX_HTTP === "1") {
    return undefined;
  }

  // OpenAlex doesn't require authentication for basic access
  // But we can support it if needed
  const baseUrl = "https://api.openalex.org";

  try {
    return new HttpMcpClient({
      baseUrl,
      headers: {
        "User-Agent": "CortexDx/1.0.0 (Academic Research)",
      },
    });
  } catch (error) {
    console.warn("[OpenAlex] Failed to initialize HTTP MCP client:", error);
    return undefined;
  }
}

/**
 * FASTMCP v3.22 capability registration
 */
export const openAlexCapabilities = {
  id: "openalex",
  name: "OpenAlex Academic Provider",
  version: "1.0.0",
  description: "Scholarly work and author research via OpenAlex API",
  tools: OpenAlexProvider.getToolDefinitions(),
  resources: [],
  prompts: [
    {
      name: "analyze_author_impact",
      description: "Analyze an author's research impact and metrics",
      arguments: [
        {
          name: "authorId",
          description: "OpenAlex author ID or ORCID",
          required: true,
        },
      ],
    },
    {
      name: "compare_institutions",
      description: "Compare research output between institutions",
      arguments: [
        {
          name: "institution1",
          description: "First institution name or ID",
          required: true,
        },
        {
          name: "institution2",
          description: "Second institution name or ID",
          required: true,
        },
      ],
    },
  ],
};
