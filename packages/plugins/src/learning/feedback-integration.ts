/**
 * User Feedback Integration System
 * Collects and integrates user feedback to improve solutions
 * Requirements: 9.4
 */

import type { FeedbackEntry } from "../storage/pattern-storage.js";
import type { Solution } from "@brainwav/cortexdx-core";

export interface FeedbackCollector {
  collectFeedback: (
    solutionId: string,
    rating: number,
    successful: boolean,
    comments?: string,
    context?: Record<string, unknown>,
  ) => Promise<void>;
  analyzeFeedback: (solutionId: string) => Promise<FeedbackAnalysis>;
  getSolutionImprovements: (
    solutionId: string,
  ) => Promise<SolutionImprovement[]>;
}

export interface FeedbackAnalysis {
  totalFeedback: number;
  averageRating: number;
  successRate: number;
  commonIssues: string[];
  positiveAspects: string[];
  improvementAreas: string[];
  trend: "improving" | "stable" | "declining";
}

export interface SolutionImprovement {
  type:
    | "step_clarification"
    | "additional_validation"
    | "better_error_handling"
    | "performance_optimization";
  description: string;
  priority: "high" | "medium" | "low";
  basedOnFeedback: string[];
}

export function createFeedbackCollector(
  feedbackStore: Map<string, FeedbackEntry[]>,
): FeedbackCollector {
  return {
    async collectFeedback(
      solutionId: string,
      rating: number,
      successful: boolean,
      comments?: string,
      context?: Record<string, unknown>,
    ): Promise<void> {
      const feedback: FeedbackEntry = {
        timestamp: Date.now(),
        rating,
        successful,
        comments,
        context: context || {},
      };

      const existing = feedbackStore.get(solutionId) || [];
      existing.push(feedback);
      feedbackStore.set(solutionId, existing);
    },

    async analyzeFeedback(solutionId: string): Promise<FeedbackAnalysis> {
      const feedback = feedbackStore.get(solutionId) || [];

      if (feedback.length === 0) {
        return {
          totalFeedback: 0,
          averageRating: 0,
          successRate: 0,
          commonIssues: [],
          positiveAspects: [],
          improvementAreas: [],
          trend: "stable",
        };
      }

      const totalFeedback = feedback.length;
      const averageRating =
        feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback;
      const successRate =
        feedback.filter((f) => f.successful).length / totalFeedback;

      // Extract common themes from comments
      const comments = feedback
        .filter((f) => f.comments)
        .map((f) => f.comments as string);
      const commonIssues = extractCommonThemes(
        comments.filter(
          (c) =>
            c.toLowerCase().includes("issue") ||
            c.toLowerCase().includes("problem"),
        ),
      );
      const positiveAspects = extractCommonThemes(
        comments.filter(
          (c) =>
            c.toLowerCase().includes("good") ||
            c.toLowerCase().includes("helpful"),
        ),
      );
      const improvementAreas = extractCommonThemes(
        comments.filter(
          (c) =>
            c.toLowerCase().includes("could") ||
            c.toLowerCase().includes("should"),
        ),
      );

      // Determine trend
      const trend = calculateTrend(feedback);

      return {
        totalFeedback,
        averageRating,
        successRate,
        commonIssues,
        positiveAspects,
        improvementAreas,
        trend,
      };
    },

    async getSolutionImprovements(
      solutionId: string,
    ): Promise<SolutionImprovement[]> {
      const analysis = await this.analyzeFeedback(solutionId);
      const improvements: SolutionImprovement[] = [];

      // Analyze feedback for improvement opportunities
      if (analysis.successRate < 0.7) {
        improvements.push({
          type: "additional_validation",
          description:
            "Add more validation steps to ensure prerequisites are met before applying solution",
          priority: "high",
          basedOnFeedback: analysis.commonIssues,
        });
      }

      if (analysis.averageRating < 3.5) {
        improvements.push({
          type: "step_clarification",
          description:
            "Provide more detailed explanations for each step to improve clarity",
          priority: "high",
          basedOnFeedback: analysis.improvementAreas,
        });
      }

      // Check for specific improvement themes
      const needsBetterErrors = analysis.improvementAreas.some((area) =>
        area.toLowerCase().includes("error"),
      );
      if (needsBetterErrors) {
        improvements.push({
          type: "better_error_handling",
          description:
            "Improve error messages and recovery guidance when solution steps fail",
          priority: "medium",
          basedOnFeedback: analysis.improvementAreas.filter((a) =>
            a.toLowerCase().includes("error"),
          ),
        });
      }

      const needsPerformance = analysis.improvementAreas.some(
        (area) =>
          area.toLowerCase().includes("slow") ||
          area.toLowerCase().includes("time"),
      );
      if (needsPerformance) {
        improvements.push({
          type: "performance_optimization",
          description: "Optimize solution steps to reduce execution time",
          priority: "medium",
          basedOnFeedback: analysis.improvementAreas.filter(
            (a) =>
              a.toLowerCase().includes("slow") ||
              a.toLowerCase().includes("time"),
          ),
        });
      }

      return improvements.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    },
  };
}

function extractCommonThemes(comments: string[]): string[] {
  if (comments.length === 0) return [];

  // Simple keyword extraction
  const wordFrequency = new Map<string, number>();

  for (const comment of comments) {
    const words = comment
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4);

    for (const word of words) {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    }
  }

  // Return words that appear in multiple comments
  const threshold = Math.max(2, Math.floor(comments.length * 0.3));
  return Array.from(wordFrequency.entries())
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function calculateTrend(
  feedback: FeedbackEntry[],
): "improving" | "stable" | "declining" {
  if (feedback.length < 6) return "stable";

  // Split feedback into older and recent halves
  const midpoint = Math.floor(feedback.length / 2);
  const older = feedback.slice(0, midpoint);
  const recent = feedback.slice(midpoint);

  const olderAvg = older.reduce((sum, f) => sum + f.rating, 0) / older.length;
  const recentAvg =
    recent.reduce((sum, f) => sum + f.rating, 0) / recent.length;

  const change = recentAvg - olderAvg;

  if (change > 0.5) return "improving";
  if (change < -0.5) return "declining";
  return "stable";
}

export interface AdaptiveSolutionGenerator {
  adaptSolution: (
    originalSolution: Solution,
    feedback: FeedbackAnalysis,
    improvements: SolutionImprovement[],
  ) => Solution;
}

export function createAdaptiveSolutionGenerator(): AdaptiveSolutionGenerator {
  return {
    adaptSolution(
      originalSolution: Solution,
      feedback: FeedbackAnalysis,
      improvements: SolutionImprovement[],
    ): Solution {
      const adaptedSolution = { ...originalSolution };

      // Adjust confidence based on feedback
      const feedbackFactor = feedback.averageRating / 5.0;
      const successFactor = feedback.successRate;
      adaptedSolution.confidence =
        originalSolution.confidence * 0.5 +
        feedbackFactor * 0.25 +
        successFactor * 0.25;

      // Add improvement notes to description
      if (improvements.length > 0) {
        const improvementNotes = improvements
          .filter((i) => i.priority === "high")
          .map((i) => i.description)
          .join("\n");

        if (improvementNotes) {
          adaptedSolution.userFriendlyDescription += `\n\nNote: Based on user feedback, ${improvementNotes.toLowerCase()}`;
        }
      }

      // Enhance steps based on feedback
      if (feedback.improvementAreas.includes("clarity")) {
        adaptedSolution.steps = adaptedSolution.steps.map((step) => ({
          ...step,
          userFriendlyDescription: `${step.userFriendlyDescription}\n(This step has been clarified based on user feedback)`,
        }));
      }

      return adaptedSolution;
    },
  };
}
