/**
 * SQLite-backed Vector Storage
 * Scalable persistent vector storage using better-sqlite3
 * Replaces in-memory JSON storage for production workloads
 */

import Database from "better-sqlite3";
import type { EmbeddingVector } from "../adapters/embedding.js";
import { cosineSimilarity } from "../adapters/embedding.js";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import type {
  DocumentMetadata,
  IVectorStorage,
  SearchOptions,
  SearchResult,
  VectorDocument,
  VectorStorageStats,
} from "./vector-storage.js";

type VectorDocumentRow = {
  id: string;
  embedding: string;
  type: string;
  problem_type: string | null;
  problem_signature: string | null;
  solution_id: string | null;
  success_count: number | null;
  confidence: number | null;
  text: string;
  context: string;
  timestamp: number;
};

/**
 * SQLite-backed vector storage implementation
 * Provides efficient persistence and querying for vector embeddings
 */
export class SQLiteVectorStorage implements IVectorStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_documents (
        id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        type TEXT NOT NULL,
        problem_type TEXT,
        problem_signature TEXT,
        solution_id TEXT,
        success_count INTEGER,
        confidence REAL,
        text TEXT NOT NULL,
        context TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vector_type ON vector_documents(type);
      CREATE INDEX IF NOT EXISTS idx_vector_problem_type ON vector_documents(problem_type);
      CREATE INDEX IF NOT EXISTS idx_vector_timestamp ON vector_documents(timestamp);
    `);
  }

  /**
   * Add a single document
   */
  async addDocument(document: VectorDocument): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO vector_documents (
        id, embedding, type, problem_type, problem_signature,
        solution_id, success_count, confidence, text, context, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      document.id,
      JSON.stringify(document.embedding),
      document.metadata.type,
      document.metadata.problemType ?? null,
      document.metadata.problemSignature ?? null,
      document.metadata.solutionId ?? null,
      document.metadata.successCount ?? null,
      document.metadata.confidence ?? null,
      document.metadata.text,
      JSON.stringify(document.metadata.context),
      document.timestamp,
    );
  }

  /**
   * Add multiple documents in a transaction
   */
  async addDocuments(documents: VectorDocument[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO vector_documents (
        id, embedding, type, problem_type, problem_signature,
        solution_id, success_count, confidence, text, context, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insert = this.db.transaction((docs: VectorDocument[]) => {
      for (const doc of docs) {
        stmt.run(
          doc.id,
          JSON.stringify(doc.embedding),
          doc.metadata.type,
          doc.metadata.problemType ?? null,
          doc.metadata.problemSignature ?? null,
          doc.metadata.solutionId ?? null,
          doc.metadata.successCount ?? null,
          doc.metadata.confidence ?? null,
          doc.metadata.text,
          JSON.stringify(doc.metadata.context),
          doc.timestamp,
        );
      }
    });

    insert(documents);
  }

  /**
   * Search for similar documents using cosine similarity
   */
  async search(
    queryEmbedding: EmbeddingVector,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const {
      topK = 10,
      minSimilarity = 0.6,
      filterType,
      filterProblemType,
    } = options;

    // Build query with filters
    let query = "SELECT * FROM vector_documents WHERE 1=1";
    const params: unknown[] = [];

    if (filterType) {
      query += " AND type = ?";
      params.push(filterType);
    }

    if (filterProblemType) {
      query += " AND problem_type = ?";
      params.push(filterProblemType);
    }

    const rows = this.db.prepare(query).all(...params) as VectorDocumentRow[];

    // Calculate similarities in-memory
    const results: SearchResult[] = [];

    for (const row of rows) {
      const doc = this.rowToDocument(row);
      const similarity = cosineSimilarity(
        queryEmbedding.values,
        doc.embedding.values,
      );

      if (similarity >= minSimilarity) {
        results.push({
          document: doc,
          similarity,
          rank: 0, // Will be set after sorting
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    // Limit to topK and set ranks
    const topResults = results.slice(0, topK);
    topResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    return topResults;
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<VectorDocument | null> {
    const row = this.db
      .prepare("SELECT * FROM vector_documents WHERE id = ?")
      .get(id) as VectorDocumentRow | undefined;

    return row ? this.rowToDocument(row) : null;
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    const result = this.db
      .prepare("DELETE FROM vector_documents WHERE id = ?")
      .run(id);

    return result.changes > 0;
  }

  /**
   * Get all documents matching a type filter
   */
  async getDocumentsByType(
    type: "problem" | "solution" | "pattern" | "reference",
  ): Promise<VectorDocument[]> {
    const rows = this.db
      .prepare("SELECT * FROM vector_documents WHERE type = ?")
      .all(type) as VectorDocumentRow[];

    return rows.map((row) => this.rowToDocument(row));
  }

  /**
   * Get storage statistics
   */
  getStats(): VectorStorageStats {
    const stats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM vector_documents
    `,
      )
      .get() as { total: number; oldest: number | null; newest: number | null };

    if (stats.total === 0) {
      return {
        totalDocuments: 0,
        documentsByType: {},
        oldestDocument: null,
        newestDocument: null,
        averageEmbeddingDimensions: 0,
      };
    }

    const typeRows = this.db
      .prepare(
        "SELECT type, COUNT(*) as count FROM vector_documents GROUP BY type",
      )
      .all() as Array<{ type: string; count: number }>;

    const documentsByType: Record<string, number> = {};
    for (const row of typeRows) {
      documentsByType[row.type] = row.count;
    }

    // Calculate average dimensions
    const allRows = this.db
      .prepare("SELECT embedding FROM vector_documents")
      .all() as Array<{ embedding: string }>;

    let totalDimensions = 0;
    for (const row of allRows) {
      const embedding = safeParseJson(row.embedding) as EmbeddingVector;
      totalDimensions += embedding.dimensions;
    }

    return {
      totalDocuments: stats.total,
      documentsByType,
      oldestDocument: stats.oldest,
      newestDocument: stats.newest,
      averageEmbeddingDimensions:
        stats.total > 0 ? totalDimensions / stats.total : 0,
    };
  }

  /**
   * Clean up old documents
   */
  async cleanupOldDocuments(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const result = this.db
      .prepare("DELETE FROM vector_documents WHERE timestamp < ?")
      .run(cutoff);

    return result.changes;
  }

  /**
   * Restore from disk (no-op for SQLite, always persisted)
   */
  async restoreFromDisk(): Promise<number> {
    const stats = this.getStats();
    return stats.totalDocuments;
  }

  /**
   * Flush pending writes (no-op for SQLite, always synced)
   */
  async flushPendingWrites(): Promise<void> {
    // SQLite writes are synchronous, nothing to flush
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    this.db.prepare("DELETE FROM vector_documents").run();
  }

  /**
   * Convert database row to VectorDocument
   */
  private rowToDocument(row: VectorDocumentRow): VectorDocument {
    const embedding = safeParseJson(row.embedding) as EmbeddingVector;
    const context = safeParseJson(row.context) as Record<string, unknown>;

    const metadata: DocumentMetadata = {
      type: row.type as DocumentMetadata["type"],
      text: row.text,
      context,
    };

    if (row.problem_type) {
      metadata.problemType = row.problem_type;
    }
    if (row.problem_signature) {
      metadata.problemSignature = row.problem_signature;
    }
    if (row.solution_id) {
      metadata.solutionId = row.solution_id;
    }
    if (row.success_count !== null) {
      metadata.successCount = row.success_count;
    }
    if (row.confidence !== null) {
      metadata.confidence = row.confidence;
    }

    return {
      id: row.id,
      embedding,
      metadata,
      timestamp: row.timestamp,
    };
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.db.close();
  }
}
