import { describe, expect, it } from "vitest";
import {
  detectErrorSpike,
  detectFallbackEngaged,
  detectHealthDown,
  detectLatencySpike,
} from "../src/anomaly/rules.js";

describe("anomaly rule detectors", () => {
  it("reports downtime when latest sample exceeds threshold", () => {
    const events = detectHealthDown([1, 2, 9], 5, { now: 42, target: "edge" });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "health",
      target: "edge",
      meta: { downtimeSec: 9 },
    });
  });

  it("ignores downtime below threshold", () => {
    expect(detectHealthDown([1, 2, 3], 5)).toHaveLength(0);
  });

  it("detects latency spikes relative to baseline", () => {
    const events = detectLatencySpike([30, 35, 40, 120], 50, 3, { target: "api", now: 99 });
    expect(events).toHaveLength(1);
    expect(events[0].meta).toMatchObject({ latest: 120 });
  });

  it("skips latency spike when baseline slice is empty", () => {
    expect(detectLatencySpike([50], 20, 2)).toHaveLength(0);
  });

  it("reports error spikes when error ratio jumps", () => {
    const buckets = [
      { 200: 90, 500: 10 },
      { 200: 80, 500: 20 },
      { 200: 40, 500: 60 },
    ];
    const events = detectErrorSpike(buckets, 10, 2, { target: "proxy" });
    expect(events).toHaveLength(1);
    expect(events[0].meta?.latest).toBeGreaterThan(events[0].meta?.baseline ?? 0);
  });

  it("omits error spikes when totals stay flat", () => {
    const buckets = [{ 200: 100 }, { 200: 100 }];
    expect(detectErrorSpike(buckets, 10, 2)).toHaveLength(0);
  });

  it("flags fallback engaged when all flags within window are true", () => {
    const events = detectFallbackEngaged([false, true, true, true], 3, { target: "sse" });
    expect(events).toHaveLength(1);
    expect(events[0].meta?.consecutive).toBe(3);
  });

  it("ignores fallback when any flag is false", () => {
    expect(detectFallbackEngaged([true, false, true], 3)).toHaveLength(0);
  });
});
