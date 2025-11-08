/**
 * Self-healing integration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoHealer } from '../src/healing/auto-healer.js';
import { InspectorAdapter } from '../src/adapters/inspector-adapter.js';
import { TemplateEngine } from '../src/template-engine/engine.js';
import { MonitoringScheduler } from '../src/healing/scheduler.js';
import { getTemplate, getTemplateRecommendations } from '../src/templates/fix-templates.js';
import type { DevelopmentContext, Finding } from '../src/types.js';

// Mock development context for testing
const createMockContext = (): DevelopmentContext => ({
  endpoint: 'http://localhost:5001',
  logger: vi.fn(),
  request: vi.fn().mockResolvedValue({}),
  jsonrpc: vi.fn().mockResolvedValue({}),
  sseProbe: vi.fn().mockResolvedValue({ ok: true }),
  evidence: vi.fn(),
  deterministic: true,
  sessionId: 'test-session',
  userExpertiseLevel: 'expert',
  conversationHistory: [],
});

describe('AutoHealer', () => {
  let healer: AutoHealer;
  let mockContext: DevelopmentContext;

  beforeEach(() => {
    mockContext = createMockContext();
    healer = new AutoHealer(mockContext);
  });

  describe('quickHealthCheck', () => {
    it('should return healthy status when no issues found', async () => {
      // Mock successful diagnostics
      vi.spyOn(healer as any, 'runDiagnostics').mockResolvedValue([]);

      const result = await healer.quickHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.issues).toBe(0);
      expect(result.criticalIssues).toBe(0);
      expect(result.message).toBe('System is healthy');
    });

    it('should return unhealthy status when critical issues found', async () => {
      const mockFindings: Finding[] = [
        {
          id: 'test-1',
          area: 'security',
          severity: 'blocker',
          title: 'Critical Security Issue',
          description: 'Test blocker issue',
          evidence: [],
        },
      ];

      vi.spyOn(healer as any, 'runDiagnostics').mockResolvedValue(mockFindings);

      const result = await healer.quickHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.issues).toBe(1);
      expect(result.criticalIssues).toBe(1);
      expect(result.message).toContain('critical issues');
    });

    it('should handle diagnostic errors gracefully', async () => {
      vi.spyOn(healer as any, 'runDiagnostics').mockRejectedValue(new Error('Diagnostic failed'));

      const result = await healer.quickHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.issues).toBe(-1);
      expect(result.criticalIssues).toBe(-1);
      expect(result.message).toContain('Health check failed');
    });
  });

  describe('getHealingRecommendations', () => {
    it('should provide recommendations for findings', async () => {
      const mockFindings: Finding[] = [
        {
          id: 'security-1',
          area: 'security',
          severity: 'minor',
          title: 'Missing Security Headers',
          description: 'Security headers not configured',
          evidence: [],
          templateId: 'security.headers',
          canAutoFix: true,
          riskLevel: 'low',
        },
      ];

      vi.spyOn(healer as any, 'runDiagnostics').mockResolvedValue(mockFindings);
      vi.spyOn(healer as any, 'analyzeFindings').mockResolvedValue(mockFindings);

      const result = await healer.getHealingRecommendations();

      expect(result.findings).toEqual(mockFindings);
      expect(result.recommendations).toContain('Apply Add Security Headers (5-10 minutes)');
      expect(result.estimatedTime).toBe('5-10 minutes');
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('healSelf', () => {
    it('should run complete healing cycle successfully', async () => {
      const mockFindings: Finding[] = [
        {
          id: 'test-1',
          area: 'security',
          severity: 'minor',
          title: 'Test Issue',
          description: 'Test finding',
          evidence: [],
          templateId: 'security.headers',
          canAutoFix: true,
          riskLevel: 'low',
        },
      ];

      const mockReport = {
        jobId: 'test-job',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        findings: mockFindings,
        fixes: [{
          findingId: 'test-1',
          templateId: 'security.headers',
          success: true,
          applied: true,
          validated: true,
          rollbackAvailable: true,
          timeTaken: 1000,
        }],
        validation: {
          totalFindings: 1,
          issuesFixed: 1,
          issuesRemaining: 0,
          autoFixed: 1,
          manualReviewRequired: 0,
          blockersRemaining: 0,
        },
        summary: {
          severity: 'success' as const,
          message: 'Complete success: All 1 issues resolved automatically',
          recommendations: ['Continue monitoring system health'],
          nextSteps: ['Run full system test suite'],
        },
      };

      vi.spyOn(healer as any, 'runDiagnostics').mockResolvedValue(mockFindings);
      vi.spyOn(healer as any, 'analyzeFindings').mockResolvedValue(mockFindings);
      vi.spyOn(healer as any, 'applyAutomatedFixes').mockResolvedValue(mockReport.fixes);
      vi.spyOn(healer as any, 'validateFixes').mockResolvedValue(mockReport.validation);
      vi.spyOn(healer as any, 'generateSummary').mockResolvedValue(mockReport.summary);

      const result = await healer.healSelf({ autoFix: true });

      expect(result.findings).toEqual(mockFindings);
      expect(result.fixes).toEqual(mockReport.fixes);
      expect(result.validation).toEqual(mockReport.validation);
      expect(result.summary).toEqual(mockReport.summary);
      expect(result.summary.severity).toBe('success');
    });

    it('should handle healing failures gracefully', async () => {
      vi.spyOn(healer as any, 'runDiagnostics').mockRejectedValue(new Error('Diagnostic failed'));

      const result = await healer.healSelf();

      expect(result.summary.severity).toBe('failed');
      expect(result.summary.message).toContain('Self-healing failed');
    });
  });
});

describe('InspectorAdapter', () => {
  let adapter: InspectorAdapter;
  let mockContext: DevelopmentContext;

  beforeEach(() => {
    mockContext = createMockContext();
    adapter = new InspectorAdapter(mockContext);
  });

  describe('diagnose', () => {
    it('should run diagnostics and return report', async () => {
      const result = await adapter.diagnose('http://localhost:3000', ['handshake', 'security']);

      expect(result.jobId).toBeDefined();
      expect(result.endpoint).toBe('http://localhost:3000');
      expect(result.startedAt).toBeDefined();
      expect(result.finishedAt).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.probesRun).toBe(2);
    });

    it('should handle endpoint errors gracefully', async () => {
      const result = await adapter.diagnose('invalid-endpoint', ['handshake']);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('blocker');
      expect(result.findings[0].area).toBe('protocol');
      expect(result.findings[0].description).toContain('failed');
    });
  });

  describe('selfDiagnose', () => {
    it('should run self-diagnosis with default probes', async () => {
      const result = await adapter.selfDiagnose();

      expect(result.endpoint).toBe('http://127.0.0.1:5001');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.metrics.probesRun).toBe(5); // Default probes
    });
  });

  describe('convertFindings', () => {
    it('should convert Inspector findings to Insula format', () => {
      const inspectorFindings = [
        {
          id: 'test-1',
          severity: 'minor',
          area: 'security',
          description: 'Test finding',
          evidence: { raw: 'test evidence' },
        },
      ];

      const converted = adapter.convertFindings(inspectorFindings);

      expect(converted).toHaveLength(1);
      expect(converted[0].id).toBe('inspector_test-1');
      expect(converted[0].area).toBe('security');
      expect(converted[0].severity).toBe('minor');
      expect(converted[0].title).toBe('Inspector: security');
      expect(converted[0].requiresLLMAnalysis).toBe(true);
      expect(converted[0].inspectorData).toBeDefined();
    });
  });
});

describe('TemplateEngine', () => {
  let engine: TemplateEngine;
  let mockContext: DevelopmentContext;

  beforeEach(() => {
    mockContext = createMockContext();
    engine = new TemplateEngine();
  });

  describe('applyTemplate', () => {
    it('should apply template successfully', async () => {
      const template = getTemplate('security.headers');
      expect(template).toBeDefined();

      const finding: Finding = {
        id: 'test-finding',
        area: 'security',
        severity: 'minor',
        title: 'Test Finding',
        description: 'Test description',
        evidence: [],
        templateId: 'security.headers',
        canAutoFix: true,
      };

      const result = await engine.applyTemplate('security.headers', finding, mockContext, {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.templateId).toBe('security.headers');
      expect(result.checklistResult).toBeDefined();
      expect(result.codeChanges).toBeDefined();
    });

    it('should handle missing template gracefully', async () => {
      const finding: Finding = {
        id: 'test-finding',
        area: 'security',
        severity: 'minor',
        title: 'Test Finding',
        description: 'Test description',
        evidence: [],
      };

      const result = await engine.applyTemplate('non-existent-template', finding, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle dry run mode correctly', async () => {
      const template = getTemplate('security.headers');
      expect(template).toBeDefined();

      const finding: Finding = {
        id: 'test-finding',
        area: 'security',
        severity: 'minor',
        title: 'Test Finding',
        description: 'Test description',
        evidence: [],
        templateId: 'security.headers',
        canAutoFix: true,
      };

      const result = await engine.applyTemplate('security.headers', finding, mockContext, {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.rollbackAvailable).toBe(false); // No rollback in dry run
    });
  });

  describe('rollbackChanges', () => {
    it('should rollback changes successfully', async () => {
      const changes = [
        {
          type: 'update' as const,
          path: 'test-file.ts',
          originalContent: 'original content',
          newContent: 'new content',
          backupPath: '/tmp/test-backup',
          applied: true,
        },
      ];

      // Mock file system operations
      vi.mock('node:fs', () => ({
        promises: {
          readFile: vi.fn().mockResolvedValue('original content'),
          writeFile: vi.fn().mockResolvedValue(undefined),
        },
      }));

      const result = await engine.rollbackChanges(changes);

      expect(result).toBe(true);
    });
  });
});

describe('MonitoringScheduler', () => {
  let scheduler: MonitoringScheduler;
  let mockContext: DevelopmentContext;

  beforeEach(() => {
    mockContext = createMockContext();
    scheduler = new MonitoringScheduler(mockContext);
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('job management', () => {
    it('should add and remove jobs', () => {
      const config = {
        endpoint: 'http://localhost:3000',
        schedule: '*/5 * * * *',
        probes: ['handshake'],
        autoHeal: false,
        enabled: true,
      };

      const jobId = scheduler.addJob(config);
      expect(jobId).toBeDefined();

      const removed = scheduler.removeJob(jobId);
      expect(removed).toBe(true);
    });

    it('should toggle job enabled state', () => {
      const config = {
        endpoint: 'http://localhost:3000',
        schedule: '*/5 * * * *',
        probes: ['handshake'],
        autoHeal: false,
        enabled: true,
      };

      const jobId = scheduler.addJob(config);

      let disabled = scheduler.toggleJob(jobId, false);
      expect(disabled).toBe(true);

      let enabled = scheduler.toggleJob(jobId, true);
      expect(enabled).toBe(true);
    });
  });

  describe('status reporting', () => {
    it('should report correct status', () => {
      const status = scheduler.getStatus();

      expect(status.running).toBe(false);
      expect(status.activeJobs).toBe(0);
      expect(status.lastCheck).toBeDefined();
      expect(status.nextCheck).toBe('No scheduled jobs');
    });

    it('should report active jobs', () => {
      const config = {
        endpoint: 'http://localhost:3000',
        schedule: '*/5 * * * *',
        probes: ['handshake'],
        autoHeal: false,
        enabled: true,
      };

      scheduler.addJob(config);
      const jobs = scheduler.getJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].config.endpoint).toBe('http://localhost:3000');
      expect(jobs[0].enabled).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should export and import configurations', () => {
      const config = {
        endpoint: 'http://localhost:3000',
        schedule: '*/5 * * * *',
        probes: ['handshake'],
        autoHeal: false,
        enabled: true,
      };

      scheduler.addJob(config);
      const exported = scheduler.exportConfig();

      expect(exported.jobs).toHaveLength(1);
      expect(exported.jobs[0].endpoint).toBe('http://localhost:3000');

      // Create new scheduler and import config
      const newScheduler = new MonitoringScheduler(mockContext);
      newScheduler.importConfig(exported);

      const importedJobs = newScheduler.getJobs();
      expect(importedJobs).toHaveLength(1);
      expect(importedJobs[0].config.endpoint).toBe('http://localhost:3000');
    });
  });
});

describe('Template System Integration', () => {
  it('should provide template recommendations for findings', () => {
    const findings: Finding[] = [
      {
        id: 'security-1',
        area: 'security',
        severity: 'minor',
        title: 'Security Issue',
        description: 'Test security issue',
        evidence: [],
        templateId: 'security.headers',
        canAutoFix: true,
      },
      {
        id: 'perf-1',
        area: 'performance',
        severity: 'major',
        title: 'Performance Issue',
        description: 'Test performance issue',
        evidence: [],
        templateId: 'sse.streaming',
        canAutoFix: true,
      },
    ];

    const recommendations = getTemplateRecommendations(findings);

    expect(recommendations).toHaveLength(2);
    expect(recommendations[0].id).toBe('sse.streaming'); // Major severity first
    expect(recommendations[1].id).toBe('security.headers');
  });

  it('should handle findings without template recommendations', () => {
    const findings: Finding[] = [
      {
        id: 'unknown-1',
        area: 'unknown',
        severity: 'info',
        title: 'Unknown Issue',
        description: 'Test unknown issue',
        evidence: [],
        canAutoFix: false,
      },
    ];

    const recommendations = getTemplateRecommendations(findings);

    expect(recommendations).toHaveLength(0);
  });
});

describe('Error Handling', () => {
  it('should handle template engine failures gracefully', async () => {
    const mockContext = createMockContext();
    const engine = new TemplateEngine();

    // Test with invalid template
    const finding: Finding = {
      id: 'test-finding',
      area: 'security',
      severity: 'minor',
      title: 'Test Finding',
      description: 'Test description',
      evidence: [],
      templateId: 'invalid-template',
      canAutoFix: true,
    };

    const result = await engine.applyTemplate('invalid-template', finding, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle auto-healer errors gracefully', async () => {
    const mockContext = createMockContext();
    const healer = new AutoHealer(mockContext);

    // Mock diagnostic failure
    vi.spyOn(healer as any, 'runDiagnostics').mockRejectedValue(new Error('Diagnostic service unavailable'));

    const result = await healer.healSelf();

    expect(result.summary.severity).toBe('failed');
    expect(result.summary.message).toContain('Self-healing failed');
  });
});