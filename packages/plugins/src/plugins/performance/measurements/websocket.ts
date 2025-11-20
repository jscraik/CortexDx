/**
 * WebSocket performance measurement
 */

import type { Finding } from "@brainwav/cortexdx-core";
import type { PerformanceHarness, WebSocketMetrics } from "@brainwav/cortexdx-core";

/**
 * Measure WebSocket performance from transcript
 */
export function measureWebSocket(
  harness: PerformanceHarness,
): WebSocketMetrics {
  const transcript = harness.transcript();

  // Check if transcript is available (simplified check since TransportTranscript doesn't have type/messages)
  if (!transcript) {
    return {
      messageCount: 0,
      maxGapMs: undefined,
      reconnects: 0,
    };
  }

  // Use exchanges instead of messages since TransportTranscript has exchanges property
  const messages = transcript.exchanges || [];
  let reconnects = 0;
  let maxGap = 0;

  // Count reconnects by looking for connection events
  // (This is simplified - actual implementation would parse message types)
  for (const msg of messages) {
    // Check if msg has a data property before accessing it
    if (
      msg &&
      typeof (msg as any).data === "string" &&
      (msg as any).data.includes("reconnect")
    ) {
      reconnects++;
    }
  }

  // Calculate max gap between messages
  for (let i = 1; i < messages.length; i++) {
    const currentMsg = messages[i];
    const previousMsg = messages[i - 1];
    // Check if messages have timestamp property
    if (
      currentMsg &&
      previousMsg &&
      typeof (currentMsg as any).timestamp === "number" &&
      typeof (previousMsg as any).timestamp === "number"
    ) {
      const gap =
        (currentMsg as any).timestamp - (previousMsg as any).timestamp;
      maxGap = Math.max(maxGap, gap);
    }
  }

  return {
    messageCount: messages.length,
    maxGapMs: maxGap > 0 ? maxGap : undefined,
    reconnects,
  };
}

/**
 * Build WebSocket description from metrics
 */
export function buildWebSocketDescription(metrics: WebSocketMetrics): string {
  const parts: string[] = [];

  parts.push(`${metrics.messageCount} messages`);

  if (metrics.maxGapMs !== undefined) {
    parts.push(`Max gap: ${metrics.maxGapMs.toFixed(2)}ms`);
  }

  if (metrics.reconnects > 0) {
    parts.push(`${metrics.reconnects} reconnects`);
  }

  return parts.join(", ");
}

/**
 * Build WebSocket-specific performance findings
 */
export function buildWebSocketFindings(
  metrics: WebSocketMetrics,
  endpoint: string,
): Finding[] {
  const findings: Finding[] = [];

  if (metrics.messageCount === 0) {
    return findings; // No WebSocket data
  }

  // Message count finding
  findings.push({
    id: "perf.websocket.messages",
    area: "performance",
    severity: metrics.reconnects > 0 ? "minor" : "info",
    title: `WebSocket: ${metrics.messageCount} messages`,
    description: buildWebSocketDescription(metrics),
    evidence: [
      { type: "log", ref: `Message count: ${metrics.messageCount}` },
      { type: "url", ref: endpoint },
    ],
    confidence: 1.0,
  });

  // Reconnect warnings
  if (metrics.reconnects > 0) {
    findings.push({
      id: "perf.websocket.reconnects",
      area: "performance",
      severity: metrics.reconnects > 2 ? "major" : "minor",
      title: `WebSocket reconnects: ${metrics.reconnects}`,
      description: `WebSocket connection reconnected ${metrics.reconnects} times, indicating stability issues`,
      evidence: [{ type: "log", ref: `Reconnects: ${metrics.reconnects}` }],
      confidence: 0.9,
    });
  }

  // Large gaps
  if (metrics.maxGapMs && metrics.maxGapMs > 5000) {
    findings.push({
      id: "perf.websocket.gap",
      area: "performance",
      severity: "minor",
      title: `Large message gap: ${metrics.maxGapMs.toFixed(2)}ms`,
      description: `Maximum gap between WebSocket messages is ${metrics.maxGapMs.toFixed(2)}ms`,
      evidence: [{ type: "log", ref: `Max gap: ${metrics.maxGapMs}ms` }],
      confidence: 0.8,
    });
  }

  return findings;
}
