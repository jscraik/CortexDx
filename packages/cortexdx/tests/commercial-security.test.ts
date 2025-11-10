/**
 * Tests for Commercial Security Features
 * Requirements: 6.4, 7.1, 10.5
 */

import { beforeEach, describe, expect, it } from "vitest";
import { EnterpriseSecurityDashboard, ThreatDetectionEngine } from "../src/plugins/commercial-security.js";
import { AuditLogger, ComplianceReporter, SecurityMonitor } from "../src/security/audit-compliance.js";
import { SecurityMonitoringService } from "../src/security/security-monitoring.js";
import type { DiagnosticContext } from "../src/types.js";

describe("ThreatDetectionEngine", () => {
    let auditLogger: AuditLogger;
    let securityMonitor: SecurityMonitor;
    let threatEngine: ThreatDetectionEngine;
    let mockContext: DiagnosticContext;

    beforeEach(() => {
        auditLogger = new AuditLogger();
        securityMonitor = new SecurityMonitor(auditLogger);
        threatEngine = new ThreatDetectionEngine(auditLogger, securityMonitor);

        mockContext = {
            endpoint: "https://test.example.com",
            logger: () => { },
            request: async () => ({}),
            jsonrpc: async () => ({}),
            sseProbe: async () => ({ ok: true }),
            evidence: () => { },
        };
    });

    it("should detect intrusion attempts from failed auth", async () => {
        for (let i = 0; i < 6; i++) {
            auditLogger.log({
                action: "authentication",
                resource: "test-resource",
                result: "denied",
                details: {},
                severity: "warning",
            });
        }

        const threats = await threatEngine.detectThreats(mockContext);

        expect(threats.length).toBeGreaterThan(0);
        const intrusionThreat = threats.find((t) => t.type === "intrusion");
        expect(intrusionThreat).toBeDefined();
        expect(intrusionThreat?.severity).toBe("high");
    });

    it("should detect anomalous activity spikes", async () => {
        for (let i = 0; i < 101; i++) {
            auditLogger.log({
                action: "request",
                resource: "test-resource",
                result: "success",
                details: {},
                severity: "info",
            });
        }

        const threats = await threatEngine.detectThreats(mockContext);

        const anomalyThreat = threats.find((t) => t.type === "anomaly");
        expect(anomalyThreat).toBeDefined();
        expect(anomalyThreat?.indicators).toContain("high-request-rate");
    });

    it("should detect policy violations for unencrypted connections", async () => {
        const httpContext = { ...mockContext, endpoint: "http://insecure.example.com" };

        const threats = await threatEngine.detectThreats(httpContext);

        const policyThreat = threats.find((t) => t.type === "policy-violation");
        expect(policyThreat).toBeDefined();
        expect(policyThreat?.severity).toBe("high");
        expect(policyThreat?.indicators).toContain("no-tls");
    });

    it("should raise alerts for critical threats", async () => {
        const httpContext = { ...mockContext, endpoint: "http://insecure.example.com" };

        await threatEngine.detectThreats(httpContext);

        const alerts = securityMonitor.getAlerts();
        expect(alerts.length).toBeGreaterThan(0);
    });

    it("should filter threats by type and severity", async () => {
        const httpContext = { ...mockContext, endpoint: "http://insecure.example.com" };
        await threatEngine.detectThreats(httpContext);

        const highThreats = threatEngine.getThreats({ severity: "high" });
        expect(highThreats.every((t) => t.severity === "high")).toBe(true);
    });
});

describe("EnterpriseSecurityDashboard", () => {
    let auditLogger: AuditLogger;
    let securityMonitor: SecurityMonitor;
    let complianceReporter: ComplianceReporter;
    let threatEngine: ThreatDetectionEngine;
    let dashboard: EnterpriseSecurityDashboard;

    beforeEach(() => {
        auditLogger = new AuditLogger();
        securityMonitor = new SecurityMonitor(auditLogger);
        complianceReporter = new ComplianceReporter(auditLogger);
        threatEngine = new ThreatDetectionEngine(auditLogger, securityMonitor);
        dashboard = new EnterpriseSecurityDashboard(
            auditLogger,
            securityMonitor,
            complianceReporter,
            threatEngine,
        );
    });

    it("should generate comprehensive security dashboard", async () => {
        auditLogger.log({
            action: "test",
            resource: "test-resource",
            result: "success",
            details: {},
            severity: "info",
        });

        const dashboardData = await dashboard.generateDashboard();

        expect(dashboardData).toBeDefined();
        expect(dashboardData.timestamp).toBeInstanceOf(Date);
        expect(dashboardData.overallScore).toBeGreaterThanOrEqual(0);
        expect(dashboardData.overallScore).toBeLessThanOrEqual(100);
        expect(dashboardData.metrics).toBeDefined();
    });

    it("should calculate compliance status correctly", async () => {
        const dashboardData = await dashboard.generateDashboard();

        expect(["compliant", "partial", "non-compliant"]).toContain(dashboardData.complianceStatus);
    });

    it("should track security metrics", async () => {
        auditLogger.log({
            action: "authentication",
            resource: "test",
            result: "denied",
            details: {},
            severity: "warning",
        });

        const dashboardData = await dashboard.generateDashboard();

        expect(dashboardData.metrics.totalAuditEntries).toBeGreaterThan(0);
        expect(dashboardData.metrics.failedAuthAttempts).toBeGreaterThan(0);
    });
});

describe("SecurityMonitoringService", () => {
    let service: SecurityMonitoringService;
    let mockContext: DiagnosticContext;

    beforeEach(() => {
        service = new SecurityMonitoringService();

        mockContext = {
            endpoint: "https://test.example.com",
            logger: () => { },
            request: async () => ({}),
            jsonrpc: async () => ({}),
            sseProbe: async () => ({ ok: true }),
            evidence: () => { },
        };
    });

    it("should monitor endpoints and log audit entries", async () => {
        await service.monitorEndpoint(mockContext);

        const auditLogger = service.getAuditLogger();
        const entries = auditLogger.getEntries();

        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0]?.action).toBe("endpoint-access");
    });

    it("should generate comprehensive security reports", async () => {
        await service.monitorEndpoint(mockContext);

        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const report = await service.generateSecurityReport({
            start: hourAgo,
            end: now,
        });

        expect(report).toBeDefined();
        expect(report.summary).toBeDefined();
        expect(report.dashboard).toBeDefined();
        expect(report.recommendations).toBeDefined();
        expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("should calculate overall risk correctly", async () => {
        await service.monitorEndpoint(mockContext);

        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const report = await service.generateSecurityReport({
            start: hourAgo,
            end: now,
        });

        expect(["low", "medium", "high", "critical"]).toContain(report.summary.overallRisk);
    });

    it("should provide security recommendations", async () => {
        const httpContext = { ...mockContext, endpoint: "http://insecure.example.com" };
        await service.monitorEndpoint(httpContext);

        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const report = await service.generateSecurityReport({
            start: hourAgo,
            end: now,
        });

        expect(report.recommendations.length).toBeGreaterThan(0);
    });
});
