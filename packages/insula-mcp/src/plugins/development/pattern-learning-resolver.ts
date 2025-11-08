/**
 * Pattern Learning Problem Resolver
 * Requirements: 16.1, 16.3, 16.5
 * 
 * Integrates pattern learning with problem resolution for automatic solution application
 * and continuous learning from successful fixes.
 */

import type { EnhancedPatternMatcher, PatternMatch } from "../../learning/pattern-matcher.js";
import type { EnhancedPatternStorage, ResolutionPattern } from "../../storage/pattern-storage.js";
import type {
    CodeSample,
    DevelopmentContext,
    DevelopmentPlugin,
    Finding,
    Problem,
    Solution,
} from "../../types.js";

export interface PatternLearningConfig {
    patternStorage: EnhancedPatternStorage;
    patternMatcher: EnhancedPatternMatcher;
    minConfidence?: number; // Minimum confidence to auto-apply (default: 0.8)
    enableAutoApply?: boolean; // Enable automatic solution application (default: false)
    trackStatistics?: boolean; // Track pattern usage statistics (default: true)
}

/**
 * Create a Pattern Learning Problem Resolver plugin
 */
export function createPatternLearningResolver(
    config: PatternLearningConfig,
): DevelopmentPlugin {
    const {
        patternStorage,
        patternMatcher,
        minConfidence = 0.8,
        enableAutoApply = false,
        trackStatistics = true,
    } = config;

    return {
        id: "pattern-learning-resolver",
        title: "Pattern Learning Problem Resolver",
        category: "development",
        order: 11,
        requiresLlm: false, // Can work without LLM using learned patterns
        supportedLanguages: ["typescript", "javascript", "python", "go"],

        async run(ctx: DevelopmentContext): Promise<Finding[]> {
            const startTime = Date.now();
            const findings: Finding[] = [];

            try {
                // Extract problems from context
                const problems = await extractProblems(ctx);

                if (problems.length === 0) {
                    findings.push({
                        id: "pattern-resolver.no-problems",
                        area: "development",
                        severity: "info",
                        title: "No problems detected for pattern matching",
                        description: "No issues found that could benefit from pattern-based resolution",
                        evidence: [{ type: "log", ref: "pattern-resolver" }],
                    });
                    return findings;
                }

                // Load all patterns
                const allPatterns = await patternStorage.loadAllPatterns();

                if (allPatterns.length === 0) {
                    findings.push({
                        id: "pattern-resolver.no-patterns",
                        area: "development",
                        severity: "info",
                        title: "No learned patterns available",
                        description:
                            "Pattern learning system has no historical patterns yet. Solutions will be learned from successful fixes.",
                        evidence: [{ type: "log", ref: "pattern-resolver" }],
                        recommendation:
                            "Continue using the system to build up a knowledge base of successful solutions",
                    });
                    return findings;
                }

                // Match problems against patterns
                for (const problem of problems) {
                    const matches = await patternMatcher.findMatches(
                        problem,
                        allPatterns,
                        minConfidence,
                    );

                    if (matches.length === 0) {
                        findings.push({
                            id: `pattern-resolver.no-match.${problem.id}`,
                            area: "development",
                            severity: "info",
                            title: `No pattern match for: ${problem.description}`,
                            description: `No learned patterns match this problem with sufficient confidence (min: ${minConfidence})`,
                            evidence: problem.evidence,
                            recommendation:
                                "This appears to be a new type of problem. Once resolved, the solution will be learned for future use.",
                        });
                        continue;
                    }

                    // Process matches
                    for (let i = 0; i < Math.min(matches.length, 3); i++) {
                        const match = matches[i]!;
                        const finding = await createFindingFromMatch(
                            problem,
                            match,
                            i,
                            enableAutoApply,
                        );
                        findings.push(finding);

                        // Track pattern usage if enabled
                        if (trackStatistics) {
                            await patternStorage.updatePatternSuccess(
                                match.pattern.id,
                                match.pattern.averageResolutionTime,
                            );
                        }
                    }
                }

                // Add statistics summary if enabled
                if (trackStatistics && allPatterns.length > 0) {
                    const stats = await patternStorage.getPatternStatistics();
                    findings.push({
                        id: "pattern-resolver.statistics",
                        area: "learning",
                        severity: "info",
                        title: "Pattern Learning Statistics",
                        description: `Knowledge base contains ${stats.totalPatterns} patterns with ${stats.totalSuccesses} successful applications (${((stats.totalSuccesses / (stats.totalSuccesses + stats.totalFailures || 1)) * 100).toFixed(1)}% success rate)`,
                        evidence: [{ type: "log", ref: "pattern-statistics" }],
                        confidence: 1.0,
                        tags: ["statistics", "learning", "knowledge-base"],
                    });
                }

                // Performance check
                const duration = Date.now() - startTime;
                if (duration > 3000) {
                    findings.push({
                        id: "pattern-resolver.performance.slow",
                        area: "performance",
                        severity: "minor",
                        title: "Pattern matching exceeded time threshold",
                        description: `Pattern matching took ${duration}ms, exceeding 3s requirement`,
                        evidence: [{ type: "log", ref: "pattern-resolver" }],
                        confidence: 1.0,
                    });
                }
            } catch (error) {
                findings.push({
                    id: "pattern-resolver.error",
                    area: "development",
                    severity: "major",
                    title: "Pattern resolver encountered an error",
                    description: `Error during pattern matching: ${error instanceof Error ? error.message : String(error)}`,
                    evidence: [{ type: "log", ref: "pattern-resolver-error" }],
                });
            }

            return findings;
        },
    };
}

/**
 * Learn from a successful fix application
 */
export async function learnFromSuccess(
    config: PatternLearningConfig,
    problem: Problem,
    solution: Solution,
    resolutionTime: number,
): Promise<void> {
    const { patternStorage, patternMatcher } = config;

    // Extract problem signature
    const problemSignature = patternMatcher.extractProblemSignature(problem);

    // Check if pattern already exists
    const allPatterns = await patternStorage.loadAllPatterns();
    const existingPattern = allPatterns.find(
        (p) =>
            patternMatcher["calculateJaccardSimilarity"](p.problemSignature, problemSignature) >
            0.9,
    );

    if (existingPattern) {
        // Update existing pattern
        await patternStorage.updatePatternSuccess(existingPattern.id, resolutionTime);
    } else {
        // Create new pattern
        const newPattern: ResolutionPattern = {
            id: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            problemType: problem.type,
            problemSignature,
            solution,
            successCount: 1,
            failureCount: 0,
            averageResolutionTime: resolutionTime,
            lastUsed: Date.now(),
            userFeedback: [],
            confidence: 1.0,
        };

        await patternStorage.savePattern(newPattern);
    }
}

/**
 * Learn from a failed fix application
 */
export async function learnFromFailure(
    config: PatternLearningConfig,
    problem: Problem,
    solution: Solution,
): Promise<void> {
    const { patternStorage, patternMatcher } = config;

    // Extract problem signature
    const problemSignature = patternMatcher.extractProblemSignature(problem);

    // Find matching pattern
    const allPatterns = await patternStorage.loadAllPatterns();
    const existingPattern = allPatterns.find(
        (p) =>
            patternMatcher["calculateJaccardSimilarity"](p.problemSignature, problemSignature) >
            0.9 && p.solution.id === solution.id,
    );

    if (existingPattern) {
        await patternStorage.updatePatternFailure(existingPattern.id);
    }
}

/**
 * Export patterns for team sharing
 */
export async function exportPatterns(
    config: PatternLearningConfig,
    filters?: {
        minConfidence?: number;
        minSuccessCount?: number;
        problemTypes?: string[];
    },
): Promise<ResolutionPattern[]> {
    const { patternStorage } = config;

    let patterns = await patternStorage.loadAllPatterns();

    // Apply filters
    if (filters) {
        if (filters.minConfidence !== undefined) {
            patterns = patterns.filter((p) => p.confidence >= filters.minConfidence!);
        }

        if (filters.minSuccessCount !== undefined) {
            patterns = patterns.filter((p) => p.successCount >= filters.minSuccessCount!);
        }

        if (filters.problemTypes && filters.problemTypes.length > 0) {
            patterns = patterns.filter((p) => filters.problemTypes!.includes(p.problemType));
        }
    }

    return patterns;
}

/**
 * Import patterns from team sharing
 */
export async function importPatterns(
    config: PatternLearningConfig,
    patterns: ResolutionPattern[],
    mergeStrategy: "replace" | "merge" = "merge",
): Promise<{ imported: number; skipped: number; merged: number }> {
    const { patternStorage, patternMatcher } = config;

    let imported = 0;
    let skipped = 0;
    let merged = 0;

    const existingPatterns = await patternStorage.loadAllPatterns();

    for (const pattern of patterns) {
        // Check if similar pattern exists
        const similar = existingPatterns.find(
            (p) =>
                patternMatcher["calculateJaccardSimilarity"](
                    p.problemSignature,
                    pattern.problemSignature,
                ) > 0.9,
        );

        if (similar) {
            if (mergeStrategy === "merge") {
                // Merge statistics
                const mergedPattern: ResolutionPattern = {
                    ...similar,
                    successCount: similar.successCount + pattern.successCount,
                    failureCount: similar.failureCount + pattern.failureCount,
                    averageResolutionTime:
                        (similar.averageResolutionTime * similar.successCount +
                            pattern.averageResolutionTime * pattern.successCount) /
                        (similar.successCount + pattern.successCount),
                    confidence:
                        (similar.successCount + pattern.successCount) /
                        (similar.successCount +
                            similar.failureCount +
                            pattern.successCount +
                            pattern.failureCount),
                    userFeedback: [...similar.userFeedback, ...pattern.userFeedback],
                };

                await patternStorage.savePattern(mergedPattern);
                merged++;
            } else {
                skipped++;
            }
        } else {
            // Import new pattern
            await patternStorage.savePattern(pattern);
            imported++;
        }
    }

    return { imported, skipped, merged };
}

/**
 * Extract problems from development context
 */
async function extractProblems(ctx: DevelopmentContext): Promise<Problem[]> {
    const problems: Problem[] = [];
    const conversation = ctx.conversationHistory.map((m) => m.content.toLowerCase()).join(" ");

    // Detect error mentions
    if (conversation.includes("error") || conversation.includes("fail")) {
        problems.push({
            id: "error_detected",
            type: "code",
            severity: "high",
            description: "Error condition detected in conversation",
            userFriendlyDescription: "An error was reported that may need fixing",
            context: {
                mcpVersion: "2024-11-05",
                serverType: "unknown",
                environment: ctx.projectContext?.environment || "development",
                configuration: {},
                errorLogs: ctx.conversationHistory.map((m) => m.content),
            },
            evidence: [{ type: "log", ref: "conversation-history", data: conversation }],
            affectedComponents: [],
            suggestedSolutions: [],
            userLevel: "intermediate",
        });
    }

    // Detect connection issues
    if (
        conversation.includes("connect") &&
        (conversation.includes("fail") || conversation.includes("timeout"))
    ) {
        problems.push({
            id: "connection_failure",
            type: "connection",
            severity: "high",
            description: "Connection failure detected",
            userFriendlyDescription: "MCP connection issues reported",
            context: {
                mcpVersion: "2024-11-05",
                serverType: "unknown",
                environment: ctx.projectContext?.environment || "development",
                configuration: {},
                errorLogs: ctx.conversationHistory.map((m) => m.content),
            },
            evidence: [{ type: "log", ref: "conversation-history", data: conversation }],
            affectedComponents: ["connection", "network"],
            suggestedSolutions: [],
            userLevel: "intermediate",
        });
    }

    // Detect protocol issues
    if (conversation.includes("protocol") || conversation.includes("json-rpc")) {
        problems.push({
            id: "protocol_issue",
            type: "protocol",
            severity: "high",
            description: "Protocol-related issue detected",
            userFriendlyDescription: "MCP protocol compliance or communication issue",
            context: {
                mcpVersion: "2024-11-05",
                serverType: "unknown",
                environment: ctx.projectContext?.environment || "development",
                configuration: {},
                errorLogs: ctx.conversationHistory.map((m) => m.content),
            },
            evidence: [{ type: "log", ref: "conversation-history", data: conversation }],
            affectedComponents: ["protocol", "json-rpc"],
            suggestedSolutions: [],
            userLevel: "intermediate",
        });
    }

    return problems;
}

/**
 * Create a finding from a pattern match
 */
async function createFindingFromMatch(
    problem: Problem,
    match: PatternMatch,
    rank: number,
    enableAutoApply: boolean,
): Promise<Finding> {
    const { pattern, confidence, matchType, reasoning } = match;

    const title =
        rank === 0
            ? `Learned solution available (${(confidence * 100).toFixed(0)}% confidence)`
            : `Alternative solution #${rank + 1} (${(confidence * 100).toFixed(0)}% confidence)`;

    const description = `${reasoning}\n\nThis solution has been successfully applied ${pattern.successCount} times with an average resolution time of ${Math.round(pattern.averageResolutionTime / 1000)}s.`;

    // Convert solution to code samples
    const codeSamples: CodeSample[] = [];
    if (pattern.solution.codeChanges && pattern.solution.codeChanges.length > 0) {
        for (const change of pattern.solution.codeChanges.slice(0, 2)) {
            codeSamples.push({
                language: "typescript",
                title: change.description || "Code change",
                snippet: change.content || "// Code change details",
            });
        }
    }

    return {
        id: `pattern-resolver.match.${problem.id}.${rank}`,
        area: "problem-resolution",
        severity: rank === 0 ? "info" : "minor",
        title,
        description,
        evidence: problem.evidence,
        recommendation: pattern.solution.description,
        confidence,
        remediation: {
            steps: pattern.solution.steps.map((s) => s.description),
            codeSamples: codeSamples.length > 0 ? codeSamples : undefined,
            filePlan: pattern.solution.codeChanges?.map((c) => ({
                action: "update" as const,
                path: c.file || "unknown",
                description: c.description || "Apply learned fix",
            })),
        },
        tags: [
            "learned-pattern",
            matchType,
            `confidence-${Math.round(confidence * 10) * 10}`,
            `success-rate-${Math.round((pattern.successCount / (pattern.successCount + pattern.failureCount)) * 10) * 10}`,
            enableAutoApply && confidence >= 0.9 ? "auto-apply" : "manual-review",
        ],
    };
}
