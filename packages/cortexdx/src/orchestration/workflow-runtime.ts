import type { DevelopmentContext, DiagnosticContext } from "../types.js";
import type { WorkflowState } from "./agent-orchestrator.js";
import type { StateCheckpoint, StateManager } from "./state-manager.js";

export function createInitialWorkflowState(
  context: DiagnosticContext | DevelopmentContext,
): Partial<WorkflowState> {
  return {
    endpoint: context.endpoint,
    context,
    findings: [],
    errors: [],
    currentNode: "",
    visitedNodes: [],
    executionPath: [],
    severity: null,
    findingCount: 0,
    hasBlockers: false,
    hasMajor: false,
    awaitingUserInput: false,
    nodeTimings: {},
    startTime: Date.now(),
  } satisfies Partial<WorkflowState>;
}

export async function recoverWorkflowCheckpoint(
  stateManager: StateManager,
  workflowId: string,
  options: { resumeCheckpoint?: string; resumeThread?: string },
): Promise<StateCheckpoint | null> {
  if (!options.resumeCheckpoint && !options.resumeThread) {
    return null;
  }
  return await stateManager.recoverState({
    workflowId,
    checkpointId: options.resumeCheckpoint,
    threadId: options.resumeThread,
  });
}
