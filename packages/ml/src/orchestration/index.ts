/**
 * Orchestration Module Exports
 * Provides LangGraph-based workflow orchestration with state management,
 * conditional branching, human-in-the-loop, and visualization
 */

// Agent Orchestrator (LangGraph v1.0)
export {
    AgentOrchestrator,
    getAgentOrchestrator, type CompiledWorkflow, type WorkflowConfig, type WorkflowDefinition, type WorkflowEdge, type WorkflowEvent, type WorkflowExecutionResult, type WorkflowNode, type WorkflowState
} from "./agent-orchestrator.js";

// State Management
export {
    StateManager,
    getStateManager,
    type StateCheckpoint, type StatePersistenceConfig, type StateRecoveryOptions, type StateTransition, type WorkflowSession
} from "./state-manager.js";

// Conditional Branching
export {
    ConditionalBranchingEngine,
    getConditionalBranchingEngine, type Branch, type BranchCondition, type ComparisonOperator, type ConditionEvaluation, type ConditionType, type FallbackPath,
    type LoopDetectionConfig, type RoutingDecision
} from "./conditional-branching.js";

// Human-in-the-Loop
export {
    HumanInLoopManager,
    getHumanInLoopManager, type DecisionPoint, type PromptContext,
    type PromptOption, type PromptType, type TimeoutConfig, type UserPrompt, type UserResponse, type WorkflowPauseState
} from "./human-in-loop.js";

// Workflow Visualization
export {
    WorkflowVisualizationEngine,
    getWorkflowVisualizationEngine, type NodeMetrics, type NodeStyle, type VisualizationOptions, type WorkflowVisualization
} from "./workflow-visualization.js";

// Plugin Orchestrator (existing)
export {
    PluginOrchestrator,
    getPluginOrchestrator, type PluginInfo, type PluginResults, type PluginWorkflow, type StageCondition, type ValidationResult, type WorkflowDependency, type WorkflowResults, type WorkflowStage
} from "./plugin-orchestrator.js";

// Workflow Engine (existing)
export {
    WorkflowEngine,
    getWorkflowEngine, type ConditionalExecutionResult,
    type DataMappingResult, type StageExecutionData, type WorkflowExecutionContext, type WorkflowExecutionPlan
} from "./workflow-engine.js";

