/**
 * MCP Docs Adapter Server
 *
 * Exposes MCP documentation as searchable knowledge via MCP tools:
 * - mcp_docs.search: Search documentation with query
 * - mcp_docs.lookup: Get full chunk by ID
 * - mcp_docs.version: Get version info and available snapshots
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SearchInput,
  SearchOutput,
  LookupInput,
  LookupOutput,
  VersionOutput,
  ErrorCode,
  McpDocsError,
  type Passage,
} from "./contracts.js";
import { DocsStore } from "./lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * MCP Docs Adapter
 */
export class McpDocsAdapter {
  private store: DocsStore | null = null;
  private activeVersion: string;
  private dataRoot: string;

  constructor(dataRoot?: string) {
    // Find workspace root: use environment variable or process.cwd() as fallback
    // You can set MCP_DOCS_WORKSPACE_ROOT to override the default workspace root
    const workspaceRoot =
      process.env.MCP_DOCS_WORKSPACE_ROOT ??
      process.cwd();
    this.dataRoot =
      dataRoot ?? path.join(workspaceRoot, "data/knowledge/mcp-docs");
    this.activeVersion = process.env.MCP_DOCS_VERSION ?? "v2025-06-18";
  }

  /**
   * Initialize the adapter and load the active version
   */
  async initialize(): Promise<void> {
    const dbPath = path.join(
      this.dataRoot,
      this.activeVersion,
      "mcp-docs.sqlite",
    );

    try {
      this.store = new DocsStore(dbPath);
      const manifest = this.store.getManifest();

      if (!manifest) {
        throw new McpDocsError(
          ErrorCode.DATA_MISSING,
          `No manifest found in ${dbPath}. Run 'pnpm docs:mcp:index' to generate the knowledge pack.`,
          { dbPath, version: this.activeVersion },
        );
      }
    } catch (error) {
      if (error instanceof McpDocsError) throw error;

      throw new McpDocsError(
        ErrorCode.DATA_MISSING,
        `Failed to initialize MCP docs adapter: ${String(error)}`,
        { dbPath, version: this.activeVersion },
      );
    }
  }

  /**
   * Search documentation
   */
  async search(input: unknown): Promise<SearchOutput> {
    // Validate input first (before checking store)
    const parsed = SearchInput.parse(input);

    if (!this.store) {
      throw new McpDocsError(
        ErrorCode.DATA_MISSING,
        "Store not initialized. Call initialize() first.",
      );
    }
    const startTime = Date.now();

    // If a specific version is requested, validate it
    if (parsed.version && parsed.version !== this.activeVersion) {
      throw new McpDocsError(
        ErrorCode.VERSION_MISMATCH,
        `Requested version ${parsed.version} does not match active version ${this.activeVersion}`,
        { requested: parsed.version, active: this.activeVersion },
      );
    }

    const chunks = this.store.search(parsed.query, parsed.topK);

    const hits: Passage[] = chunks.map((chunk, idx) => ({
      id: chunk.id,
      url: chunk.url,
      title: chunk.title,
      score: 1.0 / (idx + 1), // Simple ranking score
      text: chunk.text,
      anchor: chunk.anchor,
    }));

    const tookMs = Date.now() - startTime;

    return {
      version: this.activeVersion,
      tookMs,
      hits,
    };
  }

  /**
   * Lookup a chunk by ID
   */
  async lookup(input: unknown): Promise<LookupOutput> {
    // Validate input first (before checking store)
    const parsed = LookupInput.parse(input);

    if (!this.store) {
      throw new McpDocsError(
        ErrorCode.DATA_MISSING,
        "Store not initialized. Call initialize() first.",
      );
    }
    const chunk = this.store.lookup(parsed.id);

    if (!chunk) {
      throw new McpDocsError(ErrorCode.NOT_FOUND, `Chunk not found: ${parsed.id}`, {
        id: parsed.id,
      });
    }

    return {
      id: chunk.id,
      url: chunk.url,
      title: chunk.title,
      text: chunk.text,
      outline: chunk.headings,
    };
  }

  /**
   * Get version information
   */
  async version(): Promise<VersionOutput> {
    const manifest = this.store?.getManifest();

    return {
      active: this.activeVersion,
      available: [this.activeVersion], // TODO: scan data root for other versions
      commit: manifest?.commit ?? "unknown",
    };
  }

  /**
   * Close the adapter
   */
  close(): void {
    this.store?.close();
  }
}

/**
 * Factory function for creating an adapter instance
 */
export async function createMcpDocsAdapter(
  dataRoot?: string,
): Promise<McpDocsAdapter> {
  const adapter = new McpDocsAdapter(dataRoot);
  await adapter.initialize();
  return adapter;
}
