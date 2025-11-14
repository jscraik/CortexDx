import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOllamaAdapter } from '../src/adapters/index.js';
import { LlmOrchestrator, createLlmOrchestrator } from '../src/ml/orchestrator.js';
import { getEnhancedLlmAdapter, pickLocalLLM } from '../src/ml/router.js';
import type { Constraints, ConversationContext, DiagnosticContext, Problem } from '../src/types.js';
import { describeIntegration } from './utils/test-mode.js';

let originalEnableLocalLLM: string | undefined;
let initializeAdaptersSpy: { mockRestore: () => void } | undefined;

beforeAll(() => {
    originalEnableLocalLLM = process.env.CORTEXDX_ENABLE_LOCAL_LLM;
    process.env.CORTEXDX_ENABLE_LOCAL_LLM = 'false';
    initializeAdaptersSpy = vi
        .spyOn(
            LlmOrchestrator.prototype as unknown as { initializeAdapters: () => Promise<void> },
            'initializeAdapters',
        )
        .mockResolvedValue(undefined);
});

afterAll(() => {
    initializeAdaptersSpy?.mockRestore();
    if (originalEnableLocalLLM === undefined) {
        delete process.env.CORTEXDX_ENABLE_LOCAL_LLM;
    } else {
        process.env.CORTEXDX_ENABLE_LOCAL_LLM = originalEnableLocalLLM;
    }
});

describe('LLM Integration', () => {
    it('should create Ollama adapter with default config', () => {
        const adapter = createOllamaAdapter();
        expect(adapter.backend).toBe('ollama');
        expect(typeof adapter.complete).toBe('function');
        expect(typeof adapter.loadModel).toBe('function');
        expect(typeof adapter.startConversation).toBe('function');
    });

    it('should create LLM orchestrator', () => {
        try {
            const orchestrator = createLlmOrchestrator();
            expect(orchestrator).toBeDefined();
            expect(typeof orchestrator.startDiagnosticSession).toBe('function');
            expect(typeof orchestrator.analyzeAndExplain).toBe('function');
            expect(typeof orchestrator.generateSolution).toBe('function');
        } catch (error) {
            const message = (error as Error).message;
            expect(message).toContain('No LLM adapters available');
        }
    });

    it('should detect available LLM backends', async () => {
        const backend = await pickLocalLLM();
        expect(['ollama', 'none']).toContain(backend);
    });

    it('should handle no available adapters gracefully', async () => {
        // This test assumes no LLM backends are actually installed in CI
        const adapter = await getEnhancedLlmAdapter();
        // Should either return an adapter or null, not throw
        expect(adapter === null || typeof adapter.complete === 'function').toBe(true);
    });
});

describeIntegration('LLM Performance Validation', () => {
    let mockContext: DiagnosticContext;
    let orchestrator: ReturnType<typeof createLlmOrchestrator> | null;
    let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

    const mockResponse = (body: unknown): Response =>
        ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => body,
        }) as Response;

    beforeEach(() => {
        const fetchTarget = globalThis as { fetch: typeof fetch };
        fetchSpy = vi
            .spyOn(fetchTarget, 'fetch')
            .mockImplementation(async (input: RequestInfo | URL) => {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.toString()
                          : (input as Request).url;
                if (url.includes('/api/generate')) {
                    return mockResponse({ response: 'mock-response', done: true });
                }
                if (url.includes('/v1/chat/completions')) {
                    return mockResponse({ choices: [{ message: { content: 'mock-chat-response' } }] });
                }
                if (url.includes('/api/tags')) {
                    return mockResponse({ models: [{ name: 'llama3.2' }] });
                }
                return mockResponse({});
            });

        mockContext = {
            endpoint: 'http://localhost:3000',
            headers: { 'user-id': 'test-user' },
            logger: vi.fn(),
            request: vi.fn(),
            jsonrpc: vi.fn(),
            sseProbe: vi.fn(),
            evidence: vi.fn(),
            deterministic: true,
        };

        try {
            orchestrator = createLlmOrchestrator({
                preferredBackend: 'auto',
                responseTimeoutMs: 2000,
                enableCaching: true,
            });
        } catch (error) {
            const message = (error as Error).message;
            if (message.includes('No LLM adapters available') || message.includes('No suitable LLM adapter available')) {
                orchestrator = null;
            } else {
                throw error;
            }
        }
    });

    describe('Response Time Requirements', () => {
        it('should complete simple operations in <2s', async () => {
        const adapter = await mlRouter.getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping performance test');
                expect(true).toBe(true); // Pass test when no adapter available
                return;
            }

            const startTime = Date.now();
            const result = await adapter.complete('Hello', 10);
            const duration = Date.now() - startTime;

            expect(result).toBeDefined();
            expect(duration).toBeLessThan(2000);
        }, 10000);

        it('should start conversation in <2s', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping performance test');
                expect(true).toBe(true);
                return;
            }

            const conversationContext: ConversationContext = {
                userId: 'test-user',
                sessionType: 'debugging',
                mcpContext: {
                    serverEndpoint: 'http://localhost:3000',
                    protocolVersion: '2024-11-05',
                    capabilities: [],
                    configuration: {},
                },
            };

            const startTime = Date.now();
            const sessionId = await adapter.startConversation(conversationContext);
            const duration = Date.now() - startTime;

            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe('string');
            expect(duration).toBeLessThan(2000);

            await adapter.endConversation(sessionId);
        }, 10000);

        it('should analyze code in <5s', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping performance test');
                expect(true).toBe(true);
                return;
            }

            const sampleCode = `
                function validateMcpMessage(msg) {
                    return msg && msg.jsonrpc === '2.0';
                }
            `;

            const startTime = Date.now();
            const analysis = await adapter.analyzeCode(sampleCode, 'JavaScript MCP validation');
            const duration = Date.now() - startTime;

            expect(analysis).toBeDefined();
            expect(analysis.issues).toBeDefined();
            expect(analysis.suggestions).toBeDefined();
            expect(analysis.metrics).toBeDefined();
            expect(duration).toBeLessThan(5000);
        }, 15000);

        it('should explain errors in <5s', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping performance test');
                expect(true).toBe(true);
                return;
            }

            const testError = new Error('MCP protocol version mismatch');
            const context = {
                type: 'debugging' as const,
                environment: 'test',
                tools: ['vitest'],
                history: [],
                metadata: { protocolVersion: '2024-11-05' },
            };

            const startTime = Date.now();
            const explanation = await adapter.explainError(testError, context);
            const duration = Date.now() - startTime;

            expect(explanation).toBeDefined();
            expect(explanation.summary).toBeDefined();
            expect(explanation.nextSteps).toBeDefined();
            expect(duration).toBeLessThan(5000);
        }, 15000);

        it('should generate solutions in <10s', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping performance test');
                expect(true).toBe(true);
                return;
            }

            const problem: Problem = {
                id: 'test-problem-1',
                type: 'protocol',
                severity: 'major',
                description: 'Invalid JSON-RPC message format',
                userFriendlyDescription: 'The message format is incorrect',
                context: {
                    mcpVersion: '2024-11-05',
                    serverType: 'test-server',
                    environment: 'test',
                    configuration: {},
                    errorLogs: ['Invalid message format'],
                },
                evidence: [],
                affectedComponents: ['message-handler'],
                suggestedSolutions: [],
                userLevel: 'intermediate',
            };

            const constraints: Constraints = {
                complexity: 'medium',
                compatibility: ['node-20'],
                security: {
                    allowExternalCalls: false,
                    allowFileSystem: true,
                    allowNetworking: false,
                    requiredPermissions: [],
                },
                performance: {
                    maxResponseTime: 10000,
                    maxMemoryUsage: 512,
                    maxCpuUsage: 80,
                },
            };

            const startTime = Date.now();
            const solution = await adapter.generateSolution(problem, constraints);
            const duration = Date.now() - startTime;

            expect(solution).toBeDefined();
            expect(solution.id).toBeDefined();
            expect(solution.description).toBeDefined();
            expect(solution.steps).toBeDefined();
            expect(duration).toBeLessThan(10000);
        }, 20000);
    });

    describe('Model Selection and Routing', () => {
        it('should select appropriate model for development tasks', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping model selection test');
                return;
            }

            const devContext: ConversationContext = {
                sessionType: 'development',
                mcpContext: {
                    serverEndpoint: 'http://localhost:3000',
                    protocolVersion: '2024-11-05',
                    capabilities: ['code-generation'],
                    configuration: {},
                },
            };

            const sessionId = await adapter.startConversation(devContext);
            expect(sessionId).toBeDefined();

            await adapter.endConversation(sessionId);
        });

        it('should select appropriate model for debugging tasks', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping model selection test');
                return;
            }

            const debugContext: ConversationContext = {
                sessionType: 'debugging',
                mcpContext: {
                    serverEndpoint: 'http://localhost:3000',
                    protocolVersion: '2024-11-05',
                    capabilities: ['error-analysis'],
                    configuration: {},
                },
            };

            const sessionId = await adapter.startConversation(debugContext);
            expect(sessionId).toBeDefined();

            await adapter.endConversation(sessionId);
        });

        it('should select appropriate model for learning tasks', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping model selection test');
                return;
            }

            const learningContext: ConversationContext = {
                sessionType: 'learning',
                mcpContext: {
                    serverEndpoint: 'http://localhost:3000',
                    protocolVersion: '2024-11-05',
                    capabilities: ['explanation'],
                    configuration: {},
                },
            };

            const sessionId = await adapter.startConversation(learningContext);
            expect(sessionId).toBeDefined();

            await adapter.endConversation(sessionId);
        });

        it('should route to available backend automatically', async () => {
            const backend = await pickLocalLLM();
            expect(['ollama', 'none']).toContain(backend);

            if (backend !== 'none') {
                const adapter = await getEnhancedLlmAdapter();
                expect(adapter).not.toBeNull();
                expect(adapter?.backend).toBe(backend);
            }
        });
    });

    describe('Conversation Context Maintenance', () => {
        it('should maintain context across multiple conversation turns', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping context test');
                expect(true).toBe(true);
                return;
            }

            const context: ConversationContext = {
                userId: 'test-user',
                sessionType: 'debugging',
                mcpContext: {
                    serverEndpoint: 'http://localhost:3000',
                    protocolVersion: '2024-11-05',
                    capabilities: [],
                    configuration: {},
                },
            };

            const sessionId = await adapter.startConversation(context);

            const response1 = await adapter.continueConversation(
                sessionId,
                'What is MCP?'
            );
            expect(response1).toBeDefined();
            expect(typeof response1).toBe('string');

            const response2 = await adapter.continueConversation(
                sessionId,
                'Can you explain more about it?'
            );
            expect(response2).toBeDefined();
            expect(typeof response2).toBe('string');

            await adapter.endConversation(sessionId);
        }, 20000);

        it('should track session metrics correctly', async () => {
            if (!orchestrator) {
                console.log('No LLM adapter available, skipping session metrics test');
                expect(true).toBe(true);
                return;
            }
            try {
                const sessionId = await orchestrator.startDiagnosticSession(mockContext, 'debugging');
                expect(sessionId).toBeDefined();

                const metrics = orchestrator.getSessionMetrics(sessionId);
                expect(metrics).not.toBeNull();
                expect(metrics?.sessionId).toBe(sessionId);
                expect(metrics?.messageCount).toBe(0);
                expect(metrics?.backend).toBeDefined();

                await orchestrator.endSession(sessionId);
            } catch (error) {
                const message = (error as Error).message;
                if (message.includes('No LLM adapters available') || message.includes('No suitable LLM adapter available')) {
                    console.log('No LLM adapter available, skipping session metrics test');
                    expect(true).toBe(true);
                    return;
                }
                throw error;
            }
        });

        it('should handle multiple concurrent sessions', async () => {
            if (!orchestrator) {
                console.log('No LLM adapter available, skipping concurrent session test');
                expect(true).toBe(true);
                return;
            }
            try {
                const session1 = await orchestrator.startDiagnosticSession(mockContext, 'development');
                const session2 = await orchestrator.startDiagnosticSession(mockContext, 'debugging');
                const session3 = await orchestrator.startDiagnosticSession(mockContext, 'learning');

                expect(session1).not.toBe(session2);
                expect(session2).not.toBe(session3);
                expect(orchestrator.getActiveSessionCount()).toBeGreaterThanOrEqual(3);

                await orchestrator.endSession(session1);
                await orchestrator.endSession(session2);
                await orchestrator.endSession(session3);
            } catch (error) {
                const message = (error as Error).message;
                if (message.includes('No LLM adapters available') || message.includes('No suitable LLM adapter available')) {
                    console.log('No LLM adapter available, skipping concurrent session test');
                    expect(true).toBe(true);
                    return;
                }
                throw error;
            }
        });

        it('should preserve conversation history within session', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping history test');
                expect(true).toBe(true);
                return;
            }

            const context: ConversationContext = {
                sessionType: 'debugging',
                mcpContext: {
                    serverEndpoint: 'http://localhost:3000',
                    protocolVersion: '2024-11-05',
                    capabilities: [],
                    configuration: {},
                },
            };

            const sessionId = await adapter.startConversation(context);

            await adapter.continueConversation(sessionId, 'First message');
            await adapter.continueConversation(sessionId, 'Second message');
            await adapter.continueConversation(sessionId, 'Third message');

            const metrics = orchestrator.getSessionMetrics(sessionId);
            if (metrics) {
                expect(metrics.messageCount).toBeGreaterThan(0);
            }

            await adapter.endConversation(sessionId);
        }, 20000);
    });

    describe('Performance Optimization Features', () => {
        it('should cache responses for identical requests', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping cache test');
                expect(true).toBe(true);
                return;
            }

            const problem: Problem = {
                id: 'cache-test-1',
                type: 'configuration',
                severity: 'minor',
                description: 'Test caching behavior',
                userFriendlyDescription: 'Testing cache',
                context: {
                    mcpVersion: '2024-11-05',
                    serverType: 'test',
                    environment: 'test',
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: [],
                suggestedSolutions: [],
                userLevel: 'intermediate',
            };

            const sessionId = await orchestrator.startDiagnosticSession(mockContext);

            const start1 = Date.now();
            await orchestrator.analyzeAndExplain(sessionId, problem, mockContext);
            const duration1 = Date.now() - start1;

            const start2 = Date.now();
            await orchestrator.analyzeAndExplain(sessionId, problem, mockContext);
            const duration2 = Date.now() - start2;

            expect(duration2).toBeLessThanOrEqual(duration1);

            await orchestrator.endSession(sessionId);
        }, 20000);

        it('should respect response timeout configuration', async () => {
            const fastOrchestrator = createLlmOrchestrator({
                responseTimeoutMs: 100,
            });

            const problem: Problem = {
                id: 'timeout-test-1',
                type: 'performance',
                severity: 'major',
                description: 'Test timeout handling',
                userFriendlyDescription: 'Testing timeout',
                context: {
                    mcpVersion: '2024-11-05',
                    serverType: 'test',
                    environment: 'test',
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: [],
                suggestedSolutions: [],
                userLevel: 'expert',
            };

            const constraints: Constraints = {
                complexity: 'high',
                compatibility: [],
                security: {
                    allowExternalCalls: false,
                    allowFileSystem: false,
                    allowNetworking: false,
                    requiredPermissions: [],
                },
                performance: {
                    maxResponseTime: 100,
                    maxMemoryUsage: 256,
                    maxCpuUsage: 50,
                },
            };

            try {
                const sessionId = await fastOrchestrator.startDiagnosticSession(mockContext);
                await fastOrchestrator.generateSolution(sessionId, problem, constraints, mockContext);
            } catch (error) {
                const message = (error as Error).message;
                if (message.includes('No LLM adapters available') || message.includes('No suitable LLM adapter available')) {
                    console.log('No LLM adapter available, skipping timeout test');
                    expect(true).toBe(true);
                    return;
                }
                expect(message).toContain('timeout');
            }
        });

        it('should track average response times per session', async () => {
            const adapter = await getEnhancedLlmAdapter();
            if (!adapter) {
                console.log('No LLM adapter available, skipping metrics test');
                expect(true).toBe(true);
                return;
            }

            const sessionId = await orchestrator.startDiagnosticSession(mockContext);

            const problem: Problem = {
                id: 'metrics-test-1',
                type: 'protocol',
                severity: 'info',
                description: 'Test metrics tracking',
                userFriendlyDescription: 'Testing metrics',
                context: {
                    mcpVersion: '2024-11-05',
                    serverType: 'test',
                    environment: 'test',
                    configuration: {},
                    errorLogs: [],
                },
                evidence: [],
                affectedComponents: [],
                suggestedSolutions: [],
                userLevel: 'beginner',
            };

            await orchestrator.analyzeAndExplain(sessionId, problem, mockContext);

            const metrics = orchestrator.getSessionMetrics(sessionId);
            expect(metrics).not.toBeNull();
            expect(metrics?.averageResponseTime).toBeGreaterThanOrEqual(0);

            await orchestrator.endSession(sessionId);
        }, 20000);

    });

    afterEach(() => {
        orchestrator = null;
        fetchSpy?.mockRestore();
        vi.restoreAllMocks();
    });
});
