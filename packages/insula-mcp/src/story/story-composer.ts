import type { DepGraph, Node } from "../graph/dependency-graph.js";
import type { Event } from "../anomaly/rules.js";
import { scoreConfidence } from "./confidence.js";
import { StorySchema, type Story } from "./story-schema.js";

export type StoryComposeOptions = {
  defaultScope?: Story["scope"];
  deterministicNow?: number;
};

const TRIGGER_KIND_MAP: Record<Event["kind"], Story["trigger"]["kind"]> = {
  health: "health",
  latency: "latency",
  errors: "errors",
  fallback: "fallback",
};

const ACTION_DEFINITIONS: Record<Event["kind"], { id: string; label: string; command: string }> = {
  latency: {
    id: "action-reprobe",
    label: "Run targeted reprobe",
    command: "cortexdx story.reprobe --target={target}",
  },
  errors: {
    id: "action-revert",
    label: "Revert last config",
    command: "cortexdx actions.revert-config --target={target}",
  },
  health: {
    id: "action-restart",
    label: "Restart connector",
    command: "cortexdx actions.restart-connector --target={target}",
  },
  fallback: {
    id: "action-auth",
    label: "Rotate auth token",
    command: "cortexdx actions.auth-rotate --target={target}",
  },
};

export function composeStory(
  event: Event,
  graph: DepGraph,
  options: StoryComposeOptions = {},
): Story {
  const path = derivePath(graph, event.target);
  const scope = inferScope(graph, event.target, options.defaultScope);
  const timestamp = new Date(options.deterministicNow ?? event.at).toISOString();
  const evidence = normalizeEvidence(event.meta);
  const story: Story = {
    id: buildStoryId(event),
    timestamp,
    scope,
    trigger: {
      kind: TRIGGER_KIND_MAP[event.kind],
      details: describeTrigger(event),
    },
    propagation: { path },
    symptom: buildSymptom(event, scope),
    evidence,
    confidence: scoreConfidence(event, { pathLength: path.length, evidence }),
    suggested_actions: buildActions(event, path[path.length - 1] ?? event.target),
  };

  return StorySchema.parse(story);
}

function derivePath(graph: DepGraph, target: string, trail = new Set<string>()): string[] {
  if (trail.has(target)) {
    return [target];
  }
  const parents = graph.edges.filter((edge) => edge.to === target).map((edge) => edge.from);
  if (parents.length === 0) {
    return [target];
  }

  return parents.reduce<string[]>((best, parent) => {
    const branch = derivePath(graph, parent, new Set(trail).add(target));
    const candidate = [...branch, target];
    return candidate.length > best.length ? candidate : best;
  }, [target]);
}

function inferScope(graph: DepGraph, target: string, fallback: Story["scope"] | undefined): Story["scope"] {
  const node = graph.nodes.find((item) => item.id === target);
  if (node?.type) {
    return (node.type === "service" ? "server" : node.type) as Story["scope"];
  }
  return fallback ?? "server";
}

function normalizeEvidence(meta: Record<string, unknown>): Story["evidence"] {
  const toStrings = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry)).filter(Boolean);
    }
    if (typeof value === "string" && value.length > 0) {
      return [value];
    }
    return [];
  };

  return {
    logs: toStrings(meta.logs ?? meta.logPointers ?? []),
    traces: toStrings(meta.traces ?? meta.traceIds ?? []),
    metrics: toStrings(meta.metrics ?? meta.metricSeries ?? []),
  };
}

function buildActions(event: Event, target: string): Story["suggested_actions"] {
  const definition = ACTION_DEFINITIONS[event.kind];
  if (!definition) {
    return [];
  }
  const slug = target.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "component";
  return [
    {
      id: `${definition.id}-${slug}`,
      label: definition.label,
      command: definition.command.replace("{target}", target),
      reversible: event.kind !== "errors",
    },
  ];
}

function describeTrigger(event: Event): string {
  switch (event.kind) {
    case "latency":
      return `Latency p95 ${event.meta.latest ?? "?"}ms exceeded ${event.meta.threshold ?? "?"}ms`;
    case "errors":
      return `Error rate rose to ${(Number(event.meta.latest) * 100).toFixed(1)}%`;
    case "fallback":
      return `Fallback remained enabled for ${event.meta.consecutive ?? event.window} cycles`;
    default:
      return `Health check exceeded downtime threshold (${event.meta.downtimeSec ?? "unknown"}s)`;
  }
}

function buildSymptom(event: Event, scope: Story["scope"]): Story["symptom"] {
  const prefix = scope === "tool" ? "Tool" : "Service";
  switch (event.kind) {
    case "latency":
      return {
        user_visible: `${prefix} responses slowed for end-users`,
        technical: `Latency spike detected (${event.meta.latest ?? "?"}ms)`,
      };
    case "errors":
      return {
        user_visible: `${prefix} requests started failing intermittently`,
        technical: `Error rate delta ${(event.meta.delta ?? 0) * 100}%`,
      };
    case "fallback":
      return {
        user_visible: `${prefix} switched to fallback mode`,
        technical: `Fallback flag stayed true for ${event.meta.consecutive ?? event.window} windows`,
      };
    default:
      return {
        user_visible: `${prefix} became unavailable`,
        technical: `Downtime ${event.meta.downtimeSec ?? "?"} seconds`,
      };
  }
}

function buildStoryId(event: Event): string {
  const normalizedTarget = event.target.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "target";
  return `story-${event.kind}-${normalizedTarget}-${Math.abs(event.at)}`;
}
