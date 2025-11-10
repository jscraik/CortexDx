import type { Event } from "../anomaly/rules.js";
import {
  detectErrorSpike,
  detectFallbackEngaged,
  detectHealthDown,
  detectLatencySpike,
} from "../anomaly/rules.js";
import type { DepGraph, ManifestLike, ProbeInventory } from "../graph/dependency-graph.js";
import { buildDependencyGraph } from "../graph/dependency-graph.js";
import { composeStory, type StoryComposeOptions } from "./story-composer.js";
import type { Story } from "./story-schema.js";

export type StorySignalInput = {
  latency?: { p95: number[]; pct?: number; minutes?: number; target?: string };
  errors?: { buckets: Record<string, number>[]; pct?: number; minutes?: number; target?: string };
  health?: { downtime: number[]; thresholdSec?: number; target?: string };
  fallback?: { flags: boolean[]; minutes?: number; target?: string };
  now?: number;
};

const DEFAULT_OPTIONS: StoryComposeOptions = { defaultScope: "server" };

export class StoryService {
  private readonly graph: DepGraph;

  public constructor(manifest: ManifestLike = {}, probes: ProbeInventory = {}) {
    this.graph = buildDependencyGraph(manifest, probes);
  }

  public generateStories(signals: StorySignalInput = {}): Story[] {
    const events = this.detectEvents(signals);
    return events.map((event) =>
      composeStory(event, this.graph, {
        ...DEFAULT_OPTIONS,
        deterministicNow: signals.now,
      }),
    );
  }

  public getStoryById(id: string, signals: StorySignalInput = {}): Story | undefined {
    return this.generateStories(signals).find((story) => story.id === id);
  }

  private detectEvents(signals: StorySignalInput): Event[] {
    const now = signals.now;
    return [
      ...collectLatencyEvents(signals, now),
      ...collectErrorEvents(signals, now),
      ...collectHealthEvents(signals, now),
      ...collectFallbackEvents(signals, now),
    ];
  }
}

const collectLatencyEvents = (signals: StorySignalInput, now?: number): Event[] => {
  if (!signals.latency?.p95?.length) {
    return [];
  }
  return detectLatencySpike(
    signals.latency.p95,
    signals.latency.pct ?? 80,
    signals.latency.minutes ?? 3,
    { target: signals.latency.target, now },
  );
};

const collectErrorEvents = (signals: StorySignalInput, now?: number): Event[] => {
  if (!signals.errors?.buckets?.length) {
    return [];
  }
  return detectErrorSpike(
    signals.errors.buckets,
    signals.errors.pct ?? 20,
    signals.errors.minutes ?? 3,
    { target: signals.errors.target, now },
  );
};

const collectHealthEvents = (signals: StorySignalInput, now?: number): Event[] => {
  if (!signals.health?.downtime?.length) {
    return [];
  }
  return detectHealthDown(
    signals.health.downtime,
    signals.health.thresholdSec ?? 30,
    { target: signals.health.target, now },
  );
};

const collectFallbackEvents = (signals: StorySignalInput, now?: number): Event[] => {
  if (!signals.fallback?.flags?.length) {
    return [];
  }
  return detectFallbackEngaged(
    signals.fallback.flags,
    signals.fallback.minutes ?? 3,
    { target: signals.fallback.target, now },
  );
};
