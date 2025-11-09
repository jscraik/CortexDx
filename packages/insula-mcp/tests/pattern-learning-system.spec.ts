/**
 * Pattern Learning System Tests
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 * 
 * Tests for:
 * - Pattern anonymization (ensure no sensitive data)
 * - Pattern matching accuracy
 * - Automatic solution application
 * - Persistence across sessions
 */

import { unlink } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    createEnhancedPatternMatcher
} from "../src/learning/pattern-matcher.js";
import {
    createPatternLearningResolver,
    exportPatterns,
    importPatterns,
    learnFromFailure,
    learnFromSuccess,
    type PatternLearningConfig
} from "../src/plugins/development/pattern-learning-resolver.js";
import {
    createSQLitePatternStorage,
    PatternAnonymizer,
} from "../src/storage/pattern-storage-sqlite.js";
import type { DevelopmentContext, Problem, Solution } from "../src/types.js";

describe("Pattern Learning System Tests", () => {
    const testDbPath = "/tmp/test-pattern-learning.db";
    let config: PatternLearningConfig;

    beforeEach(() => {
        const patternStorage = createSQLitePatternStorage(testDbPath);
        const patternMatcher = createEnhancedPatternMatcher();

        config = {
            patternStorage,
            patternMatcher,
            minConfidence: 0.7,
            enableAutoApply: false,
            trackStatistics: true,
        };
    });

    afterEach(async () => {
        try {
            await unlink(testDbPath);
        } catch {
            // File might not exist
        }
    });

    describe("Pattern Anonymization (Req 16.4)", () => {
        it("should remove URLs from problem signatures", () => {
            const signature = "Connection failed to https://api.example.com/mcp/v1";
            const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

            expect(anonymized).not.toContain("api.example.com");
            expect(anonymized).toContain("example.com");
        });

        it("should remove API keys from problem signatures", () => {
            const signature = "Authentication failed with key sk_live_1234567890abcdef1234567890abcdef";
            const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

            expect(anonymized).not.toContain("sk_live_1234567890abcdef1234567890abcdef");
            expect(anonymized).toContain("[API_KEY_REMOVED]");
        });

        it("should remove bearer tokens from problem signatures", () => {
            const signature = "Request failed with bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
            const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

            expect(anonymized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
            expect(anonymized).toContain("[TOKEN_REMOVED]");
        });

        it("should remove email addresses from problem signatures", () => {
            const signature = "User user@example.com reported connection error";
            const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

            expect(anonymized).not.toContain("user@example.com");
            expect(anonymized).toContain("[EMAIL_REMOVED]");
        });

        it("should remove IP addresses from problem signatures", () => {
            const signature = "Connection timeout to 192.168.1.100:8080";
            const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

            expect(anonymized).not.toContain("192.168.1.100");
            expect(anonymized).toContain("[IP_REMOVED]");
        });

        it("should remove credentials from connection strings", () => {
            const signature = "Database connection failed: password=secret123";
            const anonymized = PatternAnonymizer.anonymizeProblemSignature(signature);

            expect(anonymized).not.toContain("secret123");
            expect(anonymized).toContain("[REDACTED]");
        });

        it("should anonymize solution data", () => {
            const solution = {
                description: "Fix connection to https://api.example.com",
                apiKey: "sk_test_12345",
                password: "secret",
                steps: [
                    {
                        description: "Update config with token abc123",
                    },
                ],
            };

            const anonymized = PatternAnonymizer.anonymizeSolution(solution);

            expect(JSON.stringify(anonymized)).not.toContain("sk_test_12345");
            expect(JSON.stringify(anonymized)).not.toContain("secret");
            expect(JSON.stringify(anonymized)).toContain("[REDACTED]");
        });

        it("should hash user identifiers", () => {
            const userId = "user123@example.com";
            const hashed = PatternAnonymizer.hashIdentifier(userId);

            expect(hashed).not.toBe(userId);
            expect(hashed.length).toBe(16);
            expect(/^[a-f0-9]{16}$/.test(hashed)).toBe(true);
        });
    });

    describe("Pattern Matching Accuracy (Req 16.2)", () => {
        it("should match similar problems with high confidence", async () => {
            const { patternStorage, patternMatcher } = config;

            // Store a pattern
            await patternStorage.savePattern({
                id: "pattern-1",
                problemType: "connection",
                problemSignature: "connection timeout error network failure",
                solution: createMockSolution(),
                successCount: 10,
                failureCount: 1,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.91,
            });

            // Create a similar problem
            const problem: Problem = {
                id: "problem-1",
                type: "connection",
                severity: "high",
                description: "Connection timeout occurred during network operation",
                userFriendlyDescription: "Connection timed out",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "http",
                    environment: "production",
                    configuration: {},
                    errorLogs: ["timeout error"],
                },
                evidence: [{ type: "log", ref: "error-log", data: "timeout" }],
                affectedComponents: ["network", "connection"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const patterns = await patternStorage.loadAllPatterns();
            const matches = await patternMatcher.findMatches(problem, patterns, 0.7);

            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0]!.confidence).toBeGreaterThan(0.7);
        });

        it("should not match dissimilar problems", async () => {
            const { patternStorage, patternMatcher } = config;

            // Store a pattern
            await patternStorage.savePattern({
                id: "pattern-2",
                problemType: "authentication",
                problemSignature: "authentication failure invalid credentials",
                solution: createMockSolution(),
                successCount: 5,
                failureCount: 0,
                averageResolutionTime: 3000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 1.0,
            });

            // Create a dissimilar problem
            const problem: Problem = {
                id: "problem-2",
                type: "performance",
                severity: "medium",
                description: "Slow response time for API calls",
                userFriendlyDescription: "API is slow",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "http",
                    environment: "production",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [{ type: "log", ref: "perf-log", data: "slow" }],
                affectedComponents: ["api", "performance"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const patterns = await patternStorage.loadAllPatterns();
            const matches = await patternMatcher.findMatches(problem, patterns, 0.7);

            expect(matches.length).toBe(0);
        });

        it("should complete pattern matching within 3 seconds", async () => {
            const { patternStorage, patternMatcher } = config;

            // Store multiple patterns
            for (let i = 0; i < 50; i++) {
                await patternStorage.savePattern({
                    id: `pattern-${i}`,
                    problemType: i % 2 === 0 ? "connection" : "protocol",
                    problemSignature: `problem signature ${i} with various keywords`,
                    solution: createMockSolution(),
                    successCount: Math.floor(Math.random() * 20),
                    failureCount: Math.floor(Math.random() * 5),
                    averageResolutionTime: Math.random() * 10000,
                    lastUsed: Date.now(),
                    userFeedback: [],
                    confidence: Math.random(),
                });
            }

            const problem: Problem = {
                id: "perf-test",
                type: "connection",
                severity: "high",
                description: "Connection issue with various keywords",
                userFriendlyDescription: "Connection problem",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "http",
                    environment: "production",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: ["connection"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const startTime = Date.now();
            const patterns = await patternStorage.loadAllPatterns();
            await patternMatcher.findMatches(problem, patterns, 0.7);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(3000);
        });

        it("should rank matches by confidence", async () => {
            const { patternStorage, patternMatcher } = config;

            // Store patterns with different success rates
            await patternStorage.savePattern({
                id: "high-confidence",
                problemType: "connection",
                problemSignature: "connection timeout network",
                solution: createMockSolution(),
                successCount: 20,
                failureCount: 1,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.95,
            });

            await patternStorage.savePattern({
                id: "low-confidence",
                problemType: "connection",
                problemSignature: "connection timeout network",
                solution: createMockSolution(),
                successCount: 5,
                failureCount: 5,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.5,
            });

            const problem: Problem = {
                id: "test-problem",
                type: "connection",
                severity: "high",
                description: "Connection timeout on network",
                userFriendlyDescription: "Connection timed out",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "http",
                    environment: "production",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: ["connection", "network"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const patterns = await patternStorage.loadAllPatterns();
            const matches = await patternMatcher.findMatches(problem, patterns, 0.5);

            expect(matches.length).toBeGreaterThanOrEqual(2);
            expect(matches[0]!.pattern.id).toBe("high-confidence");
            expect(matches[0]!.confidence).toBeGreaterThan(matches[1]!.confidence);
        });
    });

    describe("Automatic Solution Application (Req 16.3)", () => {
        it("should learn from successful fix application", async () => {
            const problem: Problem = {
                id: "learn-success",
                type: "connection",
                severity: "high",
                description: "Connection timeout error",
                userFriendlyDescription: "Connection timed out",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "http",
                    environment: "production",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: ["connection"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const solution = createMockSolution();
            const resolutionTime = 5000;

            await learnFromSuccess(config, problem, solution, resolutionTime);

            const patterns = await config.patternStorage.loadAllPatterns();
            expect(patterns.length).toBe(1);
            expect(patterns[0]!.successCount).toBe(1);
            expect(patterns[0]!.averageResolutionTime).toBe(resolutionTime);
        });

        it("should update existing pattern on repeated success", async () => {
            const problem: Problem = {
                id: "repeat-success",
                type: "connection",
                severity: "high",
                description: "Connection timeout error",
                userFriendlyDescription: "Connection timed out",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "http",
                    environment: "production",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: ["connection"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const solution = createMockSolution();

            // First success
            await learnFromSuccess(config, problem, solution, 5000);

            // Second success
            await learnFromSuccess(config, problem, solution, 3000);

            const patterns = await config.patternStorage.loadAllPatterns();
            expect(patterns.length).toBe(1);
            expect(patterns[0]!.successCount).toBe(2);
            expect(patterns[0]!.averageResolutionTime).toBe(4000); // Average of 5000 and 3000
        });

        it("should learn from failed fix application", async () => {
            const problem: Problem = {
                id: "learn-failure",
                type: "connection",
                severity: "high",
                description: "Connection timeout error",
                userFriendlyDescription: "Connection timed out",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "http",
                    environment: "production",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: ["connection"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const solution = createMockSolution();

            // First success to create pattern
            await learnFromSuccess(config, problem, solution, 5000);

            // Then failure
            await learnFromFailure(config, problem, solution);

            const patterns = await config.patternStorage.loadAllPatterns();
            expect(patterns.length).toBe(1);
            expect(patterns[0]!.failureCount).toBe(1);
            expect(patterns[0]!.confidence).toBe(0.5); // 1 success, 1 failure
        });

        it("should provide pattern-based solutions through resolver plugin", async () => {
            // Store a pattern
            await config.patternStorage.savePattern({
                id: "resolver-pattern",
                problemType: "connection",
                problemSignature: "connection error timeout",
                solution: createMockSolution(),
                successCount: 10,
                failureCount: 1,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.91,
            });

            const resolver = createPatternLearningResolver(config);

            const ctx: DevelopmentContext = {
                endpoint: "http://localhost:3000",
                conversationHistory: [
                    {
                        role: "user",
                        content: "I'm getting a connection error and timeout",
                        timestamp: Date.now(),
                    },
                ],
                projectContext: {
                    language: "typescript",
                    framework: "express",
                    environment: "development",
                },
            };

            const findings = await resolver.run(ctx);

            expect(findings.length).toBeGreaterThan(0);
            const matchFinding = findings.find((f) => f.id.includes("pattern-resolver.match"));
            expect(matchFinding).toBeDefined();
            expect(matchFinding?.confidence).toBeGreaterThan(0.7);
        });
    });

    describe("Persistence Across Sessions (Req 16.1, 16.4)", () => {
        it("should persist patterns across storage instances", async () => {
            // First session
            const storage1 = createSQLitePatternStorage(testDbPath);
            await storage1.savePattern({
                id: "persist-1",
                problemType: "connection",
                problemSignature: "connection timeout",
                solution: createMockSolution(),
                successCount: 5,
                failureCount: 1,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.83,
            });

            // Second session (simulated restart)
            const storage2 = createSQLitePatternStorage(testDbPath);
            const patterns = await storage2.loadAllPatterns();

            expect(patterns.length).toBe(1);
            expect(patterns[0]!.id).toBe("persist-1");
            expect(patterns[0]!.successCount).toBe(5);
        });

        it("should maintain encrypted data across sessions", async () => {
            const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

            // First session with encryption
            const storage1 = createSQLitePatternStorage(testDbPath, encryptionKey);
            await storage1.savePattern({
                id: "encrypted-1",
                problemType: "connection",
                problemSignature: "sensitive connection data",
                solution: createMockSolution(),
                successCount: 3,
                failureCount: 0,
                averageResolutionTime: 3000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 1.0,
            });

            // Second session with same key
            const storage2 = createSQLitePatternStorage(testDbPath, encryptionKey);
            const pattern = await storage2.loadPattern("encrypted-1");

            expect(pattern).not.toBeNull();
            expect(pattern!.id).toBe("encrypted-1");
        });

        it("should accumulate statistics across sessions", async () => {
            // First session
            const storage1 = createSQLitePatternStorage(testDbPath);
            await storage1.savePattern({
                id: "stats-1",
                problemType: "connection",
                problemSignature: "connection issue",
                solution: createMockSolution(),
                successCount: 5,
                failureCount: 1,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.83,
            });

            // Second session
            const storage2 = createSQLitePatternStorage(testDbPath);
            await storage2.savePattern({
                id: "stats-2",
                problemType: "protocol",
                problemSignature: "protocol error",
                solution: createMockSolution(),
                successCount: 3,
                failureCount: 0,
                averageResolutionTime: 3000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 1.0,
            });

            // Third session - verify accumulated stats
            const storage3 = createSQLitePatternStorage(testDbPath);
            const stats = await storage3.getPatternStatistics();

            expect(stats.totalPatterns).toBe(2);
            expect(stats.totalSuccesses).toBe(8);
            expect(stats.totalFailures).toBe(1);
        });
    });

    describe("Pattern Export/Import (Req 16.5)", () => {
        it("should export patterns with filters", async () => {
            await config.patternStorage.savePattern({
                id: "export-1",
                problemType: "connection",
                problemSignature: "connection error",
                solution: createMockSolution(),
                successCount: 10,
                failureCount: 1,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.91,
            });

            await config.patternStorage.savePattern({
                id: "export-2",
                problemType: "protocol",
                problemSignature: "protocol error",
                solution: createMockSolution(),
                successCount: 3,
                failureCount: 2,
                averageResolutionTime: 3000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.6,
            });

            const exported = await exportPatterns(config, {
                minConfidence: 0.8,
            });

            expect(exported.length).toBe(1);
            expect(exported[0]!.id).toBe("export-1");
        });

        it("should import patterns with merge strategy", async () => {
            // Existing pattern
            await config.patternStorage.savePattern({
                id: "existing",
                problemType: "connection",
                problemSignature: "connection timeout error",
                solution: createMockSolution(),
                successCount: 5,
                failureCount: 1,
                averageResolutionTime: 5000,
                lastUsed: Date.now(),
                userFeedback: [],
                confidence: 0.83,
            });

            // Import similar pattern
            const patternsToImport = [
                {
                    id: "imported",
                    problemType: "connection",
                    problemSignature: "connection timeout error",
                    solution: createMockSolution(),
                    successCount: 3,
                    failureCount: 0,
                    averageResolutionTime: 3000,
                    lastUsed: Date.now(),
                    userFeedback: [],
                    confidence: 1.0,
                },
            ];

            const result = await importPatterns(config, patternsToImport, "merge");

            expect(result.merged).toBe(1);
            expect(result.imported).toBe(0);

            const patterns = await config.patternStorage.loadAllPatterns();
            expect(patterns.length).toBe(1);
            expect(patterns[0]!.successCount).toBe(8); // 5 + 3
        });

        it("should import new patterns", async () => {
            const patternsToImport = [
                {
                    id: "new-pattern",
                    problemType: "performance",
                    problemSignature: "slow response time",
                    solution: createMockSolution(),
                    successCount: 7,
                    failureCount: 1,
                    averageResolutionTime: 8000,
                    lastUsed: Date.now(),
                    userFeedback: [],
                    confidence: 0.875,
                },
            ];

            const result = await importPatterns(config, patternsToImport, "merge");

            expect(result.imported).toBe(1);
            expect(result.merged).toBe(0);

            const patterns = await config.patternStorage.loadAllPatterns();
            expect(patterns.length).toBe(1);
            expect(patterns[0]!.id).toBe("new-pattern");
        });
    });
});

/**
 * Helper function to create a mock solution
 */
function createMockSolution(): Solution {
    return {
        id: `solution-${Date.now()}`,
        type: "automated",
        confidence: 0.9,
        description: "Fix connection timeout by increasing timeout value",
        userFriendlyDescription: "Increase connection timeout",
        steps: [
            {
                order: 1,
                description: "Update connection timeout configuration",
                userFriendlyDescription: "Update timeout setting",
                action: { type: "config-change", target: "timeout" },
                validation: { type: "test", criteria: "connection succeeds" },
                dependencies: [],
                estimatedDuration: "1m",
                canAutomate: true,
            },
        ],
        codeChanges: [
            {
                file: "config.ts",
                description: "Increase timeout value",
                content: "timeout: 30000",
                lineStart: 10,
                lineEnd: 10,
            },
        ],
        configChanges: [],
        testingStrategy: {
            type: "automated",
            tests: [],
        },
        rollbackPlan: {
            steps: ["Revert timeout to original value"],
        },
    };
}
