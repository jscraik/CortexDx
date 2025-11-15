#!/usr/bin/env tsx
/**
 * MCP Docs Indexer
 *
 * Fetches MCP documentation pages, normalizes them, chunks the content,
 * and builds a deterministic offline knowledge pack with SQLite FTS.
 *
 * Usage:
 *   pnpm docs:mcp:index
 *
 * Environment:
 *   MCP_DOCS_VERSION - Version identifier (default: v2025-06-18)
 *   MCP_DOCS_DRY_RUN - Skip writing to disk (default: false)
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Configuration
// ============================================================================

interface PageSpec {
  id: string;
  url: string;
}

const PAGES: PageSpec[] = [
  {
    id: "intro",
    url: "https://modelcontextprotocol.io/docs/getting-started/intro",
  },
  {
    id: "spec-2025-06-18",
    url: "https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/",
  },
  {
    id: "about",
    url: "https://modelcontextprotocol.io/about",
  },
  {
    id: "concepts-capabilities",
    url: "https://modelcontextprotocol.io/docs/concepts/capabilities",
  },
  {
    id: "concepts-tools",
    url: "https://modelcontextprotocol.io/docs/concepts/tools",
  },
  {
    id: "concepts-resources",
    url: "https://modelcontextprotocol.io/docs/concepts/resources",
  },
  {
    id: "concepts-prompts",
    url: "https://modelcontextprotocol.io/docs/concepts/prompts",
  },
  {
    id: "concepts-server-info",
    url: "https://modelcontextprotocol.io/docs/concepts/server",
  },
  {
    id: "concepts-lifecycle",
    url: "https://modelcontextprotocol.io/docs/concepts/lifecycle",
  },
  {
    id: "concepts-authentication",
    url: "https://modelcontextprotocol.io/docs/concepts/authentication",
  },
];

const VERSION = process.env.MCP_DOCS_VERSION ?? "v2025-06-18";
const DRY_RUN = process.env.MCP_DOCS_DRY_RUN === "1";

const DATA_ROOT = path.resolve(__dirname, "../../data/knowledge/mcp-docs");
const VERSION_DIR = path.join(DATA_ROOT, VERSION);

// ============================================================================
// Types
// ============================================================================

interface DocChunk {
  id: string;
  pageId: string;
  url: string;
  title: string;
  text: string;
  anchor?: string;
  headings: string[];
}

interface PageData {
  id: string;
  url: string;
  title: string;
  html: string;
  sha256: string;
  fetchedAt: string;
}

interface Manifest {
  version: string;
  createdAt: string;
  commit: string;
  pages: {
    id: string;
    url: string;
    title: string;
    sha256: string;
    anchors: string[];
  }[];
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log(`[mcp-docs-index] Starting indexer for version: ${VERSION}`);
  console.log(`[mcp-docs-index] Output directory: ${VERSION_DIR}`);
  console.log(`[mcp-docs-index] Dry run: ${DRY_RUN}`);
  console.log("");

  // Step 1: Fetch pages
  console.log("[1/5] Fetching pages...");
  const pages = await fetchPages(PAGES);
  console.log(`      Fetched ${pages.length} pages`);
  console.log("");

  // Step 2: Normalize and chunk
  console.log("[2/5] Normalizing and chunking...");
  const allChunks: DocChunk[] = [];
  for (const page of pages) {
    const chunks = chunkPage(page);
    allChunks.push(...chunks);
    console.log(`      ${page.id}: ${chunks.length} chunks`);
  }
  console.log(`      Total chunks: ${allChunks.length}`);
  console.log("");

  // Step 3: Build manifest
  console.log("[3/5] Building manifest...");
  const manifest = buildManifest(pages, allChunks);
  console.log(`      Version: ${manifest.version}`);
  console.log(`      Commit: ${manifest.commit}`);
  console.log("");

  // Step 4: Write to disk
  if (!DRY_RUN) {
    console.log("[4/5] Writing to disk...");
    await mkdir(VERSION_DIR, { recursive: true });

    // Write manifest
    const manifestPath = path.join(VERSION_DIR, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`      Wrote: ${manifestPath}`);

    // Write chunks as JSONL
    const jsonlPath = path.join(VERSION_DIR, "pages.jsonl");
    const jsonlLines = allChunks.map((c) => JSON.stringify(c)).join("\n");
    await writeFile(jsonlPath, jsonlLines);
    console.log(`      Wrote: ${jsonlPath}`);
  } else {
    console.log("[4/5] Skipped writing (dry run)");
  }
  console.log("");

  // Step 5: Build SQLite database
  if (!DRY_RUN) {
    console.log("[5/5] Building SQLite database...");
    await buildDatabase(allChunks, manifest);
    console.log("      Done");
  } else {
    console.log("[5/5] Skipped database build (dry run)");
  }
  console.log("");

  console.log("✅ Indexing complete!");
}

// ============================================================================
// Fetch Pages
// ============================================================================

async function fetchPages(specs: PageSpec[]): Promise<PageData[]> {
  const pages: PageData[] = [];

  for (const spec of specs) {
    try {
      const response = await fetch(spec.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} for ${spec.url}`);
      }

      const html = await response.text();
      const sha256 = createHash("sha256").update(html).digest("hex");
      const title = extractTitle(html);

      pages.push({
        id: spec.id,
        url: spec.url,
        title,
        html,
        sha256,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`   ❌ Failed to fetch ${spec.id}: ${String(error)}`);
    }
  }

  return pages;
}

function extractTitle(html: string): string {
  const match = html.match(/<title>(.*?)<\/title>/i);
  return match?.[1]?.trim() ?? "Untitled";
}

// ============================================================================
// Chunking
// ============================================================================

function chunkPage(page: PageData): DocChunk[] {
  // Simplified chunking: extract text from HTML and split by paragraphs
  // In production, use a proper HTML-to-Markdown converter
  const text = stripHtml(page.html);
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 50);

  const chunks: DocChunk[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]?.trim() ?? "";
    if (!para) continue;

    chunks.push({
      id: `${page.id}-chunk-${i}`,
      pageId: page.id,
      url: page.url,
      title: page.title,
      text: para,
      headings: [],
    });
  }

  return chunks;
}

function stripHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&quot;/g, '"');

  // Normalize whitespace
  text = text.replace(/\s+/g, " ");
  text = text.replace(/\n\s+/g, "\n");

  return text.trim();
}

// ============================================================================
// Manifest
// ============================================================================

function buildManifest(pages: PageData[], chunks: DocChunk[]): Manifest {
  const commit = process.env.GIT_SHA ?? "local-dev";

  return {
    version: VERSION,
    createdAt: new Date().toISOString(),
    commit,
    pages: pages.map((p) => ({
      id: p.id,
      url: p.url,
      title: p.title,
      sha256: p.sha256,
      anchors: chunks
        .filter((c) => c.pageId === p.id && c.anchor)
        .map((c) => c.anchor ?? ""),
    })),
  };
}

// ============================================================================
// SQLite Database
// ============================================================================

async function buildDatabase(
  chunks: DocChunk[],
  manifest: Manifest,
): Promise<void> {
  // Import dynamically to avoid loading at top-level
  const { DocsStore } = await import(
    "../../packages/mcp/mcp-docs-adapter/src/lib/store.js"
  );

  const dbPath = path.join(VERSION_DIR, "mcp-docs.sqlite");
  const store = new DocsStore(dbPath);

  // Clear existing data
  store.clear();

  // Insert chunks
  store.insertChunks(chunks);

  // Store manifest
  store.setManifest(manifest);

  const stats = store.getStats();
  console.log(`      Indexed ${stats.totalChunks} chunks from ${stats.totalPages} pages`);

  store.close();
}

// ============================================================================
// Run
// ============================================================================

main().catch((error) => {
  console.error("❌ Indexer failed:", error);
  process.exit(1);
});
