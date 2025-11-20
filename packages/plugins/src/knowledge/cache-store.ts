import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { SpecContent } from "@brainwav/cortexdx-core";

export interface CacheEntry extends SpecContent {
  ttl: number;
  accessCount: number;
}

export class SpecCacheStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.initialize();
  }

  upsert(entry: CacheEntry): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO spec_cache
        (section, version, content, url, etag, last_modified, fetched_at, ttl, access_count)
      VALUES (@section, @version, @content, @url, @etag, @lastModified, @fetchedAt, @ttl, @accessCount)
    `);
    stmt.run({
      section: entry.section,
      version: entry.version,
      content: entry.content,
      url: entry.metadata.url,
      etag: entry.metadata.etag ?? null,
      lastModified: entry.metadata.lastModified ?? null,
      fetchedAt: entry.metadata.fetchedAt,
      ttl: entry.ttl,
      accessCount: entry.accessCount,
    });
  }

  get(section: string, version: string): CacheEntry | null {
    const stmt = this.db.prepare(`
      SELECT section, version, content, url, etag, last_modified as lastModified, fetched_at as fetchedAt, ttl, access_count as accessCount
      FROM spec_cache
      WHERE section = ? AND version = ?
      LIMIT 1
    `);
    const row = stmt.get(section, version) as
      | {
          section: string;
          version: string;
          content: string;
          url: string;
          etag: string | null;
          lastModified: string | null;
          fetchedAt: number;
          ttl: number;
          accessCount: number;
        }
      | undefined;

    if (!row) return null;
    return {
      section: row.section,
      version: row.version,
      content: row.content,
      metadata: {
        url: row.url,
        etag: row.etag ?? undefined,
        lastModified: row.lastModified ?? undefined,
        fetchedAt: row.fetchedAt,
      },
      ttl: row.ttl,
      accessCount: row.accessCount,
    };
  }

  touch(section: string, version: string): void {
    this.db
      .prepare(
        "UPDATE spec_cache SET access_count = access_count + 1 WHERE section = ? AND version = ?",
      )
      .run(section, version);
  }

  pruneExpired(reference: number): number {
    const result = this.db
      .prepare("DELETE FROM spec_cache WHERE fetched_at + ttl < ?")
      .run(reference);
    return result.changes ?? 0;
  }

  stats(): { entries: number; avgAge: number; sections: Array<{ key: string; age: number }> } {
    const rows = this.db
      .prepare(
        "SELECT section, version, fetched_at as fetchedAt, ttl FROM spec_cache",
      )
      .all() as Array<{ section: string; version: string; fetchedAt: number; ttl: number }>;
    if (rows.length === 0) {
      return { entries: 0, avgAge: 0, sections: [] };
    }
    const now = Date.now();
    const ages = rows.map((row) => ({
      key: `${row.version}::${row.section}`,
      age: now - row.fetchedAt,
      ttl: row.ttl,
    }));
    const avgAge = ages.reduce((sum, row) => sum + row.age, 0) / ages.length;
    return { entries: rows.length, avgAge, sections: ages };
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS spec_cache (
        section TEXT NOT NULL,
        version TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT NOT NULL,
        etag TEXT,
        last_modified TEXT,
        fetched_at INTEGER NOT NULL,
        ttl INTEGER NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (section, version)
      );
      CREATE INDEX IF NOT EXISTS idx_spec_cache_version ON spec_cache(version);
    `);
  }
}
