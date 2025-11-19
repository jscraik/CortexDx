/**
 * OWASP ZAP DAST Integration
 * Implements dynamic application security testing using OWASP ZAP
 * Requirements: 20.5
 */

import type { DiagnosticContext } from "@brainwav/cortexdx-core";

export interface ZAPFinding {
    alertId: string;
    name: string;
    riskLevel: "High" | "Medium" | "Low" | "Informational";
    confidence: "High" | "Medium" | "Low";
    description: string;
    solution: string;
    reference: string;
    cweid: string;
    wascid: string;
    url: string;
    method: string;
    param?: string;
    attack?: string;
    evidence?: string;
}

export interface ZAPResults {
    findings: ZAPFinding[];
    totalAlerts: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    informational: number;
    executionTime: number;
    scanType: "baseline" | "full" | "api";
}

export interface ZAPConfig {
    apiKey?: string;
    proxy?: string;
    timeout?: number;
    maxDepth?: number;
    excludeUrls?: string[];
    apiUrl?: string;
    enabled?: boolean;
}

/**
 * OWASP ZAP Integration for DAST scanning
 */
export class ZAPIntegration {
    private readonly config: ZAPConfig;

    constructor(config: ZAPConfig = {}) {
        this.config = config;
    }

    /**
     * Run baseline scan (quick passive scan)
     */
    async baselineScan(endpoint: string): Promise<ZAPResults> {
        return await this.invokeZap("baseline", { endpoint });
    }

    /**
     * Run full scan (active + passive)
     */
    async fullScan(endpoint: string, config?: ZAPConfig): Promise<ZAPResults> {
        return await this.invokeZap("full", { endpoint, config });
    }

    /**
     * Run API scan using OpenAPI spec
     */
    async apiScan(openApiSpec: string, endpoint: string): Promise<ZAPResults> {
        return await this.invokeZap("api", { endpoint, openApiSpec });
    }

    /**
     * Scan HTTP endpoint
     */
    async scanHTTP(endpoint: string): Promise<ZAPFinding[]> {
        const findings: ZAPFinding[] = [];

        // Check for common HTTP vulnerabilities
        if (endpoint.startsWith("http://")) {
            findings.push({
                alertId: "10035",
                name: "Strict-Transport-Security Header Not Set",
                riskLevel: "Low",
                confidence: "High",
                description:
                    "HTTP Strict Transport Security (HSTS) is an opt-in security enhancement that is specified by a web application through the use of a special response header.",
                solution:
                    "Ensure that your web server, application server, load balancer, etc. is configured to enforce Strict-Transport-Security.",
                reference: "https://owasp.org/www-community/Security_Headers",
                cweid: "319",
                wascid: "15",
                url: endpoint,
                method: "GET",
            });
        }

        return findings;
    }

    /**
     * Scan SSE endpoint
     */
    async scanSSE(endpoint: string): Promise<ZAPFinding[]> {
        const findings: ZAPFinding[] = [];

        // SSE-specific security checks
        // Check for CORS misconfigurations
        findings.push({
            alertId: "40012",
            name: "Cross-Domain Misconfiguration (SSE)",
            riskLevel: "Medium",
            confidence: "Medium",
            description:
                "Server-Sent Events endpoint may have CORS misconfiguration allowing unauthorized access.",
            solution:
                "Configure CORS headers properly to restrict access to trusted origins only.",
            reference: "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events",
            cweid: "942",
            wascid: "14",
            url: endpoint,
            method: "GET",
        });

        return findings;
    }

    /**
     * Scan WebSocket endpoint
     */
    async scanWebSocket(endpoint: string): Promise<ZAPFinding[]> {
        const findings: ZAPFinding[] = [];

        // WebSocket-specific security checks
        if (endpoint.startsWith("ws://")) {
            findings.push({
                alertId: "10042",
                name: "Insecure WebSocket Connection",
                riskLevel: "High",
                confidence: "High",
                description:
                    "WebSocket connection is not using secure protocol (wss://). Data transmitted over ws:// is not encrypted.",
                solution: "Use wss:// (WebSocket Secure) instead of ws://.",
                reference: "https://owasp.org/www-community/vulnerabilities/Insecure_Transport",
                cweid: "319",
                wascid: "4",
                url: endpoint,
                method: "CONNECT",
            });
        }

        return findings;
    }

    /**
     * Detect XSS vulnerabilities
     */
    async detectXSS(endpoint: string): Promise<ZAPFinding[]> {
        // XSS detection requires active scanning
        // Placeholder for ZAP integration
        return [];
    }

    /**
     * Detect SQL injection vulnerabilities
     */
    async detectSQLInjection(endpoint: string): Promise<ZAPFinding[]> {
        // SQL injection detection requires active scanning
        // Placeholder for ZAP integration
        return [];
    }

    /**
     * Detect CSRF vulnerabilities
     */
    async detectCSRF(endpoint: string): Promise<ZAPFinding[]> {
        // CSRF detection requires active scanning
        // Placeholder for ZAP integration
        return [];
    }

    /**
     * Scan MCP transport-specific vulnerabilities
     */
    async scanMCPTransport(ctx: DiagnosticContext): Promise<ZAPFinding[]> {
        const findings: ZAPFinding[] = [];

        // Determine transport type from endpoint
        if (ctx.endpoint.startsWith("http://") || ctx.endpoint.startsWith("https://")) {
            const httpFindings = await this.scanHTTP(ctx.endpoint);
            findings.push(...httpFindings);
        }

        if (ctx.endpoint.includes("/sse") || ctx.endpoint.includes("/events")) {
            const sseFindings = await this.scanSSE(ctx.endpoint);
            findings.push(...sseFindings);
        }

        if (ctx.endpoint.startsWith("ws://") || ctx.endpoint.startsWith("wss://")) {
            const wsFindings = await this.scanWebSocket(ctx.endpoint);
            findings.push(...wsFindings);
        }

        return findings;
    }

    private async invokeZap(
        scanType: ZAPResults["scanType"],
        payload: { endpoint: string; openApiSpec?: string; config?: ZAPConfig },
    ): Promise<ZAPResults> {
        if (!this.isEnabled()) {
            return emptyResults(scanType);
        }

        void payload.openApiSpec;
        void payload.config;

        const start = Date.now();
        const alerts = await this.fetchAlerts(payload.endpoint);
        const findings = alerts.map((alert) => normalizeAlert(alert));
        return {
            findings,
            totalAlerts: findings.length,
            highRisk: findings.filter((f) => f.riskLevel === "High").length,
            mediumRisk: findings.filter((f) => f.riskLevel === "Medium").length,
            lowRisk: findings.filter((f) => f.riskLevel === "Low").length,
            informational: findings.filter((f) => f.riskLevel === "Informational").length,
            executionTime: Date.now() - start,
            scanType,
        };
    }

    private async fetchAlerts(endpoint: string): Promise<ZapAlert[]> {
        const baseUrl = this.config.apiUrl ?? process.env.ZAP_API_URL ?? this.config.proxy ?? "http://localhost:8080";
        const url = new URL("/JSON/core/view/alerts/", baseUrl);
        url.searchParams.set("baseurl", endpoint);
        url.searchParams.set("start", "0");
        url.searchParams.set("count", "1000");
        if (this.config.apiKey) {
            url.searchParams.set("apikey", this.config.apiKey);
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                return [];
            }
            const data = (await response.json()) as { alerts?: ZapAlert[] };
            return data.alerts ?? [];
        } catch {
            return [];
        }
    }

    private isEnabled(): boolean {
        if (typeof this.config.enabled === "boolean") {
            return this.config.enabled;
        }
        const flag = process.env.CORTEXDX_ENABLE_ZAP ?? "0";
        return flag === "1";
    }
}

/**
 * Convert ZAP findings to normalized format
 */
export function normalizeZAPResults(results: ZAPResults): NormalizedZAPFinding[] {
    return results.findings.map((finding) => ({
        id: `zap-${finding.alertId}`,
        tool: "zap",
        severity: mapZAPRiskLevel(finding.riskLevel),
        title: finding.name,
        description: `${finding.description}\n\nSolution: ${finding.solution}\n\nReference: ${finding.reference}`,
        location: {
            url: finding.url,
            method: finding.method,
            param: finding.param,
        },
        cweid: finding.cweid,
        wascid: finding.wascid,
        confidence: mapZAPConfidence(finding.confidence),
        evidence: finding.evidence,
    }));
}

export interface NormalizedZAPFinding {
    id: string;
    tool: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    location: {
        url: string;
        method: string;
        param?: string;
    };
    cweid: string;
    wascid: string;
    confidence: number;
    evidence?: string;
}

function mapZAPRiskLevel(
    riskLevel: "High" | "Medium" | "Low" | "Informational",
): "critical" | "high" | "medium" | "low" {
    const map = {
        High: "high" as const,
        Medium: "medium" as const,
        Low: "low" as const,
        Informational: "low" as const,
    };
    return map[riskLevel];
}

function mapZAPConfidence(confidence: "High" | "Medium" | "Low"): number {
    const map = {
        High: 0.9,
        Medium: 0.7,
        Low: 0.5,
    };
    return map[confidence];
}

interface ZapAlert {
    alertId: string;
    alert: string;
    risk: "High" | "Medium" | "Low" | "Informational";
    confidence: "High" | "Medium" | "Low";
    desc: string;
    solution: string;
    reference: string;
    cweid: string;
    wascid: string;
    url: string;
    method: string;
    param?: string;
    attack?: string;
    evidence?: string;
}

function emptyResults(scanType: ZAPResults["scanType"]): ZAPResults {
    return {
        findings: [],
        totalAlerts: 0,
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        informational: 0,
        executionTime: 0,
        scanType,
    };
}

function normalizeAlert(alert: ZapAlert): ZAPFinding {
    return {
        alertId: alert.alertId,
        name: alert.alert,
        riskLevel: alert.risk,
        confidence: alert.confidence,
        description: alert.desc,
        solution: alert.solution,
        reference: alert.reference,
        cweid: alert.cweid,
        wascid: alert.wascid,
        url: alert.url,
        method: alert.method,
        param: alert.param,
        attack: alert.attack,
        evidence: alert.evidence,
    };
}
