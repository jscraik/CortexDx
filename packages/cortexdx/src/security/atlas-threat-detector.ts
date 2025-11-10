/**
 * MITRE ATLAS Threat Detector
 * Implements AI/ML-specific threat detection based on MITRE ATLAS framework
 * Requirements: 20.2
 */

import type { DiagnosticContext } from "../types.js";

export interface ATLASTechnique {
    id: string; // e.g., "AML.T0051"
    name: string; // e.g., "LLM Prompt Injection"
    tactic: string; // e.g., "Initial Access"
    description: string;
    mitigations: string[];
    detectionMethods: string[];
}

export interface ATLASFinding {
    techniqueId: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    evidence: string[];
    mitigations: string[];
    confidence: number;
}

export interface ATLASReport {
    threatsDetected: number;
    highSeverityThreats: number;
    techniques: ATLASTechnique[];
    findings: ATLASFinding[];
    mitigations: string[];
    timestamp: Date;
}

export interface PromptInjectionResult {
    detected: boolean;
    confidence: number;
    patterns: string[];
    sanitized?: string;
}

export interface PoisoningDetection {
    detected: boolean;
    confidence: number;
    anomalies: string[];
}

export interface ExfiltrationDetection {
    detected: boolean;
    confidence: number;
    suspiciousPatterns: string[];
}

/**
 * MITRE ATLAS Threat Detector for AI/ML-specific threats
 */
export class ATLASThreatDetector {
    private readonly techniques: Map<string, ATLASTechnique>;

    constructor() {
        this.techniques = this.initializeTechniques();
    }

    /**
     * Detect AI/ML threats in MCP implementation
     */
    async detectThreats(ctx: DiagnosticContext): Promise<ATLASReport> {
        const findings: ATLASFinding[] = [];
        const detectedTechniques: ATLASTechnique[] = [];

        // Check for prompt injection vulnerabilities (AML.T0051)
        const promptInjectionFindings = await this.checkPromptInjection(ctx);
        findings.push(...promptInjectionFindings);
        if (promptInjectionFindings.length > 0) {
            const tech = this.techniques.get("AML.T0051");
            if (tech) detectedTechniques.push(tech);
        }

        // Check for data poisoning risks (AML.T0020)
        const poisoningFindings = await this.checkDataPoisoning(ctx);
        findings.push(...poisoningFindings);
        if (poisoningFindings.length > 0) {
            const tech = this.techniques.get("AML.T0020");
            if (tech) detectedTechniques.push(tech);
        }

        // Check for data exfiltration risks (AML.T0024)
        const exfiltrationFindings = await this.checkDataExfiltration(ctx);
        findings.push(...exfiltrationFindings);
        if (exfiltrationFindings.length > 0) {
            const tech = this.techniques.get("AML.T0024");
            if (tech) detectedTechniques.push(tech);
        }

        // Check for model access vulnerabilities (AML.T0000)
        const modelAccessFindings = await this.checkModelAccess(ctx);
        findings.push(...modelAccessFindings);
        if (modelAccessFindings.length > 0) {
            const tech = this.techniques.get("AML.T0000");
            if (tech) detectedTechniques.push(tech);
        }

        const highSeverityThreats = findings.filter(
            (f) => f.severity === "critical" || f.severity === "high",
        ).length;

        const allMitigations = new Set<string>();
        for (const finding of findings) {
            for (const mitigation of finding.mitigations) {
                allMitigations.add(mitigation);
            }
        }

        return {
            threatsDetected: findings.length,
            highSeverityThreats,
            techniques: detectedTechniques,
            findings,
            mitigations: Array.from(allMitigations),
            timestamp: new Date(),
        };
    }

    /**
     * Check for specific ATLAS technique
     */
    async checkTechnique(
        techniqueId: string,
        ctx: DiagnosticContext,
    ): Promise<ATLASFinding[]> {
        switch (techniqueId) {
            case "AML.T0051":
                return this.checkPromptInjection(ctx);
            case "AML.T0020":
                return this.checkDataPoisoning(ctx);
            case "AML.T0024":
                return this.checkDataExfiltration(ctx);
            case "AML.T0000":
                return this.checkModelAccess(ctx);
            default:
                return [];
        }
    }

    /**
     * Detect prompt injection vulnerabilities (AML.T0051)
     */
    async detectPromptInjection(input: string): Promise<PromptInjectionResult> {
        const patterns = this.getPromptInjectionPatterns();
        const detected: string[] = [];

        for (const pattern of patterns) {
            if (pattern.test(input)) {
                detected.push(pattern.source);
            }
        }

        return {
            detected: detected.length > 0,
            confidence: detected.length > 0 ? 0.85 : 0.0,
            patterns: detected,
            sanitized: detected.length > 0 ? this.sanitizePrompt(input) : undefined,
        };
    }

    /**
     * Sanitize prompt to remove injection attempts
     */
    sanitizePrompt(input: string): string {
        let sanitized = input;

        // Remove system prompt injection attempts
        sanitized = sanitized.replace(/system\s*:/gi, "");
        sanitized = sanitized.replace(/assistant\s*:/gi, "");
        sanitized = sanitized.replace(/\[INST\]/gi, "");
        sanitized = sanitized.replace(/\[\/INST\]/gi, "");

        // Remove instruction override attempts
        sanitized = sanitized.replace(/ignore\s+(previous|all)\s+instructions/gi, "");
        sanitized = sanitized.replace(/disregard\s+(previous|all)\s+instructions/gi, "");
        sanitized = sanitized.replace(/forget\s+(previous|all)\s+instructions/gi, "");

        // Remove role manipulation attempts
        sanitized = sanitized.replace(/you\s+are\s+now/gi, "");
        sanitized = sanitized.replace(/act\s+as/gi, "");
        sanitized = sanitized.replace(/pretend\s+to\s+be/gi, "");

        return sanitized.trim();
    }

    /**
     * Check for prompt injection vulnerabilities
     */
    private async checkPromptInjection(
        ctx: DiagnosticContext,
    ): Promise<ATLASFinding[]> {
        const findings: ATLASFinding[] = [];

        try {
            const tools = await ctx.jsonrpc<unknown>("tools/list");
            const toolNames = this.extractToolNames(tools);
            const surface = JSON.stringify(toolNames).toLowerCase();

            // Check if LLM/prompt operations are exposed
            if (/prompt|llm|complete|generate|chat/.test(surface)) {
                findings.push({
                    techniqueId: "AML.T0051",
                    severity: "high",
                    title: "Prompt Injection Vulnerability Risk",
                    description:
                        "LLM prompt operations detected without visible input sanitization. Attackers may inject malicious prompts to manipulate model behavior.",
                    evidence: [ctx.endpoint],
                    mitigations: [
                        "Implement input validation and sanitization for all prompts",
                        "Use prompt templates with parameterized inputs",
                        "Isolate user input from system instructions",
                        "Implement output filtering to detect injection attempts",
                        "Use separate models for different trust levels",
                    ],
                    confidence: 0.75,
                });
            }
        } catch {
            // Tool listing failed
        }

        return findings;
    }

    /**
     * Check for data poisoning risks (AML.T0020)
     */
    private async checkDataPoisoning(
        ctx: DiagnosticContext,
    ): Promise<ATLASFinding[]> {
        const findings: ATLASFinding[] = [];

        try {
            const tools = await ctx.jsonrpc<unknown>("tools/list");
            const toolNames = this.extractToolNames(tools);
            const surface = JSON.stringify(toolNames).toLowerCase();

            // Check if training/learning operations are exposed
            if (/train|learn|feedback|pattern|store/.test(surface)) {
                findings.push({
                    techniqueId: "AML.T0020",
                    severity: "medium",
                    title: "Data Poisoning Risk",
                    description:
                        "Learning or pattern storage operations detected. Attackers may poison training data to manipulate model behavior.",
                    evidence: [ctx.endpoint],
                    mitigations: [
                        "Implement anomaly detection for training data",
                        "Validate data integrity before storage",
                        "Use statistical analysis to detect outliers",
                        "Implement data provenance tracking",
                        "Require authentication for data submission",
                    ],
                    confidence: 0.7,
                });
            }
        } catch {
            // Tool listing failed
        }

        return findings;
    }

    /**
     * Check for data exfiltration risks (AML.T0024)
     */
    private async checkDataExfiltration(
        ctx: DiagnosticContext,
    ): Promise<ATLASFinding[]> {
        const findings: ATLASFinding[] = [];

        try {
            const tools = await ctx.jsonrpc<unknown>("tools/list");
            const toolNames = this.extractToolNames(tools);
            const surface = JSON.stringify(toolNames).toLowerCase();

            // Check if inference/query operations are exposed without rate limiting
            if (/infer|query|predict|complete/.test(surface)) {
                const hasAuth = ctx.headers && Object.keys(ctx.headers).length > 0;

                if (!hasAuth) {
                    findings.push({
                        techniqueId: "AML.T0024",
                        severity: "medium",
                        title: "Data Exfiltration via Inference API",
                        description:
                            "Inference operations exposed without authentication. Attackers may extract sensitive information through repeated queries.",
                        evidence: [ctx.endpoint],
                        mitigations: [
                            "Implement authentication for inference endpoints",
                            "Apply rate limiting to prevent abuse",
                            "Monitor for suspicious query patterns",
                            "Implement output filtering for sensitive data",
                            "Use differential privacy techniques",
                        ],
                        confidence: 0.65,
                    });
                }
            }
        } catch {
            // Tool listing failed
        }

        return findings;
    }

    /**
     * Check for model access vulnerabilities (AML.T0000)
     */
    private async checkModelAccess(
        ctx: DiagnosticContext,
    ): Promise<ATLASFinding[]> {
        const findings: ATLASFinding[] = [];

        try {
            const tools = await ctx.jsonrpc<unknown>("tools/list");
            const toolNames = this.extractToolNames(tools);
            const surface = JSON.stringify(toolNames).toLowerCase();

            // Check if model management operations are exposed
            if (/model|load|download|upload/.test(surface)) {
                const hasAuth = ctx.headers && Object.keys(ctx.headers).length > 0;

                if (!hasAuth) {
                    findings.push({
                        techniqueId: "AML.T0000",
                        severity: "high",
                        title: "Unauthorized Model Access Risk",
                        description:
                            "Model management operations exposed without authentication. Attackers may access or manipulate ML models.",
                        evidence: [ctx.endpoint],
                        mitigations: [
                            "Implement strong authentication for model operations",
                            "Use role-based access control (RBAC)",
                            "Validate model integrity with checksums",
                            "Encrypt models at rest and in transit",
                            "Audit all model access attempts",
                        ],
                        confidence: 0.8,
                    });
                }
            }
        } catch {
            // Tool listing failed
        }

        return findings;
    }

    /**
     * Initialize ATLAS techniques database
     */
    private initializeTechniques(): Map<string, ATLASTechnique> {
        const techniques = new Map<string, ATLASTechnique>();

        techniques.set("AML.T0051", {
            id: "AML.T0051",
            name: "LLM Prompt Injection",
            tactic: "Initial Access",
            description:
                "An adversary crafts prompts to manipulate an LLM's behavior, bypassing safety measures or extracting sensitive information.",
            mitigations: [
                "Input validation and sanitization",
                "Prompt templates with parameterization",
                "Context isolation between user and system prompts",
                "Output filtering and monitoring",
                "Multi-model architecture with trust boundaries",
            ],
            detectionMethods: [
                "Pattern matching for injection keywords",
                "Anomaly detection in prompt structure",
                "Output monitoring for unexpected behavior",
                "Rate limiting and abuse detection",
            ],
        });

        techniques.set("AML.T0020", {
            id: "AML.T0020",
            name: "Poison Training Data",
            tactic: "ML Model Access",
            description:
                "An adversary introduces malicious data into the training dataset to manipulate model behavior.",
            mitigations: [
                "Data validation and integrity checks",
                "Anomaly detection in training data",
                "Statistical analysis for outliers",
                "Data provenance tracking",
                "Secure data collection pipelines",
            ],
            detectionMethods: [
                "Statistical outlier detection",
                "Data distribution analysis",
                "Model performance monitoring",
                "Adversarial example detection",
            ],
        });

        techniques.set("AML.T0024", {
            id: "AML.T0024",
            name: "Exfiltration via ML Inference API",
            tactic: "Exfiltration",
            description:
                "An adversary extracts sensitive information by querying an ML model's inference API.",
            mitigations: [
                "Authentication and authorization",
                "Rate limiting and query throttling",
                "Output filtering for sensitive data",
                "Differential privacy techniques",
                "Query pattern monitoring",
            ],
            detectionMethods: [
                "Rate limiting violations",
                "Suspicious query patterns",
                "Repeated similar queries",
                "Unusual access times or volumes",
            ],
        });

        techniques.set("AML.T0000", {
            id: "AML.T0000",
            name: "ML Model Access",
            tactic: "ML Model Access",
            description:
                "An adversary gains unauthorized access to ML models to steal intellectual property or manipulate behavior.",
            mitigations: [
                "Strong authentication and RBAC",
                "Model encryption at rest and in transit",
                "Integrity verification with checksums",
                "Access logging and auditing",
                "Secure model storage",
            ],
            detectionMethods: [
                "Access log monitoring",
                "Integrity check failures",
                "Unauthorized access attempts",
                "Unusual model download patterns",
            ],
        });

        techniques.set("AML.T0040", {
            id: "AML.T0040",
            name: "ML Model Inference API Access",
            tactic: "ML Model Access",
            description:
                "An adversary gains access to ML inference APIs to extract model behavior or sensitive information.",
            mitigations: [
                "API authentication and authorization",
                "Rate limiting and throttling",
                "Input/output monitoring",
                "API key rotation",
                "Usage analytics and anomaly detection",
            ],
            detectionMethods: [
                "API abuse patterns",
                "Excessive query rates",
                "Unauthorized API key usage",
                "Suspicious inference patterns",
            ],
        });

        return techniques;
    }

    /**
     * Get prompt injection detection patterns
     */
    private getPromptInjectionPatterns(): RegExp[] {
        return [
            // System prompt injection
            /system\s*:/i,
            /assistant\s*:/i,
            /\[INST\]/i,
            /\[\/INST\]/i,

            // Instruction override
            /ignore\s+(previous|all)\s+instructions/i,
            /disregard\s+(previous|all)\s+instructions/i,
            /forget\s+(previous|all)\s+instructions/i,

            // Role manipulation
            /you\s+are\s+now/i,
            /act\s+as/i,
            /pretend\s+to\s+be/i,
            /roleplay\s+as/i,

            // Jailbreak attempts
            /DAN\s+mode/i,
            /developer\s+mode/i,
            /sudo\s+mode/i,

            // Prompt leaking
            /show\s+me\s+your\s+(system\s+)?prompt/i,
            /what\s+are\s+your\s+instructions/i,
            /reveal\s+your\s+prompt/i,
        ];
    }

    /**
     * Extract tool names from tools/list response
     */
    private extractToolNames(value: unknown): unknown[] {
        if (Array.isArray(value)) return value;
        if (typeof value === "object" && value !== null) {
            const maybe = (value as { tools?: unknown }).tools;
            if (Array.isArray(maybe)) return maybe;
        }
        return [];
    }
}
