/**
 * Compliance Scoring Module
 *
 * Provides stable, reproducible compliance scoring for MCP server diagnostics.
 *
 * ## Scoring Algorithm v1.0.0
 *
 * The compliance score is calculated from 100 base points, with deductions for findings:
 *
 * | Severity | Penalty | Rationale |
 * |----------|---------|-----------|
 * | blocker  | -30     | Critical security or protocol violations that prevent operation |
 * | major    | -10     | Significant deviations from best practices or spec |
 * | minor    | -2      | Style, documentation, or minor compliance issues |
 * | info     | 0       | Informational findings, no penalty |
 *
 * ## Score Interpretation
 *
 * | Score Range | Grade | Meaning |
 * |-------------|-------|---------|
 * | 90-100 | A | Excellent compliance |
 * | 70-89 | B | Good compliance with minor issues |
 * | 50-69 | C | Fair compliance, needs improvement |
 * | 0-49 | F | Poor compliance, critical issues |
 *
 * ## Compliance Threshold
 *
 * A server is considered "compliant" if:
 * - No blocker findings
 * - No more than 2 major findings
 *
 * ## Reproducibility
 *
 * To ensure reproducibility:
 * - Findings are sorted by severity, area, and title before scoring
 * - Scoring version is included in the summary
 * - Penalty values are constants that can be versioned
 *
 * @module compliance-scoring
 */

/**
 * Finding severity levels
 */
export type FindingSeverity = 'blocker' | 'major' | 'minor' | 'info';

/**
 * Scoring penalty configuration
 *
 * These values are versioned - changing them requires a version bump
 */
export const SCORING_PENALTIES = {
  blocker: 30,
  major: 10,
  minor: 2,
  info: 0,
} as const;

/**
 * Scoring configuration
 */
export const SCORING_CONFIG = {
  /** Minimum score (floor) */
  MIN_SCORE: 0,
  /** Maximum score (ceiling) */
  MAX_SCORE: 100,
  /** Maximum major findings for compliance */
  MAX_MAJOR_FOR_COMPLIANCE: 2,
  /** Scoring algorithm version */
  VERSION: '1.0.0',
} as const;

/**
 * Compliance grade thresholds
 */
export const GRADE_THRESHOLDS = {
  A: 90,
  B: 70,
  C: 50,
} as const;

/**
 * Finding with sortable properties
 */
export interface SortableFinding {
  severity: FindingSeverity;
  area: string;
  title: string;
  description?: string;
}

/**
 * Scoring result
 */
export interface ScoringResult {
  /** Compliance score (0-100) */
  score: number;
  /** Whether the target meets compliance threshold */
  compliant: boolean;
  /** Letter grade (A/B/C/F) */
  grade: 'A' | 'B' | 'C' | 'F';
  /** Number of findings by severity */
  counts: {
    blocker: number;
    major: number;
    minor: number;
    info: number;
  };
  /** Total findings */
  totalFindings: number;
  /** Scoring algorithm version */
  version: string;
}

/**
 * Severity order for sorting (highest priority first)
 */
const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  blocker: 0,
  major: 1,
  minor: 2,
  info: 3,
};

/**
 * Sort findings deterministically by severity, area, and title
 *
 * This ensures reproducible scoring regardless of the order findings are discovered.
 */
export function sortFindings(findings: SortableFinding[]): SortableFinding[] {
  return [...findings].sort((a, b) => {
    // First by severity (blocker first)
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by area (alphabetical)
    const areaDiff = a.area.localeCompare(b.area);
    if (areaDiff !== 0) return areaDiff;

    // Finally by title (alphabetical)
    return a.title.localeCompare(b.title);
  });
}

/**
 * Calculate compliance score from findings
 *
 * The scoring algorithm is:
 * 1. Start with 100 points
 * 2. Deduct penalties based on severity
 * 3. Clamp to [0, 100] range
 *
 * @param findings - Array of findings to score
 * @returns Scoring result with score, compliance status, and grade
 */
export function calculateComplianceScore(findings: SortableFinding[]): ScoringResult {
  // Sort findings deterministically
  const sortedFindings = sortFindings(findings);

  // Count findings by severity
  const counts = {
    blocker: sortedFindings.filter((f) => f.severity === 'blocker').length,
    major: sortedFindings.filter((f) => f.severity === 'major').length,
    minor: sortedFindings.filter((f) => f.severity === 'minor').length,
    info: sortedFindings.filter((f) => f.severity === 'info').length,
  };

  // Calculate score
  let score = SCORING_CONFIG.MAX_SCORE;
  score -= counts.blocker * SCORING_PENALTIES.blocker;
  score -= counts.major * SCORING_PENALTIES.major;
  score -= counts.minor * SCORING_PENALTIES.minor;
  // info findings have no penalty
  score = Math.max(SCORING_CONFIG.MIN_SCORE, Math.min(SCORING_CONFIG.MAX_SCORE, score));

  // Determine compliance
  const compliant = counts.blocker === 0 && counts.major <= SCORING_CONFIG.MAX_MAJOR_FOR_COMPLIANCE;

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'F';
  if (score >= GRADE_THRESHOLDS.A) grade = 'A';
  else if (score >= GRADE_THRESHOLDS.B) grade = 'B';
  else if (score >= GRADE_THRESHOLDS.C) grade = 'C';
  else grade = 'F';

  return {
    score,
    compliant,
    grade,
    counts,
    totalFindings: findings.length,
    version: SCORING_CONFIG.VERSION,
  };
}

/**
 * Get a human-readable description of the score
 */
export function getScoreDescription(score: number): string {
  if (score >= GRADE_THRESHOLDS.A) return 'Excellent compliance';
  if (score >= GRADE_THRESHOLDS.B) return 'Good compliance';
  if (score >= GRADE_THRESHOLDS.C) return 'Fair compliance';
  return 'Poor compliance';
}

/**
 * Calculate score difference between two scoring results
 *
 * Useful for tracking compliance improvements over time.
 */
export function calculateScoreDiff(previous: ScoringResult, current: ScoringResult): {
  scoreDiff: number;
  improved: boolean;
  gradeChanged: boolean;
  summary: string;
} {
  const scoreDiff = current.score - previous.score;
  const improved = scoreDiff > 0 || (scoreDiff === 0 && current.grade > previous.grade);
  const gradeChanged = current.grade !== previous.grade;

  const summary = improved
    ? `Compliance ${gradeChanged ? 'improved' : 'maintained'}: ${previous.score} → ${current.score} (${previous.grade} → ${current.grade})`
    : `Compliance ${gradeChanged ? 'degraded' : 'maintained'}: ${previous.score} → ${current.score} (${previous.grade} → ${current.grade})`;

  return {
    scoreDiff,
    improved,
    gradeChanged,
    summary,
  };
}

/**
 * Validate scoring configuration
 *
 * Used in tests to ensure scoring penalties are within expected ranges.
 */
export function validateScoringConfig(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (SCORING_PENALTIES.blocker < SCORING_PENALTIES.major) {
    errors.push('Blocker penalty must be >= major penalty');
  }

  if (SCORING_PENALTIES.major < SCORING_PENALTIES.minor) {
    errors.push('Major penalty must be >= minor penalty');
  }

  if (SCORING_PENALTIES.minor < SCORING_PENALTIES.info) {
    errors.push('Minor penalty must be >= info penalty');
  }

  if (SCORING_CONFIG.MIN_SCORE < 0) {
    errors.push('Min score must be >= 0');
  }

  if (SCORING_CONFIG.MAX_SCORE > 100) {
    errors.push('Max score must be <= 100');
  }

  if (SCORING_CONFIG.MIN_SCORE >= SCORING_CONFIG.MAX_SCORE) {
    errors.push('Min score must be < max score');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
