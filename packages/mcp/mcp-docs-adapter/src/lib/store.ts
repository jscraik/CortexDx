/**
 * SQLite-based vector store for MCP docs knowledge pack
 */

import Database from "better-sqlite3";
import type { DocChunk, DocManifest } from "../contracts.js";

export class DocsStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    try {
      this.db = new Database(dbPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to open SQLite database at path "${dbPath}".\n` +
        `Error: ${message}\n` +
        `Troubleshooting steps:\n` +
        `- Ensure the path exists and is correct.\n` +
        `- Check file and directory permissions.\n` +
        `- Ensure the file system is writable.\n`
      );
    }
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        anchor TEXT,
        headings TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_page_id ON chunks(page_id);
      CREATE INDEX IF NOT EXISTS idx_url ON chunks(url);

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        id UNINDEXED,
        title,
        text,
        content=chunks,
        content_rowid=rowid
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /**
   * Insert chunks in batch (for indexing)
   */
  insertChunks(chunks: DocChunk[]): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, page_id, url, title, text, anchor, headings, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFts = this.db.prepare(`
      INSERT OR REPLACE INTO chunks_fts (id, title, text)
      VALUES (?, ?, ?)
    `);

    const transaction = this.db.transaction((chunks: DocChunk[]) => {
      for (const chunk of chunks) {
        const now = Date.now();
        insert.run(
          chunk.id,
          chunk.pageId,
          chunk.url,
          chunk.title,
          chunk.text,
          chunk.anchor ?? null,
          JSON.stringify(chunk.headings),
          now,
        );
        insertFts.run(chunk.id, chunk.title, chunk.text);
      }
    });

    transaction(chunks);
  }

  /**
   * Full-text search using SQLite FTS5
   */
  search(query: string, limit = 5): Array<DocChunk & { score: number }> {
    const stmt = this.db.prepare(`
      SELECT
        c.id,
        c.page_id as pageId,
        c.url,
        c.title,
        c.text,
        c.anchor,
        c.headings,
        fts.rank as score
      FROM chunks_fts fts
      JOIN chunks c ON c.id = fts.id
      WHERE chunks_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `);

    const rows = stmt.all(query, limit) as Array<{
      id: string;
      pageId: string;
      url: string;
      title: string;
      text: string;
      anchor: string | null;
      headings: string;
      score: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      pageId: row.pageId,
      url: row.url,
      title: row.title,
      text: row.text,
      anchor: row.anchor ?? undefined,
      headings: JSON.parse(row.headings) as string[],
      score: row.score,
    }));
  }

  /**
   * Lookup a chunk by ID
   */
  lookup(id: string): DocChunk | null {
    const stmt = this.db.prepare(`
      SELECT id, page_id as pageId, url, title, text, anchor, headings
      FROM chunks
      WHERE id = ?
    `);

    const row = stmt.get(id) as
      | {
        id: string;
        pageId: string;
        url: string;
        title: string;
        text: string;
        anchor: string | null;
        headings: string;
      }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      pageId: row.pageId,
      url: row.url,
      title: row.title,
      text: row.text,
      anchor: row.anchor ?? undefined,
      headings: JSON.parse(row.headings) as string[],
    };
  }

  /**
   * Set metadata (manifest, version, etc.)
   */
  setMetadata(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value)
      VALUES (?, ?)
    `);
    stmt.run(key, value);
  }

  /**
   * Get metadata
   */
  getMetadata(key: string): string | null {
    const stmt = this.db.prepare(`
      SELECT value FROM metadata WHERE key = ?
    `);
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  /**
   * Get manifest
   */
  getManifest(): DocManifest | null {
    const manifestJson = this.getMetadata("manifest");
    if (!manifestJson) return null;
    return JSON.parse(manifestJson) as DocManifest;
  }

  /**
   * Set manifest
   */
  setManifest(manifest: DocManifest): void {
    this.setMetadata("manifest", JSON.stringify(manifest));
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.db.exec(`
      DELETE FROM chunks;
      DELETE FROM chunks_fts;
      DELETE FROM metadata;
    `);
  }

  /**
   * Close the database
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database stats
   */
  getStats(): { totalChunks: number; totalPages: number } {
    const chunkCount = this.db
      .prepare("SELECT COUNT(*) as count FROM chunks")
      .get() as { count: number };
    const pageCount = this.db
      .prepare("SELECT COUNT(DISTINCT page_id) as count FROM chunks")
      .get() as { count: number };

    return {
      totalChunks: chunkCount.count,
      totalPages: pageCount.count,
    };
  }
}
