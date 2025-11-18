/**
 * Task Executor - Background execution engine for MCP Tasks API
 *
 * Handles async execution of task-augmented requests:
 * - tools/call
 * - sampling/createMessage (future)
 * - elicitation/create (future)
 */

import type { TaskStore } from './task-store.js';
import type { DiagnosticContext, DevelopmentContext, McpTool } from '../types.js';
import { createLogger } from '../logging/logger.js';

const logger = createLogger({ component: 'task-executor' });

export class TaskExecutor {
  constructor(private taskStore: TaskStore) {}

  /**
   * Execute a task asynchronously
   * This method returns immediately; execution happens in background
   */
  async executeTask(taskId: string, ctx: DiagnosticContext): Promise<void> {
    const task = this.taskStore.getTask(taskId);
    if (!task) {
      logger.error({ taskId }, 'Task not found for execution');
      return;
    }

    logger.info({ taskId, method: task.method }, 'Starting task execution');

    try {
      // Update status to working (in case it was input_required)
      this.taskStore.updateTaskStatus(taskId, 'working', 'Executing task');

      // Dispatch to appropriate handler based on method
      let result: unknown;

      switch (task.method) {
        case 'tools/call':
          result = await this.executeToolCall(task.params, ctx);
          break;

        case 'sampling/createMessage':
          result = await this.executeSampling(task.params, ctx);
          break;

        case 'elicitation/create':
          result = await this.executeElicitation(task.params, ctx);
          break;

        default:
          throw new Error(`Unsupported task method: ${task.method}`);
      }

      // Store result
      this.taskStore.setTaskResult(taskId, result);
      logger.info({ taskId }, 'Task completed successfully');

    } catch (error) {
      logger.error({ taskId, error }, 'Task execution failed');

      // Determine error code
      let errorCode = -32603; // Internal error
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          errorCode = -32601; // Method not found
        } else if (error.message.includes('validation') || error.message.includes('invalid')) {
          errorCode = -32602; // Invalid params
        }
      }

      this.taskStore.setTaskError(taskId, {
        code: errorCode,
        message: error instanceof Error ? error.message : 'Task execution failed',
        data: error instanceof Error ? { stack: error.stack } : undefined
      });
    }
  }

  /**
   * Execute tools/call task
   */
  private async executeToolCall(params: unknown, ctx: DiagnosticContext): Promise<unknown> {
    const { name, arguments: args } = params as {
      name: string;
      arguments?: unknown;
    };

    logger.debug({ toolName: name }, 'Executing tool call task');

    // Import tool execution logic
    const { findMcpTool } = await import('../tools/index.js');
    const tool = findMcpTool(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Execute the tool
    const result = await this.executeToolWithContext(tool, args, ctx);
    return result;
  }

  /**
   * Execute a tool with proper context
   */
  private async executeToolWithContext(
    tool: McpTool,
    args: unknown,
    ctx: DiagnosticContext
  ): Promise<unknown> {
    // Convert DiagnosticContext to DevelopmentContext if needed
    const devCtx: DevelopmentContext = {
      ...ctx,
      sessionId: `task-${Date.now()}`,
      userExpertiseLevel: 'intermediate',
      conversationHistory: [],
      projectContext: undefined
    };

    // Execute based on tool category
    switch (tool.name) {
      case 'diagnose_mcp_server':
        return await this.executeDiagnoseTool(args, devCtx);

      case 'cortexdx_academic_research':
        return await this.executeAcademicTool(tool, args);

      case 'cortexdx_deepcontext_index':
      case 'cortexdx_deepcontext_search':
      case 'cortexdx_deepcontext_status':
      case 'cortexdx_deepcontext_clear':
        return await this.executeDeepContextTool(tool, args, devCtx);

      case 'cortexdx_mcp_docs_search':
      case 'cortexdx_mcp_docs_lookup':
      case 'cortexdx_mcp_docs_versions':
        return await this.executeMcpDocsTool(tool, args, devCtx);

      default:
        // Generic tool execution
        return await this.executeGenericTool(tool, args, devCtx);
    }
  }

  /**
   * Execute diagnostic tool
   * Fixed: Pass headers for authentication (High #7)
   */
  private async executeDiagnoseTool(
    args: unknown,
    ctx: DevelopmentContext
  ): Promise<unknown> {
    const {
      endpoint,
      suites = [],
      full = false,
    } = args as { endpoint: string; suites?: string[]; full?: boolean };

    // Import and run diagnostic
    const { runPlugins } = await import('../plugin-host.js');

    const results = await runPlugins({
      endpoint,
      headers: ctx.headers || {}, // Pass auth headers
      suites,
      full,
      deterministic: ctx.deterministic || false,
      budgets: { timeMs: 300000, memMb: 512 }, // Increased limits for async
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  /**
   * Execute academic integration tool
   */
  private async executeAcademicTool(tool: McpTool, args: unknown): Promise<unknown> {
    const { executeAcademicIntegrationTool } = await import(
      '../tools/academic-integration-tools.js'
    );
    return await executeAcademicIntegrationTool(tool, args);
  }

  /**
   * Execute deep context tool
   */
  private async executeDeepContextTool(
    tool: McpTool,
    args: unknown,
    ctx: DevelopmentContext
  ): Promise<unknown> {
    const { executeDeepContextTool } = await import('../tools/index.js');
    return await executeDeepContextTool(tool, args, ctx);
  }

  /**
   * Execute MCP docs tool
   */
  private async executeMcpDocsTool(
    tool: McpTool,
    args: unknown,
    ctx: DevelopmentContext
  ): Promise<unknown> {
    const { executeMcpDocsTool } = await import('../tools/mcp-docs-tools.js');
    return await executeMcpDocsTool(tool, args, ctx);
  }

  /**
   * Execute generic tool (fallback)
   */
  private async executeGenericTool(
    tool: McpTool,
    args: unknown,
    ctx: DevelopmentContext
  ): Promise<unknown> {
    // For tools not explicitly handled, try to find and execute them
    // This is a safe fallback for custom tools

    if (tool.handler && typeof tool.handler === 'function') {
      return await tool.handler(args, ctx);
    }

    throw new Error(`Tool ${tool.name} has no handler implementation`);
  }

  /**
   * Execute sampling task (future implementation)
   */
  private async executeSampling(params: unknown, ctx: DiagnosticContext): Promise<unknown> {
    logger.warn('Sampling tasks not yet implemented');
    throw new Error('Sampling tasks not yet implemented');
  }

  /**
   * Execute elicitation task (future implementation)
   */
  private async executeElicitation(params: unknown, ctx: DiagnosticContext): Promise<unknown> {
    logger.warn('Elicitation tasks not yet implemented');
    throw new Error('Elicitation tasks not yet implemented');
  }
}
