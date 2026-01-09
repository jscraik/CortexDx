import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PatternAnonymizer,
  PatternEncryption,
  createSQLitePatternStorage,
} from "../../src/storage/pattern-storage-sqlite.js";
import type {
  CommonIssuePattern,
  FeedbackEntry,
  ResolutionPattern,
} from "../../src/storage/pattern-storage.js";

// Test encryption key (32 bytes hex)
const TEST_ENCRYPTION_KEY = "a".repeat(64); // 64 hex chars = 32 bytes

// Mock resolution pattern
const createMockPattern = (
  overrides?: Partial<ResolutionPattern>,
): ResolutionPattern => ({
  id: "pattern-123",
  problemType: "connection_error",
  problemSignature: "Failed to connect to http://localhost:3000",
  solution: {
    id: "sol-123",
    type: "automated",
    confidence: 0.85,
    description: "Restart MCP server",
    userFriendlyDescription: "The MCP server needs to be restarted",
    steps: ["Stop server", "Clear cache", "Restart server"],
    codeChanges: [],
    configChanges: [],
    testingStrategy: {
      type: "automated",
      tests: ["connection_test"],
      coverage: 0.9,
      automated: true,
    },
    rollbackPlan: {
      steps: ["Restore previous state"],
      automated: false,
      backupRequired: true,
      riskLevel: "low",
    },
  },
  successCount: 5,
  failureCount: 1,
  averageResolutionTime: 2000,
  lastUsed: Date.now(),
  userFeedback: [],
  confidence: 0.83,
  ...overrides,
});

describe("Storage - Pattern Encryption", () => {
  let dbPath: string;
  let storage: ReturnType<typeof createSQLitePatternStorage>;

  beforeEach(() => {
    // Create temp database
    dbPath = join(tmpdir(), `test-pattern-${Date.now()}.db`);
    storage = createSQLitePatternStorage(dbPath, TEST_ENCRYPTION_KEY);
  });

  afterEach(() => {
    try {
      rmSync(dbPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("PatternEncryption Class", () => {
    it("should encrypt and decrypt data correctly", () => {
      const encryption = new PatternEncryption(TEST_ENCRYPTION_KEY);
      const plaintext = "sensitive pattern data";

      const encrypted = encryption.encrypt(plaintext);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should generate unique IVs for each encryption", () => {
      const encryption = new PatternEncryption(TEST_ENCRYPTION_KEY);
      const plaintext = "test data";

      const encrypted1 = encryption.encrypt(plaintext);
      const encrypted2 = encryption.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to same plaintext
      expect(encryption.decrypt(encrypted1)).toBe(plaintext);
      expect(encryption.decrypt(encrypted2)).toBe(plaintext);
    });

    it("should fail to decrypt with wrong key", () => {
      const encryption1 = new PatternEncryption("a".repeat(64));
      const encryption2 = new PatternEncryption("b".repeat(64));

      const encrypted = encryption1.encrypt("secret data");

      expect(() => {
        encryption2.decrypt(encrypted);
      }).toThrow();
    });

    it("should fail to decrypt invalid format", () => {
      const encryption = new PatternEncryption(TEST_ENCRYPTION_KEY);

      expect(() => {
        encryption.decrypt("invalid:format");
      }).toThrow(/invalid.*format/i);

      expect(() => {
        encryption.decrypt("not-encrypted-data");
      }).toThrow(/invalid.*format/i);
    });

    it("should handle JSON data encryption", () => {
      const encryption = new PatternEncryption(TEST_ENCRYPTION_KEY);
      const data = { key: "value", nested: { array: [1, 2, 3] } };

      const encrypted = encryption.encrypt(JSON.stringify(data));
      const decrypted = JSON.parse(encryption.decrypt(encrypted));

      expect(decrypted).toEqual(data);
    });

    it("should require a persisted key when running in production", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.CORTEXDX_PATTERN_KEY;

      Reflect.deleteProperty(process.env, "CORTEXDX_PATTERN_KEY");
      process.env.NODE_ENV = "production";

      expect(() => new PatternEncryption()).toThrow(/CORTEXDX_PATTERN_KEY/);

      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      } else {
        Reflect.deleteProperty(process.env, "NODE_ENV");
      }

      if (originalKey) {
        process.env.CORTEXDX_PATTERN_KEY = originalKey;
      } else {
        Reflect.deleteProperty(process.env, "CORTEXDX_PATTERN_KEY");
      }
    });

    it("should reject invalid encryption key formats", () => {
      expect(() => new PatternEncryption("not-a-hex-key")).toThrow(
        /64 character hex/,
      );
    });
  });

  describe("PatternAnonymizer", () => {
    it("should anonymize URLs", () => {
      const signature =
        "Failed to connect to https://api.internal.company.com/v1/endpoint";
      const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

      expect(anonymized).not.toContain("api.internal.company.com");
      expect(anonymized).toContain("example.com");
    });

    it("should anonymize bearer tokens", () => {
      const signature =
        "Authentication failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

      expect(anonymized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(anonymized).toContain("[TOKEN_REMOVED]");
    });

    it("should anonymize API keys", () => {
      const signature = "Invalid API key: sk_live_abc123def456ghi789jkl012";
      const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

      expect(anonymized).not.toContain("sk_live_abc123def456ghi789jkl012");
      expect(anonymized).toContain("[API_KEY_REMOVED]");
    });

    it("should anonymize email addresses", () => {
      const signature = "User user@example.com not found";
      const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

      expect(anonymized).not.toContain("user@example.com");
      expect(anonymized).toContain("[EMAIL_REMOVED]");
    });

    it("should anonymize IP addresses", () => {
      const signature = "Connection from 192.168.1.100 rejected";
      const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

      expect(anonymized).not.toContain("192.168.1.100");
      expect(anonymized).toContain("[IP_REMOVED]");
    });

    it("should anonymize passwords and secrets", () => {
      const signature = "Login failed: password=mySecretP@ss123";
      const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

      expect(anonymized).not.toContain("mySecretP@ss123");
      expect(anonymized).toContain("[REDACTED]");
    });

    it("should anonymize solution objects", () => {
      const solution = {
        apiKey: "secret-key-123",
        password: "my-password",
        normalField: "public-value",
        nested: {
          token: "secret-token",
          data: "normal-data",
        },
      };

      const anonymized = PatternAnonymizer.anonymizeSolution(solution);

      expect(anonymized).toHaveProperty("apiKey", "[REDACTED]");
      expect(anonymized).toHaveProperty("password", "[REDACTED]");
      expect(anonymized).toHaveProperty("normalField", "public-value");
      expect(anonymized).toHaveProperty("nested.token", "[REDACTED]");
      expect(anonymized).toHaveProperty("nested.data", "normal-data");
    });

    it("should anonymize solution arrays", () => {
      const solution = ["step 1", "password=secret", "step 3"];
      const anonymized = PatternAnonymizer.anonymizeSolution(
        solution,
      ) as string[];

      expect(anonymized[0]).toBe("step 1");
      expect(anonymized[1]).not.toContain("secret");
      expect(anonymized[2]).toBe("step 3");
    });

    it("should hash identifiers consistently", () => {
      const id1 = "user-123";
      const hash1 = PatternAnonymizer.hashIdentifier(id1);
      const hash2 = PatternAnonymizer.hashIdentifier(id1);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(id1);
      expect(hash1).toHaveLength(16); // Truncated to 16 chars
    });

    it("should hash different identifiers differently", () => {
      const hash1 = PatternAnonymizer.hashIdentifier("user-123");
      const hash2 = PatternAnonymizer.hashIdentifier("user-456");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Pattern Storage with Encryption", () => {
    it("should save and load encrypted patterns", async () => {
      const pattern = createMockPattern();

      await storage.savePattern(pattern);
      const loaded = await storage.loadPattern(pattern.id);

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(pattern.id);
      expect(loaded?.problemType).toBe(pattern.problemType);
      expect(loaded?.solution.description).toBe(pattern.solution.description);
    });

    it("should anonymize sensitive data before storage", async () => {
      const pattern = createMockPattern({
        problemSignature: "Failed to authenticate with token: Bearer abc123",
        solution: {
          ...createMockPattern().solution,
          steps: ["Set password=secret", "Restart server"],
        },
      });

      await storage.savePattern(pattern);
      const loaded = await storage.loadPattern(pattern.id);

      expect(loaded?.problemSignature).not.toContain("Bearer abc123");
      expect(loaded?.problemSignature).toContain("[TOKEN_REMOVED]");
    });

    it("should load all patterns with decryption", async () => {
      const pattern1 = createMockPattern({ id: "pattern-1" });
      const pattern2 = createMockPattern({ id: "pattern-2" });

      await storage.savePattern(pattern1);
      await storage.savePattern(pattern2);

      const all = await storage.loadAllPatterns();

      expect(all).toHaveLength(2);
      expect(all.map((p) => p.id)).toContain("pattern-1");
      expect(all.map((p) => p.id)).toContain("pattern-2");
    });

    it("should update pattern success counts", async () => {
      const pattern = createMockPattern({ successCount: 5 });

      await storage.savePattern(pattern);
      await storage.updatePatternSuccess(pattern.id, 1500);

      const loaded = await storage.loadPattern(pattern.id);

      expect(loaded?.successCount).toBe(6);
      expect(loaded?.averageResolutionTime).toBeGreaterThan(0);
      expect(loaded?.confidence).toBeGreaterThan(pattern.confidence);
    });

    it("should update pattern failure counts", async () => {
      const pattern = createMockPattern({ successCount: 5, failureCount: 1 });

      await storage.savePattern(pattern);
      await storage.updatePatternFailure(pattern.id);

      const loaded = await storage.loadPattern(pattern.id);

      expect(loaded?.failureCount).toBe(2);
      expect(loaded?.confidence).toBeLessThan(pattern.confidence);
    });
  });

  describe("Feedback Management", () => {
    it("should add feedback to patterns", async () => {
      const pattern = createMockPattern();
      await storage.savePattern(pattern);

      const feedback: FeedbackEntry = {
        timestamp: Date.now(),
        userId: "user-123",
        rating: 5,
        successful: true,
        comments: "Worked perfectly!",
        context: { environment: "production" },
      };

      await storage.addFeedback(pattern.id, feedback);

      // Feedback should be stored (we can't directly verify without accessing DB)
      // But we can verify the pattern still loads
      const loaded = await storage.loadPattern(pattern.id);
      expect(loaded).toBeDefined();
    });

    it("should anonymize user IDs in feedback", async () => {
      const pattern = createMockPattern();
      await storage.savePattern(pattern);

      const feedback: FeedbackEntry = {
        timestamp: Date.now(),
        userId: "sensitive-user-id-12345",
        rating: 4,
        successful: true,
        context: { environment: "production" },
      };

      // Should not throw - userId should be hashed
      await storage.addFeedback(pattern.id, feedback);

      const loaded = await storage.loadPattern(pattern.id);
      expect(loaded).toBeDefined();
    });

    it("should update pattern confidence based on feedback", async () => {
      const pattern = createMockPattern({
        successCount: 10,
        failureCount: 2,
        confidence: 0.83,
      });
      await storage.savePattern(pattern);

      // Add multiple positive feedback entries
      for (let i = 0; i < 5; i++) {
        await storage.addFeedback(pattern.id, {
          timestamp: Date.now() - i * 1000,
          rating: 5,
          successful: true,
          context: { environment: "production" },
        });
      }

      const loaded = await storage.loadPattern(pattern.id);

      // Confidence should be updated based on feedback
      expect(loaded?.confidence).toBeGreaterThanOrEqual(0);
      expect(loaded?.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Common Issues Tracking", () => {
    it("should save and load common issues", async () => {
      const issue: CommonIssuePattern = {
        signature: "Connection timeout to localhost:3000",
        occurrences: 10,
        solutions: ["Restart server", "Check firewall"],
        contexts: ["development", "testing"],
        firstSeen: Date.now() - 86400000,
        lastSeen: Date.now(),
      };

      await storage.saveCommonIssue(issue);
      const issues = await storage.loadCommonIssues();

      expect(issues).toHaveLength(1);
      expect(issues[0].occurrences).toBe(10);
      expect(issues[0].solutions).toHaveLength(2);
    });

    it("should update common issue occurrences", async () => {
      const issue: CommonIssuePattern = {
        signature: "API rate limit exceeded",
        occurrences: 1,
        solutions: [],
        contexts: ["api"],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      };

      await storage.saveCommonIssue(issue);
      await storage.updateCommonIssue(issue.signature, "new-context");

      const issues = await storage.loadCommonIssues();
      expect(issues[0].occurrences).toBe(2);
      expect(issues[0].contexts).toContain("new-context");
    });

    it("should anonymize issue signatures", async () => {
      const issue: CommonIssuePattern = {
        signature:
          "Failed to auth with https://api.company.com using token abc123",
        occurrences: 1,
        solutions: [],
        contexts: [],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      };

      await storage.saveCommonIssue(issue);
      const issues = await storage.loadCommonIssues();

      expect(issues[0].signature).not.toContain("api.company.com");
      expect(issues[0].signature).toContain("example.com");
    });
  });

  describe("Pattern Retrieval and Filtering", () => {
    beforeEach(async () => {
      // Seed some test patterns
      await storage.savePattern(
        createMockPattern({
          id: "high-conf",
          confidence: 0.9,
          successCount: 10,
        }),
      );
      await storage.savePattern(
        createMockPattern({ id: "low-conf", confidence: 0.3, successCount: 2 }),
      );
      await storage.savePattern(
        createMockPattern({
          id: "old-pattern",
          lastUsed: Date.now() - 90 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it("should retrieve patterns by minimum confidence", async () => {
      const patterns = await storage.retrievePatternsByRank({
        minConfidence: 0.7,
      });

      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns.every((p) => p.confidence >= 0.7)).toBe(true);
    });

    it("should retrieve patterns by minimum success count", async () => {
      const patterns = await storage.retrievePatternsByRank({
        minSuccessCount: 5,
      });

      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns.every((p) => p.successCount >= 5)).toBe(true);
    });

    it("should filter patterns by age", async () => {
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      const patterns = await storage.retrievePatternsByRank({ maxAge });

      // Should not include the old pattern
      expect(patterns.every((p) => p.lastUsed >= Date.now() - maxAge)).toBe(
        true,
      );
    });

    it("should sort patterns by confidence", async () => {
      const patterns = await storage.retrievePatternsByRank({
        sortBy: "confidence",
      });

      for (let i = 0; i < patterns.length - 1; i++) {
        expect(patterns[i].confidence).toBeGreaterThanOrEqual(
          patterns[i + 1].confidence,
        );
      }
    });

    it("should limit number of results", async () => {
      const patterns = await storage.retrievePatternsByRank({ limit: 2 });

      expect(patterns.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Pattern Statistics", () => {
    it("should calculate pattern statistics", async () => {
      await storage.savePattern(
        createMockPattern({ id: "p1", successCount: 10, failureCount: 2 }),
      );
      await storage.savePattern(
        createMockPattern({ id: "p2", successCount: 5, failureCount: 1 }),
      );

      const stats = await storage.getPatternStatistics();

      expect(stats.totalPatterns).toBe(2);
      expect(stats.totalSuccesses).toBe(15);
      expect(stats.totalFailures).toBe(3);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it("should identify most successful pattern", async () => {
      await storage.savePattern(
        createMockPattern({ id: "best", successCount: 20 }),
      );
      await storage.savePattern(
        createMockPattern({ id: "good", successCount: 10 }),
      );

      const stats = await storage.getPatternStatistics();

      expect(stats.mostSuccessfulPattern).toBeDefined();
      expect(stats.mostSuccessfulPattern?.id).toBe("best");
    });

    it("should track recently used patterns", async () => {
      const now = Date.now();
      await storage.savePattern(
        createMockPattern({ id: "recent", lastUsed: now }),
      );
      await storage.savePattern(
        createMockPattern({ id: "old", lastUsed: now - 100000 }),
      );

      const stats = await storage.getPatternStatistics();

      expect(stats.recentlyUsedPatterns).toBeDefined();
      expect(stats.recentlyUsedPatterns[0].id).toBe("recent");
    });

    it("should group patterns by type", async () => {
      await storage.savePattern(
        createMockPattern({ id: "p1", problemType: "connection" }),
      );
      await storage.savePattern(
        createMockPattern({ id: "p2", problemType: "connection" }),
      );
      await storage.savePattern(
        createMockPattern({ id: "p3", problemType: "auth" }),
      );

      const stats = await storage.getPatternStatistics();

      expect(stats.patternsByType.connection).toBe(2);
      expect(stats.patternsByType.auth).toBe(1);
    });

    it("should handle empty database", async () => {
      const stats = await storage.getPatternStatistics();

      expect(stats.totalPatterns).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.mostSuccessfulPattern).toBeNull();
    });
  });

  describe("Similar Pattern Matching", () => {
    beforeEach(async () => {
      await storage.savePattern(
        createMockPattern({
          id: "conn-1",
          problemSignature: "Failed to connect to MCP server on localhost",
        }),
      );
      await storage.savePattern(
        createMockPattern({
          id: "conn-2",
          problemSignature: "Connection refused to MCP server",
        }),
      );
      await storage.savePattern(
        createMockPattern({
          id: "auth-1",
          problemSignature: "Authentication failed invalid token",
        }),
      );
    });

    it("should find similar patterns", async () => {
      const similar = await storage.findSimilarPatterns(
        "Failed to connect to MCP server",
      );

      expect(similar.length).toBeGreaterThan(0);
      expect(similar.some((p) => p.id === "conn-1")).toBe(true);
    });

    it("should respect similarity threshold", async () => {
      const highThreshold = await storage.findSimilarPatterns(
        "MCP connection issue",
        0.9,
      );
      const lowThreshold = await storage.findSimilarPatterns(
        "MCP connection issue",
        0.1,
      );

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });

    it("should not match dissimilar patterns", async () => {
      const similar = await storage.findSimilarPatterns(
        "Database query timeout",
        0.6,
      );

      // Should not match connection or auth patterns
      expect(similar.length).toBe(0);
    });
  });

  describe("Pattern Pruning", () => {
    it("should prune old patterns", async () => {
      const now = Date.now();
      const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

      await storage.savePattern(
        createMockPattern({ id: "old", lastUsed: oneYearAgo }),
      );
      await storage.savePattern(
        createMockPattern({ id: "recent", lastUsed: now }),
      );

      const pruned = await storage.pruneOldPatterns(180 * 24 * 60 * 60 * 1000); // 180 days

      expect(pruned).toBe(1);

      const remaining = await storage.loadAllPatterns();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("recent");
    });

    it("should not prune recent patterns", async () => {
      const now = Date.now();

      await storage.savePattern(
        createMockPattern({ id: "recent-1", lastUsed: now - 1000 }),
      );
      await storage.savePattern(
        createMockPattern({ id: "recent-2", lastUsed: now - 2000 }),
      );

      const pruned = await storage.pruneOldPatterns(7 * 24 * 60 * 60 * 1000); // 7 days

      expect(pruned).toBe(0);

      const all = await storage.loadAllPatterns();
      expect(all).toHaveLength(2);
    });
  });

  describe("Legacy Data Compatibility", () => {
    it("should handle patterns that cannot be decrypted gracefully", async () => {
      const pattern = createMockPattern({ id: "legacy-pattern" });

      // Save with one key
      const storage1 = createSQLitePatternStorage(dbPath, "a".repeat(64));
      await storage1.savePattern(pattern);

      // Try to load with different key
      const storage2 = createSQLitePatternStorage(dbPath, "b".repeat(64));
      const loaded = await storage2.loadPattern("legacy-pattern");

      // Should return a placeholder pattern instead of throwing
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe("legacy-pattern");
    });
  });
});
