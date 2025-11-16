/**
 * Pattern Storage Tests
 * Tests for persistent pattern storage with ranking and cross-session knowledge
 */

import { unlink } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type EnhancedPatternStorage,
  type ResolutionPattern,
  createInMemoryStorage,
  createPersistentStorage,
} from "../src/storage/pattern-storage.js";
import type { Solution } from "../src/types.js";

describe("Pattern Storage Tests", () => {
  const testPersistencePath = "/tmp/test-patterns.json";

  afterEach(async () => {
    try {
      await unlink(testPersistencePath);
    } catch {
      // File might not exist
    }
  });

  describe("In-Memory Storage", () => {
    let storage: ReturnType<typeof createInMemoryStorage>;

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    it("should save and load a pattern", async () => {
      const pattern: ResolutionPattern = {
        id: "pattern-1",
        problemType: "protocol",
        problemSignature: "connection timeout error",
        solution: {
          id: "solution-1",
          type: "automated",
          confidence: 0.9,
          description: "Increase timeout",
          userFriendlyDescription: "Increase connection timeout",
          steps: [],
          codeChanges: [],
          configChanges: [],
          testingStrategy: { type: "automated", tests: [] },
          rollbackPlan: { steps: [] },
        } as unknown as Solution,
        successCount: 5,
        failureCount: 1,
        averageResolutionTime: 1500,
        lastUsed: Date.now(),
        userFeedback: [],
        confidence: 0.83,
      };

      await storage.savePattern(pattern);
      const loaded = await storage.loadPattern("pattern-1");

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe("pattern-1");
      expect(loaded?.successCount).toBe(5);
    });

    it("should update pattern on success", async () => {
      const pattern: ResolutionPattern = {
        id: "pattern-2",
        problemType: "configuration",
        problemSignature: "invalid config",
        solution: {} as Solution,
        successCount: 2,
        failureCount: 0,
        averageResolutionTime: 1000,
        lastUsed: Date.now() - 10000,
        userFeedback: [],
        confidence: 1.0,
      };

      await storage.savePattern(pattern);
      await storage.updatePatternSuccess("pattern-2", 2000);

      const updated = await storage.loadPattern("pattern-2");
      expect(updated?.successCount).toBe(3);
      expect(updated?.averageResolutionTime).toBeCloseTo(1333, 0);
      expect(updated?.confidence).toBe(1.0);
    });

    it("should update pattern on failure", async () => {
      const pattern: ResolutionPattern = {
        id: "pattern-3",
        problemType: "security",
        problemSignature: "auth failure",
        solution: {} as Solution,
        successCount: 3,
        failureCount: 1,
        averageResolutionTime: 1500,
        lastUsed: Date.now(),
        userFeedback: [],
        confidence: 0.75,
      };

      await storage.savePattern(pattern);
      await storage.updatePatternFailure("pattern-3");

      const updated = await storage.loadPattern("pattern-3");
      expect(updated?.failureCount).toBe(2);
      expect(updated?.confidence).toBe(0.6);
    });
  });

  describe("Persistent Storage", () => {
    let storage: EnhancedPatternStorage;

    beforeEach(() => {
      storage = createPersistentStorage(testPersistencePath);
    });

    it("should persist patterns to disk", async () => {
      const pattern: ResolutionPattern = {
        id: "persist-1",
        problemType: "performance",
        problemSignature: "slow response time",
        solution: {} as Solution,
        successCount: 10,
        failureCount: 2,
        averageResolutionTime: 500,
        lastUsed: Date.now(),
        userFeedback: [],
        confidence: 0.83,
      };

      await storage.savePattern(pattern);

      // Create new storage instance to simulate restart
      const newStorage = createPersistentStorage(testPersistencePath);
      const loaded = await newStorage.loadPattern("persist-1");

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe("persist-1");
      expect(loaded?.successCount).toBe(10);
    });

    it("should retrieve patterns by rank with confidence filter", async () => {
      const patterns: ResolutionPattern[] = [
        {
          id: "rank-1",
          problemType: "protocol",
          problemSignature: "sig1",
          solution: {} as Solution,
          successCount: 10,
          failureCount: 2,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 0.83,
        },
        {
          id: "rank-2",
          problemType: "protocol",
          problemSignature: "sig2",
          solution: {} as Solution,
          successCount: 5,
          failureCount: 5,
          averageResolutionTime: 1000,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 0.5,
        },
        {
          id: "rank-3",
          problemType: "protocol",
          problemSignature: "sig3",
          solution: {} as Solution,
          successCount: 20,
          failureCount: 1,
          averageResolutionTime: 300,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 0.95,
        },
      ];

      for (const pattern of patterns) {
        await storage.savePattern(pattern);
      }

      const ranked = await storage.retrievePatternsByRank({
        minConfidence: 0.7,
        sortBy: "confidence",
      });

      expect(ranked.length).toBe(2);
      expect(ranked[0]?.id).toBe("rank-3");
      expect(ranked[1]?.id).toBe("rank-1");
    });

    it("should retrieve patterns sorted by success rate", async () => {
      const patterns: ResolutionPattern[] = [
        {
          id: "rate-1",
          problemType: "protocol",
          problemSignature: "sig1",
          solution: {} as Solution,
          successCount: 8,
          failureCount: 2,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 0.8,
        },
        {
          id: "rate-2",
          problemType: "protocol",
          problemSignature: "sig2",
          solution: {} as Solution,
          successCount: 9,
          failureCount: 1,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 0.9,
        },
      ];

      for (const pattern of patterns) {
        await storage.savePattern(pattern);
      }

      const ranked = await storage.retrievePatternsByRank({
        sortBy: "successRate",
      });

      expect(ranked[0]?.id).toBe("rate-2");
    });

    it("should retrieve patterns sorted by recent use", async () => {
      const now = Date.now();
      const patterns: ResolutionPattern[] = [
        {
          id: "recent-1",
          problemType: "protocol",
          problemSignature: "sig1",
          solution: {} as Solution,
          successCount: 5,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: now - 10000,
          userFeedback: [],
          confidence: 1.0,
        },
        {
          id: "recent-2",
          problemType: "protocol",
          problemSignature: "sig2",
          solution: {} as Solution,
          successCount: 5,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: now,
          userFeedback: [],
          confidence: 1.0,
        },
      ];

      for (const pattern of patterns) {
        await storage.savePattern(pattern);
      }

      const ranked = await storage.retrievePatternsByRank({
        sortBy: "recentUse",
      });

      expect(ranked[0]?.id).toBe("recent-2");
    });

    it("should limit retrieved patterns", async () => {
      const patterns: ResolutionPattern[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `limit-${i}`,
          problemType: "protocol",
          problemSignature: `sig${i}`,
          solution: {} as Solution,
          successCount: 10 - i,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: (10 - i) / 10,
        }),
      );

      for (const pattern of patterns) {
        await storage.savePattern(pattern);
      }

      const ranked = await storage.retrievePatternsByRank({
        sortBy: "confidence",
        limit: 3,
      });

      expect(ranked.length).toBe(3);
    });

    it("should get pattern statistics", async () => {
      const patterns: ResolutionPattern[] = [
        {
          id: "stats-1",
          problemType: "protocol",
          problemSignature: "sig1",
          solution: {} as Solution,
          successCount: 10,
          failureCount: 2,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 0.83,
        },
        {
          id: "stats-2",
          problemType: "configuration",
          problemSignature: "sig2",
          solution: {} as Solution,
          successCount: 5,
          failureCount: 1,
          averageResolutionTime: 1000,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 0.83,
        },
      ];

      for (const pattern of patterns) {
        await storage.savePattern(pattern);
      }

      const stats = await storage.getPatternStatistics();

      expect(stats.totalPatterns).toBe(2);
      expect(stats.totalSuccesses).toBe(15);
      expect(stats.totalFailures).toBe(3);
      expect(stats.averageConfidence).toBeCloseTo(0.83, 2);
      expect(stats.mostSuccessfulPattern?.id).toBe("stats-1");
      expect(stats.patternsByType.protocol).toBe(1);
      expect(stats.patternsByType.configuration).toBe(1);
    });

    it("should find similar patterns", async () => {
      const patterns: ResolutionPattern[] = [
        {
          id: "similar-1",
          problemType: "protocol",
          problemSignature: "connection timeout error network",
          solution: {} as Solution,
          successCount: 5,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 1.0,
        },
        {
          id: "similar-2",
          problemType: "protocol",
          problemSignature: "timeout connection issue",
          solution: {} as Solution,
          successCount: 3,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 1.0,
        },
        {
          id: "different",
          problemType: "security",
          problemSignature: "authentication failure invalid credentials",
          solution: {} as Solution,
          successCount: 2,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 1.0,
        },
      ];

      for (const pattern of patterns) {
        await storage.savePattern(pattern);
      }

      const similar = await storage.findSimilarPatterns(
        "connection timeout network",
        0.4,
      );

      expect(similar.length).toBeGreaterThanOrEqual(1);
      expect(similar.some((p) => p.id === "similar-1")).toBe(true);
    });

    it("should prune old patterns", async () => {
      const now = Date.now();
      const patterns: ResolutionPattern[] = [
        {
          id: "old-1",
          problemType: "protocol",
          problemSignature: "sig1",
          solution: {} as Solution,
          successCount: 5,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: now - 2 * 60 * 60 * 1000, // 2 hours ago
          userFeedback: [],
          confidence: 1.0,
        },
        {
          id: "recent-1",
          problemType: "protocol",
          problemSignature: "sig2",
          solution: {} as Solution,
          successCount: 3,
          failureCount: 0,
          averageResolutionTime: 500,
          lastUsed: now,
          userFeedback: [],
          confidence: 1.0,
        },
      ];

      for (const pattern of patterns) {
        await storage.savePattern(pattern);
      }

      const pruned = await storage.pruneOldPatterns(60 * 60 * 1000); // 1 hour
      expect(pruned).toBe(1);

      const oldLoaded = await storage.loadPattern("old-1");
      const recentLoaded = await storage.loadPattern("recent-1");

      expect(oldLoaded).toBeNull();
      expect(recentLoaded).not.toBeNull();
    });
  });

  describe("Common Issue Patterns", () => {
    let storage: ReturnType<typeof createInMemoryStorage>;

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    it("should save and load common issues", async () => {
      await storage.saveCommonIssue({
        signature: "timeout error",
        occurrences: 5,
        solutions: ["increase timeout", "check network"],
        contexts: ["production", "staging"],
        firstSeen: Date.now() - 10000,
        lastSeen: Date.now(),
      });

      const issues = await storage.loadCommonIssues();
      expect(issues.length).toBe(1);
      expect(issues[0]?.signature).toBe("timeout error");
      expect(issues[0]?.occurrences).toBe(5);
    });

    it("should update common issue occurrences", async () => {
      await storage.saveCommonIssue({
        signature: "auth failure",
        occurrences: 1,
        solutions: [],
        contexts: ["production"],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      });

      await storage.updateCommonIssue("auth failure", "staging");

      const issues = await storage.loadCommonIssues();
      expect(issues[0]?.occurrences).toBe(2);
      expect(issues[0]?.contexts).toContain("staging");
    });
  });

  describe("Cross-Session Knowledge Accumulation", () => {
    it("should accumulate knowledge across storage instances", async () => {
      // First session
      const storage1 = createPersistentStorage(testPersistencePath);
      await storage1.savePattern({
        id: "session-1-pattern",
        problemType: "protocol",
        problemSignature: "connection error",
        solution: {} as Solution,
        successCount: 5,
        failureCount: 1,
        averageResolutionTime: 1000,
        lastUsed: Date.now(),
        userFeedback: [],
        confidence: 0.83,
      });

      // Second session (simulated restart)
      const storage2 = createPersistentStorage(testPersistencePath);
      await storage2.updatePatternSuccess("session-1-pattern", 800);

      // Third session (verify accumulation)
      const storage3 = createPersistentStorage(testPersistencePath);
      const pattern = await storage3.loadPattern("session-1-pattern");

      expect(pattern).not.toBeNull();
      expect(pattern?.successCount).toBe(6);
      expect(pattern?.averageResolutionTime).toBeCloseTo(967, 0);
    });

    it("should maintain statistics across sessions", async () => {
      const storage1 = createPersistentStorage(testPersistencePath);

      // Add patterns in first session
      await storage1.savePattern({
        id: "cross-1",
        problemType: "protocol",
        problemSignature: "sig1",
        solution: {} as Solution,
        successCount: 10,
        failureCount: 2,
        averageResolutionTime: 500,
        lastUsed: Date.now(),
        userFeedback: [],
        confidence: 0.83,
      });

      // New session
      const storage2 = createPersistentStorage(testPersistencePath);
      await storage2.savePattern({
        id: "cross-2",
        problemType: "configuration",
        problemSignature: "sig2",
        solution: {} as Solution,
        successCount: 5,
        failureCount: 1,
        averageResolutionTime: 1000,
        lastUsed: Date.now(),
        userFeedback: [],
        confidence: 0.83,
      });

      // Verify accumulated statistics
      const storage3 = createPersistentStorage(testPersistencePath);
      const stats = await storage3.getPatternStatistics();

      expect(stats.totalPatterns).toBe(2);
      expect(stats.totalSuccesses).toBe(15);
      expect(stats.totalFailures).toBe(3);
    });
  });
});
