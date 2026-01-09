/**
 * Pattern Recognition System
 * Identifies common issues and solutions across sessions
 * Requirements: 10.3
 */

import { randomUUID } from "node:crypto";
import type {
  CommonIssuePattern,
  ResolutionPattern,
} from "../storage/pattern-storage.js";
import type { Problem, Solution } from "@brainwav/cortexdx-core";

export interface PatternMatcher {
  findSimilarProblems: (
    problem: Problem,
    patterns: ResolutionPattern[],
  ) => ResolutionPattern[];
  extractProblemSignature: (problem: Problem) => string;
  calculateSimilarity: (sig1: string, sig2: string) => number;
  identifyCommonPatterns: (problems: Problem[]) => CommonIssuePattern[];
}

export function createPatternMatcher(): PatternMatcher {
  return {
    findSimilarProblems(
      problem: Problem,
      patterns: ResolutionPattern[],
    ): ResolutionPattern[] {
      const signature = this.extractProblemSignature(problem);
      const matches: Array<{ pattern: ResolutionPattern; similarity: number }> =
        [];

      for (const pattern of patterns) {
        const similarity = this.calculateSimilarity(
          signature,
          pattern.problemSignature,
        );

        if (similarity > 0.6) {
          matches.push({ pattern, similarity });
        }
      }

      // Sort by similarity and confidence
      return matches
        .sort((a, b) => {
          const scoreA = a.similarity * a.pattern.confidence;
          const scoreB = b.similarity * b.pattern.confidence;
          return scoreB - scoreA;
        })
        .map((m) => m.pattern);
    },

    extractProblemSignature(problem: Problem): string {
      const components: string[] = [];

      // Include problem type
      components.push(problem.type);

      // Extract key terms from description
      const keywords = extractKeywords(problem.description);
      components.push(...keywords);

      // Include affected components
      components.push(...problem.affectedComponents);

      // Include error patterns from evidence
      for (const evidence of problem.evidence) {
        if (evidence.type === "log" && typeof evidence.data === "string") {
          const errorKeywords = extractErrorKeywords(evidence.data);
          components.push(...errorKeywords);
        }
      }

      return components.join(" ").toLowerCase();
    },

    calculateSimilarity(sig1: string, sig2: string): number {
      const tokens1 = new Set(sig1.toLowerCase().split(/\s+/));
      const tokens2 = new Set(sig2.toLowerCase().split(/\s+/));

      // Calculate Jaccard similarity
      const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
      const union = new Set([...tokens1, ...tokens2]);

      return intersection.size / union.size;
    },

    identifyCommonPatterns(problems: Problem[]): CommonIssuePattern[] {
      const signatureMap = new Map<string, Problem[]>();

      // Group problems by signature
      for (const problem of problems) {
        const signature = this.extractProblemSignature(problem);
        const existing = signatureMap.get(signature) || [];
        existing.push(problem);
        signatureMap.set(signature, existing);
      }

      // Identify patterns that occur multiple times
      const commonPatterns: CommonIssuePattern[] = [];

      for (const [signature, problemGroup] of signatureMap.entries()) {
        if (problemGroup.length >= 2) {
          const solutions = problemGroup
            .flatMap((p) =>
              p.suggestedSolutions.map((s) => s.solution.description),
            )
            .filter((s, i, arr) => arr.indexOf(s) === i);

          const contexts = problemGroup
            .map((p) => p.context.environment)
            .filter((c, i, arr) => arr.indexOf(c) === i);

          commonPatterns.push({
            signature,
            occurrences: problemGroup.length,
            solutions,
            contexts,
            firstSeen: Math.min(
              ...problemGroup.map(
                (p) => p.context.sessionContext?.startTime || Date.now(),
              ),
            ),
            lastSeen: Math.max(
              ...problemGroup.map(
                (p) => p.context.sessionContext?.lastActivity || Date.now(),
              ),
            ),
          });
        }
      }

      return commonPatterns.sort((a, b) => b.occurrences - a.occurrences);
    },
  };
}

function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "may",
    "might",
    "must",
    "can",
    "this",
    "that",
    "these",
    "those",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  // Return unique keywords
  return [...new Set(words)];
}

function extractErrorKeywords(logText: string): string[] {
  const errorPatterns = [
    /error:\s*(\w+)/gi,
    /exception:\s*(\w+)/gi,
    /failed\s+to\s+(\w+)/gi,
    /cannot\s+(\w+)/gi,
    /unable\s+to\s+(\w+)/gi,
    /timeout\s+(\w+)/gi,
    /connection\s+(\w+)/gi,
  ];

  const keywords: string[] = [];

  for (const pattern of errorPatterns) {
    const matches = logText.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        keywords.push(match[1].toLowerCase());
      }
    }
  }

  return [...new Set(keywords)];
}

export interface LearningEngine {
  learnFromSuccess: (
    problem: Problem,
    solution: Solution,
    resolutionTime: number,
  ) => Promise<void>;
  learnFromFailure: (
    problem: Problem,
    solution: Solution,
    error: string,
  ) => Promise<void>;
  getSuggestedSolutions: (problem: Problem) => Promise<Solution[]>;
  recordFeedback: (
    problemSignature: string,
    solutionId: string,
    rating: number,
    successful: boolean,
    comments?: string,
  ) => Promise<void>;
}

export function createLearningEngine(
  patterns: ResolutionPattern[],
  matcher: PatternMatcher,
): LearningEngine {
  return {
    async learnFromSuccess(
      problem: Problem,
      solution: Solution,
      resolutionTime: number,
    ): Promise<void> {
      const signature = matcher.extractProblemSignature(problem);

      // Find existing pattern or create new one
      const existingPattern = patterns.find(
        (p) => matcher.calculateSimilarity(p.problemSignature, signature) > 0.9,
      );

      if (existingPattern) {
        // Update existing pattern
        const totalTime =
          existingPattern.averageResolutionTime * existingPattern.successCount +
          resolutionTime;
        existingPattern.successCount += 1;
        existingPattern.averageResolutionTime =
          totalTime / existingPattern.successCount;
        existingPattern.lastUsed = Date.now();

        // Recalculate confidence
        const totalAttempts =
          existingPattern.successCount + existingPattern.failureCount;
        existingPattern.confidence =
          existingPattern.successCount / totalAttempts;
      } else {
        // Create new pattern
        patterns.push({
          id: `pattern_${randomUUID()}`,
          problemType: problem.type,
          problemSignature: signature,
          solution,
          successCount: 1,
          failureCount: 0,
          averageResolutionTime: resolutionTime,
          lastUsed: Date.now(),
          userFeedback: [],
          confidence: 1.0,
        });
      }
    },

    async learnFromFailure(
      problem: Problem,
      solution: Solution,
      error: string,
    ): Promise<void> {
      const signature = matcher.extractProblemSignature(problem);

      const existingPattern = patterns.find(
        (p) => matcher.calculateSimilarity(p.problemSignature, signature) > 0.9,
      );

      if (existingPattern) {
        existingPattern.failureCount += 1;
        existingPattern.lastUsed = Date.now();

        // Recalculate confidence
        const totalAttempts =
          existingPattern.successCount + existingPattern.failureCount;
        existingPattern.confidence =
          existingPattern.successCount / totalAttempts;
      }
    },

    async getSuggestedSolutions(problem: Problem): Promise<Solution[]> {
      const similarPatterns = matcher.findSimilarProblems(problem, patterns);

      return similarPatterns
        .filter((p) => p.confidence > 0.6)
        .slice(0, 5)
        .map((p) => p.solution);
    },

    async recordFeedback(
      problemSignature: string,
      solutionId: string,
      rating: number,
      successful: boolean,
      comments?: string,
    ): Promise<void> {
      const pattern = patterns.find(
        (p) =>
          matcher.calculateSimilarity(p.problemSignature, problemSignature) >
            0.9 && p.solution.id === solutionId,
      );

      if (pattern) {
        pattern.userFeedback.push({
          timestamp: Date.now(),
          rating,
          successful,
          comments,
          context: {},
        });

        // Adjust confidence based on feedback
        const recentFeedback = pattern.userFeedback
          .filter((f) => Date.now() - f.timestamp < 30 * 24 * 60 * 60 * 1000)
          .map((f) => f.rating);

        if (recentFeedback.length >= 3) {
          const avgRating =
            recentFeedback.reduce((a, b) => a + b, 0) / recentFeedback.length;
          const feedbackFactor = avgRating / 5.0;

          const successRate =
            pattern.successCount /
            (pattern.successCount + pattern.failureCount);
          pattern.confidence = successRate * 0.7 + feedbackFactor * 0.3;
        }
      }
    },
  };
}
