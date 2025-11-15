/**
 * MCP Docs Plugin for CortexDx
 *
 * Provides offline MCP documentation search and retrieval
 * using the MCP docs knowledge pack.
 *
 * This plugin enhances error reporting and diagnostics by providing
 * contextual documentation links and evidence from the official MCP spec.
 */

import type { DiagnosticPlugin, Finding } from "../types.js";

/**
 * MCP Docs Plugin
 *
 * Integrates offline MCP documentation search for enhanced diagnostics.
 */
export const McpDocsPlugin: DiagnosticPlugin = {
  id: "mcp-docs",
  title: "MCP Documentation Search",
  order: 200,
  async run(ctx) {
    const findings: Finding[] = [];

    try {
      // Check if MCP docs adapter is available
      const adapter = await getMcpDocsAdapter();

      if (!adapter) {
        findings.push({
          id: "mcp.docs.unavailable",
          area: "documentation",
          severity: "info",
          title: "MCP docs knowledge pack not available",
          description:
            "Run 'pnpm docs:mcp:index' to enable offline documentation search",
          evidence: [{ type: "log", ref: "McpDocsPlugin" }],
          confidence: 1.0,
        });
        return findings;
      }

      // Get version info
      const versionInfo = await adapter.version();

      findings.push({
        id: "mcp.docs.available",
        area: "documentation",
        severity: "info",
        title: `MCP docs knowledge pack loaded (${versionInfo.active})`,
        description: `Offline documentation search enabled. ${versionInfo.available.length} version(s) available.`,
        evidence: [
          { type: "log", ref: `version=${versionInfo.active}` },
          { type: "log", ref: `commit=${versionInfo.commit}` },
        ],
        confidence: 1.0,
      });

      // Example: Search for relevant documentation based on server capabilities
      if (ctx.metadata?.capabilities) {
        const searchResults = await searchRelevantDocs(adapter, ctx.metadata);
        findings.push(...searchResults);
      }
    } catch (error) {
      findings.push({
        id: "mcp.docs.error",
        area: "documentation",
        severity: "minor",
        title: "MCP docs plugin error",
        description: `Failed to load MCP docs: ${String(error)}`,
        evidence: [{ type: "log", ref: "McpDocsPlugin" }],
        confidence: 0.9,
      });
    }

    return findings;
  },
};

/**
 * Get MCP docs adapter instance
 */
async function getMcpDocsAdapter(): Promise<McpDocsAdapter | null> {
  try {
    const { createMcpDocsAdapter } = await import(
      "@cortex-os/mcp-docs-adapter"
    );
    return await createMcpDocsAdapter();
  } catch (error) {
    console.warn('Failed to load MCP docs adapter:', error);
    return null;
  }
}

/**
 * Search for relevant documentation based on server metadata
 */
async function searchRelevantDocs(
  adapter: McpDocsAdapter,
  metadata: Record<string, unknown>,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Search for "capabilities" documentation
    const capabilitiesSearch = await adapter.search({
      query: "capabilities",
      topK: 3,
    });

    if (capabilitiesSearch.hits.length > 0) {
      findings.push({
        id: "mcp.docs.capabilities",
        area: "documentation",
        severity: "info",
        title: "Capabilities documentation available",
        description: `Found ${capabilitiesSearch.hits.length} documentation passages about capabilities`,
        evidence: capabilitiesSearch.hits.map((hit) => ({
          type: "url",
          ref: hit.url,
        })),
        confidence: 1.0,
      });
    }
  } catch (error) {
    // Silently ignore search errors
  }

  return findings;
}

/**
 * Get documentation URL for a specific error category
 *
 * This replaces hardcoded URLs with offline knowledge pack lookups
 */
export async function getDocumentationForCategory(
  category: string,
): Promise<string | null> {
  try {
    const adapter = await getMcpDocsAdapter();
    if (!adapter) return null;

    const searchResults = await adapter.search({
      query: category,
      topK: 1,
    });

    return searchResults.hits[0]?.url ?? null;
  } catch {
    return null;
  }
}

// Type definitions for adapter (to avoid circular imports)
interface McpDocsAdapter {
  search(input: {
    query: string;
    topK?: number;
  }): Promise<{
    version: string;
    tookMs: number;
    hits: Array<{
      id: string;
      url: string;
      title: string;
      score: number;
      text: string;
      anchor?: string;
    }>;
  }>;
  lookup(input: { id: string }): Promise<{
    id: string;
    url: string;
    title: string;
    text: string;
    outline: string[];
  }>;
  version(): Promise<{
    active: string;
    available: string[];
    commit: string;
  }>;
}
