#!/usr/bin/env -S node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const boss = 'AGENTS.md is the canonical authority';
const governanceRuleFiles = ['AGENTS.md'];

const requiredContextFiles = [
	// Web stack essentials
	'.cortexdx/context/web-frameworks/next.js.md',
	'.cortexdx/context/web-frameworks/react.md',
	'.cortexdx/context/web-frameworks/shadcn-ui.md',
	'.cortexdx/context/web-frameworks/tailwind-css.md',
	'.cortexdx/context/dev-tools/typescript.md',
	'.cortexdx/context/dev-tools/node.js.md',
	'.cortexdx/context/dev-tools/pnpm.md',
	// OS and protocols
	'.cortexdx/context/process/cortex-os-implementation-plan.md',
	'.cortexdx/context/protocols/model-context-protocol.md',
	'.cortexdx/context/ai-ml/mlx.md',
];

let failed = false;

// 1) Validate "boss" line in governance rule files
for (const f of governanceRuleFiles) {
	try {
		const content = readFileSync(f, 'utf8');
		if (!content.includes(boss)) {
			console.error(`Missing boss line in ${f}`);
			failed = true;
		}
	} catch (e) {
		console.error(`Failed to read governance rule file: ${f} -> ${String(e)}`);
		failed = true;
	}
}

// 2) Ensure critical context docs exist (prevent regressions on accidental moves/deletes)
for (const f of requiredContextFiles) {
	const p = resolve(process.cwd(), f);
	if (!existsSync(p)) {
		console.error(`Required context doc missing: ${f}`);
		failed = true;
	}
}

if (failed) process.exit(1);
console.log('validate-docs: OK');
