export type EventKind = "health" | "latency" | "errors" | "fallback";

export type Event = {
  kind: EventKind;
  at: number;
  target: string;
  window: number;
  meta: Record<string, unknown>;
};

export type DetectionContext = {
  target?: string;
  now?: number;
};

const DEFAULT_TARGET = "server";

const clamp = (value: number) => Math.max(0, value);

export function detectHealthDown(
  samples: number[],
  thresholdSec: number,
  context: DetectionContext = {},
): Event[] {
  if (samples.length === 0) {
    return [];
  }

  const latest = samples[samples.length - 1];
  if (latest !== undefined && latest < thresholdSec) {
    return [];
  }

  return [
    {
      kind: "health",
      at: context.now ?? Date.now(),
      target: context.target ?? DEFAULT_TARGET,
      window: samples.length,
      meta: { downtimeSec: latest },
    },
  ];
}

export function detectLatencySpike(
  p95: number[],
  pct: number,
  mins: number,
  context: DetectionContext = {},
): Event[] {
  if (p95.length < 2) {
    return [];
  }

  const latest = p95[p95.length - 1];
  const baselineSlice = p95.slice(0, -1).slice(-Math.max(mins - 1, 1));
  const baseline =
    baselineSlice.reduce((sum, value) => sum + value, 0) / baselineSlice.length;
  const threshold = baseline * (1 + pct / 100);

  if (latest !== undefined && !(latest > threshold)) {
    return [];
  }

  return [
    {
      kind: "latency",
      at: context.now ?? Date.now(),
      target: context.target ?? DEFAULT_TARGET,
      window: mins,
      meta: { baseline, latest, threshold },
    },
  ];
}

export function detectErrorSpike(
  codes: Record<string, number>[],
  pct: number,
  mins: number,
  context: DetectionContext = {},
): Event[] {
  if (codes.length === 0) {
    return [];
  }

  const latest = codes[codes.length - 1];
  const latestTotals = latest ? calculateErrorRate(latest) : 0;
  const baselineSlice = codes.slice(0, -1).slice(-Math.max(mins - 1, 1));
  const baselineAverage =
    baselineSlice.reduce((sum, bucket) => sum + calculateErrorRate(bucket), 0) /
    (baselineSlice.length || 1);

  const delta = latestTotals - baselineAverage;
  if (delta < pct / 100 && latestTotals <= baselineAverage) {
    return [];
  }

  return [
    {
      kind: "errors",
      at: context.now ?? Date.now(),
      target: context.target ?? DEFAULT_TARGET,
      window: mins,
      meta: { latest: latestTotals, baseline: baselineAverage, delta },
    },
  ];
}

export function detectFallbackEngaged(
  flags: boolean[],
  mins: number,
  context: DetectionContext = {},
): Event[] {
  if (flags.length === 0) {
    return [];
  }

  const recent = flags.slice(-mins);
  if (!recent.every(Boolean)) {
    return [];
  }

  return [
    {
      kind: "fallback",
      at: context.now ?? Date.now(),
      target: context.target ?? DEFAULT_TARGET,
      window: mins,
      meta: { consecutive: recent.length },
    },
  ];
}

function calculateErrorRate(bucket: Record<string, number>): number {
  const entries = Object.entries(bucket);
  const totals = entries.reduce(
    (acc, [code, count]) => {
      const numeric = Number(code);
      if (Number.isFinite(numeric) && numeric >= 400) {
        acc.errors += count;
      }
      acc.total += count;
      return acc;
    },
    { errors: 0, total: 0 },
  );

  if (totals.total === 0) {
    return 0;
  }

  return clamp(totals.errors / totals.total);
}
