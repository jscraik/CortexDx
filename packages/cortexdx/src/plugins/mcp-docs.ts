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
  async run(_ctx) {
    // Disabled due to missing @cortex-os/mcp-docs-adapter module
    const findings: Finding[] = [];
    return findings;
  },
};

/**
 * Get MCP docs adapter instance
 */
// async function getMcpDocsAdapter(): Promise<McpDocsAdapter | null> {
//   try {
//     const { createMcpDocsAdapter } = await import(
//       "@cortex-os/mcp-docs-adapter"
//     );
//     return await createMcpDocsAdapter();
//   } catch (error) {
//     console.error("Failed to load MCP docs adapter:", error);
//     return null;
//   }
// }

/**
 * Search for relevant documentation based on server metadata
 */
// async function searchRelevantDocs(
//   adapter: McpDocsAdapter,
//   _metadata: Record<string, unknown>,
// ): Promise<Finding[]> {
//   const findings: Finding[] = [];
//
//   try {
//     // Search for "capabilities" documentation
//     const capabilitiesSearch = await adapter.search({
//       query: "capabilities",
//       topK: 3,
//     });
//
//     if (capabilitiesSearch.hits.length > 0) {
//       findings.push({
//         id: "mcp.docs.capabilities",
//         area: "documentation",
//         severity: "info",
//         title: "Capabilities documentation available",
//         description: `Found ${capabilitiesSearch.hits.length} documentation passages about capabilities`,
//         evidence: capabilitiesSearch.hits.map((hit) => ({
//           type: "url",
//           ref: hit.url,
//         })),
//         confidence: 1.0,
//       });
//     }
//   } catch (error) {
//     console.warn(
//       "Failed to search relevant docs in searchRelevantDocs:",
//       error,
//     );
//   }
//
//   return findings;
// }

/**
 * Get documentation URL for a specific error category
 *
 * This replaces hardcoded URLs with offline knowledge pack lookups
 */
export async function getDocumentationForCategory(
  _category: string,
): Promise<string | null> {
  // Disabled due to missing @cortex-os/mcp-docs-adapter module
  return null;
}

// Type definitions for adapter (to avoid circular imports)
// interface McpDocsAdapter {
//   search(input: {
//     query: string;
//     topK?: number;
//   }): Promise<{
//     version: string;
//     tookMs: number;
//     hits: Array<{
//       id: string;
//       url: string;
//       title: string;
//       score: number;
//       text: string;
//       anchor?: string;
//     }>;
//   }>;
//   lookup(input: { id: string }): Promise<{
//     id: string;
//     url: string;
//     title: string;
//     text: string;
//     outline: string[];
//   }>;
//   version(): Promise<{
//     active: string;
//     available: string[];
//     commit: string;
//   }>;
// }
