/**
 * Pattern Storage Interface
 * Persistent storage for learned resolution patterns and user feedback
 * Requirements: 12.5, 9.4
 */

import type { Solution } from "../types.js";

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
    updatePatternSuccess: (
        id: string,
        resolutionTime: number,
    ) => Promise<void>;
    updatePatternFailure: (id: string) => Promise<void>;
    addFeedback: (id: string, feedback: FeedbackEntry) => Promise<void>;
    saveCommonIssue: (issue: CommonIssuePattern) => Promise<void>;
    loadCommonIssues: () => Promise<CommonIssuePattern[]>;
    updateCommonIssue: (signature: string, context: string) => Promise<void>;
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
                pattern.confidence = (successRate * 0.7 + feedbackFactor * 0.3);
            }

            patterns.set(id, pattern);
        },

        async saveCommonIssue(issue: CommonIssuePattern): Promise<void> {
            commonIssues.set(issue.signature, { ...issue });
        },

        async loadCommonIssues(): Promise<CommonIssuePattern[]> {
            return Array.from(commonIssues.values());
        },

        async updateCommonIssue(
            signature: string,
            context: string,
        ): Promise<void> {
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
