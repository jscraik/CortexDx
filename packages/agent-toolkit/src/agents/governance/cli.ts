#!/usr/bin/env node
import { exit } from 'node:process';
import { parseArgs } from 'node:util';

import { ensureAgentsCompliant } from '@cortex-os/agent-toolkit/agents/governance/verifyAgents.js';

const parsed = parseArgs({
	options: {
		'workspace-root': { type: 'string' },
		fast: { type: 'boolean', default: false },
	},
});

const workspaceRoot = parsed.values['workspace-root'];
const fast = parsed.values.fast;

ensureAgentsCompliant({ workspaceRoot, fast })
	.then((result) => {
		if (!result.success) {
			exit(1);
		}
	})
	.catch((error) => {
		console.error(`[agents:verify] ${error instanceof Error ? error.message : String(error)}`);
		exit(1);
	});
