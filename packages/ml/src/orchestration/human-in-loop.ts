/**
 * Human-in-the-Loop for LangGraph workflows
 * Implements workflow pause at decision points with user interaction
 * Requirements: 18.4
 */

import { randomUUID } from "node:crypto";
import type { Finding } from "@brainwav/cortexdx-core";
import type { WorkflowState } from "./agent-orchestrator.js";

/**
 * User prompt types
 */
export type PromptType =
    | "confirmation"
    | "choice"
    | "text_input"
    | "multi_choice"
    | "review"
    | "approval";

/**
 * User prompt definition
 */
export interface UserPrompt {
    id: string;
    type: PromptType;
    title: string;
    message: string;
    context?: PromptContext;
    options?: PromptOption[];
    defaultValue?: string;
    required: boolean;
    timeout?: number; // Timeout in milliseconds
    metadata?: Record<string, unknown>;
}

/**
 * Prompt context with diagnostic information
 */
export interface PromptContext {
    findings?: Finding[];
    currentNode?: string;
    executionPath?: string[];
    severity?: string;
    errorCount?: number;
    additionalInfo?: Record<string, unknown>;
}

/**
 * Prompt option for choice-based prompts
 */
export interface PromptOption {
    id: string;
    label: string;
    description?: string;
    value: string;
    recommended?: boolean;
}

/**
 * User response to a prompt
 */
export interface UserResponse {
    promptId: string;
    type: PromptType;
    value: string | string[];
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Decision point configuration
 */
export interface DecisionPoint {
    id: string;
    nodeId: string;
    prompt: UserPrompt;
    onResponse?: (response: UserResponse, state: WorkflowState) => Partial<WorkflowState>;
    onTimeout?: (state: WorkflowState) => Partial<WorkflowState>;
}

/**
 * Workflow pause state
 */
export interface WorkflowPauseState {
    workflowId: string;
    threadId: string;
    pausedAt: number;
    decisionPoint: DecisionPoint;
    state: WorkflowState;
    timeoutAt?: number;
}

/**
 * Timeout handling configuration
 */
export interface TimeoutConfig {
    defaultTimeoutMs: number;
    onTimeout: "continue" | "fail" | "custom";
    customHandler?: (state: WorkflowState) => Partial<WorkflowState>;
}

/**
 * Human-in-the-Loop Manager
 */
export class HumanInLoopManager {
    private pausedWorkflows: Map<string, WorkflowPauseState> = new Map();
    private decisionPoints: Map<string, DecisionPoint> = new Map();
    private timeoutConfig: TimeoutConfig;
    private timeoutTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(timeoutConfig?: Partial<TimeoutConfig>) {
        this.timeoutConfig = {
            defaultTimeoutMs: timeoutConfig?.defaultTimeoutMs || 300000, // 5 minutes
            onTimeout: timeoutConfig?.onTimeout || "continue",
            customHandler: timeoutConfig?.customHandler,
        };
    }

    /**
     * Pause workflow at decision point
     * Requirements: 18.4
     */
    async pauseWorkflow(
        workflowId: string,
        threadId: string,
        decisionPoint: DecisionPoint,
        state: WorkflowState
    ): Promise<UserPrompt> {
        const pausedAt = Date.now();
        const timeout = decisionPoint.prompt.timeout || this.timeoutConfig.defaultTimeoutMs;
        const timeoutAt = pausedAt + timeout;

        const pauseState: WorkflowPauseState = {
            workflowId,
            threadId,
            pausedAt,
            decisionPoint,
            state: {
                ...state,
                awaitingUserInput: true,
                userPrompt: decisionPoint.prompt.message,
            },
            timeoutAt,
        };

        this.pausedWorkflows.set(`${workflowId}-${threadId}`, pauseState);

        // Set timeout timer
        this.setTimeoutTimer(workflowId, threadId, timeout);

        return decisionPoint.prompt;
    }

    /**
     * Resume workflow with user input
     * Requirements: 18.4
     */
    async resumeWorkflow(
        workflowId: string,
        threadId: string,
        response: UserResponse
    ): Promise<WorkflowState> {
        const key = `${workflowId}-${threadId}`;
        const pauseState = this.pausedWorkflows.get(key);

        if (!pauseState) {
            throw new Error(`No paused workflow found: ${workflowId}-${threadId}`);
        }

        // Clear timeout timer
        this.clearTimeoutTimer(workflowId, threadId);

        // Apply response to state
        let updatedState: WorkflowState = {
            ...pauseState.state,
            awaitingUserInput: false,
            userResponse: Array.isArray(response.value)
                ? response.value.join(", ")
                : response.value,
        };

        // Execute custom response handler if provided
        if (pauseState.decisionPoint.onResponse) {
            const stateUpdates = pauseState.decisionPoint.onResponse(
                response,
                updatedState
            );
            updatedState = { ...updatedState, ...stateUpdates };
        }

        // Remove from paused workflows
        this.pausedWorkflows.delete(key);

        return updatedState;
    }

    /**
     * Create user prompt with context
     * Requirements: 18.4
     */
    createPrompt(
        type: PromptType,
        title: string,
        message: string,
        options?: {
            context?: PromptContext;
            choices?: PromptOption[];
            defaultValue?: string;
            required?: boolean;
            timeout?: number;
        }
    ): UserPrompt {
        return {
            id: `prompt-${randomUUID()}`,
            type,
            title,
            message,
            context: options?.context,
            options: options?.choices,
            defaultValue: options?.defaultValue,
            required: options?.required ?? true,
            timeout: options?.timeout,
        };
    }

    /**
     * Create confirmation prompt
     */
    createConfirmationPrompt(
        title: string,
        message: string,
        context?: PromptContext
    ): UserPrompt {
        return this.createPrompt("confirmation", title, message, {
            context,
            choices: [
                {
                    id: "yes",
                    label: "Yes",
                    value: "yes",
                    recommended: true,
                },
                {
                    id: "no",
                    label: "No",
                    value: "no",
                },
            ],
        });
    }

    /**
     * Create choice prompt
     */
    createChoicePrompt(
        title: string,
        message: string,
        choices: PromptOption[],
        context?: PromptContext
    ): UserPrompt {
        return this.createPrompt("choice", title, message, {
            context,
            choices,
        });
    }

    /**
     * Create review prompt for findings
     */
    createReviewPrompt(
        findings: Finding[],
        message?: string
    ): UserPrompt {
        const context: PromptContext = {
            findings,
            severity: this.getHighestSeverity(findings),
            errorCount: findings.filter((f) => f.severity === "blocker" || f.severity === "major").length,
        };

        return this.createPrompt(
            "review",
            "Review Diagnostic Findings",
            message || "Please review the diagnostic findings and decide how to proceed.",
            {
                context,
                choices: [
                    {
                        id: "continue",
                        label: "Continue",
                        description: "Continue with the workflow",
                        value: "continue",
                        recommended: true,
                    },
                    {
                        id: "abort",
                        label: "Abort",
                        description: "Stop the workflow",
                        value: "abort",
                    },
                    {
                        id: "retry",
                        label: "Retry",
                        description: "Retry the current step",
                        value: "retry",
                    },
                ],
            }
        );
    }

    /**
     * Register a decision point
     */
    registerDecisionPoint(decisionPoint: DecisionPoint): void {
        this.decisionPoints.set(decisionPoint.id, decisionPoint);
    }

    /**
     * Get decision point by ID
     */
    getDecisionPoint(id: string): DecisionPoint | undefined {
        return this.decisionPoints.get(id);
    }

    /**
     * Get paused workflow state
     */
    getPausedWorkflow(
        workflowId: string,
        threadId: string
    ): WorkflowPauseState | undefined {
        return this.pausedWorkflows.get(`${workflowId}-${threadId}`);
    }

    /**
     * List all paused workflows
     */
    listPausedWorkflows(): WorkflowPauseState[] {
        return Array.from(this.pausedWorkflows.values());
    }

    /**
     * Check if workflow is paused
     */
    isWorkflowPaused(workflowId: string, threadId: string): boolean {
        return this.pausedWorkflows.has(`${workflowId}-${threadId}`);
    }

    /**
     * Handle timeout for abandoned workflow
     * Requirements: 18.4
     */
    async handleTimeout(
        workflowId: string,
        threadId: string
    ): Promise<WorkflowState | null> {
        const key = `${workflowId}-${threadId}`;
        const pauseState = this.pausedWorkflows.get(key);

        if (!pauseState) {
            return null;
        }

        let updatedState: WorkflowState = {
            ...pauseState.state,
            awaitingUserInput: false,
            errors: [
                ...pauseState.state.errors,
                `Workflow timed out waiting for user input at ${pauseState.decisionPoint.nodeId}`,
            ],
        };

        // Execute custom timeout handler if provided
        if (pauseState.decisionPoint.onTimeout) {
            const stateUpdates = pauseState.decisionPoint.onTimeout(updatedState);
            updatedState = { ...updatedState, ...stateUpdates };
        } else if (this.timeoutConfig.customHandler) {
            const stateUpdates = this.timeoutConfig.customHandler(updatedState);
            updatedState = { ...updatedState, ...stateUpdates };
        }

        // Remove from paused workflows
        this.pausedWorkflows.delete(key);

        return updatedState;
    }

    /**
     * Cancel paused workflow
     */
    cancelWorkflow(workflowId: string, threadId: string): boolean {
        const key = `${workflowId}-${threadId}`;
        this.clearTimeoutTimer(workflowId, threadId);
        return this.pausedWorkflows.delete(key);
    }

    /**
     * Update timeout configuration
     */
    updateTimeoutConfig(config: Partial<TimeoutConfig>): void {
        this.timeoutConfig = {
            ...this.timeoutConfig,
            ...config,
        };
    }

    /**
     * Get timeout configuration
     */
    getTimeoutConfig(): TimeoutConfig {
        return { ...this.timeoutConfig };
    }

    // Private helper methods

    private setTimeoutTimer(
        workflowId: string,
        threadId: string,
        timeoutMs: number
    ): void {
        const key = `${workflowId}-${threadId}`;
        const timer = setTimeout(async () => {
            await this.handleTimeout(workflowId, threadId);
        }, timeoutMs);

        this.timeoutTimers.set(key, timer);
    }

    private clearTimeoutTimer(workflowId: string, threadId: string): void {
        const key = `${workflowId}-${threadId}`;
        const timer = this.timeoutTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timeoutTimers.delete(key);
        }
    }

    private getHighestSeverity(findings: Finding[]): string {
        if (findings.some((f) => f.severity === "blocker")) {
            return "blocker";
        }
        if (findings.some((f) => f.severity === "major")) {
            return "major";
        }
        if (findings.some((f) => f.severity === "minor")) {
            return "minor";
        }
        return "info";
    }

    /**
     * Cleanup all timers
     */
    cleanup(): void {
        for (const timer of this.timeoutTimers.values()) {
            clearTimeout(timer);
        }
        this.timeoutTimers.clear();
        this.pausedWorkflows.clear();
    }
}

/**
 * Create a singleton instance of the human-in-loop manager
 */
let humanInLoopInstance: HumanInLoopManager | null = null;

export function getHumanInLoopManager(
    config?: Partial<TimeoutConfig>
): HumanInLoopManager {
    if (!humanInLoopInstance) {
        humanInLoopInstance = new HumanInLoopManager(config);
    }
    return humanInLoopInstance;
}
