/**
 * SQLite Vector Storage Tests
 * Tests for SQLite-backed vector storage implementation
 */

import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SQLiteVectorStorage,
  type VectorDocument,
} from "../../src/storage/vector-storage.js";

describe("SQLite Vector Storage", () => {
  let dbPath: string;
  let storage: SQLiteVectorStorage;

  beforeEach(() => {
    dbPath = join(tmpdir(), `test-vector-${Date.now()}.db`);
    storage = new SQLiteVectorStorage(dbPath);
  });

  afterEach(async () => {
    await storage.close();
    try {
      rmSync(dbPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("basic operations", () => {
    it("should store and retrieve documents", async () => {
      const doc: VectorDocument = {
        id: "test-1",
        embedding: {
          values: [1, 0, 0],
          dimensions: 3,
          model: "test",
          timestamp: Date.now(),
        },
        metadata: {
          type: "problem",
          text: "Test problem",
          context: {},
        },
        timestamp: Date.now(),
      };

      await storage.addDocument(doc);

      const retrieved = await storage.getDocument("test-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("test-1");
      expect(retrieved?.metadata.type).toBe("problem");
      expect(retrieved?.embedding.values).toEqual([1, 0, 0]);
    });

    it("should handle batch document insertion", async () => {
      const docs: VectorDocument[] = [
        {
          id: "doc-1",
          embedding: {
            values: [1, 0, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "problem",
            text: "Problem 1",
            context: {},
          },
          timestamp: Date.now(),
        },
        {
          id: "doc-2",
          embedding: {
            values: [0, 1, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "solution",
            text: "Solution 1",
            context: {},
          },
          timestamp: Date.now(),
        },
      ];

      await storage.addDocuments(docs);

      const doc1 = await storage.getDocument("doc-1");
      const doc2 = await storage.getDocument("doc-2");

      expect(doc1).toBeDefined();
      expect(doc2).toBeDefined();
      expect(doc1?.metadata.type).toBe("problem");
      expect(doc2?.metadata.type).toBe("solution");
    });

    it("should update existing documents", async () => {
      const doc: VectorDocument = {
        id: "update-test",
        embedding: {
          values: [1, 0, 0],
          dimensions: 3,
          model: "test",
          timestamp: Date.now(),
        },
        metadata: {
          type: "problem",
          text: "Original text",
          context: {},
        },
        timestamp: Date.now(),
      };

      await storage.addDocument(doc);

      const updated = {
        ...doc,
        metadata: {
          ...doc.metadata,
          text: "Updated text",
        },
      };

      await storage.addDocument(updated);

      const retrieved = await storage.getDocument("update-test");
      expect(retrieved?.metadata.text).toBe("Updated text");
    });

    it("should delete documents", async () => {
      const doc: VectorDocument = {
        id: "delete-test",
        embedding: {
          values: [1, 0, 0],
          dimensions: 3,
          model: "test",
          timestamp: Date.now(),
        },
        metadata: {
          type: "problem",
          text: "To be deleted",
          context: {},
        },
        timestamp: Date.now(),
      };

      await storage.addDocument(doc);
      expect(await storage.getDocument("delete-test")).toBeDefined();

      const deleted = await storage.deleteDocument("delete-test");
      expect(deleted).toBe(true);
      expect(await storage.getDocument("delete-test")).toBeNull();
    });
  });

  describe("search and filtering", () => {
    beforeEach(async () => {
      const docs: VectorDocument[] = [
        {
          id: "search-1",
          embedding: {
            values: [1, 0, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "problem",
            problemType: "connection",
            text: "Connection error",
            context: {},
          },
          timestamp: Date.now(),
        },
        {
          id: "search-2",
          embedding: {
            values: [0.9, 0.1, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "problem",
            problemType: "timeout",
            text: "Network timeout",
            context: {},
          },
          timestamp: Date.now(),
        },
        {
          id: "search-3",
          embedding: {
            values: [0, 1, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "solution",
            text: "Fix solution",
            context: {},
          },
          timestamp: Date.now(),
        },
      ];

      await storage.addDocuments(docs);
    });

    it("should search for similar documents", async () => {
      const queryEmbedding = {
        values: [1, 0, 0],
        dimensions: 3,
        model: "test",
        timestamp: Date.now(),
      };

      const results = await storage.search(queryEmbedding, {
        topK: 2,
        minSimilarity: 0.5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.document.id).toBe("search-1");
      expect(results[0]?.similarity).toBeGreaterThan(0.9);
    });

    it("should filter by document type", async () => {
      const queryEmbedding = {
        values: [1, 0, 0],
        dimensions: 3,
        model: "test",
        timestamp: Date.now(),
      };

      const problemResults = await storage.search(queryEmbedding, {
        filterType: "problem",
        topK: 10,
      });

      expect(
        problemResults.every((r) => r.document.metadata.type === "problem"),
      ).toBe(true);
    });

    it("should filter by problem type", async () => {
      const queryEmbedding = {
        values: [1, 0, 0],
        dimensions: 3,
        model: "test",
        timestamp: Date.now(),
      };

      const connectionResults = await storage.search(queryEmbedding, {
        filterProblemType: "connection",
        topK: 10,
      });

      expect(connectionResults.length).toBe(1);
      expect(connectionResults[0]?.document.metadata.problemType).toBe(
        "connection",
      );
    });

    it("should get documents by type", async () => {
      const problems = await storage.getDocumentsByType("problem");
      const solutions = await storage.getDocumentsByType("solution");

      expect(problems.length).toBe(2);
      expect(solutions.length).toBe(1);
    });
  });

  describe("statistics and cleanup", () => {
    it("should return accurate statistics", async () => {
      const docs: VectorDocument[] = [
        {
          id: "stats-1",
          embedding: {
            values: [1, 0, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "problem",
            text: "Problem",
            context: {},
          },
          timestamp: Date.now(),
        },
        {
          id: "stats-2",
          embedding: {
            values: [0, 1, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "solution",
            text: "Solution",
            context: {},
          },
          timestamp: Date.now(),
        },
      ];

      await storage.addDocuments(docs);

      const stats = storage.getStats();

      expect(stats.totalDocuments).toBe(2);
      expect(stats.documentsByType.problem).toBe(1);
      expect(stats.documentsByType.solution).toBe(1);
      expect(stats.averageEmbeddingDimensions).toBe(3);
    });

    it("should cleanup old documents", async () => {
      const now = Date.now();
      const docs: VectorDocument[] = [
        {
          id: "old-1",
          embedding: {
            values: [1, 0, 0],
            dimensions: 3,
            model: "test",
            timestamp: now,
          },
          metadata: {
            type: "problem",
            text: "Old problem",
            context: {},
          },
          timestamp: now - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        },
        {
          id: "recent-1",
          embedding: {
            values: [0, 1, 0],
            dimensions: 3,
            model: "test",
            timestamp: now,
          },
          metadata: {
            type: "problem",
            text: "Recent problem",
            context: {},
          },
          timestamp: now,
        },
      ];

      await storage.addDocuments(docs);

      const cleaned = await storage.cleanupOldDocuments(
        180 * 24 * 60 * 60 * 1000,
      ); // 180 days

      expect(cleaned).toBe(1);

      const remaining = await storage.getDocumentsByType("problem");
      expect(remaining.length).toBe(1);
      expect(remaining[0]?.id).toBe("recent-1");
    });

    it("should clear all documents", async () => {
      const docs: VectorDocument[] = [
        {
          id: "clear-1",
          embedding: {
            values: [1, 0, 0],
            dimensions: 3,
            model: "test",
            timestamp: Date.now(),
          },
          metadata: {
            type: "problem",
            text: "Problem",
            context: {},
          },
          timestamp: Date.now(),
        },
      ];

      await storage.addDocuments(docs);
      expect(storage.getStats().totalDocuments).toBe(1);

      await storage.clear();
      expect(storage.getStats().totalDocuments).toBe(0);
    });
  });

  describe("persistence", () => {
    it("should persist data across instances", async () => {
      const doc: VectorDocument = {
        id: "persist-1",
        embedding: {
          values: [1, 0, 0],
          dimensions: 3,
          model: "test",
          timestamp: Date.now(),
        },
        metadata: {
          type: "problem",
          text: "Persisted problem",
          context: {},
        },
        timestamp: Date.now(),
      };

      await storage.addDocument(doc);
      await storage.close();

      // Create new instance with same database
      const storage2 = new SQLiteVectorStorage(dbPath);
      const retrieved = await storage2.getDocument("persist-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.text).toBe("Persisted problem");

      await storage2.close();
    });
  });
});
