import type { ReActStep } from '@cortex-os/agent-toolkit/reasoning/ReActExecutor.js';

export type ReasoningNodeType = 'question' | 'tool_call' | 'observation' | 'conclusion';

export interface ReasoningNode {
	id: string;
	type: ReasoningNodeType;
	content: string;
	confidence: number;
	edges: string[];
}

export class ReasoningGraphTracker {
	async build(steps: ReActStep[]): Promise<{ nodes: ReasoningNode[] }> {
		const nodes: ReasoningNode[] = [];
		const map = new Map<string, ReasoningNode>();
		let previous: string | undefined;

		steps.forEach((step, index) => {
			const thoughtId = `thought-${index}`;
			const thoughtNode = this.createNode(thoughtId, 'question', step.thought, 0.6);
			nodes.push(thoughtNode);
			map.set(thoughtId, thoughtNode);
			this.link(map, previous, thoughtId);
			previous = thoughtId;

			if (step.action) {
				const actionId = `action-${index}`;
				const actionNode = this.createNode(actionId, 'tool_call', step.action.tool, 0.55);
				nodes.push(actionNode);
				map.set(actionId, actionNode);
				this.link(map, previous, actionId);
				previous = actionId;
			}

			if (step.observation !== undefined) {
				const observationId = `observation-${index}`;
				const observationNode = this.createNode(
					observationId,
					'observation',
					this.serialise(step.observation),
					0.65,
				);
				nodes.push(observationNode);
				map.set(observationId, observationNode);
				this.link(map, previous, observationId);
				previous = observationId;
			}

			if (/final answer/i.test(step.thought)) {
				const conclusionId = `conclusion-${index}`;
				const conclusionNode = this.createNode(
					conclusionId,
					'conclusion',
					this.extractConclusion(step.thought),
					0.9,
				);
				nodes.push(conclusionNode);
				map.set(conclusionId, conclusionNode);
				this.link(map, previous, conclusionId);
				previous = conclusionId;
			}
		});

		return { nodes };
	}

	hasCycles(nodes: ReasoningNode[]): boolean {
		const adjacency = new Map<string, string[]>(nodes.map((node) => [node.id, node.edges]));
		const visiting = new Set<string>();
		const visited = new Set<string>();

		const dfs = (nodeId: string): boolean => {
			if (visiting.has(nodeId)) {
				return true;
			}
			if (visited.has(nodeId)) {
				return false;
			}
			visiting.add(nodeId);
			for (const next of adjacency.get(nodeId) ?? []) {
				if (dfs(next)) {
					return true;
				}
			}
			visiting.delete(nodeId);
			visited.add(nodeId);
			return false;
		};

		return nodes.some((node) => dfs(node.id));
	}

	bestPath(nodes: ReasoningNode[]): string[] {
		const map = new Map(nodes.map((node) => [node.id, node]));
		const incoming = new Map<string, number>();
		nodes.forEach((node) => {
			node.edges.forEach((edge) => {
				incoming.set(edge, (incoming.get(edge) ?? 0) + 1);
			});
		});

		const roots = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
		if (roots.length === 0) {
			return [];
		}

		let bestScore = -Infinity;
		let bestPath: string[] = [];

		const dfs = (nodeId: string, path: string[], score: number) => {
			const node = map.get(nodeId);
			if (!node) {
				return;
			}
			const nextScore = score + node.confidence;
			const nextPath = [...path, nodeId];
			if (node.edges.length === 0 && nextScore > bestScore) {
				bestScore = nextScore;
				bestPath = nextPath;
			}
			node.edges.forEach((edge) => dfs(edge, nextPath, nextScore));
		};

		roots.forEach((root) => dfs(root.id, [], 0));
		return bestPath;
	}

	private createNode(
		id: string,
		type: ReasoningNodeType,
		content: string,
		confidence: number,
	): ReasoningNode {
		return { id, type, content, confidence, edges: [] };
	}

	private link(map: Map<string, ReasoningNode>, from: string | undefined, to: string) {
		if (!from) {
			return;
		}
		const node = map.get(from);
		if (node && !node.edges.includes(to)) {
			node.edges.push(to);
		}
	}

	private serialise(value: unknown): string {
		if (value === null || value === undefined) {
			return 'unknown';
		}
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return `${value}`;
		}
		try {
			return JSON.stringify(value).slice(0, 120);
		} catch {
			return 'unserializable';
		}
	}

	private extractConclusion(thought: string): string {
		const lower = thought.toLowerCase();
		const marker = 'final answer';
		const markerIndex = lower.indexOf(marker);
		if (markerIndex === -1) {
			return thought.trim();
		}

		const colonIndex = thought.indexOf(':', markerIndex);
		if (colonIndex === -1) {
			return thought.slice(markerIndex + marker.length).trim();
		}

		return thought.slice(colonIndex + 1).trim();
	}
}
