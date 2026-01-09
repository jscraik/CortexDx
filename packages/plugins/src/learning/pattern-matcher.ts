/**
 * Enhanced Pattern Matching System
 * Requirements: 16.2
 *
 * Provides structural and semantic matching strategies with confidence scoring
 * Target: 90% accuracy, <3s response time
 */

import type { ResolutionPattern } from "../storage/pattern-storage.js";
import type { Problem } from "@brainwav/cortexdx-core";

export interface PatternMatch {
  pattern: ResolutionPattern;
  confidence: number; // 0-1 scale
  similarity: number; // 0-1 scale
  matchType: "structural" | "semantic" | "hybrid";
  reasoning: string;
}

export interface MatchingStrategy {
  name: string;
  weight: number;
  match: (problem: Problem, pattern: ResolutionPattern) => number;
}

/**
 * Enhanced pattern matcher with multiple matching strategies
 */
export class EnhancedPatternMatcher {
  private strategies: MatchingStrategy[];

  constructor(strategies?: MatchingStrategy[]) {
    this.strategies = strategies || this.getDefaultStrategies();
  }

  /**
   * Find matching patterns for a problem with confidence scoring
   * Target: <3s response time, 90% accuracy
   */
  async findMatches(
    problem: Problem,
    patterns: ResolutionPattern[],
    minConfidence = 0.7,
  ): Promise<PatternMatch[]> {
    const startTime = Date.now();
    const matches: PatternMatch[] = [];

    for (const pattern of patterns) {
      // Calculate match score using all strategies
      const scores = this.strategies.map((strategy) => ({
        strategy: strategy.name,
        score: strategy.match(problem, pattern),
        weight: strategy.weight,
      }));

      // Weighted average of all strategy scores
      const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
      const weightedScore =
        scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;

      // Calculate confidence based on pattern history and match score
      const patternSuccessRate =
        pattern.successCount /
        (pattern.successCount + pattern.failureCount || 1);
      const confidence = weightedScore * 0.4 + patternSuccessRate * 0.6;

      if (confidence >= minConfidence) {
        const matchType = this.determineMatchType(scores);
        const reasoning = this.generateReasoning(scores, pattern);

        matches.push({
          pattern,
          confidence,
          similarity: weightedScore,
          matchType,
          reasoning,
        });
      }
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > 3000) {
      console.warn(
        `Pattern matching took ${elapsedTime}ms (target: <3000ms) for ${patterns.length} patterns`,
      );
    }

    return matches;
  }

  /**
   * Extract problem signature for matching
   */
  extractProblemSignature(problem: Problem): string {
    const components: string[] = [];

    // Include problem type
    components.push(problem.type);

    // Extract key terms from description
    const keywords = this.extractKeywords(problem.description);
    components.push(...keywords);

    // Include affected components
    components.push(...problem.affectedComponents);

    // Include error patterns from evidence
    for (const evidence of problem.evidence) {
      if (evidence.type === "log" && typeof evidence.data === "string") {
        const errorKeywords = this.extractErrorKeywords(evidence.data);
        components.push(...errorKeywords);
      }
    }

    return components.join(" ").toLowerCase();
  }

  /**
   * Default matching strategies
   */
  private getDefaultStrategies(): MatchingStrategy[] {
    return [
      {
        name: "problemType",
        weight: 0.2,
        match: (problem, pattern) => {
          return problem.type === pattern.problemType ? 1.0 : 0.0;
        },
      },
      {
        name: "textualSimilarity",
        weight: 0.3,
        match: (problem, pattern) => {
          const problemSig = this.extractProblemSignature(problem);
          return this.calculateJaccardSimilarity(
            problemSig,
            pattern.problemSignature,
          );
        },
      },
      {
        name: "componentOverlap",
        weight: 0.2,
        match: (problem, pattern) => {
          // Extract components from pattern signature
          const patternComponents = new Set(
            pattern.problemSignature.toLowerCase().split(/\s+/),
          );
          const problemComponents = new Set(
            problem.affectedComponents.map((c) => c.toLowerCase()),
          );

          const intersection = new Set(
            [...problemComponents].filter((c) => patternComponents.has(c)),
          );
          const union = new Set([...problemComponents, ...patternComponents]);

          return union.size > 0 ? intersection.size / union.size : 0;
        },
      },
      {
        name: "severityMatch",
        weight: 0.1,
        match: (problem, pattern) => {
          // Severity is encoded in problem signature
          const severityMatch = pattern.problemSignature
            .toLowerCase()
            .includes(problem.severity);
          return severityMatch ? 1.0 : 0.5;
        },
      },
      {
        name: "contextSimilarity",
        weight: 0.2,
        match: (problem, pattern) => {
          // Compare context features
          const problemContext = JSON.stringify(problem.context);
          const patternContext = pattern.problemSignature;

          // Check for common context elements
          const contextKeywords = this.extractKeywords(problemContext);
          const patternKeywords = new Set(
            patternContext.toLowerCase().split(/\s+/),
          );

          const matches = contextKeywords.filter((k) => patternKeywords.has(k));
          return contextKeywords.length > 0
            ? matches.length / contextKeywords.length
            : 0;
        },
      },
    ];
  }

  /**
   * Calculate Jaccard similarity between two text strings
   */
  calculateJaccardSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Determine match type based on strategy scores
   */
  private determineMatchType(
    scores: Array<{ strategy: string; score: number; weight: number }>,
  ): "structural" | "semantic" | "hybrid" {
    const structuralStrategies = [
      "problemType",
      "componentOverlap",
      "severityMatch",
    ];
    const semanticStrategies = ["textualSimilarity", "contextSimilarity"];

    const structuralScore =
      scores
        .filter((s) => structuralStrategies.includes(s.strategy))
        .reduce((sum, s) => sum + s.score * s.weight, 0) /
      scores
        .filter((s) => structuralStrategies.includes(s.strategy))
        .reduce((sum, s) => sum + s.weight, 0);

    const semanticScore =
      scores
        .filter((s) => semanticStrategies.includes(s.strategy))
        .reduce((sum, s) => sum + s.score * s.weight, 0) /
      scores
        .filter((s) => semanticStrategies.includes(s.strategy))
        .reduce((sum, s) => sum + s.weight, 0);

    if (structuralScore > 0.7 && semanticScore > 0.7) {
      return "hybrid";
    }
    if (structuralScore > semanticScore) {
      return "structural";
    }
    return "semantic";
  }

  /**
   * Generate human-readable reasoning for the match
   */
  private generateReasoning(
    scores: Array<{ strategy: string; score: number; weight: number }>,
    pattern: ResolutionPattern,
  ): string {
    const topScores = scores
      .filter((s) => s.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (topScores.length === 0) {
      return "Low confidence match based on general similarity";
    }

    const reasons: string[] = [];

    for (const score of topScores) {
      switch (score.strategy) {
        case "problemType":
          reasons.push(`same problem type (${pattern.problemType})`);
          break;
        case "textualSimilarity":
          reasons.push(
            `high textual similarity (${(score.score * 100).toFixed(0)}%)`,
          );
          break;
        case "componentOverlap":
          reasons.push(
            `overlapping affected components (${(score.score * 100).toFixed(0)}%)`,
          );
          break;
        case "severityMatch":
          reasons.push("matching severity level");
          break;
        case "contextSimilarity":
          reasons.push(`similar context (${(score.score * 100).toFixed(0)}%)`);
          break;
      }
    }

    const successRate =
      pattern.successCount / (pattern.successCount + pattern.failureCount || 1);
    reasons.push(
      `pattern has ${(successRate * 100).toFixed(0)}% success rate (${pattern.successCount} successes)`,
    );

    return `Match based on: ${reasons.join(", ")}`;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text?: string): string[] {
    if (!text) {
      return [];
    }
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

    return [...new Set(words)];
  }

  /**
   * Extract error keywords from log text
   */
  private extractErrorKeywords(logText: string): string[] {
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
}

/**
 * Create an enhanced pattern matcher instance
 */
export function createEnhancedPatternMatcher(
  strategies?: MatchingStrategy[],
): EnhancedPatternMatcher {
  return new EnhancedPatternMatcher(strategies);
}
