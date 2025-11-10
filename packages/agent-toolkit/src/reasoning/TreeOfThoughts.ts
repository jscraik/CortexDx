export type ThoughtStatus = 'pending' | 'explored' | 'success' | 'failed';

export interface ThoughtNode {
	id: string;
	content: string;
	score?: number;
	status: ThoughtStatus;
	parentId?: string;
	children: string[];
}

interface TreeOfThoughtsDeps {
	readonly propose: (prompt: string) => Promise<string[]>;
	readonly score: (idea: string) => Promise<number>;
}

interface ExploreOptions {
	readonly maxDepth?: number;
	readonly beamWidth?: number;
}

interface FrontierItem {
	readonly node: ThoughtNode;
	readonly depth: number;
}

type ExploreConfig = {
	readonly maxDepth: number;
	readonly beamWidth: number;
};

export class TreeOfThoughtsExecutor {
	private readonly propose: TreeOfThoughtsDeps['propose'];
	private readonly score: TreeOfThoughtsDeps['score'];
	private readonly maxDepth: number;
	private readonly beamWidth: number;
	private lastTraversal = new Map<string, ThoughtNode>();
	private idCounter = 0;

	constructor(deps: TreeOfThoughtsDeps, defaults: ExploreOptions = {}) {
		this.propose = deps.propose;
		this.score = deps.score;
		this.maxDepth = Math.max(1, defaults.maxDepth ?? 5);
		this.beamWidth = Math.max(1, defaults.beamWidth ?? 3);
	}

	async explore(problem: string, options: ExploreOptions = {}): Promise<ThoughtNode> {
		const config: ExploreConfig = {
			maxDepth: Math.min(Math.max(1, options.maxDepth ?? this.maxDepth), 10),
			beamWidth: Math.min(Math.max(1, options.beamWidth ?? this.beamWidth), 6),
		};

		this.lastTraversal = new Map<string, ThoughtNode>();

		const root: ThoughtNode = {
			id: this.nextId(),
			content: problem,
			status: 'pending',
			children: [],
		};
		this.register(root);
		const frontier: FrontierItem[] = [{ node: root, depth: 0 }];

		while (frontier.length > 0) {
			const current = frontier.shift();
			if (!current) {
				break;
			}

			if (current.depth >= config.maxDepth) {
				if (current.node.children.length === 0) {
					current.node.status = 'failed';
				}
				continue;
			}

			const success = await this.expandNode(current, config, frontier);
			if (success) {
				return success;
			}
		}

		root.status = root.children.length === 0 ? 'failed' : root.status;
		return root;
	}

	private async expandNode(
		current: FrontierItem,
		config: ExploreConfig,
		frontier: FrontierItem[],
	): Promise<ThoughtNode | undefined> {
		const ideas = await this.propose(current.node.content);
		if (ideas.length === 0) {
			return undefined;
		}

		const scoredIdeas = await Promise.all(
			ideas.map(async (idea) => ({ idea, score: await this.score(idea) })),
		);
		const rankedIdeas = [...scoredIdeas]
			.sort((a, b) => b.score - a.score)
			.slice(0, config.beamWidth);

		current.node.status = 'explored';

		for (const { idea, score } of rankedIdeas) {
			const child: ThoughtNode = {
				id: this.nextId(),
				content: idea,
				score,
				status: this.isSuccess(idea, score) ? 'success' : 'pending',
				parentId: current.node.id,
				children: [],
			};
			current.node.children.push(child.id);
			this.register(child);

			if (child.status === 'success') {
				return child;
			}

			frontier.push({ node: child, depth: current.depth + 1 });
		}

		return undefined;
	}

	private register(node: ThoughtNode) {
		this.lastTraversal.set(node.id, node);
	}

	private buildPath(nodeId: string): ThoughtNode[] {
		const path: ThoughtNode[] = [];
		let current = this.lastTraversal.get(nodeId);
		while (current) {
			path.unshift(current);
			if (!current.parentId) {
				break;
			}
			current = this.lastTraversal.get(current.parentId);
		}
		return path;
	}

	public extractPath(nodeId: string): ThoughtNode[] {
		return this.buildPath(nodeId);
	}

	private isSuccess(content: string, score: number): boolean {
		return score >= 0.8 || /final answer/i.test(content);
	}

	private nextId(): string {
		this.idCounter += 1;
		return `tot-${this.idCounter}`;
	}
}
