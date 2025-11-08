/**
 * RAG System Tests
 * Tests for embeddings and semantic search functionality
 * Requirements: 12.5, 10.2
 */

import { describe, expect, it } from "vitest";
import { cosineSimilarity, normalizeVector } from "../src/adapters/embedding.js";
import { createPatternMatcher } from "../src/learning/pattern-recognition.js";
import { createRagSystem } from "../src/learning/rag-system.js";
import { createInMemoryStorage } from "../src/storage/pattern-storage.js";
import { createVectorStorage } from "../src/storage/vector-storage.js";
import type { Problem, Solution } from "../src/types.js";

describe("RAG System", () => {
    describe("Vector Operations", () => {
        it("should calculate cosine similarity correctly", () => {
            const vec1 = [1, 0, 0];
            const vec2 = [1, 0, 0];
            const vec3 = [0, 1, 0];

            expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0);
            expect(cosineSimilarity(vec1, vec3)).toBeCloseTo(0.0);
        });

        it("should normalize vectors correctly", () => {
            const vec = [3, 4];
            const normalized = normalizeVector(vec);

            expect(normalized[0]).toBeCloseTo(0.6);
            expect(normalized[1]).toBeCloseTo(0.8);

            // Normalized vector should have length 1
            const length = Math.sqrt(
                normalized.reduce((sum, val) => sum + val * val, 0),
            );
            expect(length).toBeCloseTo(1.0);
        });
    });

    describe("Vector Storage", () => {
        it("should store and retrieve documents", async () => {
            const storage = createVectorStorage();

            const doc = {
                id: "test-1",
                embedding: {
                    values: [1, 0, 0],
                    dimensions: 3,
                    model: "test",
                    timestamp: Date.now(),
                },
                metadata: {
                    type: "problem" as const,
                    text: "Test problem",
                    context: {},
                },
                timestamp: Date.now(),
            };

            await storage.addDocument(doc);

            const retrieved = await storage.getDocument("test-1");
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe("test-1");
        });

        it("should search for similar documents", async () => {
            const storage = createVectorStorage();

            // Add some test documents
            await storage.addDocument({
                id: "doc-1",
                embedding: {
                    values: [1, 0, 0],
                    dimensions: 3,
                    model: "test",
                    timestamp: Date.now(),
                },
                metadata: {
                    type: "problem" as const,
                    text: "Connection error",
                    context: {},
                },
                timestamp: Date.now(),
            });

            await storage.addDocument({
                id: "doc-2",
                embedding: {
                    values: [0.9, 0.1, 0],
                    dimensions: 3,
                    model: "test",
                    timestamp: Date.now(),
                },
                metadata: {
                    type: "problem" as const,
                    text: "Network timeout",
                    context: {},
                },
                timestamp: Date.now(),
            });

            await storage.addDocument({
                id: "doc-3",
                embedding: {
                    values: [0, 1, 0],
                    dimensions: 3,
                    model: "test",
                    timestamp: Date.now(),
                },
                metadata: {
                    type: "solution" as const,
                    text: "Unrelated solution",
                    context: {},
                },
                timestamp: Date.now(),
            });

            // Search for similar documents
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
            expect(results[0]?.document.id).toBe("doc-1");
            expect(results[0]?.similarity).toBeGreaterThan(0.9);
        });

        it("should filter by document type", async () => {
            const storage = createVectorStorage();

            await storage.addDocument({
                id: "problem-1",
                embedding: {
                    values: [1, 0, 0],
                    dimensions: 3,
                    model: "test",
                    timestamp: Date.now(),
                },
                metadata: {
                    type: "problem" as const,
                    text: "Test problem",
                    context: {},
                },
                timestamp: Date.now(),
            });

            await storage.addDocument({
                id: "solution-1",
                embedding: {
                    values: [1, 0, 0],
                    dimensions: 3,
                    model: "test",
                    timestamp: Date.now(),
                },
                metadata: {
                    type: "solution" as const,
                    text: "Test solution",
                    context: {},
                },
                timestamp: Date.now(),
            });

            const queryEmbedding = {
                values: [1, 0, 0],
                dimensions: 3,
                model: "test",
                timestamp: Date.now(),
            };

            const problemResults = await storage.search(queryEmbedding, {
                filterType: "problem",
            });

            expect(problemResults.length).toBe(1);
            expect(problemResults[0]?.document.metadata.type).toBe("problem");
        });

        it("should get storage statistics", async () => {
            const storage = createVectorStorage();

            await storage.addDocument({
                id: "doc-1",
                embedding: {
                    values: [1, 0, 0],
                    dimensions: 3,
                    model: "test",
                    timestamp: Date.now(),
                },
                metadata: {
                    type: "problem" as const,
                    text: "Test",
                    context: {},
                },
                timestamp: Date.now(),
            });

            const stats = storage.getStats();

            expect(stats.totalDocuments).toBe(1);
            expect(stats.documentsByType.problem).toBe(1);
            expect(stats.averageEmbeddingDimensions).toBe(3);
        });
    });

    describe("RAG System Integration", () => {
        it("should initialize RAG system", async () => {
            const vectorStorage = createVectorStorage();
            const patternStorage = createInMemoryStorage();
            const patternMatcher = createPatternMatcher();

            const ragSystem = createRagSystem(
                vectorStorage,
                patternStorage,
                patternMatcher,
                {
                    embeddingBackend: "mlx",
                },
            );

            await ragSystem.initialize();

            const stats = await ragSystem.getStats();
            expect(stats).toBeDefined();
            expect(stats.totalProblems).toBe(0);
            expect(stats.totalSolutions).toBe(0);
            expect(stats.totalPatterns).toBe(0);
        });

        it("should index problems and solutions", async () => {
            const vectorStorage = createVectorStorage();
            const patternStorage = createInMemoryStorage();
            const patternMatcher = createPatternMatcher();

            const ragSystem = createRagSystem(
                vectorStorage,
                patternStorage,
                patternMatcher,
                {
                    embeddingBackend: "mlx",
                },
            );

            await ragSystem.initialize();

            const problem: Problem = {
                id: "test-problem-1",
                type: "protocol",
                severity: "medium",
                description: "Connection timeout error",
                userFriendlyDescription: "The connection timed out",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "test",
                    environment: "test",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: ["network"],
                suggestedSolutions: [],
                userLevel: "intermediate",
            };

            const solution: Solution = {
                id: "test-solution-1",
                type: "automated",
                confidence: 0.9,
                description: "Increase timeout value",
                userFriendlyDescription: "Increase the timeout",
                steps: [],
                codeChanges: [],
                configChanges: [],
                testingStrategy: {
                    automated: true,
                    testCases: [],
                },
                rollbackPlan: {
                    steps: [],
                    backupRequired: false,
                },
            };

            await ragSystem.indexProblem(problem);
            await ragSystem.indexSolution(solution, problem);

            const stats = await ragSystem.getStats();
            expect(stats.totalProblems).toBe(1);
            expect(stats.totalSolutions).toBe(1);
        });

        it("should learn from successful resolutions", async () => {
            const vectorStorage = createVectorStorage();
            const patternStorage = createInMemoryStorage();
            const patternMatcher = createPatternMatcher();

            const ragSystem = createRagSystem(
                vectorStorage,
                patternStorage,
                patternMatcher,
                {
                    embeddingBackend: "mlx",
                },
            );

            await ragSystem.initialize();

            const problem: Problem = {
                id: "test-problem-2",
                type: "configuration",
                severity: "high",
                description: "Invalid configuration parameter",
                userFriendlyDescription: "Configuration is invalid",
                context: {
                    mcpVersion: "2024-11-05",
                    serverType: "test",
                    environment: "test",
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: ["config"],
                suggestedSolutions: [],
                userLevel: "beginner",
            };

            const solution: Solution = {
                id: "test-solution-2",
                type: "automated",
                confidence: 0.95,
                description: "Fix configuration parameter",
                userFriendlyDescription: "Fix the config",
                steps: [],
                codeChanges: [],
                configChanges: [],
                testingStrategy: {
                    automated: true,
                    testCases: [],
                },
                rollbackPlan: {
                    steps: [],
                    backupRequired: false,
                },
            };

            await ragSystem.learnFromSuccess(problem, solution, 5000);

            const stats = await ragSystem.getStats();
            expect(stats.totalProblems).toBe(1);
            expect(stats.totalSolutions).toBe(1);
            expect(stats.totalPatterns).toBe(1);
        });
    });
});
