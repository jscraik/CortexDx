/**
 * Plugin Orchestrator
 * Manages parallel and sequential execution of diagnostic plugins with workflow support
 * Requirements: 17.2, 17.3, 17.4
 */

import { randomUUID } from "node:crypto";
import {
  BUILTIN_PLUGINS,
  DEVELOPMENT_PLUGINS,
  getDevelopmentPluginById,
  getPluginById,
} from "@brainwav/cortexdx-plugins";
import type {
  DevelopmentContext,
  DevelopmentPlugin,
  DiagnosticContext,
  DiagnosticPlugin,
  Finding,
} from "@brainwav/cortexdx-core";
import { extractFindingFields } from "@brainwav/cortexdx-core/utils/type-helpers";

export interface PluginWorkflow {
  id: string;
  name: string;
  description: string;
  stages: WorkflowStage[];
  dependencies: WorkflowDependency[];
  timeout?: number; // Overall workflow timeout in ms
}

export interface WorkflowStage {
  id: string;
  pluginId: string;
  order: number;
  parallel: boolean; // Execute with other stages at same order
  inputMapping?: Record<string, string>; // Map outputs from previous stages
  condition?: StageCondition; // Conditional execution
  timeout?: number; // Stage-specific timeout in ms
}

export interface StageCondition {
  type: "severity" | "finding_count" | "custom";
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | "contains";
  value: string | number;
  field?: string; // For custom conditions
}

export interface WorkflowDependency {
  fromStage: string;
  toStage: string;
  dataFlow: string[]; // Which data flows between stages
  required: boolean; // Whether dependency must succeed
}

export interface PluginResults {
  results: Map<string, Finding[]>;
  executionTime: number;
  errors: Map<string, Error>;
  startTime: number;
  endTime: number;
}

export interface WorkflowResults {
  workflowId: string;
  stageResults: Map<string, Finding[]>;
  totalExecutionTime: number;
  stageTimings: Map<string, number>;
  skippedStages: string[]; // Stages skipped due to conditions
  errors: Map<string, Error>;
  success: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PluginInfo {
  id: string;
  title: string;
  category: "diagnostic" | "development";
  order?: number;
  requiresLlm?: boolean;
  supportedLanguages?: string[];
}

/**
 * Plugin Orchestrator class for managing plugin execution
 */
export class PluginOrchestrator {
  private workflows: Map<string, PluginWorkflow> = new Map();
  private executionHistory: Map<string, WorkflowResults[]> = new Map();

  /**
   * Execute a single plugin
   */
  async executePlugin(
    pluginId: string,
    context: DiagnosticContext | DevelopmentContext,
  ): Promise<Finding[]> {
    const plugin = this.getPlugin(pluginId, context);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      // Type guard to ensure correct context is passed to the plugin
      if (this.isDevelopmentPlugin(plugin)) {
        if (!this.isDevelopmentContext(context)) {
          throw new Error(`Context type mismatch for plugin: ${pluginId}`);
        }
        const findings = await plugin.run(context);
        return findings;
      }
      // For diagnostic plugins, we can use either context type
      const findings = await plugin.run(context);
      return findings;
    } catch (error) {
      throw new Error(
        `Plugin execution failed: ${pluginId} - ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Execute multiple plugins in parallel
   * Optimized for <30s completion (Req 17.2)
   */
  async executeParallel(
    pluginIds: string[],
    context: DiagnosticContext | DevelopmentContext,
  ): Promise<PluginResults> {
    const startTime = Date.now();
    const results = new Map<string, Finding[]>();
    const errors = new Map<string, Error>();

    // Execute all plugins in parallel
    const promises = pluginIds.map(async (pluginId) => {
      try {
        const findings = await this.executePlugin(pluginId, context);
        results.set(pluginId, findings);
      } catch (error) {
        errors.set(
          pluginId,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    await Promise.all(promises);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    return {
      results,
      executionTime,
      errors,
      startTime,
      endTime,
    };
  }

  /**
   * Execute plugins sequentially with dependency resolution
   * Requirements: 17.3, 17.4
   */
  async executeSequential(
    workflow: PluginWorkflow,
    context: DiagnosticContext | DevelopmentContext,
  ): Promise<WorkflowResults> {
    const startTime = Date.now();
    const stageResults = new Map<string, Finding[]>();
    const stageTimings = new Map<string, number>();
    const skippedStages: string[] = [];
    const errors = new Map<string, Error>();

    // Validate workflow before execution
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(", ")}`);
    }

    // Group stages by order for parallel execution within same order
    const stagesByOrder = this.groupStagesByOrder(workflow.stages);

    // Execute stages in order
    for (const [order, stages] of stagesByOrder.entries()) {
      const parallelStages = stages.filter((s) => s.parallel);
      const sequentialStages = stages.filter((s) => !s.parallel);

      // Execute parallel stages at this order level
      if (parallelStages.length > 0) {
        await this.executeStagesInParallel(
          parallelStages,
          context,
          stageResults,
          stageTimings,
          skippedStages,
          errors,
          workflow,
        );
      }

      // Execute sequential stages at this order level
      for (const stage of sequentialStages) {
        await this.executeStage(
          stage,
          context,
          stageResults,
          stageTimings,
          skippedStages,
          errors,
          workflow,
        );
      }
    }

    const endTime = Date.now();
    const totalExecutionTime = Math.max(1, endTime - startTime);

    const result: WorkflowResults = {
      workflowId: workflow.id,
      stageResults,
      totalExecutionTime,
      stageTimings,
      skippedStages,
      errors,
      success: errors.size === 0,
    };

    // Store in execution history
    if (!this.executionHistory.has(workflow.id)) {
      this.executionHistory.set(workflow.id, []);
    }
    this.executionHistory.get(workflow.id)?.push(result);

    return result;
  }

  /**
   * Create a new workflow
   */
  createWorkflow(
    definition: Omit<PluginWorkflow, "id"> & { id?: string },
  ): PluginWorkflow {
    const { id, ...rest } = definition;
    const workflow: PluginWorkflow = {
      id: id ?? `workflow-${randomUUID()}`,
      ...rest,
    };

    // Validate workflow
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(
        `Invalid workflow definition: ${validation.errors.join(", ")}`,
      );
    }

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Validate workflow definition
   * Requirements: 17.3
   */
  validateWorkflow(workflow: PluginWorkflow): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty stages
    if (workflow.stages.length === 0) {
      errors.push("Workflow must have at least one stage");
    }

    // Check for duplicate stage IDs
    const stageIds = new Set<string>();
    for (const stage of workflow.stages) {
      if (stageIds.has(stage.id)) {
        errors.push(`Duplicate stage ID: ${stage.id}`);
      }
      stageIds.add(stage.id);

      // Validate plugin exists
      const plugin = this.getPluginInfo(stage.pluginId);
      if (!plugin) {
        errors.push(`Plugin not found: ${stage.pluginId}`);
      }
    }

    // Validate dependencies
    for (const dep of workflow.dependencies) {
      if (!stageIds.has(dep.fromStage)) {
        errors.push(`Dependency references unknown stage: ${dep.fromStage}`);
      }
      if (!stageIds.has(dep.toStage)) {
        errors.push(`Dependency references unknown stage: ${dep.toStage}`);
      }

      // Check for circular dependencies
      if (this.hasCircularDependency(workflow, dep.fromStage, dep.toStage)) {
        errors.push(
          `Circular dependency detected: ${dep.fromStage} -> ${dep.toStage}`,
        );
      }
    }

    // Validate stage ordering
    const orderMap = new Map<string, number>();
    for (const stage of workflow.stages) {
      orderMap.set(stage.id, stage.order);
    }

    for (const dep of workflow.dependencies) {
      const fromOrder = orderMap.get(dep.fromStage);
      const toOrder = orderMap.get(dep.toStage);
      if (
        fromOrder !== undefined &&
        toOrder !== undefined &&
        fromOrder >= toOrder
      ) {
        warnings.push(
          `Dependency ${dep.fromStage} -> ${dep.toStage} has invalid order (${fromOrder} >= ${toOrder})`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * List all available plugins
   */
  listPlugins(): PluginInfo[] {
    const { BUILTIN_PLUGINS, DEVELOPMENT_PLUGINS } = this.getPluginLists();

    const diagnosticPlugins: PluginInfo[] = BUILTIN_PLUGINS.map((p) => ({
      id: p.id,
      title: p.title,
      category: "diagnostic" as const,
      order: p.order,
    }));

    const developmentPlugins: PluginInfo[] = DEVELOPMENT_PLUGINS.map((p) => ({
      id: p.id,
      title: p.title,
      category: "development" as const,
      order: p.order,
      requiresLlm: p.requiresLlm,
      supportedLanguages: p.supportedLanguages,
    }));

    return [...diagnosticPlugins, ...developmentPlugins];
  }

  /**
   * Get plugin schema information
   */
  getPluginSchema(pluginId: string): PluginInfo | null {
    return this.getPluginInfo(pluginId);
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): PluginWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * List all workflows
   */
  listWorkflows(): PluginWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  /**
   * Get execution history for a workflow
   */
  getExecutionHistory(workflowId: string): WorkflowResults[] {
    return this.executionHistory.get(workflowId) || [];
  }

  // Private helper methods

  private getPlugin(
    pluginId: string,
    context: DiagnosticContext | DevelopmentContext,
  ): DiagnosticPlugin | DevelopmentPlugin | null {
    if (this.isDevelopmentContext(context)) {
      const devPlugin = getDevelopmentPluginById(pluginId);
      if (devPlugin) return devPlugin;
      const diagPlugin = getPluginById(pluginId);
      return diagPlugin || null;
    }
    const plugin = getPluginById(pluginId);
    return plugin || null;
  }

  private getPluginInfo(pluginId: string): PluginInfo | null {
    const { BUILTIN_PLUGINS, DEVELOPMENT_PLUGINS } = this.getPluginLists();

    const diagnosticPlugin = BUILTIN_PLUGINS.find((p) => p.id === pluginId);
    if (diagnosticPlugin) {
      return {
        id: diagnosticPlugin.id,
        title: diagnosticPlugin.title,
        category: "diagnostic",
        order: diagnosticPlugin.order,
      };
    }

    const developmentPlugin = DEVELOPMENT_PLUGINS.find(
      (p) => p.id === pluginId,
    );
    if (developmentPlugin) {
      return {
        id: developmentPlugin.id,
        title: developmentPlugin.title,
        category: "development",
        order: developmentPlugin.order,
        requiresLlm: developmentPlugin.requiresLlm,
        supportedLanguages: developmentPlugin.supportedLanguages,
      };
    }

    return null;
  }

  private getPluginLists() {
    // Return imported plugin lists
    return { BUILTIN_PLUGINS, DEVELOPMENT_PLUGINS };
  }

  private isDevelopmentContext(
    context: DiagnosticContext | DevelopmentContext,
  ): context is DevelopmentContext {
    return "sessionId" in context && "userExpertiseLevel" in context;
  }

  private isDevelopmentPlugin(
    plugin: DiagnosticPlugin | DevelopmentPlugin,
  ): plugin is DevelopmentPlugin {
    return "category" in plugin;
  }

  private groupStagesByOrder(
    stages: WorkflowStage[],
  ): Map<number, WorkflowStage[]> {
    const grouped = new Map<number, WorkflowStage[]>();
    for (const stage of stages) {
      if (!grouped.has(stage.order)) {
        grouped.set(stage.order, []);
      }
      grouped.get(stage.order)?.push(stage);
    }
    return new Map([...grouped.entries()].sort((a, b) => a[0] - b[0]));
  }

  private async executeStagesInParallel(
    stages: WorkflowStage[],
    context: DiagnosticContext | DevelopmentContext,
    stageResults: Map<string, Finding[]>,
    stageTimings: Map<string, number>,
    skippedStages: string[],
    errors: Map<string, Error>,
    workflow: PluginWorkflow,
  ): Promise<void> {
    const promises = stages.map((stage) =>
      this.executeStage(
        stage,
        context,
        stageResults,
        stageTimings,
        skippedStages,
        errors,
        workflow,
      ),
    );
    await Promise.all(promises);
  }

  private async executeStage(
    stage: WorkflowStage,
    context: DiagnosticContext | DevelopmentContext,
    stageResults: Map<string, Finding[]>,
    stageTimings: Map<string, number>,
    skippedStages: string[],
    errors: Map<string, Error>,
    workflow: PluginWorkflow,
  ): Promise<void> {
    const stageStartTime = Date.now();

    try {
      // Check if stage should be skipped based on condition
      if (stage.condition) {
        const shouldExecute = this.evaluateCondition(
          stage.condition,
          stageResults,
        );
        if (!shouldExecute) {
          skippedStages.push(stage.id);
          return;
        }
      }

      // Check dependencies
      const dependencies = workflow.dependencies.filter(
        (d) => d.toStage === stage.id,
      );
      for (const dep of dependencies) {
        if (dep.required && errors.has(dep.fromStage)) {
          skippedStages.push(stage.id);
          errors.set(
            stage.id,
            new Error(`Skipped due to failed dependency: ${dep.fromStage}`),
          );
          return;
        }
      }

      // Apply input mapping if specified
      const mappedContext = this.applyInputMapping(
        stage,
        context,
        stageResults,
        workflow,
      );

      // Execute plugin with timeout
      const timeout = stage.timeout || workflow.timeout || 30000;
      const findings = await this.executeWithTimeout(
        () => this.executePlugin(stage.pluginId, mappedContext),
        timeout,
      );

      stageResults.set(stage.id, findings);
    } catch (error) {
      errors.set(
        stage.id,
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      const stageEndTime = Date.now();
      stageTimings.set(stage.id, Math.max(1, stageEndTime - stageStartTime));
    }
  }

  private evaluateCondition(
    condition: StageCondition,
    stageResults: Map<string, Finding[]>,
  ): boolean {
    const allFindings = Array.from(stageResults.values()).flat();

    switch (condition.type) {
      case "severity": {
        const count = allFindings.filter(
          (f) => f.severity === condition.value,
        ).length;
        return this.compareValues(
          count,
          condition.operator,
          Number(condition.value) || 0,
        );
      }
      case "finding_count": {
        const count = allFindings.length;
        return this.compareValues(
          count,
          condition.operator,
          Number(condition.value),
        );
      }
      case "custom": {
        if (!condition.field) return true;
        const fieldName = condition.field;
        // Custom field evaluation (simplified)
        const fieldValues = extractFindingFields(allFindings, fieldName);
        return fieldValues.some((v) =>
          this.compareValues(v, condition.operator, condition.value),
        );
      }
      default:
        return true;
    }
  }

  private compareValues(
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

  private applyInputMapping(
    stage: WorkflowStage,
    context: DiagnosticContext | DevelopmentContext,
    stageResults: Map<string, Finding[]>,
    workflow: PluginWorkflow,
  ): DiagnosticContext | DevelopmentContext {
    if (!stage.inputMapping) {
      return context;
    }

    // Get dependencies for this stage
    const dependencies = workflow.dependencies.filter(
      (d) => d.toStage === stage.id,
    );

    // Build mapped context with data from previous stages
    const mappedData: Record<string, unknown> = {};
    for (const dep of dependencies) {
      const sourceResults = stageResults.get(dep.fromStage);
      if (sourceResults) {
        for (const dataKey of dep.dataFlow) {
          const targetKey = stage.inputMapping[dataKey] || dataKey;
          mappedData[targetKey] = sourceResults;
        }
      }
    }

    // Merge mapped data into context
    return {
      ...context,
      ...mappedData,
    };
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Execution timeout after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  private hasCircularDependency(
    workflow: PluginWorkflow,
    fromStage: string,
    toStage: string,
  ): boolean {
    if (fromStage === toStage) {
      return true;
    }
    return this.pathExists(workflow, toStage, fromStage, new Set<string>());
  }

  private pathExists(
    workflow: PluginWorkflow,
    currentStage: string,
    targetStage: string,
    visiting: Set<string>,
  ): boolean {
    if (currentStage === targetStage) {
      return true;
    }
    if (visiting.has(currentStage)) {
      return false;
    }

    visiting.add(currentStage);
    const nextDeps = workflow.dependencies.filter(
      (d) => d.fromStage === currentStage,
    );
    for (const dep of nextDeps) {
      if (this.pathExists(workflow, dep.toStage, targetStage, visiting)) {
        visiting.delete(currentStage);
        return true;
      }
    }
    visiting.delete(currentStage);
    return false;
  }
}

/**
 * Create a singleton instance of the orchestrator
 */
let orchestratorInstance: PluginOrchestrator | null = null;

export function getPluginOrchestrator(): PluginOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PluginOrchestrator();
  }
  return orchestratorInstance;
}
