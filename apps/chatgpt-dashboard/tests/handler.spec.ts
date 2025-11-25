/**
 * Dashboard API Handler Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
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
} from '../src/api/handler.js';

describe('Dashboard API Handler', () => {
  describe('getHealth', () => {
    it('returns health status with required fields', () => {
      const health = getHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('protocolVersion');
      expect(health).toHaveProperty('components');
      expect(health.protocolVersion).toBe('2025-03-26');
    });
    
    it('returns healthy status by default', () => {
      const health = getHealth();
      expect(health.status).toBe('healthy');
    });
    
    it('includes component health information', () => {
      const health = getHealth();
      expect(Array.isArray(health.components)).toBe(true);
      expect(health.components.length).toBeGreaterThan(0);
      
      const component = health.components[0];
      expect(component).toHaveProperty('name');
      expect(component).toHaveProperty('status');
      expect(component).toHaveProperty('lastCheck');
    });
  });
  
  describe('getLogs', () => {
    beforeEach(() => {
      addLog('info', 'test', 'Test log entry');
    });
    
    it('returns log entries', () => {
      const logs = getLogs();
      expect(Array.isArray(logs)).toBe(true);
    });
    
    it('respects limit parameter', () => {
      // Add multiple logs
      for (let i = 0; i < 10; i++) {
        addLog('info', 'test', `Log entry ${i}`);
      }
      
      const logs = getLogs(5);
      expect(logs.length).toBeLessThanOrEqual(5);
    });
    
    it('log entries have required fields', () => {
      addLog('warn', 'test', 'Warning message');
      const logs = getLogs();
      
      if (logs.length > 0) {
        const log = logs[logs.length - 1];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('level');
        expect(log).toHaveProperty('component');
        expect(log).toHaveProperty('message');
      }
    });
  });
  
  describe('getTraces', () => {
    it('returns trace spans array', () => {
      const traces = getTraces();
      expect(Array.isArray(traces)).toBe(true);
    });
    
    it('respects limit parameter', () => {
      const traces = getTraces(10);
      expect(traces.length).toBeLessThanOrEqual(10);
    });
  });
  
  describe('getMetrics', () => {
    it('returns metrics snapshot', () => {
      const metrics = getMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('metrics');
      expect(Array.isArray(metrics.metrics)).toBe(true);
    });
    
    it('includes standard metrics', () => {
      const metrics = getMetrics();
      const metricNames = metrics.metrics.map(m => m.name);
      
      expect(metricNames).toContain('memory_usage');
    });
    
    it('metrics have required fields', () => {
      const metrics = getMetrics();
      
      if (metrics.metrics.length > 0) {
        const metric = metrics.metrics[0];
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('value');
        expect(metric).toHaveProperty('unit');
        expect(metric).toHaveProperty('timestamp');
      }
    });
  });
  
  describe('getAgentRuns', () => {
    it('returns agent runs array', () => {
      const runs = getAgentRuns();
      expect(Array.isArray(runs)).toBe(true);
    });
  });
  
  describe('executeControl', () => {
    it('handles pause action', () => {
      const result = executeControl({ action: 'pause' });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result.action).toBe('pause');
    });
    
    it('handles resume action', () => {
      const result = executeControl({ action: 'resume' });
      
      expect(result.action).toBe('resume');
      expect(result.success).toBe(true);
    });
    
    it('handles drain action', () => {
      const result = executeControl({ action: 'drain' });
      
      expect(result.action).toBe('drain');
      expect(result.success).toBe(true);
    });
    
    it('handles unknown action', () => {
      const result = executeControl({ action: 'unknown' });
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('getConfig', () => {
    it('returns dashboard configuration', () => {
      const config = getConfig();
      
      expect(config).toHaveProperty('refreshInterval');
      expect(config).toHaveProperty('maxLogEntries');
      expect(config).toHaveProperty('maxTraceSpans');
      expect(config).toHaveProperty('theme');
    });
  });
  
  describe('updateConfig', () => {
    it('updates configuration', () => {
      const updated = updateConfig({ refreshInterval: 10000 });
      
      expect(updated.refreshInterval).toBe(10000);
    });
    
    it('preserves unchanged values', () => {
      const before = getConfig();
      const updated = updateConfig({ refreshInterval: 15000 });
      
      expect(updated.maxLogEntries).toBe(before.maxLogEntries);
    });
  });
  
  describe('getProtectedResourceMetadata', () => {
    it('returns OAuth protected resource metadata (RFC 9728)', () => {
      const metadata = getProtectedResourceMetadata();
      
      expect(metadata).toHaveProperty('resource');
      expect(metadata).toHaveProperty('authorization_servers');
      expect(metadata).toHaveProperty('scopes_supported');
      expect(Array.isArray(metadata.authorization_servers)).toBe(true);
      expect(Array.isArray(metadata.scopes_supported)).toBe(true);
    });
    
    it('includes required OAuth scopes', () => {
      const metadata = getProtectedResourceMetadata();
      
      expect(metadata.scopes_supported).toContain('search.read');
      expect(metadata.scopes_supported).toContain('memory.read');
      expect(metadata.scopes_supported).toContain('memory.write');
    });
  });
  
  describe('getSessions', () => {
    it('returns session info array', () => {
      const sessions = getSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
    });
    
    it('sessions have MCP v2025-03-26 protocol version', () => {
      const sessions = getSessions();
      
      if (sessions.length > 0) {
        expect(sessions[0].protocolVersion).toBe('2025-03-26');
      }
    });
  });
  
  describe('startTestFlow', () => {
    it('starts a test flow and returns run ID', () => {
      const result = startTestFlow('http://localhost:3024/mcp', 'diagnose');
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('runId');
      expect(result).toHaveProperty('message');
    });
    
    it('adds run to agent runs', () => {
      const runsBefore = getAgentRuns().length;
      startTestFlow('http://localhost:3024/mcp', 'self-healing');
      const runsAfter = getAgentRuns().length;
      
      expect(runsAfter).toBeGreaterThan(runsBefore);
    });
  });
});

describe('MCP v2025-03-26 Compliance', () => {
  it('health endpoint returns correct protocol version', () => {
    const health = getHealth();
    expect(health.protocolVersion).toBe('2025-03-26');
  });
  
  it('protected resource metadata follows RFC 9728', () => {
    const metadata = getProtectedResourceMetadata();
    
    // RFC 9728 required fields
    expect(metadata).toHaveProperty('resource');
    expect(metadata).toHaveProperty('authorization_servers');
    
    // Optional but recommended fields
    expect(metadata).toHaveProperty('scopes_supported');
    expect(metadata).toHaveProperty('bearer_methods_supported');
  });
  
  it('sessions use MCP session ID format', () => {
    const sessions = getSessions();
    
    if (sessions.length > 0) {
      expect(sessions[0]).toHaveProperty('sessionId');
      expect(sessions[0]).toHaveProperty('transportType');
      expect(['httpStreamable', 'websocket']).toContain(sessions[0].transportType);
    }
  });
});
