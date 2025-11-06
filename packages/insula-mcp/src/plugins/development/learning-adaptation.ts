/**
 * Learning and Adaptation Plugin
 * Learns from successful problem resolutions and adapts recommendations
 * Requirements: 12.5, 9.4, 10.3
 */

import type {
    DevelopmentContext,
    DevelopmentPlugin,
    Finding,
    Solution
} from "../../types.js";

interface ResolutionPattern {
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

interface FeedbackEntry {
    timestamp: number;
    userId?: string;
    rating: number; // 1-5
    successful: boolean;
    comments?: string;
    context: Record<string, unknown>;
}

interface CommonIssuePattern {
    signature: string;
    occurrences: number;
    solutions: string[];
    contexts: string[];
    firstSeen: number;
    lastSeen: number;
}

export const LearningAdaptationPlugin: DevelopmentPlugin = {
    id: "learning-adaptation",
    title: "Learning and Adaptation System",
    category: "development",
    order: 13,
    requiresLlm: true,

    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];

        // Load learned patterns from storage
        const patterns = await loadResolutionPatterns(ctx);
        const commonIssues = await loadCommonIssues(ctx);

        // Analyze current context for pattern matches
        const matchedPatterns = findMatchingPatterns(ctx, patterns);

        if (matchedPatterns.length > 0) {
            findings.push({
                id: "learning.patterns.matched",
                area: "learning",
                severity: "info",
                title: `Found ${matchedPatterns.length} learned solution(s) for similar issues`,
                description: generatePatternMatchDescription(matchedPatterns),
                evidence: [{ type: "log", ref: "learning-system" }],
                confidence: calculateAverageConfidence(matchedPatterns),
                recommendation: generatePatternRecommendation(matchedPatterns),
                tags: ["learned-solution", "pattern-match", "adaptive"],
            });
        }

        // Identify common issues across sessions
        const detectedCommonIssues = detectCommonIssues(ctx, commonIssues);
        for (const issue of detectedCommonIssues) {
            findings.push({
                id: `learning.common.${issue.id}`,
                area: "learning",
                severity: "info",
                title: `Common issue detected: ${issue.title}`,
                description: issue.description,
                evidence: [{ type: "log", ref: "pattern-recognition" }],
                recommendation: issue.recommendation,
                tags: ["common-issue", "pattern-recognition"],
            });
        }

        // Analyze user feedback trends
        const feedbackInsights = analyzeFeedbackTrends(patterns);
        if (feedbackInsights.length > 0) {
            findings.push({
                id: "learning.feedback.insights",
                area: "learning",
                severity: "info",
                title: "Solution improvements based on user feedback",
                description: generateFeedbackInsights(feedbackInsights),
                evidence: [{ type: "log", ref: "feedback-analysis" }],
                recommendation:
                    "The system has adapted its recommendations based on user feedback",
                tags: ["feedback", "improvement", "adaptive"],
            });
        }

        // Suggest improvements for low-performing solutions
        const improvementSuggestions = identifyImprovementOpportunities(patterns);
        for (const suggestion of improvementSuggestions) {
            findings.push({
                id: `learning.improve.${suggestion.id}`,
                area: "learning",
                severity: "minor",
                title: suggestion.title,
                description: suggestion.description,
                evidence: [{ type: "log", ref: "improvement-analysis" }],
                recommendation: suggestion.recommendation,
                tags: ["improvement", "optimization"],
            });
        }

        return findings;
    },
};

async function loadResolutionPatterns(
    ctx: DevelopmentContext,
): Promise<ResolutionPattern[]> {
    // In a real implementation, this would load from persistent storage
    // For now, return empty array as baseline
    return [];
}

async function loadCommonIssues(
    ctx: DevelopmentContext,
): Promise<CommonIssuePattern[]> {
    // In a real implementation, this would load from persistent storage
    return [];
}

function findMatchingPatterns(
    ctx: DevelopmentContext,
    patterns: ResolutionPattern[],
): ResolutionPattern[] {
    const matches: ResolutionPattern[] = [];
    const conversationText = ctx.conversationHistory
        .map((m) => m.content.toLowerCase())
        .join(" ");

    for (const pattern of patterns) {
        const signature = pattern.problemSignature.toLowerCase();
        const keywords = signature.split(" ");

        // Check if conversation contains pattern keywords
        const matchCount = keywords.filter((kw) =>
            conversationText.includes(kw),
        ).length;
        const matchRatio = matchCount / keywords.length;

        // Consider it a match if >60% of keywords are present
        if (matchRatio > 0.6 && pattern.successCount > pattern.failureCount) {
            matches.push(pattern);
        }
    }

    // Sort by confidence and success rate
    return matches.sort((a, b) => {
        const scoreA = a.confidence * (a.successCount / (a.successCount + a.failureCount));
        const scoreB = b.confidence * (b.successCount / (b.successCount + b.failureCount));
        return scoreB - scoreA;
    });
}

function generatePatternMatchDescription(
    patterns: ResolutionPattern[],
): string {
    if (patterns.length === 0) return "No matching patterns found.";

    const topPattern = patterns.at(0);
    if (!topPattern) return "No matching patterns found.";

    const successRate =
        (topPattern.successCount /
            (topPattern.successCount + topPattern.failureCount)) *
        100;

    return `Based on ${topPattern.successCount} successful resolutions, I've identified a similar issue pattern. This solution has a ${successRate.toFixed(1)}% success rate and typically resolves in ${formatTime(topPattern.averageResolutionTime)}.`;
}

function calculateAverageConfidence(patterns: ResolutionPattern[]): number {
    if (patterns.length === 0) return 0;
    const sum = patterns.reduce((acc, p) => acc + p.confidence, 0);
    return sum / patterns.length;
}

function generatePatternRecommendation(
    patterns: ResolutionPattern[],
): string {
    const recommendations = patterns
        .slice(0, 3)
        .map((p, i) => {
            const successRate =
                (p.successCount / (p.successCount + p.failureCount)) * 100;
            return `${i + 1}. ${p.solution.userFriendlyDescription} (${successRate.toFixed(0)}% success rate)`;
        })
        .join("\n");

    return `Based on learned patterns, here are recommended approaches:\n\n${recommendations}`;
}

function detectCommonIssues(
    ctx: DevelopmentContext,
    commonIssues: CommonIssuePattern[],
): Array<{
    id: string;
    title: string;
    description: string;
    recommendation: string;
}> {
    const detected: Array<{
        id: string;
        title: string;
        description: string;
        recommendation: string;
    }> = [];
    const conversationText = ctx.conversationHistory
        .map((m) => m.content.toLowerCase())
        .join(" ");

    for (const issue of commonIssues) {
        if (conversationText.includes(issue.signature.toLowerCase())) {
            detected.push({
                id: issue.signature.replace(/\s+/g, "_"),
                title: `Frequently encountered: ${issue.signature}`,
                description: `This issue has been seen ${issue.occurrences} times across different sessions. Common contexts: ${issue.contexts.slice(0, 3).join(", ")}`,
                recommendation: `Recommended solutions based on past successes:\n${issue.solutions.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
            });
        }
    }

    return detected;
}

function analyzeFeedbackTrends(
    patterns: ResolutionPattern[],
): Array<{ pattern: string; trend: string; improvement: string }> {
    const insights: Array<{
        pattern: string;
        trend: string;
        improvement: string;
    }> = [];

    for (const pattern of patterns) {
        if (pattern.userFeedback.length < 3) continue;

        // Analyze recent feedback vs older feedback
        const recentFeedback = pattern.userFeedback
            .filter((f) => Date.now() - f.timestamp < 30 * 24 * 60 * 60 * 1000)
            .map((f) => f.rating);
        const olderFeedback = pattern.userFeedback
            .filter((f) => Date.now() - f.timestamp >= 30 * 24 * 60 * 60 * 1000)
            .map((f) => f.rating);

        if (recentFeedback.length > 0 && olderFeedback.length > 0) {
            const recentAvg =
                recentFeedback.reduce((a, b) => a + b, 0) / recentFeedback.length;
            const olderAvg =
                olderFeedback.reduce((a, b) => a + b, 0) / olderFeedback.length;
            const improvement = ((recentAvg - olderAvg) / olderAvg) * 100;

            if (Math.abs(improvement) > 10) {
                insights.push({
                    pattern: pattern.problemType,
                    trend: improvement > 0 ? "improving" : "declining",
                    improvement: `${Math.abs(improvement).toFixed(1)}%`,
                });
            }
        }
    }

    return insights;
}

function generateFeedbackInsights(
    insights: Array<{ pattern: string; trend: string; improvement: string }>,
): string {
    const improving = insights.filter((i) => i.trend === "improving");
    const declining = insights.filter((i) => i.trend === "declining");

    let description = "User feedback analysis:\n\n";

    if (improving.length > 0) {
        description += `✓ Improved solutions (${improving.length}):\n`;
        description += improving
            .map((i) => `  - ${i.pattern}: +${i.improvement} satisfaction`)
            .join("\n");
        description += "\n\n";
    }

    if (declining.length > 0) {
        description += `⚠ Solutions needing attention (${declining.length}):\n`;
        description += declining
            .map((i) => `  - ${i.pattern}: -${i.improvement} satisfaction`)
            .join("\n");
    }

    return description;
}

function identifyImprovementOpportunities(
    patterns: ResolutionPattern[],
): Array<{
    id: string;
    title: string;
    description: string;
    recommendation: string;
}> {
    const opportunities: Array<{
        id: string;
        title: string;
        description: string;
        recommendation: string;
    }> = [];

    for (const pattern of patterns) {
        const successRate =
            pattern.successCount / (pattern.successCount + pattern.failureCount);

        // Identify patterns with low success rates but high usage
        if (successRate < 0.7 && pattern.successCount + pattern.failureCount > 5) {
            opportunities.push({
                id: pattern.id,
                title: `Low success rate for ${pattern.problemType} solutions`,
                description: `This solution type has only ${(successRate * 100).toFixed(1)}% success rate across ${pattern.successCount + pattern.failureCount} attempts`,
                recommendation:
                    "Consider refining the solution approach or gathering more context before applying",
            });
        }

        // Identify patterns with negative feedback
        const avgRating =
            pattern.userFeedback.length > 0
                ? pattern.userFeedback.reduce((sum, f) => sum + f.rating, 0) /
                pattern.userFeedback.length
                : 0;

        if (avgRating > 0 && avgRating < 3 && pattern.userFeedback.length >= 3) {
            opportunities.push({
                id: `${pattern.id}_feedback`,
                title: `Low user satisfaction for ${pattern.problemType}`,
                description: `Average user rating: ${avgRating.toFixed(1)}/5.0 based on ${pattern.userFeedback.length} reviews`,
                recommendation:
                    "Review user feedback comments to identify specific pain points and improve the solution",
            });
        }
    }

    return opportunities;
}

function formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
}

// Export functions for pattern storage and feedback integration
export async function recordResolutionSuccess(
    problemSignature: string,
    solution: Solution,
    resolutionTime: number,
    ctx: DevelopmentContext,
): Promise<void> {
    // In a real implementation, this would persist to storage
    // For now, this is a placeholder for the storage interface
}

export async function recordResolutionFailure(
    problemSignature: string,
    solution: Solution,
    error: string,
    ctx: DevelopmentContext,
): Promise<void> {
    // In a real implementation, this would persist to storage
}

export async function recordUserFeedback(
    patternId: string,
    rating: number,
    successful: boolean,
    comments: string | undefined,
    ctx: DevelopmentContext,
): Promise<void> {
    // In a real implementation, this would persist to storage
}
