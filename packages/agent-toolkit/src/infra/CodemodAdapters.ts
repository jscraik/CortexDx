import { resolve } from 'node:path';
import type { CodemodTool } from '@cortex-os/agent-toolkit/domain/ToolInterfaces.js';
import {
	resolveToolsDirFromOverride,
	type ToolsDirOverride,
} from '@cortex-os/agent-toolkit/infra/paths.js';
import { safeExecFile } from '@cortex-os/agent-toolkit/infra/securityBridge.js';
import type { AgentToolkitCodemodInput, AgentToolkitCodemodResult } from '@cortex-os/contracts';

/**
 * Comby code modification tool adapter
 */
export class CombyAdapter implements CodemodTool {
	private readonly scriptPathPromise: Promise<string>;

	constructor(toolsPath?: ToolsDirOverride) {
		this.scriptPathPromise = resolveToolsDirFromOverride(toolsPath).then((dir) =>
			resolve(dir, 'comby_rewrite.sh'),
		);
	}

	async rewrite(inputs: AgentToolkitCodemodInput): Promise<AgentToolkitCodemodResult> {
		try {
			const scriptPath = await this.scriptPathPromise;
			const { find, replace, path } = inputs;
			if (!find || !replace || !path) {
				throw new Error('Invalid codemod input');
			}
			// CodeQL Fix #204: Use safeExecFile instead of exec to prevent shell injection
			const { stdout } = await safeExecFile(scriptPath, [find, replace, path]);
			const result = JSON.parse(stdout) as AgentToolkitCodemodResult;

			// Validate the result matches our schema
			if (result.tool !== 'comby') {
				throw new Error('Unexpected tool result format');
			}

			return result;
		} catch (error) {
			return {
				tool: 'comby',
				op: 'rewrite',
				inputs,
				results: [],
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}
}
