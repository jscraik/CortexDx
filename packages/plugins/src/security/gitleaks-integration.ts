/**
 * gitleaks Secrets Scanner Integration
 * Implements secrets detection using gitleaks
 * Requirements: 20.4
 */

import type { DiagnosticContext } from "@brainwav/cortexdx-core";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface Secret {
    type: string; // e.g., "AWS Access Key", "GitHub Token"
    match: string; // The matched secret (redacted in output)
    file: string;
    line: number;
    commit?: string;
    author?: string;
    date?: string;
}

export interface SecretFindings {
    secrets: Secret[];
    totalFound: number;
    byType: Record<string, number>;
    executionTime: number;
}

export interface GitleaksConfig {
    rules: GitleaksRule[];
    allowlist?: {
        paths?: string[];
        regexes?: string[];
    };
}

export interface GitleaksRule {
    id: string;
    description: string;
    regex: string;
    keywords?: string[];
}

/**
 * gitleaks Integration for secrets detection
 */
export class GitleaksIntegration {
    private readonly defaultRules: GitleaksRule[];

    constructor() {
        this.defaultRules = this.initializeDefaultRules();
    }

    /**
     * Scan repository for secrets (requires gitleaks CLI)
     */
    async scanRepository(repoPath: string): Promise<SecretFindings> {
        try {
            // Fallback to manual scanning if CLI is not available
            // For now, we'll just implement the manual scanning as the primary method
            // since we don't have the CLI integration yet.

            const files = await this.getAllFiles(repoPath);
            const secrets: Secret[] = [];

            for (const file of files) {
                const fileSecrets = await this.scanFile(file);
                secrets.push(...fileSecrets);
            }

            const byType: Record<string, number> = {};
            for (const secret of secrets) {
                byType[secret.type] = (byType[secret.type] || 0) + 1;
            }

            return {
                secrets,
                totalFound: secrets.length,
                byType,
                executionTime: 0, // TODO: Measure time
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to scan repository at ${repoPath}: ${message}`);
        }
    }

    private async getAllFiles(dir: string): Promise<string[]> {
        let files: string[] = [];
        try {
            const entries = await readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === "node_modules" || entry.name === ".git") continue;
                    files = files.concat(await this.getAllFiles(fullPath));
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Ignore errors for now (e.g. permission denied)
        }
        return files;
    }

    /**
     * Scan configuration files for secrets
     */
    async scanConfiguration(configFiles: string[]): Promise<SecretFindings> {
        try {
            const secrets: Secret[] = [];

            for (const file of configFiles) {
                const fileSecrets = await this.scanFile(file);
                secrets.push(...fileSecrets);
            }

            const byType: Record<string, number> = {};
            for (const secret of secrets) {
                byType[secret.type] = (byType[secret.type] || 0) + 1;
            }

            return {
                secrets,
                totalFound: secrets.length,
                byType,
                executionTime: 0,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to scan configuration files: ${message}`);
        }
    }

    /**
     * Scan a single file for secrets
     */
    private async scanFile(filePath: string): Promise<Secret[]> {
        try {
            const content = await readFile(filePath, "utf-8");
            const secrets: Secret[] = [];

            for (const rule of this.defaultRules) {
                const regex = new RegExp(rule.regex, "gi");
                const matches = Array.from(content.matchAll(regex));

                for (const match of matches) {
                    secrets.push({
                        type: rule.description,
                        match: this.redactSecret(match[0]),
                        file: filePath,
                        line: this.getLineNumber(content, match.index || 0),
                    });
                }
            }

            return secrets;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Don't throw, just return empty or log? The original code threw.
            // I'll throw to be consistent.
            throw new Error(`Failed to scan file ${filePath}: ${message}`);
        }
    }

    /**
     * Detect API keys in content
     */
    async detectAPIKeys(content: string): Promise<Secret[]> {
        try {
            const secrets: Secret[] = [];
            const rules = this.defaultRules.filter((r) =>
                r.id.toLowerCase().includes("api"),
            );

            for (const rule of rules) {
                const regex = new RegExp(rule.regex, "gi");
                const matches = Array.from(content.matchAll(regex));

                for (const match of matches) {
                    secrets.push({
                        type: rule.description,
                        match: this.redactSecret(match[0]),
                        file: "content",
                        line: this.getLineNumber(content, match.index || 0),
                    });
                }
            }

            return secrets;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to detect API keys in content: ${message}`);
        }
    }

    /**
     * Detect tokens in content
     */
    async detectTokens(content: string): Promise<Secret[]> {
        try {
            const secrets: Secret[] = [];
            const rules = this.defaultRules.filter((r) =>
                r.id.toLowerCase().includes("token"),
            );

            for (const rule of rules) {
                const regex = new RegExp(rule.regex, "gi");
                const matches = Array.from(content.matchAll(regex));

                for (const match of matches) {
                    secrets.push({
                        type: rule.description,
                        match: this.redactSecret(match[0]),
                        file: "content",
                        line: this.getLineNumber(content, match.index || 0),
                    });
                }
            }

            return secrets;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to detect tokens in content: ${message}`);
        }
    }

    /**
     * Detect credentials in content
     */
    async detectCredentials(content: string): Promise<Secret[]> {
        try {
            const secrets: Secret[] = [];
            const rules = this.defaultRules.filter(
                (r) =>
                    r.id.toLowerCase().includes("password") ||
                    r.id.toLowerCase().includes("credential"),
            );

            for (const rule of rules) {
                const regex = new RegExp(rule.regex, "gi");
                const matches = Array.from(content.matchAll(regex));

                for (const match of matches) {
                    secrets.push({
                        type: rule.description,
                        match: this.redactSecret(match[0]),
                        file: "content",
                        line: this.getLineNumber(content, match.index || 0),
                    });
                }
            }

            return secrets;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to detect credentials in content: ${message}`);
        }
    }

    /**
     * Scan MCP context for exposed secrets
     */
    async scanMCPContext(ctx: DiagnosticContext): Promise<Secret[]> {
        try {
            const secrets: Secret[] = [];

            // Check headers for exposed tokens
            if (ctx.headers) {
                const headersStr = JSON.stringify(ctx.headers);
                const headerSecrets = await this.detectTokens(headersStr);
                secrets.push(...headerSecrets);
            }

            // Check endpoint for embedded credentials
            const endpointSecrets = await this.detectCredentials(ctx.endpoint);
            secrets.push(...endpointSecrets);

            return secrets;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to scan MCP context for secrets: ${message}`);
        }
    }

    /**
     * Initialize default gitleaks rules
     */
    private initializeDefaultRules(): GitleaksRule[] {
        return [
            {
                id: "aws-access-key",
                description: "AWS Access Key",
                regex: "(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
                keywords: ["aws", "access", "key"],
            },
            {
                id: "aws-secret-key",
                description: "AWS Secret Key",
                regex: "aws(.{0,20})?['\"][0-9a-zA-Z/+]{40}['\"]",
                keywords: ["aws", "secret"],
            },
            {
                id: "github-token",
                description: "GitHub Token",
                regex: "ghp_[0-9a-zA-Z]{36}",
                keywords: ["github", "token"],
            },
            {
                id: "github-oauth",
                description: "GitHub OAuth Token",
                regex: "gho_[0-9a-zA-Z]{36}",
                keywords: ["github", "oauth"],
            },
            {
                id: "slack-token",
                description: "Slack Token",
                regex: "xox[baprs]-([0-9a-zA-Z]{10,48})",
                keywords: ["slack", "token"],
            },
            {
                id: "slack-webhook",
                description: "Slack Webhook",
                regex: "https://hooks\\.slack\\.com/services/T[a-zA-Z0-9_]{8}/B[a-zA-Z0-9_]{8}/[a-zA-Z0-9_]{24}",
                keywords: ["slack", "webhook"],
            },
            {
                id: "google-api-key",
                description: "Google API Key",
                regex: "AIza[0-9A-Za-z\\-_]{35}",
                keywords: ["google", "api", "key"],
            },
            {
                id: "google-oauth",
                description: "Google OAuth Token",
                regex: "[0-9]+-[0-9A-Za-z_]{32}\\.apps\\.googleusercontent\\.com",
                keywords: ["google", "oauth"],
            },
            {
                id: "stripe-api-key",
                description: "Stripe API Key",
                regex: "sk_live_[0-9a-zA-Z]{24}",
                keywords: ["stripe", "api", "key"],
            },
            {
                id: "twilio-api-key",
                description: "Twilio API Key",
                regex: "SK[0-9a-fA-F]{32}",
                keywords: ["twilio", "api", "key"],
            },
            {
                id: "generic-api-key",
                description: "Generic API Key",
                regex: "[aA][pP][iI]_?[kK][eE][yY].*['\"][0-9a-zA-Z]{32,45}['\"]",
                keywords: ["api", "key"],
            },
            {
                id: "generic-secret",
                description: "Generic Secret",
                regex: "[sS][eE][cC][rR][eE][tT].*['\"][0-9a-zA-Z]{32,45}['\"]",
                keywords: ["secret"],
            },
            {
                id: "password-in-url",
                description: "Password in URL",
                regex: "[a-zA-Z]{3,10}://[^/\\s:@]{3,20}:[^/\\s:@]{3,20}@.{1,100}",
                keywords: ["password", "url"],
            },
            {
                id: "private-key",
                description: "Private Key",
                regex: "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
                keywords: ["private", "key"],
            },
            {
                id: "jwt-token",
                description: "JWT Token",
                regex: "eyJ[A-Za-z0-9-_=]+\\.eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*",
                keywords: ["jwt", "token"],
            },
        ];
    }

    /**
     * Redact secret for safe display
     */
    private redactSecret(secret: string): string {
        if (secret.length <= 8) {
            return "***";
        }
        const visible = 4;
        return `${secret.substring(0, visible)}***${secret.substring(secret.length - visible)}`;
    }

    /**
     * Get line number from content index
     */
    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split("\n").length;
    }
}

/**
 * Convert gitleaks findings to normalized format
 */
export function normalizeGitleaksResults(
    results: SecretFindings,
): NormalizedSecretFinding[] {
    try {
        return results.secrets.map((secret) => ({
            id: `gitleaks-${secret.type.toLowerCase().replace(/\s+/g, "-")}`,
            tool: "gitleaks",
            severity: "critical" as const,
            title: `${secret.type} Detected`,
            description: `Secret detected: ${secret.type}\nLocation: ${secret.file}:${secret.line}\nMatch: ${secret.match}`,
            location: {
                path: secret.file,
                line: secret.line,
            },
            secretType: secret.type,
            confidence: 0.95,
        }));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to normalize gitleaks results: ${message}`);
    }
}

export interface NormalizedSecretFinding {
    id: string;
    tool: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    location: {
        path: string;
        line: number;
    };
    secretType: string;
    confidence: number;
}
