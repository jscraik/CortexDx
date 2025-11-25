/**
 * CortexDx ChatGPT Control Panel Types
 * 
 * Types for the dashboard API and UI components.
 * Follows MCP v2025-03-26 specification.
 */

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  protocolVersion: string;
  components: ComponentHealth[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: string;
}

/**
 * Log entry from the system
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Trace span for distributed tracing
 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'ok' | 'error' | 'unset';
  attributes?: Record<string, unknown>;
}

/**
 * Metrics data point
 */
export interface MetricPoint {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  labels?: Record<string, string>;
}

/**
 * Metrics snapshot
 */
export interface MetricsSnapshot {
  timestamp: string;
  metrics: MetricPoint[];
}

/**
 * Agent run status
 */
export interface AgentRun {
  id: string;
  workflow: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  phase: 'R' | 'G' | 'F' | 'REVIEW';
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  progress?: number;
  currentStep?: string;
}

/**
 * Control action request
 */
export interface ControlAction {
  action: 'pause' | 'resume' | 'cancel' | 'retry' | 'drain';
  targetId?: string;
  params?: Record<string, unknown>;
}

/**
 * Control action response
 */
export interface ControlActionResult {
  success: boolean;
  action: string;
  targetId?: string;
  message: string;
  timestamp: string;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  refreshInterval: number;
  maxLogEntries: number;
  maxTraceSpans: number;
  theme: 'light' | 'dark' | 'system';
}

/**
 * OAuth Protected Resource Metadata (RFC 9728)
 */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_signing_alg_values_supported?: string[];
  resource_documentation?: string;
}

/**
 * MCP Session info for Streamable HTTP
 */
export interface SessionInfo {
  sessionId: string;
  protocolVersion: string;
  createdAt: string;
  lastActivity: string;
  transportType: 'httpStreamable' | 'websocket';
}

/**
 * Dashboard API endpoints
 */
export interface DashboardAPI {
  getHealth(): Promise<HealthStatus>;
  getLogs(limit?: number, since?: string): Promise<LogEntry[]>;
  getTraces(limit?: number): Promise<TraceSpan[]>;
  getMetrics(): Promise<MetricsSnapshot>;
  getAgentRuns(): Promise<AgentRun[]>;
  executeControl(action: ControlAction): Promise<ControlActionResult>;
  getConfig(): Promise<DashboardConfig>;
  updateConfig(config: Partial<DashboardConfig>): Promise<DashboardConfig>;
  getProtectedResourceMetadata(): Promise<ProtectedResourceMetadata>;
  getSessions(): Promise<SessionInfo[]>;
}

/**
 * Tab identifiers for dashboard navigation
 */
export type DashboardTab = 'health' | 'logs' | 'traces' | 'metrics' | 'controls';

/**
 * Accessibility announcement for screen readers
 */
export interface A11yAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
}
