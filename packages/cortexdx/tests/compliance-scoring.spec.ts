/**
 * Compliance Scoring Tests
 */

import { describe, it, expect } from "vitest";
import {
  calculateComplianceScore,
  sortFindings,
  getScoreDescription,
  calculateScoreDiff,
  validateScoringConfig,
  SCORING_PENALTIES,
  SCORING_CONFIG,
  GRADE_THRESHOLDS,
  type SortableFinding,
} from "../src/probe/compliance-scoring";

describe("compliance-scoring", () => {
  describe("SCORING_CONFIG", () => {
    it("should have valid penalty structure", () => {
      expect(SCORING_PENALTIES.blocker).toBeGreaterThanOrEqual(
        SCORING_PENALTIES.major,
      );
      expect(SCORING_PENALTIES.major).toBeGreaterThanOrEqual(
        SCORING_PENALTIES.minor,
      );
      expect(SCORING_PENALTIES.minor).toBeGreaterThanOrEqual(
        SCORING_PENALTIES.info,
      );
    });

    it("should have valid score bounds", () => {
      expect(SCORING_CONFIG.MIN_SCORE).toBeGreaterThanOrEqual(0);
      expect(SCORING_CONFIG.MAX_SCORE).toBeLessThanOrEqual(100);
      expect(SCORING_CONFIG.MIN_SCORE).toBeLessThan(SCORING_CONFIG.MAX_SCORE);
    });
  });

  describe("validateScoringConfig", () => {
    it("should validate correct configuration", () => {
      const result = validateScoringConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe("sortFindings", () => {
    it("should sort by severity first", () => {
      const findings: SortableFinding[] = [
        { severity: "minor", area: "X", title: "A" },
        { severity: "blocker", area: "Y", title: "Z" },
        { severity: "major", area: "W", title: "M" },
      ];

      const sorted = sortFindings(findings);
      expect(sorted[0].severity).toBe("blocker");
      expect(sorted[1].severity).toBe("major");
      expect(sorted[2].severity).toBe("minor");
    });

    it("should sort by area within same severity", () => {
      const findings: SortableFinding[] = [
        { severity: "major", area: "Z", title: "A" },
        { severity: "major", area: "A", title: "Z" },
        { severity: "major", area: "M", title: "M" },
      ];

      const sorted = sortFindings(findings);
      expect(sorted[0].area).toBe("A");
      expect(sorted[1].area).toBe("M");
      expect(sorted[2].area).toBe("Z");
    });

    it("should sort by title within same area and severity", () => {
      const findings: SortableFinding[] = [
        { severity: "major", area: "Security", title: "Z" },
        { severity: "major", area: "Security", title: "A" },
        { severity: "major", area: "Security", title: "M" },
      ];

      const sorted = sortFindings(findings);
      expect(sorted[0].title).toBe("A");
      expect(sorted[1].title).toBe("M");
      expect(sorted[2].title).toBe("Z");
    });

    it("should not mutate original array", () => {
      const findings: SortableFinding[] = [
        { severity: "minor", area: "X", title: "A" },
        { severity: "blocker", area: "Y", title: "Z" },
      ];

      const originalOrder = findings.map((f) => f.severity);
      sortFindings(findings);

      expect(findings.map((f) => f.severity)).toEqual(originalOrder);
    });
  });

  describe("calculateComplianceScore", () => {
    it("should return perfect score for no findings", () => {
      const result = calculateComplianceScore([]);

      expect(result.score).toBe(100);
      expect(result.compliant).toBe(true);
      expect(result.grade).toBe("A");
      expect(result.counts).toEqual({
        blocker: 0,
        major: 0,
        minor: 0,
        info: 0,
      });
    });

    it("should deduct for blocker findings", () => {
      const result = calculateComplianceScore([
        { severity: "blocker", area: "Security", title: "Auth bypass" },
      ]);

      expect(result.score).toBe(100 - SCORING_PENALTIES.blocker);
      expect(result.compliant).toBe(false);
      expect(result.grade).not.toBe("A");
    });

    it("should deduct for major findings", () => {
      const result = calculateComplianceScore([
        { severity: "major", area: "Protocol", title: "Missing version" },
        { severity: "major", area: "Tools", title: "No schema" },
      ]);

      expect(result.score).toBe(100 - 2 * SCORING_PENALTIES.major);
    });

    it("should deduct for minor findings", () => {
      const result = calculateComplianceScore([
        { severity: "minor", area: "Docs", title: "Missing description" },
        { severity: "minor", area: "Style", title: "Inconsistent naming" },
      ]);

      expect(result.score).toBe(100 - 2 * SCORING_PENALTIES.minor);
    });

    it("should not deduct for info findings", () => {
      const result = calculateComplianceScore([
        { severity: "info", area: "Info", title: "Informational" },
      ]);

      expect(result.score).toBe(100);
    });

    it("should clamp score to valid range", () => {
      // Many blockers should not go below 0
      const result = calculateComplianceScore(
        Array(10).fill({ severity: "blocker" as const, area: "X", title: "Y" }),
      );

      expect(result.score).toBe(SCORING_CONFIG.MIN_SCORE);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("should mark compliant when no blockers and <= 2 majors", () => {
      const result = calculateComplianceScore([
        { severity: "major", area: "X", title: "A" },
        { severity: "major", area: "Y", title: "B" },
      ]);

      expect(result.compliant).toBe(true);
    });

    it("should mark non-compliant when > 2 majors", () => {
      const result = calculateComplianceScore([
        { severity: "major", area: "X", title: "A" },
        { severity: "major", area: "Y", title: "B" },
        { severity: "major", area: "Z", title: "C" },
      ]);

      expect(result.compliant).toBe(false);
    });

    it("should mark non-compliant when blockers present", () => {
      const result = calculateComplianceScore([
        { severity: "blocker", area: "Security", title: "Critical" },
      ]);

      expect(result.compliant).toBe(false);
    });

    it("should assign correct grades", () => {
      expect(calculateComplianceScore([]).grade).toBe("A");
      expect(
        calculateComplianceScore([{ severity: "minor", area: "X", title: "Y" }])
          .grade,
      ).toBe("A");
      // Single major finding: score = 90, which is still A (90+ threshold)
      expect(
        calculateComplianceScore([{ severity: "major", area: "X", title: "Y" }])
          .grade,
      ).toBe("A");
      // Two major findings: score = 80, which is B (70+ threshold)
      expect(
        calculateComplianceScore([
          { severity: "major", area: "X", title: "Y" },
          { severity: "major", area: "Z", title: "W" },
        ]).grade,
      ).toBe("B");
      // Single blocker: score = 70, which is B (70+ threshold, but not compliant)
      expect(
        calculateComplianceScore([
          { severity: "blocker", area: "X", title: "Y" },
        ]).grade,
      ).toBe("B");
      // Two blockers: score = 40, which is F (<50 threshold)
      expect(
        calculateComplianceScore([
          { severity: "blocker", area: "X", title: "Y" },
          { severity: "blocker", area: "Z", title: "W" },
        ]).grade,
      ).toBe("F");
    });

    it("should include version in result", () => {
      const result = calculateComplianceScore([]);

      expect(result.version).toBe(SCORING_CONFIG.VERSION);
    });
  });

  describe("reproducibility", () => {
    it("should produce same score regardless of finding order", () => {
      const findings1: SortableFinding[] = [
        { severity: "minor", area: "A", title: "1" },
        { severity: "blocker", area: "B", title: "2" },
        { severity: "major", area: "C", title: "3" },
      ];

      const findings2: SortableFinding[] = [
        { severity: "major", area: "C", title: "3" },
        { severity: "minor", area: "A", title: "1" },
        { severity: "blocker", area: "B", title: "2" },
      ];

      const score1 = calculateComplianceScore(findings1);
      const score2 = calculateComplianceScore(findings2);

      expect(score1.score).toBe(score2.score);
      expect(score1.grade).toBe(score2.grade);
      expect(score1.compliant).toBe(score2.compliant);
    });

    it("should produce deterministic results across multiple runs", () => {
      const findings: SortableFinding[] = [
        { severity: "major", area: "Security", title: "Missing auth" },
        { severity: "minor", area: "Docs", title: "No description" },
        { severity: "blocker", area: "Protocol", title: "Wrong version" },
      ];

      const scores = Array(10)
        .fill(0)
        .map(() => calculateComplianceScore(findings));

      // All runs should produce identical results
      const first = scores[0];
      for (const score of scores) {
        expect(score.score).toBe(first.score);
        expect(score.grade).toBe(first.grade);
        expect(score.compliant).toBe(first.compliant);
      }
    });
  });

  describe("getScoreDescription", () => {
    it("should return description for each grade", () => {
      expect(getScoreDescription(95)).toContain("Excellent");
      expect(getScoreDescription(80)).toContain("Good");
      expect(getScoreDescription(60)).toContain("Fair");
      expect(getScoreDescription(30)).toContain("Poor");
    });
  });

  describe("calculateScoreDiff", () => {
    it("should detect improvement", () => {
      const previous = calculateComplianceScore([
        { severity: "major", area: "X", title: "A" },
      ]);

      const current = calculateComplianceScore([]);

      const diff = calculateScoreDiff(previous, current);

      expect(diff.scoreDiff).toBeGreaterThan(0);
      expect(diff.improved).toBe(true);
    });

    it("should detect degradation", () => {
      const previous = calculateComplianceScore([]);

      const current = calculateComplianceScore([
        { severity: "blocker", area: "X", title: "A" },
      ]);

      const diff = calculateScoreDiff(previous, current);

      expect(diff.scoreDiff).toBeLessThan(0);
      expect(diff.improved).toBe(false);
    });

    it("should detect grade change", () => {
      const previous = calculateComplianceScore([]);

      const current = calculateComplianceScore([
        { severity: "major", area: "X", title: "A" },
        { severity: "major", area: "Y", title: "B" },
      ]);

      const diff = calculateScoreDiff(previous, current);

      // Score went from 100 to 80, grade from A to B
      expect(diff.gradeChanged).toBe(true);
    });
  });
});
