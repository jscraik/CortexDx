/**
 * Workflow Visualization for LangGraph workflows
 * Generates Mermaid diagrams and tracks execution state
 * Requirements: 18.5
 */

import type { WorkflowDefinition, WorkflowNode, WorkflowState } from "./agent-orchestrator.js";
import type { StateTransition } from "./state-manager.js";

/**
 * Visualization options
 */
export interface VisualizationOptions {
    includeTimings: boolean;
    highlightCurrentNode: boolean;
    showVisitedNodes: boolean;
    includeMetrics: boolean;
    theme?: "default" | "dark" | "forest" | "neutral";
}

/**
 * Node visualization style
 */
export interface NodeStyle {
    shape: "rectangle" | "rounded" | "stadium" | "circle" | "diamond" | "hexagon";
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
}

/**
 * Execution metrics per node
 */
export interface NodeMetrics {
    nodeId: string;
    executionCount: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    errorCount: number;
    lastExecutionTime?: number;
}

/**
 * Workflow visualization result
 */
export interface WorkflowVisualization {
    mermaidDiagram: string;
    metrics: Map<string, NodeMetrics>;
    executionPath: string[];
    currentNode?: string;
    totalExecutionTime: number;
}

/**
 * Workflow Visualization Engine
 */
export class WorkflowVisualizationEngine {
    private nodeStyles: Map<string, NodeStyle> = new Map();
    private defaultOptions: VisualizationOptions = {
        includeTimings: true,
        highlightCurrentNode: true,
        showVisitedNodes: true,
        includeMetrics: true,
        theme: "default",
    };

    /**
     * Generate Mermaid diagram from workflow definition
     * Requirements: 18.5
     */
    generateMermaidDiagram(
        definition: WorkflowDefinition,
        state?: WorkflowState,
        options?: Partial<VisualizationOptions>
    ): string {
        const opts = { ...this.defaultOptions, ...options };
        const lines: string[] = [];

        // Start diagram
        lines.push("graph TD");

        // Add theme if specified
        if (opts.theme && opts.theme !== "default") {
            lines.push(`    %%{init: {'theme':'${opts.theme}'}}%%`);
        }

        // Add nodes
        for (const node of definition.nodes) {
            const nodeLabel = this.createNodeLabel(node, state, opts);
            const nodeShape = this.getNodeShape(node);
            const nodeStyle = this.getNodeStyleString(node, state, opts);

            lines.push(`    ${node.id}${nodeShape[0]}${nodeLabel}${nodeShape[1]}${nodeStyle}`);
        }

        // Add edges
        for (const edge of definition.edges) {
            const edgeLabel = edge.label ? `|${edge.label}|` : "";
            const edgeStyle = edge.condition ? "-.->" : "-->";
            lines.push(`    ${edge.from} ${edgeStyle}${edgeLabel} ${edge.to}`);
        }

        // Add START and END nodes
        lines.push(`    START([START])`);
        lines.push(`    END([END])`);
        lines.push(`    START --> ${definition.entryPoint}`);

        // Add styling for special nodes
        if (opts.highlightCurrentNode && state?.currentNode) {
            lines.push(`    style ${state.currentNode} fill:#ffeb3b,stroke:#f57c00,stroke-width:4px`);
        }

        if (opts.showVisitedNodes && state?.visitedNodes) {
            for (const visitedNode of state.visitedNodes) {
                if (visitedNode !== state.currentNode) {
                    lines.push(`    style ${visitedNode} fill:#c8e6c9,stroke:#4caf50,stroke-width:2px`);
                }
            }
        }

        return lines.join("\n");
    }

    /**
     * Generate real-time execution highlighting
     * Requirements: 18.5
     */
    generateExecutionHighlight(
        diagram: string,
        state: WorkflowState
    ): string {
        let highlightedDiagram = diagram;

        // Highlight current node
        if (state.currentNode) {
            const currentStyle = `style ${state.currentNode} fill:#ffeb3b,stroke:#f57c00,stroke-width:4px`;
            if (!highlightedDiagram.includes(currentStyle)) {
                highlightedDiagram += `\n    ${currentStyle}`;
            }
        }

        // Highlight execution path
        for (let i = 0; i < state.executionPath.length - 1; i++) {
            const from = state.visitedNodes[i];
            const to = state.visitedNodes[i + 1];
            if (from && to) {
                highlightedDiagram += `\n    linkStyle ${i} stroke:#4caf50,stroke-width:3px`;
            }
        }

        return highlightedDiagram;
    }

    /**
     * Track state transition history
     * Requirements: 18.5
     */
    generateTransitionHistory(
        transitions: StateTransition[]
    ): string {
        const lines: string[] = [];

        lines.push("graph LR");
        lines.push("    subgraph \"State Transition History\"");

        for (let i = 0; i < transitions.length; i++) {
            const transition = transitions[i];
            if (transition) {
                const fromNode = transition.fromNode || "START";
                const toNode = transition.toNode;
                const duration = transition.durationMs
                    ? ` [${transition.durationMs}ms]`
                    : "";

                lines.push(`    ${fromNode}_${i} --> |${transition.transitionType}${duration}| ${toNode}_${i}`);
            }
        }

        lines.push("    end");

        return lines.join("\n");
    }

    /**
     * Calculate performance metrics per node
     * Requirements: 18.5
     */
    calculateNodeMetrics(
        state: WorkflowState,
        transitions?: StateTransition[]
    ): Map<string, NodeMetrics> {
        const metrics = new Map<string, NodeMetrics>();

        // Calculate from state timings
        for (const [nodeId, timing] of Object.entries(state.nodeTimings)) {
            const existing = metrics.get(nodeId);
            if (existing) {
                existing.executionCount++;
                existing.totalExecutionTime += timing;
                existing.averageExecutionTime = existing.totalExecutionTime / existing.executionCount;
                existing.minExecutionTime = Math.min(existing.minExecutionTime, timing);
                existing.maxExecutionTime = Math.max(existing.maxExecutionTime, timing);
                existing.lastExecutionTime = timing;
            } else {
                metrics.set(nodeId, {
                    nodeId,
                    executionCount: 1,
                    totalExecutionTime: timing,
                    averageExecutionTime: timing,
                    minExecutionTime: timing,
                    maxExecutionTime: timing,
                    errorCount: 0,
                    lastExecutionTime: timing,
                });
            }
        }

        // Add error counts
        const visitCounts = new Map<string, number>();
        for (const node of state.visitedNodes) {
            visitCounts.set(node, (visitCounts.get(node) || 0) + 1);
        }

        for (const [nodeId, count] of visitCounts.entries()) {
            const metric = metrics.get(nodeId);
            if (metric) {
                metric.executionCount = count;
            }
        }

        return metrics;
    }

    /**
     * Generate complete workflow visualization
     * Requirements: 18.5
     */
    generateVisualization(
        definition: WorkflowDefinition,
        state: WorkflowState,
        transitions?: StateTransition[],
        options?: Partial<VisualizationOptions>
    ): WorkflowVisualization {
        const opts = { ...this.defaultOptions, ...options };

        // Generate Mermaid diagram
        let mermaidDiagram = this.generateMermaidDiagram(definition, state, opts);

        // Add execution highlighting
        if (opts.highlightCurrentNode) {
            mermaidDiagram = this.generateExecutionHighlight(mermaidDiagram, state);
        }

        // Calculate metrics
        const metrics = opts.includeMetrics
            ? this.calculateNodeMetrics(state, transitions)
            : new Map();

        // Calculate total execution time
        const totalExecutionTime = Date.now() - state.startTime;

        return {
            mermaidDiagram,
            metrics,
            executionPath: state.executionPath,
            currentNode: state.currentNode,
            totalExecutionTime,
        };
    }

    /**
     * Generate metrics summary
     */
    generateMetricsSummary(metrics: Map<string, NodeMetrics>): string {
        const lines: string[] = [];

        lines.push("## Workflow Metrics\n");
        lines.push("| Node | Executions | Avg Time | Min Time | Max Time | Errors |");
        lines.push("|------|------------|----------|----------|----------|--------|");

        for (const [nodeId, metric] of metrics.entries()) {
            lines.push(
                `| ${nodeId} | ${metric.executionCount} | ${metric.averageExecutionTime.toFixed(2)}ms | ${metric.minExecutionTime}ms | ${metric.maxExecutionTime}ms | ${metric.errorCount} |`
            );
        }

        return lines.join("\n");
    }

    /**
     * Set custom node style
     */
    setNodeStyle(nodeId: string, style: NodeStyle): void {
        this.nodeStyles.set(nodeId, style);
    }

    /**
     * Get node style
     */
    getNodeStyle(nodeId: string): NodeStyle | undefined {
        return this.nodeStyles.get(nodeId);
    }

    /**
     * Update default visualization options
     */
    updateDefaultOptions(options: Partial<VisualizationOptions>): void {
        this.defaultOptions = { ...this.defaultOptions, ...options };
    }

    // Private helper methods

    private createNodeLabel(
        node: WorkflowNode,
        state?: WorkflowState,
        options?: VisualizationOptions
    ): string {
        let label = node.name;

        if (options?.includeTimings && state?.nodeTimings[node.id]) {
            const timing = state.nodeTimings[node.id];
            label += `<br/>${timing}ms`;
        }

        return label;
    }

    private getNodeShape(node: WorkflowNode): [string, string] {
        const customStyle = this.nodeStyles.get(node.id);
        if (customStyle) {
            switch (customStyle.shape) {
                case "rounded":
                    return ["(", ")"];
                case "stadium":
                    return ["([", "])"];
                case "circle":
                    return ["((", "))"];
                case "diamond":
                    return ["{", "}"];
                case "hexagon":
                    return ["{{", "}}"];
                default:
                    return ["[", "]"];
            }
        }

        // Default shapes based on node type
        switch (node.type) {
            case "decision":
                return ["{", "}"];
            case "human_input":
                return ["([", "])"];
            case "aggregation":
                return ["{{", "}}"];
            default:
                return ["[", "]"];
        }
    }

    private getNodeStyleString(
        node: WorkflowNode,
        state?: WorkflowState,
        options?: VisualizationOptions
    ): string {
        const customStyle = this.nodeStyles.get(node.id);
        if (customStyle && (customStyle.fill || customStyle.stroke)) {
            const parts: string[] = [];
            if (customStyle.fill) parts.push(`fill:${customStyle.fill}`);
            if (customStyle.stroke) parts.push(`stroke:${customStyle.stroke}`);
            if (customStyle.strokeWidth) parts.push(`stroke-width:${customStyle.strokeWidth}px`);
            return `:::${parts.join(",")}`;
        }

        return "";
    }

    /**
     * Export visualization to different formats
     */
    exportVisualization(
        visualization: WorkflowVisualization,
        format: "mermaid" | "json" | "markdown"
    ): string {
        switch (format) {
            case "mermaid":
                return visualization.mermaidDiagram;

            case "json":
                return JSON.stringify(
                    {
                        diagram: visualization.mermaidDiagram,
                        metrics: Array.from(visualization.metrics.entries()).map(
                            ([id, metricsData]) => ({ nodeId: id, ...metricsData })
                        ),
                        executionPath: visualization.executionPath,
                        currentNode: visualization.currentNode,
                        totalExecutionTime: visualization.totalExecutionTime,
                    },
                    null,
                    2
                );

            case "markdown":
                const lines: string[] = [];
                lines.push("# Workflow Visualization\n");
                lines.push("## Diagram\n");
                lines.push("```mermaid");
                lines.push(visualization.mermaidDiagram);
                lines.push("```\n");
                lines.push(this.generateMetricsSummary(visualization.metrics));
                lines.push(`\n**Total Execution Time:** ${visualization.totalExecutionTime}ms`);
                lines.push(`\n**Execution Path:** ${visualization.executionPath.join(" → ")}`);
                if (visualization.currentNode) {
                    lines.push(`\n**Current Node:** ${visualization.currentNode}`);
                }
                return lines.join("\n");

            default:
                return visualization.mermaidDiagram;
        }
    }
}

/**
 * Create a singleton instance of the visualization engine
 */
let visualizationEngineInstance: WorkflowVisualizationEngine | null = null;

export function getWorkflowVisualizationEngine(): WorkflowVisualizationEngine {
    if (!visualizationEngineInstance) {
        visualizationEngineInstance = new WorkflowVisualizationEngine();
    }
    return visualizationEngineInstance;
}
