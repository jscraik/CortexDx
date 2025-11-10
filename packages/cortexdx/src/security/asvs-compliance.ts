/**
 * OWASP ASVS Compliance Engine
 * Implements ASVS (Application Security Verification Standard) assessment
 * Requirements: 20.1
 */

import type { DiagnosticContext, Finding } from "../types.js";

export type ASVSLevel = "L1" | "L2" | "L3";

export interface ASVSRequirement {
    id: string; // e.g., "V2.1.1"
    category: string; // e.g., "Authentication"
    level: ASVSLevel;
    description: string;
    verificationMethod: "automated" | "manual" | "hybrid";
    tools: string[]; // Which tools can verify this requirement
}

export interface ASVSFinding {
    requirementId: string;
    passed: boolean;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    evidence: string[];
    recommendation: string;
    confidence: number;
}

export interface ASVSReport {
    level: ASVSLevel;
    totalRequirements: number;
    passedRequirements: number;
    failedRequirements: number;
    notApplicable: number;
    compliancePercentage: number;
    findings: ASVSFinding[];
    recommendations: string[];
    timestamp: Date;
}

export interface ASVSMapping {
    findingId: string;
    asvs: string[];
    category: string;
}

/**
 * ASVS Compliance Engine for MCP implementations
 */
export class ASVSComplianceEngine {
    private readonly requirements: Map<ASVSLevel, ASVSRequirement[]>;

    constructor() {
        this.requirements = this.initializeRequirements();
    }

    /**
     * Assess ASVS compliance for a target MCP implementation
     */
    async assessASVS(
        ctx: DiagnosticContext,
        level: ASVSLevel,
    ): Promise<ASVSReport> {
        const requirements = this.getRequirementsForLevel(level);
        const findings: ASVSFinding[] = [];
        let passed = 0;
        let failed = 0;
        let notApplicable = 0;

        for (const req of requirements) {
            const result = await this.validateRequirement(req, ctx);
            if (result) {
                findings.push(result);
                if (result.passed) {
                    passed++;
                } else {
                    failed++;
                }
            } else {
                notApplicable++;
            }
        }

        const total = requirements.length;
        const compliancePercentage =
            total > 0 ? Math.round((passed / (passed + failed)) * 100) : 100;

        return {
            level,
            totalRequirements: total,
            passedRequirements: passed,
            failedRequirements: failed,
            notApplicable,
            compliancePercentage,
            findings,
            recommendations: this.generateRecommendations(findings),
            timestamp: new Date(),
        };
    }

    /**
     * Validate a specific ASVS requirement
     */
    async validateRequirement(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        // Only validate automated requirements
        if (requirement.verificationMethod === "manual") {
            return null;
        }

        // Route to appropriate validator based on category
        switch (requirement.category) {
            case "Authentication":
                return this.validateAuthentication(requirement, ctx);
            case "Session Management":
                return this.validateSessionManagement(requirement, ctx);
            case "Access Control":
                return this.validateAccessControl(requirement, ctx);
            case "Validation":
                return this.validateInputValidation(requirement, ctx);
            case "Cryptography":
                return this.validateCryptography(requirement, ctx);
            case "Communication":
                return this.validateCommunication(requirement, ctx);
            case "API":
                return this.validateAPI(requirement, ctx);
            case "Configuration":
                return this.validateConfiguration(requirement, ctx);
            default:
                return null;
        }
    }

    /**
     * Get requirements for a specific ASVS level
     */
    getRequirementsForLevel(level: ASVSLevel): ASVSRequirement[] {
        const reqs = this.requirements.get(level) || [];
        return reqs;
    }

    /**
     * Map existing findings to ASVS requirements
     */
    mapFindingsToASVS(findings: Finding[]): ASVSMapping[] {
        const mappings: ASVSMapping[] = [];

        for (const finding of findings) {
            const asvs = this.findASVSMapping(finding);
            if (asvs.length > 0) {
                mappings.push({
                    findingId: finding.id,
                    asvs,
                    category: finding.area,
                });
            }
        }

        return mappings;
    }

    /**
     * Initialize ASVS requirements database
     */
    private initializeRequirements(): Map<ASVSLevel, ASVSRequirement[]> {
        const requirements = new Map<ASVSLevel, ASVSRequirement[]>();

        // L1 - Opportunistic (Community Edition)
        requirements.set("L1", [
            {
                id: "V2.1.1",
                category: "Authentication",
                level: "L1",
                description:
                    "Verify that user set passwords are at least 12 characters in length",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V2.1.7",
                category: "Authentication",
                level: "L1",
                description:
                    "Verify that passwords submitted during account registration, login, and password change are checked against a set of breached passwords",
                verificationMethod: "automated",
                tools: ["custom"],
            },
            {
                id: "V3.2.1",
                category: "Session Management",
                level: "L1",
                description:
                    "Verify the application generates a new session token on user authentication",
                verificationMethod: "automated",
                tools: ["zap"],
            },
            {
                id: "V4.1.1",
                category: "Access Control",
                level: "L1",
                description:
                    "Verify that the application enforces access control rules on a trusted service layer",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V5.1.1",
                category: "Validation",
                level: "L1",
                description:
                    "Verify that the application has defenses against HTTP parameter pollution attacks",
                verificationMethod: "automated",
                tools: ["zap"],
            },
            {
                id: "V7.1.1",
                category: "Cryptography",
                level: "L1",
                description:
                    "Verify that the application does not use weak or deprecated cryptographic algorithms",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V9.1.1",
                category: "Communication",
                level: "L1",
                description:
                    "Verify that TLS is used for all client connectivity, and does not fall back to insecure or unencrypted communications",
                verificationMethod: "automated",
                tools: ["custom"],
            },
            {
                id: "V13.1.1",
                category: "API",
                level: "L1",
                description:
                    "Verify that all application components, libraries, and frameworks are from trusted sources",
                verificationMethod: "automated",
                tools: ["dependency-track"],
            },
            {
                id: "V14.1.1",
                category: "Configuration",
                level: "L1",
                description:
                    "Verify that the application build and deployment processes are performed in a secure and repeatable way",
                verificationMethod: "hybrid",
                tools: ["custom"],
            },
        ]);

        // L2 - Standard (Professional Edition)
        const l1Base = requirements.get("L1") ?? [];
        const l2Requirements = [...l1Base];
        l2Requirements.push(
            {
                id: "V2.2.1",
                category: "Authentication",
                level: "L2",
                description:
                    "Verify that anti-automation controls are effective at mitigating breached credential testing, brute force, and account lockout attacks",
                verificationMethod: "automated",
                tools: ["zap"],
            },
            {
                id: "V2.7.1",
                category: "Authentication",
                level: "L2",
                description:
                    "Verify that clear text out of band (NIST 'restricted') authenticators are not offered by default",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V3.3.1",
                category: "Session Management",
                level: "L2",
                description:
                    "Verify that logout and expiration invalidate the session token",
                verificationMethod: "automated",
                tools: ["zap"],
            },
            {
                id: "V4.2.1",
                category: "Access Control",
                level: "L2",
                description:
                    "Verify that sensitive data and APIs are protected against Insecure Direct Object Reference (IDOR) attacks",
                verificationMethod: "automated",
                tools: ["zap"],
            },
            {
                id: "V5.2.1",
                category: "Validation",
                level: "L2",
                description:
                    "Verify that all untrusted HTML input from WYSIWYG editors or similar is properly sanitized",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V7.2.1",
                category: "Cryptography",
                level: "L2",
                description:
                    "Verify that all cryptographic modules fail securely, and errors are handled in a way that does not enable Padding Oracle attacks",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V9.2.1",
                category: "Communication",
                level: "L2",
                description:
                    "Verify that connections to and from the server use trusted TLS certificates",
                verificationMethod: "automated",
                tools: ["zap"],
            },
            {
                id: "V13.2.1",
                category: "API",
                level: "L2",
                description:
                    "Verify that enabled communication security controls such as up-to-date TLS, strong cipher suites and HTTP security headers are in place",
                verificationMethod: "automated",
                tools: ["zap"],
            },
        );
        requirements.set("L2", l2Requirements);

        // L3 - Advanced (Enterprise Edition)
        const l2Base = requirements.get("L2") ?? [];
        const l3Requirements = [...l2Base];
        l3Requirements.push(
            {
                id: "V2.8.1",
                category: "Authentication",
                level: "L3",
                description:
                    "Verify that risk based re-authentication, two factor or transaction signing is in place for high value transactions",
                verificationMethod: "manual",
                tools: [],
            },
            {
                id: "V3.4.1",
                category: "Session Management",
                level: "L3",
                description:
                    "Verify that cookie-based session tokens have the 'Secure' attribute set",
                verificationMethod: "automated",
                tools: ["zap"],
            },
            {
                id: "V4.3.1",
                category: "Access Control",
                level: "L3",
                description:
                    "Verify administrative interfaces use appropriate multi-factor authentication",
                verificationMethod: "manual",
                tools: [],
            },
            {
                id: "V5.3.1",
                category: "Validation",
                level: "L3",
                description:
                    "Verify that output encoding is relevant for the interpreter and context required",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V7.3.1",
                category: "Cryptography",
                level: "L3",
                description:
                    "Verify that all random numbers, random file names, random GUIDs, and random strings are generated using the cryptographic module's approved cryptographically secure random number generator",
                verificationMethod: "automated",
                tools: ["semgrep"],
            },
            {
                id: "V9.3.1",
                category: "Communication",
                level: "L3",
                description:
                    "Verify that TLS is used for all connections (including both external and backend connections) that are authenticated or that involve sensitive data or functions",
                verificationMethod: "automated",
                tools: ["custom"],
            },
            {
                id: "V13.3.1",
                category: "API",
                level: "L3",
                description:
                    "Verify API URLs do not expose sensitive information, such as the API key, session tokens etc.",
                verificationMethod: "automated",
                tools: ["gitleaks"],
            },
        );
        requirements.set("L3", l3Requirements);

        return requirements;
    }

    /**
     * Validate authentication requirements
     */
    private async validateAuthentication(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        const hasAuth = ctx.headers && Object.keys(ctx.headers).length > 0;

        if (requirement.id === "V2.1.1" || requirement.id === "V2.1.7") {
            // Password requirements - can't verify without access to auth system
            return null;
        }

        if (requirement.id === "V2.2.1") {
            // Anti-automation controls - requires dynamic testing
            return {
                requirementId: requirement.id,
                passed: hasAuth,
                severity: hasAuth ? "low" : "medium",
                title: `ASVS ${requirement.id}: Anti-automation Controls`,
                description: hasAuth
                    ? "Authentication detected, verify anti-automation controls are in place"
                    : "No authentication detected, anti-automation controls may be missing",
                evidence: [ctx.endpoint],
                recommendation:
                    "Implement rate limiting and account lockout mechanisms",
                confidence: 0.6,
            };
        }

        return null;
    }

    /**
     * Validate session management requirements
     */
    private async validateSessionManagement(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        // Session management requires dynamic testing
        return null;
    }

    /**
     * Validate access control requirements
     */
    private async validateAccessControl(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        try {
            const tools = await ctx.jsonrpc<unknown>("tools/list");
            const toolNames = this.extractToolNames(tools);
            const surface = JSON.stringify(toolNames).toLowerCase();

            if (requirement.id === "V4.1.1") {
                const hasPrivilegedOps = /admin|delete|remove|drop|truncate/.test(
                    surface,
                );
                return {
                    requirementId: requirement.id,
                    passed: !hasPrivilegedOps,
                    severity: hasPrivilegedOps ? "high" : "low",
                    title: `ASVS ${requirement.id}: Access Control Rules`,
                    description: hasPrivilegedOps
                        ? "Privileged operations detected, verify access control enforcement"
                        : "No obvious privileged operations detected",
                    evidence: [ctx.endpoint],
                    recommendation:
                        "Implement role-based access control for privileged operations",
                    confidence: 0.75,
                };
            }
        } catch {
            // Tool listing failed
        }

        return null;
    }

    /**
     * Validate input validation requirements
     */
    private async validateInputValidation(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        try {
            const tools = await ctx.jsonrpc<unknown>("tools/list");
            const toolNames = this.extractToolNames(tools);
            const surface = JSON.stringify(toolNames).toLowerCase();

            if (requirement.id === "V5.1.1") {
                const hasInputOps = /prompt|template|input|query/.test(surface);
                return {
                    requirementId: requirement.id,
                    passed: !hasInputOps,
                    severity: hasInputOps ? "medium" : "low",
                    title: `ASVS ${requirement.id}: Input Validation`,
                    description: hasInputOps
                        ? "Input operations detected, verify parameter pollution defenses"
                        : "No obvious input operations detected",
                    evidence: [ctx.endpoint],
                    recommendation:
                        "Implement strict input validation and sanitization for all user inputs",
                    confidence: 0.7,
                };
            }
        } catch {
            // Tool listing failed
        }

        return null;
    }

    /**
     * Validate cryptography requirements
     */
    private async validateCryptography(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        // Cryptography validation requires code analysis (Semgrep)
        return null;
    }

    /**
     * Validate communication requirements
     */
    private async validateCommunication(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        if (requirement.id === "V9.1.1" || requirement.id === "V9.3.1") {
            const usesTLS = ctx.endpoint.startsWith("https://");
            return {
                requirementId: requirement.id,
                passed: usesTLS,
                severity: usesTLS ? "low" : "critical",
                title: `ASVS ${requirement.id}: TLS Communication`,
                description: usesTLS
                    ? "TLS is used for communication"
                    : "Insecure HTTP communication detected",
                evidence: [ctx.endpoint],
                recommendation: "Use HTTPS/TLS for all communications",
                confidence: 1.0,
            };
        }

        return null;
    }

    /**
     * Validate API requirements
     */
    private async validateAPI(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        if (requirement.id === "V13.1.1") {
            // Dependency verification requires SBOM/Dependency Track
            return null;
        }

        if (requirement.id === "V13.2.1") {
            const usesTLS = ctx.endpoint.startsWith("https://");
            return {
                requirementId: requirement.id,
                passed: usesTLS,
                severity: usesTLS ? "low" : "high",
                title: `ASVS ${requirement.id}: API Security Controls`,
                description: usesTLS
                    ? "TLS enabled for API communication"
                    : "API communication not using TLS",
                evidence: [ctx.endpoint],
                recommendation: "Enable TLS and security headers for API endpoints",
                confidence: 0.9,
            };
        }

        return null;
    }

    /**
     * Validate configuration requirements
     */
    private async validateConfiguration(
        requirement: ASVSRequirement,
        ctx: DiagnosticContext,
    ): Promise<ASVSFinding | null> {
        // Configuration validation requires build/deployment analysis
        return null;
    }

    /**
     * Generate recommendations from findings
     */
    private generateRecommendations(findings: ASVSFinding[]): string[] {
        const recommendations = new Set<string>();

        for (const finding of findings) {
            if (!finding.passed) {
                recommendations.add(finding.recommendation);
            }
        }

        return Array.from(recommendations);
    }

    /**
     * Find ASVS mapping for a finding
     */
    private findASVSMapping(finding: Finding): string[] {
        const mappings: string[] = [];

        // Map based on finding tags and area
        if (finding.tags?.includes("authentication") || finding.area === "auth") {
            mappings.push("V2");
        }
        if (finding.tags?.includes("session")) {
            mappings.push("V3");
        }
        if (finding.tags?.includes("access-control")) {
            mappings.push("V4");
        }
        if (finding.tags?.includes("validation") || finding.tags?.includes("injection")) {
            mappings.push("V5");
        }
        if (finding.tags?.includes("cryptography") || finding.tags?.includes("encryption")) {
            mappings.push("V7");
        }
        if (finding.tags?.includes("communication") || finding.tags?.includes("tls")) {
            mappings.push("V9");
        }
        if (finding.area === "security" && finding.tags?.includes("api")) {
            mappings.push("V13");
        }
        if (finding.tags?.includes("configuration")) {
            mappings.push("V14");
        }

        return mappings;
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
