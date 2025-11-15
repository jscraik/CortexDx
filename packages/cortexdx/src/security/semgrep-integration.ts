/**
 * Semgrep SAST Integration
 * Implements static application security testing using Semgrep
 * Requirements: 20.3
 */

import { safeParseJson } from "../utils/json.js";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import type { DiagnosticContext } from "../types.js";

export interface SemgrepRule {
    id: string;
    pattern: string;
    message: string;
    severity: "ERROR" | "WARNING" | "INFO";
    languages: string[];
    metadata?: Record<string, unknown>;
}

export interface SemgrepFinding {
    ruleId: string;
    path: string;
    line: number;
    column: number;
    message: string;
    severity: "ERROR" | "WARNING" | "INFO";
    code: string;
    fix?: string;
}

export interface SemgrepResults {
    findings: SemgrepFinding[];
    errors: string[];
    executionTime: number;
    rulesRun: number;
}

/**
 * Semgrep Integration for SAST scanning
 */
export class SemgrepIntegration {
    private readonly mcpRules: SemgrepRule[];

    constructor() {
        this.mcpRules = this.initializeMCPRules();
    }

    /**
     * Load MCP-specific Semgrep rules
     */
    loadMCPRules(): SemgrepRule[] {
        return this.mcpRules;
    }

    /**
     * Create custom Semgrep rule
     */
    createCustomRule(
        pattern: string,
        message: string,
        severity: "ERROR" | "WARNING" | "INFO" = "WARNING",
    ): SemgrepRule {
        return {
            id: `custom-${Date.now()}`,
            pattern,
            message,
            severity,
            languages: ["typescript", "javascript"],
        };
    }

    /**
     * Scan code with Semgrep (requires Semgrep CLI to be installed)
     */
    async scanCode(
        path: string,
        rules: SemgrepRule[],
    ): Promise<SemgrepResults> {
        if (rules.length === 0) {
            return { findings: [], errors: [], executionTime: 0, rulesRun: 0 };
        }

        const semgrepBin = process.env.SEMGREP_BIN || "semgrep";
        const start = Date.now();
        const tempDir = await mkdtemp(join(tmpdir(), "semgrep-"));
        const configPath = join(tempDir, "mcp-rules.yaml");
        const configYAML = this.buildSemgrepConfig(rules);
        await writeFile(configPath, configYAML, "utf8");
        const baseDir = process.env.INIT_CWD ?? process.cwd();
        const targetPath = path.startsWith("/") ? path : resolvePath(baseDir, path);

        try {
            const { stdout } = await this.execSemgrep(semgrepBin, [
                "--config",
                configPath,
                "--json",
                "--quiet",
                targetPath,
            ]);
            const parsed = this.parseSemgrepJson(stdout);
            return {
                findings: parsed.findings,
                errors: parsed.errors,
                executionTime: Date.now() - start,
                rulesRun: rules.length,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            return {
                findings: [],
                errors: [message],
                executionTime: Date.now() - start,
                rulesRun: rules.length,
            };
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Scan dependencies for vulnerabilities
     */
    async scanDependencies(manifest: string): Promise<SemgrepFinding[]> {
        // Dependency scanning with Semgrep Supply Chain
        // Requires Semgrep Pro/Team subscription
        return [];
    }

    /**
     * Detect insecure transport usage
     */
    async detectInsecureTransport(
        ctx: DiagnosticContext,
    ): Promise<SemgrepFinding[]> {
        const findings: SemgrepFinding[] = [];

        // Check endpoint for HTTP usage
        if (ctx.endpoint.startsWith("http://")) {
            findings.push({
                ruleId: "mcp-insecure-transport",
                path: "endpoint",
                line: 1,
                column: 1,
                message: "MCP server using insecure HTTP transport. Use HTTPS.",
                severity: "ERROR",
                code: ctx.endpoint,
                fix: ctx.endpoint.replace("http://", "https://"),
            });
        }

        return findings;
    }

    /**
     * Detect weak authentication patterns
     */
    async detectWeakAuthentication(
        ctx: DiagnosticContext,
    ): Promise<SemgrepFinding[]> {
        const findings: SemgrepFinding[] = [];

        // Check for missing authentication
        if (!ctx.headers || Object.keys(ctx.headers).length === 0) {
            findings.push({
                ruleId: "mcp-no-auth",
                path: "headers",
                line: 1,
                column: 1,
                message: "No authentication headers detected. Implement OAuth 2.0 or API key authentication.",
                severity: "WARNING",
                code: "headers: {}",
            });
        }

        return findings;
    }

    /**
     * Detect prompt injection vulnerabilities
     */
    async detectPromptInjectionVulnerabilities(
        ctx: DiagnosticContext,
    ): Promise<SemgrepFinding[]> {
        const findings: SemgrepFinding[] = [];

        try {
            const tools = await ctx.jsonrpc<unknown>("tools/list");
            const toolNames = this.extractToolNames(tools);
            const surface = JSON.stringify(toolNames).toLowerCase();

            // Check for unsanitized LLM input operations
            if (/prompt|llm|complete/.test(surface)) {
                findings.push({
                    ruleId: "mcp-prompt-injection-risk",
                    path: "tools",
                    line: 1,
                    column: 1,
                    message:
                        "Unsanitized user input may be passed to LLM. Risk of prompt injection.",
                    severity: "WARNING",
                    code: "llm.complete(userInput)",
                    fix: "llm.complete(sanitizeInput(userInput))",
                });
            }
        } catch {
            // Tool listing failed
        }

        return findings;
    }

    /**
     * Initialize MCP-specific Semgrep rules
     */
    private initializeMCPRules(): SemgrepRule[] {
        return [
            {
                id: "mcp-insecure-transport",
                pattern: "http://$URL",
                message: "MCP server using insecure HTTP transport. Use HTTPS.",
                severity: "ERROR",
                languages: ["typescript", "javascript", "python"],
                metadata: {
                    category: "security",
                    cwe: "CWE-319",
                    owasp: "A02:2021-Cryptographic Failures",
                },
            },
            {
                id: "mcp-hardcoded-token",
                pattern: 'headers: { Authorization: "$TOKEN" }',
                message: "Hardcoded authorization token detected.",
                severity: "ERROR",
                languages: ["typescript", "javascript"],
                metadata: {
                    category: "security",
                    cwe: "CWE-798",
                    owasp: "A07:2021-Identification and Authentication Failures",
                },
            },
            {
                id: "mcp-prompt-injection-risk",
                pattern: "llm.complete($USER_INPUT)",
                message:
                    "Unsanitized user input passed to LLM. Risk of prompt injection.",
                severity: "WARNING",
                languages: ["typescript", "javascript", "python"],
                metadata: {
                    category: "security",
                    atlas: "AML.T0051",
                    mitigation: "Sanitize and validate all user inputs before LLM processing",
                },
            },
            {
                id: "mcp-sql-injection",
                pattern: 'db.query("SELECT * FROM users WHERE id = " + $USER_INPUT)',
                message: "SQL injection vulnerability. Use parameterized queries.",
                severity: "ERROR",
                languages: ["typescript", "javascript", "python"],
                metadata: {
                    category: "security",
                    cwe: "CWE-89",
                    owasp: "A03:2021-Injection",
                },
            },
            {
                id: "mcp-weak-crypto",
                pattern: "crypto.createHash('md5')",
                message: "Weak cryptographic algorithm MD5 detected. Use SHA-256 or better.",
                severity: "WARNING",
                languages: ["typescript", "javascript"],
                metadata: {
                    category: "security",
                    cwe: "CWE-327",
                    owasp: "A02:2021-Cryptographic Failures",
                },
            },
            {
                id: "mcp-eval-usage",
                pattern: "eval($CODE)",
                message: "Use of eval() detected. This is a security risk.",
                severity: "ERROR",
                languages: ["typescript", "javascript"],
                metadata: {
                    category: "security",
                    cwe: "CWE-95",
                    owasp: "A03:2021-Injection",
                },
            },
            {
                id: "mcp-unsafe-deserialization",
                pattern: "JSON.parse($UNTRUSTED_INPUT)",
                message: "Direct JSON.parse on untrusted input. Use safeParseJson() + schema validation.",
                severity: "WARNING",
                languages: ["typescript", "javascript"],
                metadata: {
                    category: "security",
                    cwe: "CWE-502",
                    owasp: "A08:2021-Software and Data Integrity Failures",
                },
            },
            {
                id: "mcp-missing-input-validation",
                pattern: "function handleInput($INPUT) { return process($INPUT); }",
                message: "Missing input validation. Validate all user inputs.",
                severity: "WARNING",
                languages: ["typescript", "javascript"],
                metadata: {
                    category: "security",
                    cwe: "CWE-20",
                    owasp: "A03:2021-Injection",
                },
            },
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

    private buildSemgrepConfig(rules: SemgrepRule[]): string {
        const ruleBlocks = rules
            .map((rule) => {
                const languages = rule.languages
                    .map((lang) => `'${lang}'`)
                    .join(", ");
                const message = rule.message.replace(/"/g, '\\"');
                const patternBody = rule.pattern
                    .split("\n")
                    .map((line) => (line.length > 0 ? `      ${line}` : ""))
                    .join("\n");
                return `
  - id: ${rule.id}
    pattern: |
${patternBody}
    message: "${message}"
    languages: [${languages}]
    severity: ${rule.severity}`;
            })
            .join("\n");
        return `rules:${ruleBlocks}`;
    }

    private execSemgrep(binary: string, args: string[]): Promise<{ stdout: string }> {
        return new Promise((resolve, reject) => {
            execFile(
                binary,
                args,
                { maxBuffer: 10 * 1024 * 1024 },
                (error, stdout, stderr) => {
                    if (error) {
                        const message = stderr?.trim() || stdout?.trim() || error.message;
                        reject(new Error(message));
                        return;
                    }
                    resolve({ stdout });
                },
            );
        });
    }

    private parseSemgrepJson(
        payload: string,
    ): { findings: SemgrepFinding[]; errors: string[] } {
        try {
            const data = safeParseJson(payload) as {
                results?: Array<{
                    check_id: string;
                    path?: { filename?: string };
                    start?: { line?: number; col?: number };
                    extra?: { message?: string; severity?: string; lines?: string; fix?: string };
                }>;
                errors?: Array<{ message?: string }>;
            };
            const findings =
                data.results?.map((result) => {
                    const filename =
                        typeof (result.path as unknown) === "string"
                            ? (result.path as string)
                            : result.path?.filename ?? "unknown";
                    return {
                        ruleId: result.check_id,
                        path: filename,
                        line: result.start?.line ?? 1,
                        column: result.start?.col ?? 1,
                        message: result.extra?.message ?? "Semgrep finding",
                        severity: (result.extra?.severity?.toUpperCase() as SemgrepFinding["severity"]) || "WARNING",
                        code: result.extra?.lines ?? "",
                        fix: result.extra?.fix,
                    };
                }) ?? [];
            const errors =
                data.errors?.map((error) => error.message ?? "Semgrep error") ?? [];
            return { findings, errors };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Failed to parse Semgrep output";
            return { findings: [], errors: [message] };
        }
    }
}

/**
 * Convert Semgrep findings to normalized format
 */
export function normalizeSemgrepResults(
    results: SemgrepResults,
): NormalizedFinding[] {
    return results.findings.map((finding) => ({
        id: `semgrep-${finding.ruleId}`,
        tool: "semgrep",
        severity: mapSemgrepSeverity(finding.severity),
        title: finding.message,
        description: `${finding.message}\n\nLocation: ${finding.path}:${finding.line}:${finding.column}\nCode: ${finding.code}`,
        location: {
            path: finding.path,
            line: finding.line,
            column: finding.column,
        },
        fix: finding.fix,
        confidence: 0.9,
    }));
}

export interface NormalizedFinding {
    id: string;
    tool: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description: string;
    location: {
        path: string;
        line: number;
        column: number;
    };
    fix?: string;
    confidence: number;
}

function mapSemgrepSeverity(
    severity: "ERROR" | "WARNING" | "INFO",
): "critical" | "high" | "medium" | "low" {
    const map = {
        ERROR: "high" as const,
        WARNING: "medium" as const,
        INFO: "low" as const,
    };
    return map[severity];
}
