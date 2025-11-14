/**
 * Pattern Storage Usage Example
 * Demonstrates persistent pattern storage with ranking and cross-session knowledge
 * Requirements: 12.5, 10.2
 */

import type { Solution } from "../types.js";
import type { ResolutionPattern } from "./pattern-storage.js";
import { createPersistentStorage } from "./pattern-storage.js";

/**
 * Example: Using persistent pattern storage for cross-session learning
 */
export async function demonstratePatternStorage() {
  // Create persistent storage (data survives across restarts)
  const storage = createPersistentStorage("/tmp/cortexdx-patterns.json");

  // Example 1: Save a successful resolution pattern
  const pattern: ResolutionPattern = {
    id: "pattern-timeout-fix",
    problemType: "protocol",
    problemSignature: "connection timeout error network",
    solution: {
      id: "solution-1",
      type: "configuration",
      confidence: 0.9,
      description: "Increase connection timeout to 30 seconds",
      userFriendlyDescription: "Increase the connection timeout setting",
      steps: [],
      codeChanges: [],
      configChanges: [],
      testingStrategy: {
        type: "unit",
        tests: [],
        coverage: 0,
        automated: true,
      },
      rollbackPlan: {
        steps: [],
        automated: false,
        backupRequired: true,
        riskLevel: "low",
      },
    } as Solution,
    successCount: 10,
    failureCount: 2,
    averageResolutionTime: 1500,
    lastUsed: Date.now(),
    userFeedback: [],
    confidence: 0.83,
  };

  await storage.savePattern(pattern);

  // Example 2: Update pattern after successful use
  await storage.updatePatternSuccess("pattern-timeout-fix", 1200);

  // Example 3: Retrieve patterns ranked by confidence
  const topPatterns = await storage.retrievePatternsByRank({
    minConfidence: 0.7,
    sortBy: "confidence",
    limit: 5,
  });

  console.log(`Found ${topPatterns.length} high-confidence patterns`);

  // Example 4: Find similar patterns for a new problem
  const similarPatterns = await storage.findSimilarPatterns(
    "timeout connection network issue",
    0.6,
  );

  console.log(`Found ${similarPatterns.length} similar patterns`);

  // Example 5: Get overall statistics
  const stats = await storage.getPatternStatistics();
  console.log("Pattern Statistics:", {
    totalPatterns: stats.totalPatterns,
    totalSuccesses: stats.totalSuccesses,
    averageConfidence: stats.averageConfidence.toFixed(2),
    mostSuccessful: stats.mostSuccessfulPattern?.id,
  });

  // Example 6: Prune old patterns (older than 30 days)
  const pruned = await storage.pruneOldPatterns(30 * 24 * 60 * 60 * 1000);
  console.log(`Pruned ${pruned} old patterns`);

  return {
    topPatterns,
    similarPatterns,
    stats,
  };
}

/**
 * Example: Cross-session knowledge accumulation
 */
export async function demonstrateCrossSessionLearning() {
  const storagePath = "/tmp/cortexdx-cross-session.json";

  // Session 1: Initial learning
  console.log("Session 1: Learning from first resolution...");
  const session1 = createPersistentStorage(storagePath);
  await session1.savePattern({
    id: "auth-failure-pattern",
    problemType: "security",
    problemSignature: "authentication failure invalid token",
    solution: {
      id: "solution-auth-1",
      type: "configuration",
      confidence: 0.8,
      description: "Fix authentication configuration",
      userFriendlyDescription: "Update authentication settings",
      steps: [],
      codeChanges: [],
      configChanges: [],
      testingStrategy: {
        type: "unit",
        tests: [],
        coverage: 0,
        automated: true,
      },
      rollbackPlan: {
        steps: [],
        automated: false,
        backupRequired: true,
        riskLevel: "low",
      },
    } as Solution,
    successCount: 1,
    failureCount: 0,
    averageResolutionTime: 2000,
    lastUsed: Date.now(),
    userFeedback: [],
    confidence: 1.0,
  });

  // Session 2: Pattern reused successfully (simulated restart)
  console.log("Session 2: Reusing pattern after restart...");
  const session2 = createPersistentStorage(storagePath);
  await session2.updatePatternSuccess("auth-failure-pattern", 1500);

  // Session 3: Another successful use
  console.log("Session 3: Pattern used again...");
  const session3 = createPersistentStorage(storagePath);
  await session3.updatePatternSuccess("auth-failure-pattern", 1800);

  // Session 4: Check accumulated knowledge
  console.log("Session 4: Checking accumulated knowledge...");
  const session4 = createPersistentStorage(storagePath);
  const pattern = await session4.loadPattern("auth-failure-pattern");

  console.log("Accumulated Pattern Knowledge:", {
    successCount: pattern?.successCount,
    averageResolutionTime: pattern?.averageResolutionTime,
    confidence: pattern?.confidence,
  });

  return pattern;
}

/**
 * Example: Pattern ranking for intelligent suggestion
 */
export async function demonstratePatternRanking() {
  const storage = createPersistentStorage("/tmp/cortexdx-ranking.json");

  // Add multiple patterns with different characteristics
  const patterns: ResolutionPattern[] = [
    {
      id: "high-confidence-pattern",
      problemType: "protocol",
      problemSignature: "sig1",
      solution: {
        id: "solution-auth-1",
        type: "configuration",
        confidence: 0.8,
        description: "Fix authentication configuration",
        userFriendlyDescription: "Update authentication settings",
        steps: [],
        codeChanges: [],
        configChanges: [],
        testingStrategy: {
          type: "unit",
          tests: [],
          coverage: 0,
          automated: true,
        },
        rollbackPlan: {
          steps: [],
          automated: false,
          backupRequired: true,
          riskLevel: "low",
        },
      } as Solution,
      successCount: 20,
      failureCount: 1,
      averageResolutionTime: 500,
      lastUsed: Date.now(),
      userFeedback: [],
      confidence: 0.95,
    },
    {
      id: "medium-confidence-pattern",
      problemType: "configuration",
      problemSignature: "sig2",
      solution: {
        id: "solution-auth-1",
        type: "configuration",
        confidence: 0.8,
        description: "Fix authentication configuration",
        userFriendlyDescription: "Update authentication settings",
        steps: [],
        codeChanges: [],
        configChanges: [],
        testingStrategy: {
          type: "unit",
          tests: [],
          coverage: 0,
          automated: true,
        },
        rollbackPlan: {
          steps: [],
          automated: false,
          backupRequired: true,
          riskLevel: "low",
        },
      } as Solution,
      successCount: 10,
      failureCount: 5,
      averageResolutionTime: 1000,
      lastUsed: Date.now() - 10000,
      userFeedback: [],
      confidence: 0.67,
    },
    {
      id: "low-confidence-pattern",
      problemType: "performance",
      problemSignature: "sig3",
      solution: {
        id: "solution-auth-1",
        type: "configuration",
        confidence: 0.8,
        description: "Fix authentication configuration",
        userFriendlyDescription: "Update authentication settings",
        steps: [],
        codeChanges: [],
        configChanges: [],
        testingStrategy: {
          type: "unit",
          tests: [],
          coverage: 0,
          automated: true,
        },
        rollbackPlan: {
          steps: [],
          automated: false,
          backupRequired: true,
          riskLevel: "low",
        },
      } as Solution,
      successCount: 2,
      failureCount: 3,
      averageResolutionTime: 2000,
      lastUsed: Date.now() - 100000,
      userFeedback: [],
      confidence: 0.4,
    },
  ];

  for (const pattern of patterns) {
    await storage.savePattern(pattern);
  }

  // Retrieve by different ranking criteria
  console.log("\n=== Ranking Examples ===");

  const byConfidence = await storage.retrievePatternsByRank({
    sortBy: "confidence",
    limit: 2,
  });
  console.log(
    "Top 2 by confidence:",
    byConfidence.map((p) => ({ id: p.id, confidence: p.confidence })),
  );

  const bySuccessRate = await storage.retrievePatternsByRank({
    sortBy: "successRate",
    limit: 2,
  });
  console.log(
    "Top 2 by success rate:",
    bySuccessRate.map((p) => ({
      id: p.id,
      rate: p.successCount / (p.successCount + p.failureCount),
    })),
  );

  const byRecentUse = await storage.retrievePatternsByRank({
    sortBy: "recentUse",
    limit: 2,
  });
  console.log(
    "Top 2 by recent use:",
    byRecentUse.map((p) => ({ id: p.id, lastUsed: p.lastUsed })),
  );

  const highConfidenceOnly = await storage.retrievePatternsByRank({
    minConfidence: 0.8,
    sortBy: "confidence",
  });
  console.log(
    "High confidence patterns (>0.8):",
    highConfidenceOnly.map((p) => ({ id: p.id, confidence: p.confidence })),
  );

  return {
    byConfidence,
    bySuccessRate,
    byRecentUse,
    highConfidenceOnly,
  };
}
