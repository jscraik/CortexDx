/**
 * Workflow Engine
 * Manages workflow stage execution, input/output mapping, and conditional execution
 * Requirements: 17.3, 17.4
 */

import type { DevelopmentContext, DiagnosticContext, Finding } from "../types.js";
import type { PluginWorkflow, StageCondition, WorkflowStage } from "./plugin-orchestrator.js";

export interface WorkflowExecutionContext {
    workflowId: string;
    startTime: number;
    currentStage?: string;
    stageData: Map<string, StageExecutionData>;
    globalContext: Record<string, unknown>;
}

export interface StageExecutionData {
    stageId: string;
    pluginId: string;
    findings: Finding[];
    executionTime: number;
    startTime: number;
    endTime: number;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    error?: Error;
    inputData?: Record<string, unknown>;
    outputData?: Record<string, unknown>;
}

export interface WorkflowExecutionPlan {
    workflow: PluginWorkflow;
    executionOrder: WorkflowStage[][];
    dependencyGraph: Map<string, string[]>;
    criticalPath: string[];
}

export interface ConditionalExecutionResult {
    shouldExecute: boolean;
    reason: string;
    evaluatedCondition?: StageCondition;
}

export interface DataMappingResult {
    mappedData: Record<string, unknown>;
    sourcesUsed: string[];
    missingDependencies: string[];
}

/**
 * Workflow Engine for advanced workflow execution
 */
export class WorkflowEngine {
    private executionContexts: Map<string, WorkflowExecutionContext> = new Map();

    /**
     * Create an execution plan for a workflow
     * Analyzes dependencies and determines optimal execution order
     */
    createExecutionPlan(workflow: PluginWorkflow): WorkflowExecutionPlan {
        // Build dependency graph
        const dependencyGraph = this.buildDependencyGraph(workflow);

        // Determine execution order (topological sort with parallel groups)
        const executionOrder = this.determineExecutionOrder(workflow, dependencyGraph);

        // Calculate critical path
        const criticalPath = this.calculateCriticalPath(workflow, dependencyGraph);

        return {
            workflow,
            executionOrder,
            dependencyGraph,
            criticalPath,
        };
    }

    /**
     * Execute a workflow stage with input/output mapping
     */
    async executeStageWithMapping(
        stage: WorkflowStage,
        workflow: PluginWorkflow,
        context: DiagnosticContext | DevelopmentContext,
        executionContext: WorkflowExecutionContext,
    ): Promise<StageExecutionData> {
        const stageStartTime = Date.now();

        // Initialize stage data
        const stageData: StageExecutionData = {
            stageId: stage.id,
            pluginId: stage.pluginId,
            findings: [],
            executionTime: 0,
            startTime: stageStartTime,
            endTime: 0,
            status: "running",
        };

        executionContext.currentStage = stage.id;
        executionContext.stageData.set(stage.id, stageData);

        try {
            // Apply input mapping
            const mappingResult = this.applyInputMapping(
                stage,
                workflow,
                executionContext,
            );
            stageData.inputData = mappingResult.mappedData;

            // Check for missing required dependencies
            if (mappingResult.missingDependencies.length > 0) {
                const requiredDeps = workflow.dependencies.filter(
                    (d) => d.toStage === stage.id && d.required,
                );
                const missingRequired = mappingResult.missingDependencies.filter((dep) =>
                    requiredDeps.some((rd) => rd.fromStage === dep),
                );

                if (missingRequired.length > 0) {
                    throw new Error(
                        `Missing required dependencies: ${missingRequired.join(", ")}`,
                    );
                }
            }

            // Create enhanced context with mapped data
            const enhancedContext = {
                ...context,
                ...mappingResult.mappedData,
                workflowContext: executionContext.globalContext,
            };

            // Execute plugin (this would be implemented by the orchestrator)
            // For now, we'll return empty findings as this is handled by the orchestrator
            stageData.findings = [];
            stageData.status = "completed";

            // Extract output data for downstream stages
            stageData.outputData = this.extractOutputData(stageData.findings, stage);

            // Update global context
            this.updateGlobalContext(executionContext, stage, stageData);
        } catch (error) {
            stageData.status = "failed";
            stageData.error =
                error instanceof Error ? error : new Error(String(error));
            throw error;
        } finally {
            const stageEndTime = Date.now();
            stageData.endTime = stageEndTime;
            stageData.executionTime = stageEndTime - stageStartTime;
        }

        return stageData;
    }

    /**
     * Evaluate conditional execution for a stage
     */
    evaluateConditionalExecution(
        stage: WorkflowStage,
        executionContext: WorkflowExecutionContext,
    ): ConditionalExecutionResult {
        if (!stage.condition) {
            return {
                shouldExecute: true,
                reason: "No condition specified",
            };
        }

        const condition = stage.condition;
        const allFindings = this.getAllFindings(executionContext);

        let shouldExecute = false;
        let reason = "";

        switch (condition.type) {
            case "severity": {
                const count = allFindings.filter(
                    (f) => f.severity === condition.value,
                ).length;
                shouldExecute = this.evaluateOperator(
                    count,
                    condition.operator,
                    Number(condition.value) || 0,
                );
                reason = `Severity ${condition.value} count: ${count} ${condition.operator} ${condition.value}`;
                break;
            }

            case "finding_count": {
                const count = allFindings.length;
                shouldExecute = this.evaluateOperator(
                    count,
                    condition.operator,
                    Number(condition.value),
                );
                reason = `Finding count: ${count} ${condition.operator} ${condition.value}`;
                break;
            }

            case "custom": {
                if (condition.field) {
                    const fieldValues = allFindings
                        .map((f) => (f as Record<string, unknown>)[condition.field!])
                        .filter((v) => v !== undefined);

                    shouldExecute = fieldValues.some((v) =>
                        this.evaluateOperator(v, condition.operator, condition.value),
                    );
                    reason = `Custom field ${condition.field}: ${fieldValues.length} matches`;
                } else {
                    shouldExecute = true;
                    reason = "Custom condition without field";
                }
                break;
            }

            default:
                shouldExecute = true;
                reason = "Unknown condition type";
        }

        return {
            shouldExecute,
            reason,
            evaluatedCondition: condition,
        };
    }

    /**
     * Apply input mapping from previous stages
     */
    applyInputMapping(
        stage: WorkflowStage,
        workflow: PluginWorkflow,
        executionContext: WorkflowExecutionContext,
    ): DataMappingResult {
        const mappedData: Record<string, unknown> = {};
        const sourcesUsed: string[] = [];
        const missingDependencies: string[] = [];

        if (!stage.inputMapping) {
            return { mappedData, sourcesUsed, missingDependencies };
        }

        // Get dependencies for this stage
        const dependencies = workflow.dependencies.filter(
            (d) => d.toStage === stage.id,
        );

        for (const dep of dependencies) {
            const sourceStageData = executionContext.stageData.get(dep.fromStage);

            if (!sourceStageData || sourceStageData.status !== "completed") {
                missingDependencies.push(dep.fromStage);
                continue;
            }

            sourcesUsed.push(dep.fromStage);

            // Map data according to dataFlow specification
            for (const dataKey of dep.dataFlow) {
                const targetKey = stage.inputMapping[dataKey] || dataKey;

                // Try to get data from output data first, then from findings
                if (sourceStageData.outputData?.[dataKey] !== undefined) {
                    mappedData[targetKey] = sourceStageData.outputData[dataKey];
                } else if (dataKey === "findings") {
                    mappedData[targetKey] = sourceStageData.findings;
                } else if (dataKey === "executionTime") {
                    mappedData[targetKey] = sourceStageData.executionTime;
                } else {
                    // Try to extract from findings
                    const extractedData = this.extractDataFromFindings(
                        sourceStageData.findings,
                        dataKey,
                    );
                    if (extractedData !== undefined) {
                        mappedData[targetKey] = extractedData;
                    }
                }
            }
        }

        return { mappedData, sourcesUsed, missingDependencies };
    }

    /**
     * Aggregate results from multiple stages
     */
    aggregateResults(
        executionContext: WorkflowExecutionContext,
        stageIds?: string[],
    ): {
        findings: Finding[];
        totalExecutionTime: number;
        stageCount: number;
        successCount: number;
        failureCount: number;
        skippedCount: number;
    } {
        const stagesToAggregate = stageIds
            ? Array.from(executionContext.stageData.values()).filter((s) =>
                stageIds.includes(s.stageId),
            )
            : Array.from(executionContext.stageData.values());

        const findings: Finding[] = [];
        let totalExecutionTime = 0;
        let successCount = 0;
        let failureCount = 0;
        let skippedCount = 0;

        for (const stageData of stagesToAggregate) {
            findings.push(...stageData.findings);
            totalExecutionTime += stageData.executionTime;

            switch (stageData.status) {
                case "completed":
                    successCount++;
                    break;
                case "failed":
                    failureCount++;
                    break;
                case "skipped":
                    skippedCount++;
                    break;
            }
        }

        return {
            findings,
            totalExecutionTime,
            stageCount: stagesToAggregate.length,
            successCount,
            failureCount,
            skippedCount,
        };
    }

    /**
     * Create a new execution context
     */
    createExecutionContext(workflowId: string): WorkflowExecutionContext {
        const context: WorkflowExecutionContext = {
            workflowId,
            startTime: Date.now(),
            stageData: new Map(),
            globalContext: {},
        };

        this.executionContexts.set(workflowId, context);
        return context;
    }

    /**
     * Get execution context
     */
    getExecutionContext(workflowId: string): WorkflowExecutionContext | undefined {
        return this.executionContexts.get(workflowId);
    }

    /**
     * Clear execution context
     */
    clearExecutionContext(workflowId: string): void {
        this.executionContexts.delete(workflowId);
    }

    // Private helper methods

    private buildDependencyGraph(
        workflow: PluginWorkflow,
    ): Map<string, string[]> {
        const graph = new Map<string, string[]>();

        // Initialize all stages
        for (const stage of workflow.stages) {
            if (!graph.has(stage.id)) {
                graph.set(stage.id, []);
            }
        }

        // Add dependencies
        for (const dep of workflow.dependencies) {
            const deps = graph.get(dep.toStage) || [];
            deps.push(dep.fromStage);
            graph.set(dep.toStage, deps);
        }

        return graph;
    }

    private determineExecutionOrder(
        workflow: PluginWorkflow,
        dependencyGraph: Map<string, string[]>,
    ): WorkflowStage[][] {
        // Group stages by order first
        const stagesByOrder = new Map<number, WorkflowStage[]>();
        for (const stage of workflow.stages) {
            if (!stagesByOrder.has(stage.order)) {
                stagesByOrder.set(stage.order, []);
            }
            stagesByOrder.get(stage.order)?.push(stage);
        }

        // Sort by order and return as array of parallel groups
        const sortedOrders = Array.from(stagesByOrder.keys()).sort((a, b) => a - b);
        return sortedOrders.map((order) => stagesByOrder.get(order) || []);
    }

    private calculateCriticalPath(
        workflow: PluginWorkflow,
        dependencyGraph: Map<string, string[]>,
    ): string[] {
        // Simple critical path: longest chain of dependencies
        const visited = new Set<string>();
        let longestPath: string[] = [];

        const dfs = (stageId: string, currentPath: string[]): void => {
            if (visited.has(stageId)) return;

            visited.add(stageId);
            currentPath.push(stageId);

            const deps = dependencyGraph.get(stageId) || [];
            if (deps.length === 0) {
                if (currentPath.length > longestPath.length) {
                    longestPath = [...currentPath];
                }
            } else {
                for (const dep of deps) {
                    dfs(dep, currentPath);
                }
            }

            currentPath.pop();
            visited.delete(stageId);
        };

        // Start from stages with no dependencies
        for (const stage of workflow.stages) {
            const deps = dependencyGraph.get(stage.id) || [];
            if (deps.length === 0) {
                dfs(stage.id, []);
            }
        }

        return longestPath.reverse();
    }

    private getAllFindings(
        executionContext: WorkflowExecutionContext,
    ): Finding[] {
        const findings: Finding[] = [];
        for (const stageData of executionContext.stageData.values()) {
            if (stageData.status === "completed") {
                findings.push(...stageData.findings);
            }
        }
        return findings;
    }

    private evaluateOperator(
        actual: unknown,
        operator: StageCondition["operator"],
        expected: string | number,
    ): boolean {
        const actualNum = typeof actual === "number" ? actual : Number(actual);
        const expectedNum =
            typeof expected === "number" ? expected : Number(expected);

        switch (operator) {
            case "gt":
                return actualNum > expectedNum;
            case "lt":
                return actualNum < expectedNum;
            case "eq":
                return actual === expected;
            case "gte":
                return actualNum >= expectedNum;
            case "lte":
                return actualNum <= expectedNum;
            case "contains":
                return String(actual).includes(String(expected));
            default:
                return false;
        }
    }

    private extractOutputData(
        findings: Finding[],
        stage: WorkflowStage,
    ): Record<string, unknown> {
        return {
            findings,
            findingCount: findings.length,
            severityCounts: this.countBySeverity(findings),
            areaCounts: this.countByArea(findings),
            hasBlockers: findings.some((f) => f.severity === "blocker"),
            hasMajor: findings.some((f) => f.severity === "major"),
        };
    }

    private countBySeverity(findings: Finding[]): Record<string, number> {
        const counts: Record<string, number> = {
            blocker: 0,
            major: 0,
            minor: 0,
            info: 0,
        };

        for (const finding of findings) {
            counts[finding.severity] = (counts[finding.severity] || 0) + 1;
        }

        return counts;
    }

    private countByArea(findings: Finding[]): Record<string, number> {
        const counts: Record<string, number> = {};

        for (const finding of findings) {
            counts[finding.area] = (counts[finding.area] || 0) + 1;
        }

        return counts;
    }

    private extractDataFromFindings(
        findings: Finding[],
        dataKey: string,
    ): unknown {
        // Extract specific data from findings based on key
        switch (dataKey) {
            case "severities":
                return findings.map((f) => f.severity);
            case "areas":
                return findings.map((f) => f.area);
            case "titles":
                return findings.map((f) => f.title);
            case "blockerCount":
                return findings.filter((f) => f.severity === "blocker").length;
            case "majorCount":
                return findings.filter((f) => f.severity === "major").length;
            default:
                return undefined;
        }
    }

    private updateGlobalContext(
        executionContext: WorkflowExecutionContext,
        stage: WorkflowStage,
        stageData: StageExecutionData,
    ): void {
        // Update global context with stage results
        executionContext.globalContext[`${stage.id}_findings`] = stageData.findings;
        executionContext.globalContext[`${stage.id}_executionTime`] =
            stageData.executionTime;
        executionContext.globalContext[`${stage.id}_status`] = stageData.status;

        // Update aggregate statistics
        const allFindings = this.getAllFindings(executionContext);
        executionContext.globalContext.totalFindings = allFindings.length;
        executionContext.globalContext.totalBlockers = allFindings.filter(
            (f) => f.severity === "blocker",
        ).length;
        executionContext.globalContext.totalMajor = allFindings.filter(
            (f) => f.severity === "major",
        ).length;
    }
}

/**
 * Create a singleton instance of the workflow engine
 */
let workflowEngineInstance: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
    if (!workflowEngineInstance) {
        workflowEngineInstance = new WorkflowEngine();
    }
    return workflowEngineInstance;
}
