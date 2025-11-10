import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		setupFiles: ['#tests/network-setup'],
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', '__tests__/', 'dist/', 'tools/'],
		},
	},
});
