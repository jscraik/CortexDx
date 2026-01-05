import { z } from 'zod';
import type { PluginContext, RequestContext, ServerPlugin, ServerPluginHost } from './types.js';

export interface OrchestrationPluginConfig {
    defaultModel?: string;
}

export function createOrchestrationPlugin(config: OrchestrationPluginConfig = {}): ServerPlugin {
    let currentModel = config.defaultModel || 'gpt-4o';
    let serverHost: ServerPluginHost | undefined;

    return {
        name: 'orchestration',
        version: '1.0.0',

        async onLoad(host: ServerPluginHost) {
            serverHost = host;
            host.logger.info('Orchestration plugin loaded', { currentModel });
        },

        async onToolCall(ctx: RequestContext, toolName: string, args: unknown) {
            if (toolName === 'set_model') {
                const { model } = args as { model: string };
                currentModel = model;
                ctx.fastMCP?.log?.info(`Model switched to ${model}`);
            } else if (toolName === 'chat_completion') {
                ctx.fastMCP?.log?.info(`Processing chat completion with model ${currentModel}`);
            }
        },
    };
}

export const orchestrationTools = {
    set_model: {
        name: 'set_model',
        description: 'Set the active model for the orchestration agent',
        parameters: z.object({
            model: z.string().describe('Model ID to switch to (e.g., gpt-4o, claude-3-5-sonnet)'),
        }),
        execute: async (args: { model: string }, ctx: PluginContext) => {
            return {
                status: 'success',
                message: `Active model set to ${args.model}`,
                model: args.model
            };
        }
    },
    chat_completion: {
        name: 'chat_completion',
        description: 'Generate a chat completion using the active model',
        parameters: z.object({
            messages: z.array(z.object({
                role: z.enum(['system', 'user', 'assistant']),
                content: z.string()
            })).describe('Chat messages'),
            temperature: z.number().optional().describe('Sampling temperature'),
        }),
        execute: async (args: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; temperature?: number }, ctx: PluginContext) => {
            // Simulate LLM response
            await new Promise(resolve => setTimeout(resolve, 1500));

            return {
                id: 'chatcmpl-' + Math.random().toString(36).substring(2),
                object: 'chat.completion',
                created: Date.now(),
                model: 'gpt-4o', // In a real app, this would use the state
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'This is a simulated response from the orchestration plugin. In a real implementation, this would call the LLM provider.'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 20,
                    total_tokens: 70
                }
            };
        }
    }
};
