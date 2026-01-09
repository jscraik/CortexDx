/**
 * Conditional Branching for LangGraph workflows
 * Implements dynamic routing based on diagnostic results and severity levels
 * Requirements: 18.3
 */

import type { WorkflowState } from "./agent-orchestrator.js";

/**
 * Condition types for branching
 */
export type ConditionType =
  | "severity"
  | "finding_count"
  | "has_blockers"
  | "has_major"
  | "error_count"
  | "node_visited"
  | "custom";

/**
 * Comparison operators
 */
export type ComparisonOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "in";

/**
 * Branch condition definition
 */
export interface BranchCondition {
  type: ConditionType;
  operator: ComparisonOperator;
  value: string | number | boolean | string[];
  field?: string; // For custom conditions
  negate?: boolean; // Negate the condition result
}

/**
 * Branch definition with multiple conditions
 */
export interface Branch {
  id: string;
  name: string;
  targetNode: string;
  conditions: BranchCondition[];
  conditionLogic: "AND" | "OR"; // How to combine multiple conditions
  priority: number; // Higher priority branches evaluated first
  fallback?: boolean; // Is this a fallback branch?
}

/**
 * Routing decision result
 */
export interface RoutingDecision {
  targetNode: string;
  branchId: string;
  branchName: string;
  reason: string;
  conditionsEvaluated: ConditionEvaluation[];
}

/**
 * Condition evaluation result
 */
export interface ConditionEvaluation {
  condition: BranchCondition;
  result: boolean;
  actualValue: unknown;
  expectedValue: unknown;
  reason: string;
}

/**
 * Fallback path configuration
 */
export interface FallbackPath {
  fromNode: string;
  toNode: string;
  condition: "error" | "timeout" | "no_match" | "custom";
  customCondition?: (state: WorkflowState) => boolean;
}

/**
 * Loop detection configuration
 */
export interface LoopDetectionConfig {
  maxIterations: number;
  maxSameNodeVisits: number;
  detectCycles: boolean;
  breakOnLoop: boolean;
}

/**
 * Conditional Branching Engine
 */
export class ConditionalBranchingEngine {
  private loopDetection: LoopDetectionConfig;
  private fallbackPaths: Map<string, FallbackPath[]> = new Map();

  constructor(loopDetection?: Partial<LoopDetectionConfig>) {
    this.loopDetection = {
      maxIterations: loopDetection?.maxIterations || 100,
      maxSameNodeVisits: loopDetection?.maxSameNodeVisits || 3,
      detectCycles: loopDetection?.detectCycles ?? true,
      breakOnLoop: loopDetection?.breakOnLoop ?? true,
    };
  }

  /**
   * Evaluate branches and determine routing
   * Requirements: 18.3
   */
  evaluateBranches(state: WorkflowState, branches: Branch[]): RoutingDecision {
    // Check for loops first
    if (this.loopDetection.detectCycles) {
      const loopDetected = this.detectLoop(state);
      if (loopDetected && this.loopDetection.breakOnLoop) {
        return this.createLoopBreakDecision(state);
      }
    }

    // Sort branches by priority (higher first)
    const sortedBranches = [...branches].sort(
      (a, b) => b.priority - a.priority,
    );

    // Evaluate each branch
    for (const branch of sortedBranches) {
      const evaluation = this.evaluateBranch(state, branch);
      if (evaluation.matches) {
        return {
          targetNode: branch.targetNode,
          branchId: branch.id,
          branchName: branch.name,
          reason: evaluation.reason,
          conditionsEvaluated: evaluation.conditionsEvaluated,
        };
      }
    }

    // No branch matched, use fallback
    const fallbackBranch = sortedBranches.find((b) => b.fallback);
    if (fallbackBranch) {
      return {
        targetNode: fallbackBranch.targetNode,
        branchId: fallbackBranch.id,
        branchName: fallbackBranch.name,
        reason: "No conditions matched, using fallback branch",
        conditionsEvaluated: [],
      };
    }

    // No fallback, throw error
    throw new Error("No branch matched and no fallback branch defined");
  }

  /**
   * Evaluate a single branch
   */
  private evaluateBranch(
    state: WorkflowState,
    branch: Branch,
  ): {
    matches: boolean;
    reason: string;
    conditionsEvaluated: ConditionEvaluation[];
  } {
    const conditionsEvaluated: ConditionEvaluation[] = [];

    for (const condition of branch.conditions) {
      const evaluation = this.evaluateCondition(state, condition);
      conditionsEvaluated.push(evaluation);
    }

    // Apply condition logic (AND/OR)
    let matches: boolean;
    if (branch.conditionLogic === "AND") {
      matches = conditionsEvaluated.every((e) => e.result);
    } else {
      matches = conditionsEvaluated.some((e) => e.result);
    }

    const reason = matches
      ? `All ${branch.conditionLogic} conditions met`
      : `Not all ${branch.conditionLogic} conditions met`;

    return { matches, reason, conditionsEvaluated };
  }

  /**
   * Evaluate a single condition
   * Requirements: 18.3
   */
  evaluateCondition(
    state: WorkflowState,
    condition: BranchCondition,
  ): ConditionEvaluation {
    let result = false;
    let actualValue: unknown;
    let reason = "";

    switch (condition.type) {
      case "severity": {
        actualValue = state.severity;
        result = this.compareValues(
          actualValue,
          condition.operator,
          condition.value,
        );
        reason = `Severity ${actualValue} ${condition.operator} ${condition.value}`;
        break;
      }

      case "finding_count": {
        actualValue = state.findingCount;
        result = this.compareValues(
          actualValue,
          condition.operator,
          condition.value,
        );
        reason = `Finding count ${actualValue} ${condition.operator} ${condition.value}`;
        break;
      }

      case "has_blockers": {
        actualValue = state.hasBlockers;
        result = this.compareValues(
          actualValue,
          condition.operator,
          condition.value,
        );
        reason = `Has blockers: ${actualValue} ${condition.operator} ${condition.value}`;
        break;
      }

      case "has_major": {
        actualValue = state.hasMajor;
        result = this.compareValues(
          actualValue,
          condition.operator,
          condition.value,
        );
        reason = `Has major: ${actualValue} ${condition.operator} ${condition.value}`;
        break;
      }

      case "error_count": {
        actualValue = state.errors.length;
        result = this.compareValues(
          actualValue,
          condition.operator,
          condition.value,
        );
        reason = `Error count ${actualValue} ${condition.operator} ${condition.value}`;
        break;
      }

      case "node_visited": {
        actualValue = state.visitedNodes.includes(String(condition.value));
        result = this.compareValues(actualValue, condition.operator, true);
        reason = `Node ${condition.value} visited: ${actualValue}`;
        break;
      }

      case "custom": {
        if (condition.field) {
          actualValue = this.getFieldValue(state, condition.field);
          result = this.compareValues(
            actualValue,
            condition.operator,
            condition.value,
          );
          reason = `Custom field ${condition.field}: ${actualValue} ${condition.operator} ${condition.value}`;
        } else {
          result = false;
          reason = "Custom condition missing field";
        }
        break;
      }

      default:
        result = false;
        reason = `Unknown condition type: ${condition.type}`;
    }

    // Apply negation if specified
    if (condition.negate) {
      result = !result;
      reason = `NOT (${reason})`;
    }

    return {
      condition,
      result,
      actualValue,
      expectedValue: condition.value,
      reason,
    };
  }

  /**
   * Create routing based on severity levels
   * Requirements: 18.3
   */
  createSeverityRouting(
    blockerNode: string,
    majorNode: string,
    minorNode: string,
    infoNode: string,
  ): Branch[] {
    return [
      {
        id: "blocker-branch",
        name: "Blocker Severity",
        targetNode: blockerNode,
        conditions: [
          {
            type: "has_blockers",
            operator: "eq",
            value: true,
          },
        ],
        conditionLogic: "AND",
        priority: 100,
      },
      {
        id: "major-branch",
        name: "Major Severity",
        targetNode: majorNode,
        conditions: [
          {
            type: "has_major",
            operator: "eq",
            value: true,
          },
        ],
        conditionLogic: "AND",
        priority: 90,
      },
      {
        id: "minor-branch",
        name: "Minor Severity",
        targetNode: minorNode,
        conditions: [
          {
            type: "severity",
            operator: "eq",
            value: "minor",
          },
        ],
        conditionLogic: "AND",
        priority: 80,
      },
      {
        id: "info-branch",
        name: "Info Severity",
        targetNode: infoNode,
        conditions: [],
        conditionLogic: "AND",
        priority: 0,
        fallback: true,
      },
    ];
  }

  /**
   * Add fallback path for error scenarios
   * Requirements: 18.3
   */
  addFallbackPath(path: FallbackPath): void {
    const paths = this.fallbackPaths.get(path.fromNode) || [];
    paths.push(path);
    this.fallbackPaths.set(path.fromNode, paths);
  }

  /**
   * Get fallback path for a node
   */
  getFallbackPath(
    fromNode: string,
    state: WorkflowState,
    condition: "error" | "timeout" | "no_match" | "custom",
  ): string | null {
    const paths = this.fallbackPaths.get(fromNode);
    if (!paths) {
      return null;
    }

    for (const path of paths) {
      if (path.condition === condition) {
        if (condition === "custom" && path.customCondition) {
          if (path.customCondition(state)) {
            return path.toNode;
          }
        } else {
          return path.toNode;
        }
      }
    }

    return null;
  }

  /**
   * Detect loops in execution path
   * Requirements: 18.3
   */
  detectLoop(state: WorkflowState): boolean {
    // Check total iterations
    if (state.visitedNodes.length > this.loopDetection.maxIterations) {
      return true;
    }

    // Check same node visits
    const nodeCounts = new Map<string, number>();
    for (const node of state.visitedNodes) {
      nodeCounts.set(node, (nodeCounts.get(node) || 0) + 1);
    }

    for (const count of nodeCounts.values()) {
      if (count > this.loopDetection.maxSameNodeVisits) {
        return true;
      }
    }

    // Check for cycles (simple cycle detection)
    if (state.visitedNodes.length >= 3) {
      const lastThree = state.visitedNodes.slice(-3);
      if (lastThree[0] === lastThree[2]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create loop break decision
   */
  private createLoopBreakDecision(state: WorkflowState): RoutingDecision {
    return {
      targetNode: "END",
      branchId: "loop-break",
      branchName: "Loop Break",
      reason: "Loop detected, breaking execution",
      conditionsEvaluated: [],
    };
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: unknown,
    operator: ComparisonOperator,
    expected: string | number | boolean | string[],
  ): boolean {
    switch (operator) {
      case "eq":
        return actual === expected;

      case "ne":
        return actual !== expected;

      case "gt":
        return Number(actual) > Number(expected);

      case "gte":
        return Number(actual) >= Number(expected);

      case "lt":
        return Number(actual) < Number(expected);

      case "lte":
        return Number(actual) <= Number(expected);

      case "contains":
        if (typeof actual === "string" && typeof expected === "string") {
          return actual.includes(expected);
        }
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return false;

      case "in":
        if (Array.isArray(expected)) {
          return expected.includes(String(actual));
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get field value from state using dot notation
   */
  private getFieldValue(state: WorkflowState, field: string): unknown {
    const parts = field.split(".");
    let value: unknown = state;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Update loop detection configuration
   */
  updateLoopDetection(config: Partial<LoopDetectionConfig>): void {
    this.loopDetection = {
      ...this.loopDetection,
      ...config,
    };
  }

  /**
   * Get loop detection configuration
   */
  getLoopDetection(): LoopDetectionConfig {
    return { ...this.loopDetection };
  }
}

/**
 * Create a singleton instance of the conditional branching engine
 */
let branchingEngineInstance: ConditionalBranchingEngine | null = null;

export function getConditionalBranchingEngine(
  config?: Partial<LoopDetectionConfig>,
): ConditionalBranchingEngine {
  if (!branchingEngineInstance) {
    branchingEngineInstance = new ConditionalBranchingEngine(config);
  }
  return branchingEngineInstance;
}
