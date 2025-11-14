#!/usr/bin/env -S node
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { globby } from 'globby';

const ajv = new Ajv({ allErrors: true, strict: false });

function loadJSON(path: string) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

const schemaMap: Record<string, string> = {
	'policy.repo.json': '.cortexdx/schemas/policy.repo.schema.json',
	'policy.tools.json': '.cortexdx/schemas/policy.tools.schema.json',
	'policy.agents.json': '.cortexdx/schemas/policy.agents.schema.json',
	'agents.mandates.json': '.cortexdx/schemas/mandates.schema.json',
	'mcp-governance.json': '.cortexdx/schemas/mcp-governance.schema.json',
	'model-gateway.json': '.cortexdx/schemas/policy.tools.schema.json',
	'egress.allowlist.json': '.cortexdx/schemas/egress.allowlist.schema.json',
};

async function main() {
	const files = await globby(['.cortexdx/policy/*.json'], { gitignore: true });
	let failed = false;
	for (const file of files) {
		const base = file.split('/').pop() as string;
		const schemaPath = schemaMap[base];
		if (!schemaPath) continue; // skip unknown files
		const schema = loadJSON(schemaPath);
		const data = loadJSON(file);
		const validate = ajv.compile(schema);
		const ok = validate(data);
		if (!ok) {
			failed = true;
			console.error(`Schema validation failed for ${file}`);
			console.error(validate.errors);
		}
	}
	if (failed) process.exit(1);
	console.log('validate-policies: OK');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
