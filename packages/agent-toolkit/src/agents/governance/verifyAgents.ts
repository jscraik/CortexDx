import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'yaml';

export interface VerifyAgentsOptions {
	workspaceRoot?: string;
	agentRoots?: string[];
	fast?: boolean;
	logger?: Pick<typeof console, 'info' | 'warn' | 'error'>;
}

export interface AgentIssue {
	type: 'error' | 'warning';
	message: string;
}

export interface AgentCheck {
	agentDir: string;
	configPath: string;
	issues: AgentIssue[];
}

export interface VerifyAgentsResult {
	success: boolean;
	agents: AgentCheck[];
}

const DEFAULT_AGENT_ROOTS = ['packages/agents'];
const REQUIRED_FILES: Array<{ path: string; description: string }> = [
	{ path: 'README.md', description: 'Agent README' },
	{ path: 'capabilities.json', description: 'Capabilities declaration' },
	{ path: 'SECURITY.md', description: 'Security posture' },
];
const REQUIRED_DIRECTORIES: Array<{ path: string; description: string }> = [
	{ path: 'tests', description: 'Tests directory' },
];

const IGNORED_DIRECTORIES = new Set([
	'.git',
	'.nx',
	'.cortex',
	'coverage',
	'dist',
	'node_modules',
	'out',
	'reports',
	'tmp',
]);

const CONFIG_FILENAMES = new Set(['agent.config.json', 'agent.config.yaml', 'agent.config.yml']);

let cachedValidator:
	| {
			validate: ValidateFunction;
			schemaLoadedFrom: string;
	  }
	| undefined;

const createValidator = async (workspaceRoot: string) => {
	const schemaPath = path.join(workspaceRoot, 'schemas', 'agent-config.schema.json');
	if (!cachedValidator || cachedValidator.schemaLoadedFrom !== schemaPath) {
		const schemaRaw = await readFile(schemaPath, 'utf-8');
		const schemaJson = JSON.parse(schemaRaw);
		const ajv = new Ajv2020({
			allErrors: true,
			allowUnionTypes: true,
			strict: false,
		});
		addFormats(ajv);
		cachedValidator = {
			validate: ajv.compile(schemaJson),
			schemaLoadedFrom: schemaPath,
		};
	}
	return cachedValidator.validate;
};

const readAgentConfig = async (filePath: string) => {
	const raw = await readFile(filePath, 'utf-8');
	if (filePath.endsWith('.json')) {
		return JSON.parse(raw);
	}
	return yaml.parse(raw);
};

const pathExists = async (targetPath: string, expectDirectory: boolean) => {
	try {
		const stats = await stat(targetPath);
		return expectDirectory ? stats.isDirectory() : stats.isFile();
	} catch {
		return false;
	}
};

const discoverConfigFiles = async (root: string): Promise<string[]> => {
	const queue: string[] = [root];
	const results: string[] = [];
	while (queue.length > 0) {
		const current = queue.pop();
		if (!current) continue;
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (!IGNORED_DIRECTORIES.has(entry.name)) {
					queue.push(path.join(current, entry.name));
				}
				continue;
			}
			if (CONFIG_FILENAMES.has(entry.name)) {
				results.push(path.join(current, entry.name));
			}
		}
	}
	return results;
};

const resolveAgentDir = (configPath: string) => path.dirname(configPath);

const ensureEvidence = async (
	agentDir: string,
	fast: boolean | undefined,
): Promise<AgentIssue[]> => {
	const evidenceDir = path.join(agentDir, 'evidence');
	const exists = await pathExists(evidenceDir, true);
	if (!exists) {
		return [
			{
				type: 'error',
				message: 'Missing evidence directory at evidence/',
			},
		];
	}
	if (fast) {
		return [];
	}
	try {
		const files = await readdir(evidenceDir);
		const artifacts = files.filter((file) => !file.startsWith('.'));
		if (artifacts.length < 3) {
			return [
				{
					type: 'error',
					message: `Evidence directory must contain at least 3 artefacts, found ${artifacts.length}`,
				},
			];
		}
		return [];
	} catch (error) {
		return [
			{
				type: 'error',
				message: `Unable to read evidence directory: ${(error as Error).message}`,
			},
		];
	}
};

const ensureRequiredArtifacts = async (
	agentDir: string,
	fast: boolean | undefined,
): Promise<AgentIssue[]> => {
	const issues: AgentIssue[] = [];
	for (const requirement of REQUIRED_FILES) {
		const target = path.join(agentDir, requirement.path);
		if (!(await pathExists(target, false))) {
			issues.push({
				type: 'error',
				message: `Missing required file: ${requirement.path} (${requirement.description})`,
			});
		}
	}
	for (const requirement of REQUIRED_DIRECTORIES) {
		const target = path.join(agentDir, requirement.path);
		const expectDir = await pathExists(target, true);
		if (!expectDir) {
			issues.push({
				type: 'error',
				message: `Missing required directory: ${requirement.path} (${requirement.description})`,
			});
		}
	}
	if (!fast) {
		issues.push(...(await ensureEvidence(agentDir, fast)));
	}
	return issues;
};

const ensureAccessibility = async (
	agentDir: string,
	agentConfig: Record<string, unknown>,
): Promise<AgentIssue[]> => {
	const uiConfig = agentConfig['ui'] as Record<string, unknown> | undefined;
	const requiresAccessibility = Boolean(uiConfig?.['requiresAccessibility']);
	const surfaces = Array.isArray(uiConfig?.['surfaces'])
		? (uiConfig?.['surfaces'] as unknown[])
		: [];
	const accessibilityRequired = requiresAccessibility || surfaces.length > 0;
	if (!accessibilityRequired) {
		return [];
	}
	const a11yPath = path.join(agentDir, 'a11y.md');
	if (!(await pathExists(a11yPath, false))) {
		return [
			{
				type: 'error',
				message: 'UI agent requires a11y.md with accessibility coverage',
			},
		];
	}
	return [];
};

const relativeToWorkspace = (workspaceRoot: string, target: string) =>
	path.relative(workspaceRoot, target) || path.basename(target);

export async function verifyAgents(options: VerifyAgentsOptions = {}): Promise<VerifyAgentsResult> {
	const workspaceRoot = options.workspaceRoot ?? process.cwd();
	const logger = options.logger ?? console;
	const agentRoots = options.agentRoots?.length
		? options.agentRoots
		: DEFAULT_AGENT_ROOTS.map((root) => path.join(workspaceRoot, root));

	const validator = await createValidator(workspaceRoot);
	const checks: AgentCheck[] = [];

	for (const agentRoot of agentRoots) {
		const configFiles = await discoverConfigFiles(agentRoot);
		if (configFiles.length === 0) {
			logger.warn?.(
				`No agent manifests found under ${relativeToWorkspace(workspaceRoot, agentRoot)}`,
			);
		}
		for (const configFile of configFiles) {
			const configPathRel = relativeToWorkspace(workspaceRoot, configFile);
			const agentDir = resolveAgentDir(configFile);
			const issues: AgentIssue[] = [];
			try {
				const config = await readAgentConfig(configFile);
				const valid = validator(config);
				if (!valid && validator.errors) {
					for (const err of validator.errors) {
						issues.push({
							type: 'error',
							message: `Schema violation at ${err.instancePath || '/'}: ${err.message ?? 'unknown error'}`,
						});
					}
				}
				issues.push(...(await ensureRequiredArtifacts(agentDir, options.fast)));
				issues.push(...(await ensureAccessibility(agentDir, config)));
			} catch (error) {
				issues.push({
					type: 'error',
					message: `Failed to load ${configPathRel}: ${(error as Error).message}`,
				});
			}
			checks.push({
				agentDir: relativeToWorkspace(workspaceRoot, agentDir),
				configPath: configPathRel,
				issues,
			});
		}
	}

	const flattenedIssues = checks.flatMap((check) =>
		check.issues.filter((issue) => issue.type === 'error'),
	);
	const success = flattenedIssues.length === 0;
	if (success) {
		logger.info?.(`Agent governance verification succeeded for ${checks.length} manifest(s).`);
	} else {
		logger.error?.(`Agent governance verification failed with ${flattenedIssues.length} error(s).`);
	}

	return { success, agents: checks };
}

export const verifyAgentsFast = (options: VerifyAgentsOptions = {}) =>
	verifyAgents({ ...options, fast: true });

export const ensureAgentsCompliant = async (options: VerifyAgentsOptions = {}) => {
	const result = await verifyAgents(options);
	if (!result.success) {
		const messages = result.agents
			.flatMap((agent) =>
				agent.issues
					.filter((issue) => issue.type === 'error')
					.map((issue) => `${agent.configPath}: ${issue.message}`),
			)
			.join('\n');
		throw new Error(messages || 'Agent governance verification failed');
	}
	return result;
};
