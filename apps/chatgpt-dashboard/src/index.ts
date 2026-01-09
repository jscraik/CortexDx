/**
 * CortexDx ChatGPT Control Panel
 *
 * A WCAG 2.2 AA accessible dashboard for monitoring health, logs, traces,
 * metrics and controlling agents within ChatGPT using MCP v2025-03-26.
 *
 * Supports dual-mode transport:
 * - Streamable HTTP (SSE) for real-time updates
 * - WebSocket for bidirectional communication
 *
 * @packageDocumentation
 */

export { startDashboardServer, broadcastSSE, broadcastWS } from "./server.js";

export {
  getHealth,
  getLogs,
  getTraces,
  getMetrics,
  getAgentRuns,
  executeControl,
  getConfig,
  updateConfig,
  getProtectedResourceMetadata,
  getSessions,
  startTestFlow,
  addLog,
} from "./api/handler.js";

export type {
  HealthStatus,
  ComponentHealth,
  LogEntry,
  TraceSpan,
  MetricPoint,
  MetricsSnapshot,
  AgentRun,
  ControlAction,
  ControlActionResult,
  DashboardConfig,
  ProtectedResourceMetadata,
  SessionInfo,
  DashboardAPI,
  DashboardTab,
  A11yAnnouncement,
} from "./types/index.js";
