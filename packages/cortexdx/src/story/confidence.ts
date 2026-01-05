import type { Event } from "../anomaly/rules.js";

export type ConfidenceContext = {
  pathLength?: number;
  evidence?: {
    logs?: string[];
    traces?: string[];
    metrics?: string[];
  };
};

const KIND_BASE: Record<Event["kind"], number> = {
  health: 0.55,
  latency: 0.6,
  errors: 0.65,
  fallback: 0.7,
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function scoreConfidence(
  event: Event,
  context: ConfidenceContext = {},
): number {
  const base = KIND_BASE[event.kind] ?? 0.5;
  const magnitude = clamp(
    Number(event.meta.magnitude ?? event.meta.delta ?? 0.2),
  );
  const signalBoost = clamp(magnitude * 0.2);
  const pathBoost = clamp(((context.pathLength ?? 1) - 1) * 0.02);
  const evidenceCount = countEvidence(context.evidence);
  const evidenceBoost = clamp(evidenceCount * 0.02);
  const raw = clamp(base + signalBoost + pathBoost + evidenceBoost);
  return Number(raw.toFixed(2));
}

function countEvidence(evidence: ConfidenceContext["evidence"]): number {
  if (!evidence) {
    return 0;
  }
  return (
    (evidence.logs?.length ?? 0) +
    (evidence.traces?.length ?? 0) +
    (evidence.metrics?.length ?? 0)
  );
}
