/**
 * SQLite-based Pattern Storage with Anonymization and Encryption
 * Requirements: 16.1, 16.4
 * 
 * Provides persistent, privacy-preserving storage for learned resolution patterns
 * with encryption at rest and automatic anonymization of sensitive data.
 */

import { safeParseJson } from "../utils/json.js";
import Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
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

/**
 * Anonymization utilities for removing sensitive data from patterns
 */
export function anonymizeProblemSignature(signature: string): string {
    let anonymized = signature;

    anonymized = anonymized.replace(
        /https?:\/\/[^\s]+/gi,
        "https://example.com/mcp",
    );

    anonymized = anonymized.replace(
        /bearer\s+[A-Za-z0-9._-]+/gi,
        "bearer [TOKEN_REMOVED]",
    );

    anonymized = anonymized.replace(
        /\b(sk|pk|api)_[a-z]+_[A-Za-z0-9]{20,}\b/gi,
        "[API_KEY_REMOVED]",
    );

    anonymized = anonymized.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        "[EMAIL_REMOVED]",
    );

    anonymized = anonymized.replace(
        /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        "[IP_REMOVED]",
    );

    anonymized = anonymized.replace(
        /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.)+[a-z]{2,}\b/gi,
        "example.com",
    );

    anonymized = anonymized.replace(
        /(?:password|pwd|pass|secret|token|key)[:=]\s*[^\s;]+/gi,
        "$1=[REDACTED]",
    );

    return anonymized;
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

    constructor(encryptionKey?: string) {
        // In production, retrieve from system keychain
        // For now, use provided key or generate one (but cache it for consistency)
        const keyString = encryptionKey || process.env.CORTEXDX_PATTERN_KEY || this.getOrGenerateDefaultKey();
        this.key = Buffer.from(keyString, "hex");
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
    const db = new Database(dbPath);
    const encryption = new PatternEncryption(encryptionKey);

    // Create tables
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
        },

        async loadPattern(id: string): Promise<ResolutionPattern | null> {
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
        },

        async loadAllPatterns(): Promise<ResolutionPattern[]> {
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
        },

        async updatePatternSuccess(id: string, resolutionTime: number): Promise<void> {
            const now = Date.now();
            updatePatternSuccess.run(resolutionTime, now, now, id);
        },

        async updatePatternFailure(id: string): Promise<void> {
            const now = Date.now();
            updatePatternFailure.run(now, now, id);
        },

        async addFeedback(id: string, feedback: FeedbackEntry): Promise<void> {
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
                        pattern.successCount / (pattern.successCount + pattern.failureCount);
                    const newConfidence = successRate * 0.7 + feedbackFactor * 0.3;

                    db.prepare("UPDATE patterns SET confidence = ?, updated_at = ? WHERE id = ?").run(
                        newConfidence,
                        Date.now(),
                        id,
                    );
                }
            }
        },

        async saveCommonIssue(issue: CommonIssuePattern): Promise<void> {
            insertCommonIssue.run(
                PatternAnonymizer.anonymizeProblemSignature(issue.signature),
                issue.occurrences,
                JSON.stringify(issue.solutions),
                JSON.stringify(issue.contexts),
                issue.firstSeen,
                issue.lastSeen,
            );
        },

        async loadCommonIssues(): Promise<CommonIssuePattern[]> {
            const rows = selectCommonIssues.all() as CommonIssueRow[];
            return rows.map((row) => ({
                signature: row.signature,
                occurrences: row.occurrences,
                solutions: safeParseJson(row.solutions),
                contexts: safeParseJson(row.contexts),
                firstSeen: row.first_seen,
                lastSeen: row.last_seen,
            }));
        },

        async updateCommonIssue(signature: string, context: string): Promise<void> {
            const anonymizedSig = PatternAnonymizer.anonymizeProblemSignature(signature);
            const existing = selectCommonIssue.get(anonymizedSig) as CommonIssueRow | undefined;

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
        },

        async retrievePatternsByRank(
            options: PatternRetrievalOptions = {},
        ): Promise<ResolutionPattern[]> {
            const {
                minConfidence = 0,
                minSuccessCount = 0,
                maxAge,
                sortBy = "confidence",
                limit,
            } = options;

            let query = "SELECT * FROM patterns WHERE confidence >= ? AND success_count >= ?";
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
                    query += " ORDER BY (CAST(success_count AS REAL) / (success_count + failure_count)) DESC";
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
        },

        async getPatternStatistics(): Promise<PatternStatistics> {
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
        },

        async findSimilarPatterns(
            signature: string,
            threshold = 0.6,
        ): Promise<ResolutionPattern[]> {
            const anonymizedSig = PatternAnonymizer.anonymizeProblemSignature(signature);
            const allPatterns = await this.loadAllPatterns();

            const similar: Array<{ pattern: ResolutionPattern; similarity: number }> = [];

            for (const pattern of allPatterns) {
                const similarity = calculateSimilarity(anonymizedSig, pattern.problemSignature);
                if (similarity >= threshold) {
                    similar.push({ pattern, similarity });
                }
            }

            return similar
                .sort((a, b) => b.similarity - a.similarity)
                .map((s) => s.pattern);
        },

        async pruneOldPatterns(maxAge: number): Promise<number> {
            const cutoff = Date.now() - maxAge;
            const result = db
                .prepare("DELETE FROM patterns WHERE last_used < ?")
                .run(cutoff);
            return result.changes;
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
