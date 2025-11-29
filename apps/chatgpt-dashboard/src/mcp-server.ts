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
    }) as any,
    execute: async (args: any) => {
        return getLogs(args.limit, args.since);
    },
});

mcpServer.addTool({
    name: 'get_traces',
    description: 'Get system traces',
    parameters: z.object({
        limit: z.number().optional().default(50).describe('Number of traces to return'),
    }) as any,
    execute: async (args: any) => {
        return getTraces(args.limit);
    },
});

mcpServer.addTool({
    name: 'get_runs',
    description: 'Get agent runs',
    parameters: z.object({}) as any,
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
    }) as any,
    execute: async (args: any) => {
        return executeControl(args);
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
    }) as any,
    execute: async (args: any) => {
        return updateConfig(args);
    },
});

mcpServer.addTool({
    name: 'start_test_flow',
    description: 'Start a test flow',
    parameters: z.object({
        endpoint: z.string().describe('Target endpoint'),
        workflow: z.string().describe('Workflow name'),
    }) as any,
    execute: async (args: any) => {
        return startTestFlow(args.endpoint, args.workflow);
    },
});
