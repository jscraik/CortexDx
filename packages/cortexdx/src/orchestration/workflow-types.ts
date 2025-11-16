/**
 * Shared type definitions for LangGraph workflows
 * Extracted to break circular dependency between agent-orchestrator and state-manager
 */

import type { DiagnosticContext, Finding } from "../types.js";

/**
 * Workflow state that flows through the graph
 */
export interface WorkflowState {
    // Core diagnostic data
    endpoint: string;
    findings: Finding[];
    errors: string[];

    // Execution metadata
    currentNode: string;
    visitedNodes: string[];
    executionPath: string[];

    // Decision data for conditional branching
    severity: "info" | "minor" | "major" | "blocker" | null;
    findingCount: number;
    hasBlockers: boolean;
    hasMajor: boolean;

    // Human-in-the-loop
    awaitingUserInput: boolean;
    userPrompt?: string;
    userResponse?: string;

    // Context and configuration
    context: DiagnosticContext;
    config: WorkflowConfig;

    // Performance tracking
    startTime: number;
    nodeTimings: Record<string, number>;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
    workflowId: string;
    name: string;
    description: string;
    timeout?: number;
    enableCheckpointing: boolean;
    checkpointPath?: string;
}

/**
 * Node definition for the workflow graph
 */
export interface WorkflowNode {
    id: string;
    name: string;
    type: "plugin" | "decision" | "aggregation" | "human_input";
    pluginId?: string;
    handler?: (state: WorkflowState) => Promise<Partial<WorkflowState>>;
}

/**
 * Edge definition with conditional logic
 */
export interface WorkflowEdge {
    from: string;
    to: string;
    condition?: (state: WorkflowState) => boolean;
    label?: string;
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition {
    config: WorkflowConfig;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    entryPoint: string;
}
