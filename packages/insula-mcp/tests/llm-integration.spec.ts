import { describe, expect, it } from 'vitest';
import { createMlxAdapter, createOllamaAdapter } from '../src/adapters/index.js';
import { createLlmOrchestrator } from '../src/ml/orchestrator.js';
import { getEnhancedLlmAdapter, pickLocalLLM } from '../src/ml/router.js';

describe('LLM Integration', () => {
    it('should create Ollama adapter with default config', () => {
        const adapter = createOllamaAdapter();
        expect(adapter.backend).toBe('ollama');
        expect(typeof adapter.complete).toBe('function');
        expect(typeof adapter.loadModel).toBe('function');
        expect(typeof adapter.startConversation).toBe('function');
    });

    it('should create MLX adapter with default config', () => {
        const adapter = createMlxAdapter();
        expect(adapter.backend).toBe('mlx');
        expect(typeof adapter.complete).toBe('function');
        expect(typeof adapter.loadModel).toBe('function');
        expect(typeof adapter.startConversation).toBe('function');
    });

    it('should create LLM orchestrator', () => {
        const orchestrator = createLlmOrchestrator();
        expect(orchestrator).toBeDefined();
        expect(typeof orchestrator.startDiagnosticSession).toBe('function');
        expect(typeof orchestrator.analyzeAndExplain).toBe('function');
        expect(typeof orchestrator.generateSolution).toBe('function');
    });

    it('should detect available LLM backends', async () => {
        const backend = await pickLocalLLM();
        expect(['mlx', 'ollama', 'none']).toContain(backend);
    });

    it('should handle no available adapters gracefully', async () => {
        // This test assumes no LLM backends are actually installed in CI
        const adapter = await getEnhancedLlmAdapter();
        // Should either return an adapter or null, not throw
        expect(adapter === null || typeof adapter.complete === 'function').toBe(true);
    });
});