import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { enforce, Grant } from '../../packages/policy/src/index.ts';

const POLICY_PATH = path.join(__dirname, 'policy.tools.json');

describe('policy.tools.json', () => {
	it('defines a valid sandbox grant schema', async () => {
		const raw = await readFile(POLICY_PATH, 'utf-8');
		const policy = JSON.parse(raw);
		const grant = Grant.parse(policy);

		expect(grant.tool).toBe('sandbox');
		expect(grant.actions).toEqual(expect.arrayContaining(['fs', 'egress']));
		expect(grant.fsScope.length).toBeGreaterThan(0);
		expect(grant.rate.perMinute).toBeGreaterThan(0);
		expect(policy.fs?.writeAllow).toEqual(grant.fsScope);
	});

	it('permits tmp sandbox writes while blocking siblings', async () => {
		const raw = await readFile(POLICY_PATH, 'utf-8');
		const policy = JSON.parse(raw);
		const grant = Grant.parse(policy);
		const allowedPath = path.join(process.cwd(), 'apps/cortex-os/feature/tmp/output.txt');
		const blockedPath = path.join(process.cwd(), 'apps/cortex-os/feature/logs/output.txt');

		expect(() => enforce(grant, 'fs', { path: allowedPath })).not.toThrow();
		expect(() => enforce(grant, 'fs', { path: blockedPath })).toThrow();
	});
});
