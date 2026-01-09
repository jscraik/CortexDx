/**
 * Pattern Storage Interface
 * Persistent storage for learned resolution patterns and user feedback
 * Requirements: 12.5, 9.4
 */

import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import type { Solution } from "@brainwav/cortexdx-core";

export interface ResolutionPattern {
  id: string;
  problemType: string;
  problemSignature: string;
  solution: Solution;
  successCount: number;
  failureCount: number;
  averageResolutionTime: number;
  lastUsed: number;
  userFeedback: FeedbackEntry[];
  confidence: number;
}

export interface FeedbackEntry {
  timestamp: number;
  userId?: string;
  rating: number;
  successful: boolean;
  comments?: string;
  context: Record<string, unknown>;
}

export interface CommonIssuePattern {
  signature: string;
  occurrences: number;
  solutions: string[];
  contexts: string[];
  firstSeen: number;
  lastSeen: number;
}

export interface PatternStorage {
  savePattern: (pattern: ResolutionPattern) => Promise<void>;
  loadPattern: (id: string) => Promise<ResolutionPattern | null>;
  loadAllPatterns: () => Promise<ResolutionPattern[]>;
  updatePatternSuccess: (id: string, resolutionTime: number) => Promise<void>;
  updatePatternFailure: (id: string) => Promise<void>;
  addFeedback: (id: string, feedback: FeedbackEntry) => Promise<void>;
  saveCommonIssue: (issue: CommonIssuePattern) => Promise<void>;
  loadCommonIssues: () => Promise<CommonIssuePattern[]>;
  updateCommonIssue: (signature: string, context: string) => Promise<void>;
}

interface PersistedPatternStore {
  patterns?: ResolutionPattern[];
  commonIssues?: CommonIssuePattern[];
  metadata?: {
    lastUpdated?: number;
    version?: string;
  };
}

export function createInMemoryStorage(): PatternStorage {
  const patterns = new Map<string, ResolutionPattern>();
  const commonIssues = new Map<string, CommonIssuePattern>();

  return {
    async savePattern(pattern: ResolutionPattern): Promise<void> {
      patterns.set(pattern.id, { ...pattern });
    },

    async loadPattern(id: string): Promise<ResolutionPattern | null> {
      return patterns.get(id) || null;
    },

    async loadAllPatterns(): Promise<ResolutionPattern[]> {
      return Array.from(patterns.values());
    },

    async updatePatternSuccess(
      id: string,
      resolutionTime: number,
    ): Promise<void> {
      const pattern = patterns.get(id);
      if (!pattern) return;

      const totalTime =
        pattern.averageResolutionTime * pattern.successCount + resolutionTime;
      pattern.successCount += 1;
      pattern.averageResolutionTime = totalTime / pattern.successCount;
      pattern.lastUsed = Date.now();

      // Update confidence based on success rate
      const totalAttempts = pattern.successCount + pattern.failureCount;
      pattern.confidence = pattern.successCount / totalAttempts;

      patterns.set(id, pattern);
    },

    async updatePatternFailure(id: string): Promise<void> {
      const pattern = patterns.get(id);
      if (!pattern) return;

      pattern.failureCount += 1;
      pattern.lastUsed = Date.now();

      // Update confidence based on success rate
      const totalAttempts = pattern.successCount + pattern.failureCount;
      pattern.confidence = pattern.successCount / totalAttempts;

      patterns.set(id, pattern);
    },

    async addFeedback(id: string, feedback: FeedbackEntry): Promise<void> {
      const pattern = patterns.get(id);
      if (!pattern) return;

      pattern.userFeedback.push(feedback);

      // Adjust confidence based on recent feedback
      const recentFeedback = pattern.userFeedback
        .filter((f) => Date.now() - f.timestamp < 30 * 24 * 60 * 60 * 1000)
        .map((f) => f.rating);

      if (recentFeedback.length >= 3) {
        const avgRating =
          recentFeedback.reduce((a, b) => a + b, 0) / recentFeedback.length;
        const feedbackFactor = avgRating / 5.0;

        // Blend success rate with user feedback
        const successRate =
          pattern.successCount / (pattern.successCount + pattern.failureCount);
        pattern.confidence = successRate * 0.7 + feedbackFactor * 0.3;
      }

      patterns.set(id, pattern);
    },

    async saveCommonIssue(issue: CommonIssuePattern): Promise<void> {
      commonIssues.set(issue.signature, { ...issue });
    },

    async loadCommonIssues(): Promise<CommonIssuePattern[]> {
      return Array.from(commonIssues.values());
    },

    async updateCommonIssue(signature: string, context: string): Promise<void> {
      const issue = commonIssues.get(signature);

      if (issue) {
        issue.occurrences += 1;
        issue.lastSeen = Date.now();
        if (!issue.contexts.includes(context)) {
          issue.contexts.push(context);
        }
      } else {
        commonIssues.set(signature, {
          signature,
          occurrences: 1,
          solutions: [],
          contexts: [context],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }
    },
  };
}

/**
 * Enhanced pattern retrieval options with ranking support
 */
export interface PatternRetrievalOptions {
  minConfidence?: number;
  minSuccessCount?: number;
  maxAge?: number; // milliseconds
  sortBy?: "confidence" | "successRate" | "recentUse" | "totalUses";
  limit?: number;
}

/**
 * Pattern statistics for cross-session knowledge accumulation
 */
export interface PatternStatistics {
  totalPatterns: number;
  totalSuccesses: number;
  totalFailures: number;
  averageConfidence: number;
  mostSuccessfulPattern: ResolutionPattern | null;
  recentlyUsedPatterns: ResolutionPattern[];
  patternsByType: Record<string, number>;
}

/**
 * Extended PatternStorage interface with ranking and statistics
 */
export interface EnhancedPatternStorage extends PatternStorage {
  retrievePatternsByRank: (
    options?: PatternRetrievalOptions,
  ) => Promise<ResolutionPattern[]>;
  getPatternStatistics: () => Promise<PatternStatistics>;
  findSimilarPatterns: (
    signature: string,
    threshold?: number,
  ) => Promise<ResolutionPattern[]>;
  pruneOldPatterns: (maxAge: number) => Promise<number>;
}

/**
 * Create persistent pattern storage with file-based persistence
 */
export function createPersistentStorage(
  persistencePath: string,
): EnhancedPatternStorage {
  const patterns = new Map<string, ResolutionPattern>();
  const commonIssues = new Map<string, CommonIssuePattern>();
  let isRestored = false;

  const persistToDisk = async (): Promise<void> => {
    try {
      const fs = await import("node:fs/promises");
      const data = {
        patterns: Array.from(patterns.values()),
        commonIssues: Array.from(commonIssues.values()),
        metadata: {
          lastUpdated: Date.now(),
          version: "1.0",
        },
      };
      await fs.writeFile(
        persistencePath,
        JSON.stringify(data, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("Failed to persist pattern storage:", error);
    }
  };

  const restoreFromDisk = async (): Promise<void> => {
    if (isRestored) return;

    try {
      const fs = await import("node:fs/promises");
      const data = await fs.readFile(persistencePath, "utf-8");
      const parsed = safeParseJson<PersistedPatternStore>(
        data,
        "pattern-storage persistence",
      );

      if (parsed.patterns) {
        for (const pattern of parsed.patterns) {
          patterns.set(pattern.id, pattern);
        }
      }

      if (parsed.commonIssues) {
        for (const issue of parsed.commonIssues) {
          commonIssues.set(issue.signature, issue);
        }
      }

      isRestored = true;
    } catch (error) {
      // File doesn't exist or is invalid - that's okay on first run
      isRestored = true;
    }
  };

  // Ensure restoration before operations
  const ensureRestored = async (): Promise<void> => {
    if (!isRestored) {
      await restoreFromDisk();
    }
  };

  return {
    async savePattern(pattern: ResolutionPattern): Promise<void> {
      await ensureRestored();
      patterns.set(pattern.id, { ...pattern });
      await persistToDisk();
    },

    async loadPattern(id: string): Promise<ResolutionPattern | null> {
      await ensureRestored();
      return patterns.get(id) || null;
    },

    async loadAllPatterns(): Promise<ResolutionPattern[]> {
      await ensureRestored();
      return Array.from(patterns.values());
    },

    async updatePatternSuccess(
      id: string,
      resolutionTime: number,
    ): Promise<void> {
      await ensureRestored();
      const pattern = patterns.get(id);
      if (!pattern) return;

      const totalTime =
        pattern.averageResolutionTime * pattern.successCount + resolutionTime;
      pattern.successCount += 1;
      pattern.averageResolutionTime = totalTime / pattern.successCount;
      pattern.lastUsed = Date.now();

      const totalAttempts = pattern.successCount + pattern.failureCount;
      pattern.confidence = pattern.successCount / totalAttempts;

      patterns.set(id, pattern);
      await persistToDisk();
    },

    async updatePatternFailure(id: string): Promise<void> {
      await ensureRestored();
      const pattern = patterns.get(id);
      if (!pattern) return;

      pattern.failureCount += 1;
      pattern.lastUsed = Date.now();

      const totalAttempts = pattern.successCount + pattern.failureCount;
      pattern.confidence = pattern.successCount / totalAttempts;

      patterns.set(id, pattern);
      await persistToDisk();
    },

    async addFeedback(id: string, feedback: FeedbackEntry): Promise<void> {
      await ensureRestored();
      const pattern = patterns.get(id);
      if (!pattern) return;

      pattern.userFeedback.push(feedback);

      const recentFeedback = pattern.userFeedback
        .filter((f) => Date.now() - f.timestamp < 30 * 24 * 60 * 60 * 1000)
        .map((f) => f.rating);

      if (recentFeedback.length >= 3) {
        const avgRating =
          recentFeedback.reduce((a, b) => a + b, 0) / recentFeedback.length;
        const feedbackFactor = avgRating / 5.0;

        const successRate =
          pattern.successCount / (pattern.successCount + pattern.failureCount);
        pattern.confidence = successRate * 0.7 + feedbackFactor * 0.3;
      }

      patterns.set(id, pattern);
      await persistToDisk();
    },

    async saveCommonIssue(issue: CommonIssuePattern): Promise<void> {
      await ensureRestored();
      commonIssues.set(issue.signature, { ...issue });
      await persistToDisk();
    },

    async loadCommonIssues(): Promise<CommonIssuePattern[]> {
      await ensureRestored();
      return Array.from(commonIssues.values());
    },

    async updateCommonIssue(signature: string, context: string): Promise<void> {
      await ensureRestored();
      const issue = commonIssues.get(signature);

      if (issue) {
        issue.occurrences += 1;
        issue.lastSeen = Date.now();
        if (!issue.contexts.includes(context)) {
          issue.contexts.push(context);
        }
      } else {
        commonIssues.set(signature, {
          signature,
          occurrences: 1,
          solutions: [],
          contexts: [context],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }

      await persistToDisk();
    },

    async retrievePatternsByRank(
      options: PatternRetrievalOptions = {},
    ): Promise<ResolutionPattern[]> {
      await ensureRestored();
      const {
        minConfidence = 0,
        minSuccessCount = 0,
        maxAge,
        sortBy = "confidence",
        limit,
      } = options;

      let filtered = Array.from(patterns.values());

      // Apply filters
      filtered = filtered.filter((p) => {
        if (p.confidence < minConfidence) return false;
        if (p.successCount < minSuccessCount) return false;
        if (maxAge && Date.now() - p.lastUsed > maxAge) return false;
        return true;
      });

      // Sort by specified criteria
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "confidence":
            return b.confidence - a.confidence;
          case "successRate": {
            const rateA = a.successCount / (a.successCount + a.failureCount);
            const rateB = b.successCount / (b.successCount + b.failureCount);
            return rateB - rateA;
          }
          case "recentUse":
            return b.lastUsed - a.lastUsed;
          case "totalUses":
            return (
              b.successCount +
              b.failureCount -
              (a.successCount + a.failureCount)
            );
          default:
            return 0;
        }
      });

      // Apply limit if specified
      if (limit && limit > 0) {
        filtered = filtered.slice(0, limit);
      }

      return filtered;
    },

    async getPatternStatistics(): Promise<PatternStatistics> {
      await ensureRestored();
      const allPatterns = Array.from(patterns.values());

      if (allPatterns.length === 0) {
        return {
          totalPatterns: 0,
          totalSuccesses: 0,
          totalFailures: 0,
          averageConfidence: 0,
          mostSuccessfulPattern: null,
          recentlyUsedPatterns: [],
          patternsByType: {},
        };
      }

      const totalSuccesses = allPatterns.reduce(
        (sum, p) => sum + p.successCount,
        0,
      );
      const totalFailures = allPatterns.reduce(
        (sum, p) => sum + p.failureCount,
        0,
      );
      const averageConfidence =
        allPatterns.reduce((sum, p) => sum + p.confidence, 0) /
        allPatterns.length;

      const mostSuccessful = allPatterns.reduce((best, current) =>
        current.successCount > best.successCount ? current : best,
      );

      const recentlyUsed = [...allPatterns]
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, 10);

      const patternsByType: Record<string, number> = {};
      for (const pattern of allPatterns) {
        patternsByType[pattern.problemType] =
          (patternsByType[pattern.problemType] || 0) + 1;
      }

      return {
        totalPatterns: allPatterns.length,
        totalSuccesses,
        totalFailures,
        averageConfidence,
        mostSuccessfulPattern: mostSuccessful,
        recentlyUsedPatterns: recentlyUsed,
        patternsByType,
      };
    },

    async findSimilarPatterns(
      signature: string,
      threshold = 0.6,
    ): Promise<ResolutionPattern[]> {
      await ensureRestored();
      const allPatterns = Array.from(patterns.values());
      const similar: Array<{ pattern: ResolutionPattern; similarity: number }> =
        [];

      for (const pattern of allPatterns) {
        const similarity = calculateSimilarity(
          signature,
          pattern.problemSignature,
        );
        if (similarity >= threshold) {
          similar.push({ pattern, similarity });
        }
      }

      return similar
        .sort((a, b) => b.similarity - a.similarity)
        .map((s) => s.pattern);
    },

    async pruneOldPatterns(maxAge: number): Promise<number> {
      await ensureRestored();
      const now = Date.now();
      let pruned = 0;

      for (const [id, pattern] of patterns.entries()) {
        if (now - pattern.lastUsed > maxAge) {
          patterns.delete(id);
          pruned++;
        }
      }

      if (pruned > 0) {
        await persistToDisk();
      }

      return pruned;
    },
  };
}

/**
 * Calculate similarity between two signatures using Jaccard similarity
 */
function calculateSimilarity(sig1: string, sig2: string): number {
  const tokens1 = new Set(sig1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(sig2.toLowerCase().split(/\s+/));

  const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}
