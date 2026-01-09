import { z } from "zod";

export const STORY_SCOPE_VALUES = [
  "server",
  "tool",
  "connector",
  "network",
  "auth",
  "storage",
] as const;

export const STORY_TRIGGER_VALUES = [
  "deploy",
  "config",
  "network",
  "auth",
  "rate_limit",
  "dependency",
  "latency",
  "health",
  "errors",
  "fallback",
] as const;

export const STORY_FIELD_KEYS = [
  "id",
  "timestamp",
  "scope",
  "trigger",
  "propagation",
  "symptom",
  "evidence",
  "confidence",
  "suggested_actions",
] as const satisfies readonly string[];

const actionSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9:_-]{3,64}$/)
    .describe("Action identifier"),
  label: z.string().min(3).describe("Human-readable label"),
  command: z.string().min(3).describe("CLI command or MCP tool"),
  reversible: z.boolean().describe("True if the action is easily reversible"),
});

export const StorySchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9:_-]{3,64}$/)
      .describe("Stable identifier"),
    timestamp: z.string().datetime().describe("ISO timestamp for the snapshot"),
    scope: z.enum(STORY_SCOPE_VALUES),
    trigger: z.object({
      kind: z.enum(STORY_TRIGGER_VALUES),
      details: z.string().min(3),
    }),
    propagation: z.object({
      path: z.array(z.string().min(1)).min(1),
    }),
    symptom: z.object({
      user_visible: z.string().min(3),
      technical: z.string().min(3),
    }),
    evidence: z.object({
      logs: z.array(z.string()),
      traces: z.array(z.string()),
      metrics: z.array(z.string()),
    }),
    confidence: z.number().min(0).max(1),
    suggested_actions: z.array(actionSchema),
  })
  .strict();

export type Story = z.infer<typeof StorySchema>;
