import { McpServer } from '@brainwav/cortexdx-server';
import { z } from 'zod';
import {
    executeControl,
    getAgentRuns,
    getConfig,
    getHealth,
    getLogs,
    getMetrics,
    getTraces,
    startTestFlow,
    updateConfig
} from './api/handler.js';

// Create server with FastMCP options
export const mcpServer = new McpServer({
    name: 'CortexDx Control Panel',
    version: '0.1.0',
    instructions: `
    CortexDx Control Panel MCP Server.
    Provides access to system health, logs, traces, metrics, and control actions.
  `,
    transport: {
        type: 'httpStreamable',
        httpStreamable: {
            port: 5002,
            endpoint: '/mcp',
            stateless: false,
        },
    },
});

// Resources
mcpServer.addResource({
    uri: 'cortex://health',
    name: 'System Health',
    description: 'Current system health status',
    mimeType: 'application/json',
    load: async () => {
        return { text: JSON.stringify(getHealth(), null, 2) };
    },
});

mcpServer.addResource({
    uri: 'cortex://metrics',
    name: 'System Metrics',
    description: 'Current system metrics',
    mimeType: 'application/json',
    load: async () => {
        return { text: JSON.stringify(getMetrics(), null, 2) };
    },
});

mcpServer.addResource({
    uri: 'cortex://config',
    name: 'Dashboard Configuration',
    description: 'Current dashboard configuration',
    mimeType: 'application/json',
    load: async () => {
        return { text: JSON.stringify(getConfig(), null, 2) };
    },
});

// Tools
mcpServer.addTool({
    name: 'get_logs',
    description: 'Get system logs',
    parameters: z.object({
        limit: z.number().optional().default(100).describe('Number of logs to return'),
        since: z.string().optional().describe('Filter logs since timestamp (ISO 8601)'),
    }),
    execute: async (args: Record<string, unknown>) => {
        return getLogs((args.limit as number | undefined), (args.since as string | undefined));
    },
});

mcpServer.addTool({
    name: 'get_traces',
    description: 'Get system traces',
    parameters: z.object({
        limit: z.number().optional().default(50).describe('Number of traces to return'),
    }),
    execute: async (args: Record<string, unknown>) => {
        return getTraces((args.limit as number | undefined));
    },
});

mcpServer.addTool({
    name: 'get_runs',
    description: 'Get agent runs',
    parameters: z.object({}),
    execute: async () => {
        return getAgentRuns();
    },
});

mcpServer.addTool({
    name: 'control_action',
    description: 'Execute a control action',
    parameters: z.object({
        action: z.enum(['pause', 'resume', 'cancel', 'drain', 'retry']).describe('Action to execute'),
        targetId: z.string().optional().describe('Target ID for the action (e.g., run ID)'),
    }),
    execute: async (args: Record<string, unknown>) => {
        return executeControl(args as Record<string, unknown>);
    },
});

mcpServer.addTool({
    name: 'update_config',
    description: 'Update dashboard configuration',
    parameters: z.object({
        refreshInterval: z.number().optional(),
        maxLogEntries: z.number().optional(),
        maxTraceSpans: z.number().optional(),
        theme: z.enum(['light', 'dark', 'system']).optional(),
    }),
    execute: async (args: Record<string, unknown>) => {
        return updateConfig(args as Record<string, unknown>);
    },
});

mcpServer.addTool({
    name: 'start_test_flow',
    description: 'Start a test flow',
    parameters: z.object({
        endpoint: z.string().describe('Target endpoint'),
        workflow: z.string().describe('Workflow name'),
    }),
    execute: async (args: Record<string, unknown>) => {
        return startTestFlow((args.endpoint as string), (args.workflow as string));
    },
});
