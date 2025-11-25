/**
 * CortexDx ChatGPT Control Panel - API Handler
 * 
 * Provides dashboard API endpoints for health, logs, traces, metrics, and controls.
 */

import type {
  HealthStatus,
  LogEntry,
  TraceSpan,
  MetricsSnapshot,
  AgentRun,
  ControlAction,
  ControlActionResult,
  DashboardConfig,
  ProtectedResourceMetadata,
  SessionInfo,
} from '../types/index.js';

/**
 * Dashboard API state (in-memory for demonstration)
 */
const state = {
  logs: [] as LogEntry[],
  traces: [] as TraceSpan[],
  runs: [] as AgentRun[],
  config: {
    refreshInterval: 5000,
    maxLogEntries: 1000,
    maxTraceSpans: 500,
    theme: 'light' as 'light' | 'dark' | 'system',
  },
  startTime: Date.now(),
};

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get system health status
 */
export function getHealth(): HealthStatus {
  const uptime = Math.floor((Date.now() - state.startTime) / 1000);
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime,
    version: '0.1.0',
    protocolVersion: '2025-03-26',
    components: [
      {
        name: 'MCP Server',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        message: 'Accepting connections',
      },
      {
        name: 'WebSocket Transport',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        message: 'Ready',
      },
      {
        name: 'SSE Transport',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        message: 'Ready',
      },
      {
        name: 'Storage',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        message: 'SQLite connected',
      },
    ],
  };
}

/**
 * Get log entries
 */
export function getLogs(limit = 100, since?: string): LogEntry[] {
  let logs = state.logs;
  
  if (since) {
    const sinceDate = new Date(since).getTime();
    logs = logs.filter(log => new Date(log.timestamp).getTime() > sinceDate);
  }
  
  return logs.slice(-limit);
}

/**
 * Add a log entry
 */
export function addLog(level: LogEntry['level'], component: string, message: string, metadata?: Record<string, unknown>): void {
  const entry: LogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    metadata,
  };
  
  state.logs.push(entry);
  
  // Trim logs if exceeding max
  if (state.logs.length > state.config.maxLogEntries) {
    state.logs = state.logs.slice(-state.config.maxLogEntries);
  }
}

/**
 * Get trace spans
 */
export function getTraces(limit = 50): TraceSpan[] {
  return state.traces.slice(-limit);
}

/**
 * Add a trace span
 */
export function addTrace(span: Omit<TraceSpan, 'traceId' | 'spanId'>): void {
  const fullSpan: TraceSpan = {
    traceId: generateId(),
    spanId: generateId(),
    ...span,
  };
  
  state.traces.push(fullSpan);
  
  // Trim traces if exceeding max
  if (state.traces.length > state.config.maxTraceSpans) {
    state.traces = state.traces.slice(-state.config.maxTraceSpans);
  }
}

/**
 * Get metrics snapshot
 * 
 * Note: Some metrics use placeholder values (Math.random()) for demonstration.
 * In production, these should be replaced with actual metric collection from
 * observability infrastructure (Prometheus, OpenTelemetry, etc.)
 */
export function getMetrics(): MetricsSnapshot {
  const now = new Date().toISOString();
  
  // Note: Demo values - replace with real metrics in production
  return {
    timestamp: now,
    metrics: [
      {
        name: 'requests_total',
        value: Math.floor(Math.random() * 10000), // Demo: Replace with actual counter
        unit: 'count',
        timestamp: now,
      },
      {
        name: 'request_latency_p95',
        value: Math.random() * 100 + 10, // Demo: Replace with histogram percentile
        unit: 'ms',
        timestamp: now,
      },
      {
        name: 'memory_usage',
        value: process.memoryUsage().heapUsed / 1024 / 1024, // Real metric
        unit: 'MB',
        timestamp: now,
      },
      {
        name: 'cpu_usage',
        value: Math.random() * 30, // Demo: Replace with actual CPU monitoring
        unit: '%',
        timestamp: now,
      },
      {
        name: 'active_connections',
        value: Math.floor(Math.random() * 50), // Demo: Replace with connection counter
        unit: 'count',
        timestamp: now,
      },
      {
        name: 'diagnostics_run',
        value: Math.floor(Math.random() * 100), // Demo: Replace with run counter
        unit: 'count',
        timestamp: now,
      },
    ],
  };
}

/**
 * Get agent runs
 */
export function getAgentRuns(): AgentRun[] {
  return state.runs;
}

/**
 * Execute a control action
 */
export function executeControl(action: ControlAction): ControlActionResult {
  const timestamp = new Date().toISOString();
  
  switch (action.action) {
    case 'pause':
      if (action.targetId) {
        const run = state.runs.find(r => r.id === action.targetId);
        if (run && run.status === 'running') {
          run.status = 'paused';
          run.updatedAt = timestamp;
          addLog('info', 'control', `Paused run ${action.targetId}`);
          return { success: true, action: 'pause', targetId: action.targetId, message: 'Run paused', timestamp };
        }
        return { success: false, action: 'pause', targetId: action.targetId, message: 'Run not found or not running', timestamp };
      }
      // Pause all
      for (const r of state.runs.filter(r => r.status === 'running')) {
        r.status = 'paused';
        r.updatedAt = timestamp;
      }
      addLog('info', 'control', 'Paused all runs');
      return { success: true, action: 'pause', message: 'All runs paused', timestamp };
      
    case 'resume':
      if (action.targetId) {
        const run = state.runs.find(r => r.id === action.targetId);
        if (run && run.status === 'paused') {
          run.status = 'running';
          run.updatedAt = timestamp;
          addLog('info', 'control', `Resumed run ${action.targetId}`);
          return { success: true, action: 'resume', targetId: action.targetId, message: 'Run resumed', timestamp };
        }
        return { success: false, action: 'resume', targetId: action.targetId, message: 'Run not found or not paused', timestamp };
      }
      // Resume all
      for (const r of state.runs.filter(r => r.status === 'paused')) {
        r.status = 'running';
        r.updatedAt = timestamp;
      }
      addLog('info', 'control', 'Resumed all runs');
      return { success: true, action: 'resume', message: 'All runs resumed', timestamp };
      
    case 'cancel':
      if (action.targetId) {
        const run = state.runs.find(r => r.id === action.targetId);
        if (run && (run.status === 'running' || run.status === 'paused')) {
          run.status = 'cancelled';
          run.updatedAt = timestamp;
          run.completedAt = timestamp;
          addLog('info', 'control', `Cancelled run ${action.targetId}`);
          return { success: true, action: 'cancel', targetId: action.targetId, message: 'Run cancelled', timestamp };
        }
        return { success: false, action: 'cancel', targetId: action.targetId, message: 'Run not found or already completed', timestamp };
      }
      return { success: false, action: 'cancel', message: 'Target ID required for cancel', timestamp };
      
    case 'drain':
      addLog('info', 'control', 'Queue drain initiated');
      return { success: true, action: 'drain', message: 'Queue drain initiated', timestamp };
      
    case 'retry':
      if (action.targetId) {
        const run = state.runs.find(r => r.id === action.targetId);
        if (run && run.status === 'failed') {
          run.status = 'pending';
          run.updatedAt = timestamp;
          run.completedAt = undefined;
          run.progress = 0;
          addLog('info', 'control', `Retrying run ${action.targetId}`);
          return { success: true, action: 'retry', targetId: action.targetId, message: 'Run queued for retry', timestamp };
        }
        return { success: false, action: 'retry', targetId: action.targetId, message: 'Run not found or not failed', timestamp };
      }
      return { success: false, action: 'retry', message: 'Target ID required for retry', timestamp };
      
    default:
      return { success: false, action: action.action, message: 'Unknown action', timestamp };
  }
}

/**
 * Get dashboard configuration
 */
export function getConfig(): DashboardConfig {
  return { ...state.config };
}

/**
 * Update dashboard configuration
 */
export function updateConfig(updates: Partial<DashboardConfig>): DashboardConfig {
  state.config = { ...state.config, ...updates };
  return state.config;
}

/**
 * Get OAuth Protected Resource Metadata (RFC 9728)
 */
export function getProtectedResourceMetadata(): ProtectedResourceMetadata {
  return {
    resource: 'https://cortexdx.brainwav.io',
    authorization_servers: ['https://auth.brainwav.io'],
    scopes_supported: [
      'search.read',
      'docs.write',
      'memory.read',
      'memory.write',
      'memory.delete',
    ],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://docs.brainwav.io/cortexdx',
  };
}

/**
 * Get active sessions
 */
export function getSessions(): SessionInfo[] {
  // Return demo session info
  return [
    {
      sessionId: 'dashboard-demo',
      protocolVersion: '2025-03-26',
      createdAt: new Date(state.startTime).toISOString(),
      lastActivity: new Date().toISOString(),
      transportType: 'httpStreamable',
    },
  ];
}

/**
 * Start a test flow
 */
export function startTestFlow(endpoint: string, workflow: string): { success: boolean; runId?: string; message: string } {
  const runId = generateId();
  const now = new Date().toISOString();
  
  const run: AgentRun = {
    id: runId,
    workflow,
    status: 'pending',
    phase: 'R',
    startedAt: now,
    updatedAt: now,
    progress: 0,
    currentStep: 'Initializing',
  };
  
  state.runs.push(run);
  addLog('info', 'test-flow', `Started test flow: ${workflow} against ${endpoint}`, { endpoint, workflow, runId });
  
  // Simulate run progression
  simulateRunProgress(runId);
  
  return { success: true, runId, message: `Test flow started: ${runId}` };
}

/**
 * Simulate run progress (for demo purposes)
 */
function simulateRunProgress(runId: string): void {
  const run = state.runs.find(r => r.id === runId);
  if (!run) return;
  
  const phases: Array<'R' | 'G' | 'F' | 'REVIEW'> = ['R', 'G', 'F', 'REVIEW'];
  let phaseIndex = 0;
  let progress = 0;
  
  run.status = 'running';
  
  const interval = setInterval(() => {
    if (!run || run.status !== 'running') {
      clearInterval(interval);
      return;
    }
    
    progress += Math.random() * 10;
    
    if (progress >= 100) {
      phaseIndex++;
      if (phaseIndex >= phases.length) {
        run.status = 'completed';
        run.progress = 100;
        run.completedAt = new Date().toISOString();
        run.updatedAt = run.completedAt;
        addLog('info', 'test-flow', `Run ${runId} completed`);
        clearInterval(interval);
        return;
      }
      progress = 0;
      run.phase = phases[phaseIndex];
    }
    
    run.progress = Math.min(progress, 100);
    run.updatedAt = new Date().toISOString();
    run.currentStep = `Phase ${run.phase}: ${Math.floor(run.progress)}%`;
  }, 1000);
}

// Initialize with some demo logs
addLog('info', 'system', 'Dashboard initialized');
addLog('info', 'mcp-server', 'MCP v2025-03-26 protocol active');
addLog('debug', 'transport', 'HTTP Streamable transport ready');
addLog('debug', 'transport', 'WebSocket transport ready');
