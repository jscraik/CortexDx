/**
 * Cortex Vibe MCP Provider
 * FASTMCP v3.22 compliant provider for AI agent metacognitive oversight
 * Based on @brainwav/cortex-vibe-mcp (Chain-Pattern Interrupts for agent alignment)
 *
 * Purpose: Metacognitive oversight layer with adaptive CPI interrupts for aligned,
 * reflective AI agents. Prevents tunnel vision and reasoning lock-in.
 *
 * Note: This provider focuses on AI AGENT SAFETY & ALIGNMENT (metacognition, CPI).
 * For academic research quality assessment, see research-quality.mcp.ts
 */

import {
  type LicenseValidatorPlugin,
  createLicenseValidator,
} from "../../plugins/development/license-validation.js";
import type { DiagnosticContext } from "@brainwav/cortexdx-core";
import { HttpMcpClient, sanitizeToolArgs } from "./http-mcp-client.js";

export interface VibeCheckResult {
  questions: string[];
  usedFallback: boolean;
  sessionId?: string;
  historySummary?: string;
}

export interface VibeLearnResult {
  added: number;
  alreadyKnown: number;
  currentTally: number;
  topCategories?: Array<{ category: string; count: number }>;
}

export interface ConstitutionRule {
  rule: string;
  category?: string;
  priority?: number;
}

export interface ConstitutionResult {
  rules: ConstitutionRule[];
  sessionId?: string;
  totalRules: number;
}

export class CortexVibeProvider {
  private readonly licenseValidator: LicenseValidatorPlugin;
  private readonly remoteClient?: HttpMcpClient;

  constructor(private ctx: DiagnosticContext) {
    this.licenseValidator = createLicenseValidator(ctx);
    this.remoteClient = this.initializeCortexVibeClient();
  }

  /**
   * FASTMCP v3.22 tool definitions
   */
  static getToolDefinitions() {
    return [
      {
        name: "cortex_vibe_check",
        description:
          "Challenge assumptions and prevent tunnel vision using Chain-Pattern Interrupts (CPI)",
        inputSchema: {
          type: "object",
          properties: {
            taskContext: {
              type: "string",
              description:
                "Current task context including recent tool calls and reasoning",
            },
            currentPlan: {
              type: "string",
              description: "Current plan or approach being considered",
            },
            sessionId: {
              type: "string",
              description: "Optional session ID for continuity",
            },
          },
          required: ["taskContext", "currentPlan"],
        },
      },
      {
        name: "cortex_vibe_learn",
        description:
          "Capture mistakes, preferences, and successes for future reference",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description:
                "Category of learning (e.g., 'mistake', 'success', 'preference')",
            },
            description: {
              type: "string",
              description: "Description of what was learned",
            },
            context: {
              type: "string",
              description: "Context in which this learning occurred",
            },
          },
          required: ["category", "description"],
        },
      },
      {
        name: "cortex_update_constitution",
        description:
          "Set or merge session rules that the CPI layer will enforce",
        inputSchema: {
          type: "object",
          properties: {
            rules: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  rule: { type: "string" },
                  category: { type: "string" },
                  priority: { type: "number" },
                },
                required: ["rule"],
              },
              description: "Rules to add or update for the session",
            },
            sessionId: {
              type: "string",
              description: "Session ID",
            },
            merge: {
              type: "boolean",
              description: "Merge with existing rules (default: true)",
              default: true,
            },
          },
          required: ["rules"],
        },
      },
      {
        name: "cortex_reset_constitution",
        description: "Clear all rules for a session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID to reset",
            },
          },
        },
      },
      {
        name: "cortex_check_constitution",
        description: "Inspect effective rules for a session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "Session ID to inspect",
            },
          },
        },
      },
    ];
  }

  /**
   * Initialize HTTP MCP client for Cortex Vibe
   */
  private initializeCortexVibeClient(): HttpMcpClient | undefined {
    if (process.env.CORTEXDX_DISABLE_CORTEX_VIBE_HTTP === "1") {
      return undefined;
    }

    const baseUrl =
      (this.ctx.headers?.["cortex-vibe-base-url"] as string | undefined) ??
      process.env.CORTEX_VIBE_API_BASE_URL ??
      process.env.CORTEX_VIBE_HTTP_URL;

    if (!baseUrl) {
      this.ctx.logger?.(
        "[CortexVibe] No HTTP URL configured, remote calls disabled",
      );
      return undefined;
    }

    try {
      return new HttpMcpClient({
        baseUrl: baseUrl.trim(),
        headers: {
          "X-CortexVibe-Client": "cortexdx",
          "User-Agent": "CortexDx/1.0.0 (Agent Oversight)",
        },
      });
    } catch (error) {
      console.warn("[CortexVibe] Failed to initialize HTTP client:", error);
      return undefined;
    }
  }

  /**
   * Execute vibe check (CPI)
   */
  async vibeCheck(
    taskContext: string,
    currentPlan: string,
    sessionId?: string,
  ): Promise<VibeCheckResult> {
    if (this.remoteClient) {
      try {
        const result = await this.remoteClient.callToolJson<VibeCheckResult>(
          "vibe_check",
          sanitizeToolArgs({
            taskContext,
            currentPlan,
            sessionId,
          }),
        );

        this.ctx.evidence({
          type: "log",
          ref: "[CortexVibe] Remote vibe_check executed",
        });

        return result;
      } catch (error) {
        this.ctx.logger?.(
          `[CortexVibe] Remote vibe_check failed: ${String(error)}`,
        );
      }
    }

    // Fallback: local simplified CPI
    const questions = [
      "What assumptions are you making that might be incorrect?",
      "Are there alternative approaches you haven't considered?",
      "What could go wrong with your current plan?",
      "Is this the most direct path to the goal?",
      "Have you considered edge cases or failure modes?",
    ];

    return {
      questions,
      usedFallback: true,
      sessionId,
    };
  }

  /**
   * Capture learning
   */
  async vibeLearn(
    category: string,
    description: string,
    context?: string,
  ): Promise<VibeLearnResult> {
    if (this.remoteClient) {
      try {
        const result = await this.remoteClient.callToolJson<VibeLearnResult>(
          "vibe_learn",
          sanitizeToolArgs({
            category,
            description,
            context,
          }),
        );

        this.ctx.evidence({
          type: "log",
          ref: "[CortexVibe] Remote vibe_learn executed",
        });

        return result;
      } catch (error) {
        this.ctx.logger?.(
          `[CortexVibe] Remote vibe_learn failed: ${String(error)}`,
        );
      }
    }

    // Fallback: simple acknowledgment
    return {
      added: 1,
      alreadyKnown: 0,
      currentTally: 1,
    };
  }

  /**
   * Update constitution
   */
  async updateConstitution(
    rules: ConstitutionRule[],
    sessionId?: string,
    merge = true,
  ): Promise<ConstitutionResult> {
    if (this.remoteClient) {
      try {
        const result = await this.remoteClient.callToolJson<ConstitutionResult>(
          "update_constitution",
          sanitizeToolArgs({
            rules,
            sessionId,
            merge,
          }),
        );

        this.ctx.evidence({
          type: "log",
          ref: "[CortexVibe] Remote update_constitution executed",
        });

        return result;
      } catch (error) {
        this.ctx.logger?.(
          `[CortexVibe] Remote update_constitution failed: ${String(error)}`,
        );
      }
    }

    // Fallback
    return {
      rules,
      sessionId,
      totalRules: rules.length,
    };
  }

  /**
   * Reset constitution
   */
  async resetConstitution(sessionId?: string): Promise<ConstitutionResult> {
    if (this.remoteClient) {
      try {
        const result = await this.remoteClient.callToolJson<ConstitutionResult>(
          "reset_constitution",
          sanitizeToolArgs({ sessionId }),
        );

        this.ctx.evidence({
          type: "log",
          ref: "[CortexVibe] Remote reset_constitution executed",
        });

        return result;
      } catch (error) {
        this.ctx.logger?.(
          `[CortexVibe] Remote reset_constitution failed: ${String(error)}`,
        );
      }
    }

    return {
      rules: [],
      sessionId,
      totalRules: 0,
    };
  }

  /**
   * Check constitution
   */
  async checkConstitution(sessionId?: string): Promise<ConstitutionResult> {
    if (this.remoteClient) {
      try {
        const result = await this.remoteClient.callToolJson<ConstitutionResult>(
          "check_constitution",
          sanitizeToolArgs({ sessionId }),
        );

        this.ctx.evidence({
          type: "log",
          ref: "[CortexVibe] Remote check_constitution executed",
        });

        return result;
      } catch (error) {
        this.ctx.logger?.(
          `[CortexVibe] Remote check_constitution failed: ${String(error)}`,
        );
      }
    }

    return {
      rules: [],
      sessionId,
      totalRules: 0,
    };
  }

  /**
   * Health check for the provider
   */
  async healthCheck(): Promise<boolean> {
    if (this.remoteClient) {
      try {
        // Try to call a simple tool to verify connectivity
        await this.remoteClient.callToolJson("vibe_check", {
          taskContext: "health check",
          currentPlan: "verify connectivity",
        });
        return true;
      } catch {
        return false;
      }
    }
    // Local fallback is always available
    return true;
  }

  /**
   * Execute tool calls
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case "cortex_vibe_check":
        return await this.vibeCheck(
          params.taskContext as string,
          params.currentPlan as string,
          params.sessionId as string | undefined,
        );

      case "cortex_vibe_learn":
        return await this.vibeLearn(
          params.category as string,
          params.description as string,
          params.context as string | undefined,
        );

      case "cortex_update_constitution":
        return await this.updateConstitution(
          params.rules as ConstitutionRule[],
          params.sessionId as string | undefined,
          params.merge as boolean | undefined,
        );

      case "cortex_reset_constitution":
        return await this.resetConstitution(
          params.sessionId as string | undefined,
        );

      case "cortex_check_constitution":
        return await this.checkConstitution(
          params.sessionId as string | undefined,
        );

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

/**
 * FASTMCP v3.22 capability registration
 */
export const cortexVibeCapabilities = {
  id: "cortex-vibe",
  name: "Cortex Vibe Metacognitive Oversight Provider",
  version: "0.0.19",
  description:
    "Chain-Pattern Interrupts (CPI) for AI agent alignment and metacognitive oversight",
  tools: CortexVibeProvider.getToolDefinitions(),
  resources: [],
  prompts: [
    {
      name: "agent_self_check",
      description: "Trigger a metacognitive self-check during complex tasks",
      arguments: [
        {
          name: "task_description",
          description: "Description of current task",
          required: true,
        },
      ],
    },
    {
      name: "prevent_tunnel_vision",
      description: "Challenge current approach to prevent reasoning lock-in",
      arguments: [
        {
          name: "current_approach",
          description: "Current approach or plan",
          required: true,
        },
      ],
    },
  ],
};
