/**
 * SQLite-based Pattern Storage with Anonymization and Encryption
 * Requirements: 16.1, 16.4
 *
 * Provides persistent, privacy-preserving storage for learned resolution patterns
 * with encryption at rest and automatic anonymization of sensitive data.
 */

import Database from "better-sqlite3";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json.js";
import type {
  CommonIssuePattern,
  EnhancedPatternStorage,
  FeedbackEntry,
  PatternRetrievalOptions,
  PatternStatistics,
  ResolutionPattern,
} from "./pattern-storage.js";

type PatternRow = {
  id: string;
  problem_type: string;
  problem_signature: string;
  solution_data: string;
  success_count: number;
  failure_count: number;
  average_resolution_time: number;
  last_used: number;
  confidence: number;
  created_at: number;
  updated_at: number;
};

type FeedbackRow = {
  id: number;
  pattern_id: string;
  timestamp: number;
  user_id: string | null;
  rating: number;
  successful: number;
  comments: string | null;
  context: string | null;
};

type CommonIssueRow = {
  signature: string;
  occurrences: number;
  solutions: string;
  contexts: string;
  first_seen: number;
  last_seen: number;
};

type PatternStatsRow = {
  total: number;
  successes: number | null;
  failures: number | null;
  avg_confidence: number | null;
};

const SENSITIVE_SIGNATURE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/https?:\/\/[^\s]+/gi, "https://example.com/mcp"],
  [/bearer\s+[A-Za-z0-9._-]+/gi, "bearer [TOKEN_REMOVED]"],
  [/\b(sk|pk|api)_[a-z]+_[A-Za-z0-9]{20,}\b/gi, "[API_KEY_REMOVED]"],
  [/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[EMAIL_REMOVED]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP_REMOVED]"],
  [/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.)+[a-z]{2,}\b/gi, "example.com"],
  [/((?:password|pwd|pass|secret|token|key)[:=])\s*[^\s;]+/gi, "$1[REDACTED]"],
];

const SIMILARITY_CANDIDATE_LIMIT = 200;
const MIN_SIMILARITY_TOKEN_LENGTH = 4;

/**
 * Anonymization utilities for removing sensitive data from patterns
 */
export function anonymizeProblemSignature(signature: string): string {
  if (!signature) {
    return "";
  }

  return SENSITIVE_SIGNATURE_REPLACEMENTS.reduce<string>(
    (current, [pattern, replacement]) => {
      return current.replace(pattern, replacement);
    },
    signature,
  );
}

export function anonymizeSolution(solution: unknown): unknown {
  if (typeof solution === "string") {
    return anonymizeProblemSignature(solution);
  }

  if (Array.isArray(solution)) {
    return solution.map((item) => anonymizeSolution(item));
  }

  if (solution && typeof solution === "object") {
    const anonymized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(solution)) {
      const lowered = key.toLowerCase();
      if (
        lowered.includes("password") ||
        lowered.includes("secret") ||
        lowered.includes("token") ||
        lowered.includes("key") ||
        lowered.includes("credential")
      ) {
        anonymized[key] = "[REDACTED]";
      } else {
        anonymized[key] = anonymizeSolution(value);
      }
    }
    return anonymized;
  }

  return solution;
}

export function hashIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex").substring(0, 16);
}

export const PatternAnonymizer = {
  anonymizeProblemSignature,
  anonymizeSolution,
  hashIdentifier,
};

/**
 * Simple encryption for pattern data at rest
 * Uses system-provided encryption key (in production, use system keychain)
 */
export class PatternEncryption {
  private key: Buffer;
  private static defaultKey: string | null = null;
  private static warnedAboutEphemeralKey = false;

  constructor(encryptionKey?: string) {
    const keyString = this.resolveKey(encryptionKey);
    this.key = Buffer.from(keyString, "hex");
  }

  private resolveKey(explicitKey?: string): string {
    const providedKey = explicitKey ?? process.env.CORTEXDX_PATTERN_KEY ?? null;
    if (providedKey) {
      this.assertValidKey(providedKey);
      return providedKey;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CORTEXDX_PATTERN_KEY environment variable is required for persistence in production",
      );
    }

    if (!PatternEncryption.warnedAboutEphemeralKey) {
      console.warn(
        "[pattern-storage] Using ephemeral encryption key; persisted patterns will be unreadable after restart. Set CORTEXDX_PATTERN_KEY to avoid data loss.",
      );
      PatternEncryption.warnedAboutEphemeralKey = true;
    }
    return this.getOrGenerateDefaultKey();
  }

  private assertValidKey(key: string): void {
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error(
        "Encryption key must be a 64 character hex string (32 bytes)",
      );
    }
  }

  private getOrGenerateDefaultKey(): string {
    if (!PatternEncryption.defaultKey) {
      PatternEncryption.defaultKey = randomBytes(32).toString("hex");
    }
    return PatternEncryption.defaultKey;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

/**
 * SQLite-based pattern storage with encryption and anonymization
 */
export function createSQLitePatternStorage(
  dbPath: string,
  encryptionKey?: string,
): EnhancedPatternStorage {
  let db: Database.Database;
  let encryption: PatternEncryption;

  try {
    db = new Database(dbPath);
    encryption = new PatternEncryption(encryptionKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to initialize pattern storage at ${dbPath}: ${message}`,
    );
  }

  // Create tables
  try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS patterns (
            id TEXT PRIMARY KEY,
            problem_type TEXT NOT NULL,
            problem_signature TEXT NOT NULL,
            solution_data TEXT NOT NULL,
            success_count INTEGER DEFAULT 0,
            failure_count INTEGER DEFAULT 0,
            average_resolution_time REAL DEFAULT 0,
            last_used INTEGER NOT NULL,
            confidence REAL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_problem_type ON patterns(problem_type);
        CREATE INDEX IF NOT EXISTS idx_confidence ON patterns(confidence);
        CREATE INDEX IF NOT EXISTS idx_last_used ON patterns(last_used);

        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            user_id TEXT,
            rating INTEGER NOT NULL,
            successful INTEGER NOT NULL,
            comments TEXT,
            context TEXT,
            FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_feedback_pattern ON feedback(pattern_id);

        CREATE TABLE IF NOT EXISTS common_issues (
            signature TEXT PRIMARY KEY,
            occurrences INTEGER DEFAULT 0,
            solutions TEXT NOT NULL,
            contexts TEXT NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_common_occurrences ON common_issues(occurrences DESC);
    `);
  } catch (error) {
    db.close();
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create pattern storage schema: ${message}`);
  }

  // Prepared statements
  const insertPattern = db.prepare(`
        INSERT OR REPLACE INTO patterns 
        (id, problem_type, problem_signature, solution_data, success_count, failure_count, 
         average_resolution_time, last_used, confidence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

  const selectPattern = db.prepare(`
        SELECT * FROM patterns WHERE id = ?
    `);

  const selectAllPatterns = db.prepare(`
        SELECT * FROM patterns
    `);

  const selectSimilarCandidates = db.prepare(`
        SELECT * FROM patterns
        WHERE problem_signature LIKE ?
           OR problem_signature LIKE ?
           OR problem_signature LIKE ?
        ORDER BY last_used DESC
        LIMIT ?
    `);

  const updatePatternSuccess = db.prepare(`
        UPDATE patterns 
        SET success_count = success_count + 1,
            average_resolution_time = (average_resolution_time * success_count + ?) / (success_count + 1),
            last_used = ?,
            confidence = CAST(success_count + 1 AS REAL) / (success_count + failure_count + 1),
            updated_at = ?
        WHERE id = ?
    `);

  const updatePatternFailure = db.prepare(`
        UPDATE patterns 
        SET failure_count = failure_count + 1,
            last_used = ?,
            confidence = CAST(success_count AS REAL) / (success_count + failure_count + 1),
            updated_at = ?
        WHERE id = ?
    `);

  const insertFeedback = db.prepare(`
        INSERT INTO feedback (pattern_id, timestamp, user_id, rating, successful, comments, context)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

  const selectFeedback = db.prepare(`
        SELECT * FROM feedback WHERE pattern_id = ? ORDER BY timestamp DESC
    `);

  const insertCommonIssue = db.prepare(`
        INSERT OR REPLACE INTO common_issues (signature, occurrences, solutions, contexts, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

  const selectCommonIssues = db.prepare(`
        SELECT * FROM common_issues ORDER BY occurrences DESC
    `);

  const selectCommonIssue = db.prepare(`
        SELECT * FROM common_issues WHERE signature = ?
    `);

  /**
   * Serialize and encrypt pattern data
   */
  function serializePattern(pattern: ResolutionPattern): string {
    // Anonymize before encryption
    const anonymized = {
      ...pattern,
      problemSignature: PatternAnonymizer.anonymizeProblemSignature(
        pattern.problemSignature,
      ),
      solution: PatternAnonymizer.anonymizeSolution(pattern.solution),
    };

    const json = JSON.stringify(anonymized);
    return encryption.encrypt(json);
  }

  /**
   * Decrypt and deserialize pattern data
   */
  const loggedDecryptFailures = new Set<string>();

  function deserializePattern(row: PatternRow): ResolutionPattern {
    const encrypted = row.solution_data;
    try {
      const json = encryption.decrypt(encrypted);
      return safeParseJson(json) as ResolutionPattern;
    } catch (error) {
      if (!loggedDecryptFailures.has(row.id)) {
        console.warn(
          "[pattern-storage] Failed to decrypt pattern",
          row.id,
          error instanceof Error ? error.message : error,
        );
        loggedDecryptFailures.add(row.id);
      }

      // Attempt to treat the payload as legacy plaintext JSON
      const trimmed = encrypted.trim();
      if (trimmed.startsWith("{")) {
        try {
          return safeParseJson(trimmed) as ResolutionPattern;
        } catch {
          // fall through to placeholder
        }
      }

      return {
        id: row.id,
        problemType: row.problem_type,
        problemSignature: row.problem_signature,
        solution: {
          id: `legacy-${row.id}`,
          type: "manual",
          confidence: 0,
          description: "Legacy pattern could not be decrypted",
          userFriendlyDescription: "Legacy pattern could not be decrypted",
          steps: [],
          codeChanges: [],
          configChanges: [],
          testingStrategy: {
            type: "manual",
            tests: [],
            coverage: 0,
            automated: false,
          },
          rollbackPlan: {
            steps: [],
            automated: false,
            backupRequired: false,
            riskLevel: "low",
          },
        },
        successCount: row.success_count,
        failureCount: row.failure_count,
        averageResolutionTime: row.average_resolution_time,
        lastUsed: row.last_used,
        userFeedback: [],
        confidence: row.confidence,
      } as ResolutionPattern;
    }
  }

  return {
    async savePattern(pattern: ResolutionPattern): Promise<void> {
      try {
        const now = Date.now();
        const encrypted = serializePattern(pattern);

        insertPattern.run(
          pattern.id,
          pattern.problemType,
          PatternAnonymizer.anonymizeProblemSignature(pattern.problemSignature),
          encrypted,
          pattern.successCount,
          pattern.failureCount,
          pattern.averageResolutionTime,
          pattern.lastUsed,
          pattern.confidence,
          now,
          now,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to save pattern ${pattern.id}: ${message}`);
      }
    },

    async loadPattern(id: string): Promise<ResolutionPattern | null> {
      try {
        const row = selectPattern.get(id) as PatternRow | undefined;
        if (!row) return null;

        const pattern = deserializePattern(row);
        return {
          ...pattern,
          id: row.id,
          problemType: row.problem_type,
          successCount: row.success_count,
          failureCount: row.failure_count,
          averageResolutionTime: row.average_resolution_time,
          lastUsed: row.last_used,
          confidence: row.confidence,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load pattern ${id}: ${message}`);
      }
    },

    async loadAllPatterns(): Promise<ResolutionPattern[]> {
      try {
        const rows = selectAllPatterns.all() as PatternRow[];
        return rows.map((row) => {
          const pattern = deserializePattern(row);
          return {
            ...pattern,
            id: row.id,
            problemType: row.problem_type,
            successCount: row.success_count,
            failureCount: row.failure_count,
            averageResolutionTime: row.average_resolution_time,
            lastUsed: row.last_used,
            confidence: row.confidence,
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load all patterns: ${message}`);
      }
    },

    async updatePatternSuccess(
      id: string,
      resolutionTime: number,
    ): Promise<void> {
      try {
        const now = Date.now();
        updatePatternSuccess.run(resolutionTime, now, now, id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to update pattern success for ${id}: ${message}`,
        );
      }
    },

    async updatePatternFailure(id: string): Promise<void> {
      try {
        const now = Date.now();
        updatePatternFailure.run(now, now, id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to update pattern failure for ${id}: ${message}`,
        );
      }
    },

    async addFeedback(id: string, feedback: FeedbackEntry): Promise<void> {
      try {
        const userId = feedback.userId
          ? PatternAnonymizer.hashIdentifier(feedback.userId)
          : null;

        insertFeedback.run(
          id,
          feedback.timestamp,
          userId,
          feedback.rating,
          feedback.successful ? 1 : 0,
          feedback.comments || null,
          JSON.stringify(feedback.context),
        );

        // Update pattern confidence based on feedback
        const pattern = await this.loadPattern(id);
        if (pattern) {
          const feedbackRows = selectFeedback.all(id) as FeedbackRow[];
          const recentFeedback = feedbackRows
            .filter((f) => Date.now() - f.timestamp < 30 * 24 * 60 * 60 * 1000)
            .map((f) => f.rating);

          if (recentFeedback.length >= 3) {
            const avgRating =
              recentFeedback.reduce((a, b) => a + b, 0) / recentFeedback.length;
            const feedbackFactor = avgRating / 5.0;

            const successRate =
              pattern.successCount /
              (pattern.successCount + pattern.failureCount);
            const newConfidence = successRate * 0.7 + feedbackFactor * 0.3;

            db.prepare(
              "UPDATE patterns SET confidence = ?, updated_at = ? WHERE id = ?",
            ).run(newConfidence, Date.now(), id);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to add feedback for pattern ${id}: ${message}`);
      }
    },

    async saveCommonIssue(issue: CommonIssuePattern): Promise<void> {
      try {
        insertCommonIssue.run(
          PatternAnonymizer.anonymizeProblemSignature(issue.signature),
          issue.occurrences,
          JSON.stringify(issue.solutions),
          JSON.stringify(issue.contexts),
          issue.firstSeen,
          issue.lastSeen,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to save common issue ${issue.signature}: ${message}`,
        );
      }
    },

    async loadCommonIssues(): Promise<CommonIssuePattern[]> {
      try {
        const rows = selectCommonIssues.all() as CommonIssueRow[];
        return rows.map((row) => ({
          signature: row.signature,
          occurrences: row.occurrences,
          solutions: safeParseJson(row.solutions),
          contexts: safeParseJson(row.contexts),
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load common issues: ${message}`);
      }
    },

    async updateCommonIssue(signature: string, context: string): Promise<void> {
      try {
        const anonymizedSig =
          PatternAnonymizer.anonymizeProblemSignature(signature);
        const existing = selectCommonIssue.get(anonymizedSig) as
          | CommonIssueRow
          | undefined;

        if (existing) {
          const contexts = safeParseJson(existing.contexts) as string[];
          if (!contexts.includes(context)) {
            contexts.push(context);
          }

          db.prepare(`
                        UPDATE common_issues
                        SET occurrences = occurrences + 1,
                            contexts = ?,
                            last_seen = ?
                        WHERE signature = ?
                    `).run(JSON.stringify(contexts), Date.now(), anonymizedSig);
        } else {
          insertCommonIssue.run(
            anonymizedSig,
            1,
            JSON.stringify([]),
            JSON.stringify([context]),
            Date.now(),
            Date.now(),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to update common issue ${signature}: ${message}`,
        );
      }
    },

    async retrievePatternsByRank(
      options: PatternRetrievalOptions = {},
    ): Promise<ResolutionPattern[]> {
      try {
        const {
          minConfidence = 0,
          minSuccessCount = 0,
          maxAge,
          sortBy = "confidence",
          limit,
        } = options;

        let query =
          "SELECT * FROM patterns WHERE confidence >= ? AND success_count >= ?";
        const params: number[] = [minConfidence, minSuccessCount];

        if (maxAge) {
          query += " AND last_used >= ?";
          params.push(Date.now() - maxAge);
        }

        // Add sorting
        switch (sortBy) {
          case "confidence":
            query += " ORDER BY confidence DESC";
            break;
          case "successRate":
            query +=
              " ORDER BY (CAST(success_count AS REAL) / (success_count + failure_count)) DESC";
            break;
          case "recentUse":
            query += " ORDER BY last_used DESC";
            break;
          case "totalUses":
            query += " ORDER BY (success_count + failure_count) DESC";
            break;
        }

        if (limit && limit > 0) {
          query += " LIMIT ?";
          params.push(limit);
        }

        const rows = db.prepare(query).all(...params) as PatternRow[];
        return rows.map((row) => {
          const pattern = deserializePattern(row);
          return {
            ...pattern,
            id: row.id,
            problemType: row.problem_type,
            successCount: row.success_count,
            failureCount: row.failure_count,
            averageResolutionTime: row.average_resolution_time,
            lastUsed: row.last_used,
            confidence: row.confidence,
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to retrieve patterns by rank: ${message}`);
      }
    },

    async getPatternStatistics(): Promise<PatternStatistics> {
      try {
        const stats = db
          .prepare(
            `
                    SELECT
                        COUNT(*) as total,
                        SUM(success_count) as successes,
                        SUM(failure_count) as failures,
                        AVG(confidence) as avg_confidence
                    FROM patterns
                `,
          )
          .get() as PatternStatsRow | undefined;

        if (!stats || stats.total === 0) {
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

        const mostSuccessful = db
          .prepare("SELECT * FROM patterns ORDER BY success_count DESC LIMIT 1")
          .get() as PatternRow | undefined;

        const recentRows = db
          .prepare("SELECT * FROM patterns ORDER BY last_used DESC LIMIT 10")
          .all() as PatternRow[];

        const typeRows = db
          .prepare(
            "SELECT problem_type, COUNT(*) as count FROM patterns GROUP BY problem_type",
          )
          .all() as Array<{ problem_type: string; count: number }>;

        const patternsByType: Record<string, number> = {};
        for (const row of typeRows) {
          patternsByType[row.problem_type] = row.count;
        }

        return {
          totalPatterns: stats.total,
          totalSuccesses: stats.successes ?? 0,
          totalFailures: stats.failures ?? 0,
          averageConfidence: stats.avg_confidence ?? 0,
          mostSuccessfulPattern: mostSuccessful
            ? deserializePattern(mostSuccessful)
            : null,
          recentlyUsedPatterns: recentRows.map((row) =>
            deserializePattern(row),
          ),
          patternsByType,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get pattern statistics: ${message}`);
      }
    },

    async findSimilarPatterns(
      signature: string,
      threshold = 0.6,
    ): Promise<ResolutionPattern[]> {
      try {
        const anonymizedSig =
          PatternAnonymizer.anonymizeProblemSignature(signature);
        const [likeA, likeB, likeC] =
          buildSimilarityCandidatePatterns(anonymizedSig);
        const candidateRows = selectSimilarCandidates.all(
          likeA,
          likeB,
          likeC,
          SIMILARITY_CANDIDATE_LIMIT,
        ) as PatternRow[];

        const candidates = candidateRows.map((row) => {
          const pattern = deserializePattern(row);
          return {
            ...pattern,
            id: row.id,
            problemType: row.problem_type,
            successCount: row.success_count,
            failureCount: row.failure_count,
            averageResolutionTime: row.average_resolution_time,
            lastUsed: row.last_used,
            confidence: row.confidence,
          };
        });

        return candidates
          .map((pattern) => ({
            pattern,
            similarity: calculateSimilarity(
              anonymizedSig,
              pattern.problemSignature,
            ),
          }))
          .filter((entry) => entry.similarity >= threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .map((entry) => entry.pattern);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to find similar patterns for signature: ${message}`,
        );
      }
    },

    async pruneOldPatterns(maxAge: number): Promise<number> {
      try {
        const cutoff = Date.now() - maxAge;
        const result = db
          .prepare("DELETE FROM patterns WHERE last_used < ?")
          .run(cutoff);
        return result.changes;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to prune old patterns: ${message}`);
      }
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

function buildSimilarityCandidatePatterns(
  signature: string,
): [string, string, string] {
  const normalized = signature.toLowerCase();
  const tokens = Array.from(
    new Set(
      normalized
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= MIN_SIMILARITY_TOKEN_LENGTH),
    ),
  );

  const likes: string[] = [];
  for (const token of tokens) {
    likes.push(`%${token}%`);
    if (likes.length === 3) break;
  }

  const fallbackSource = normalized.trim() || signature.trim();
  const fallback = fallbackSource ? `%${fallbackSource.slice(0, 32)}%` : "%";
  while (likes.length < 3) {
    likes.push(fallback);
  }

  return [likes[0], likes[1], likes[2]];
}
