/**
 * Enhanced Security Scanner Plugin
 * Extends threat-model.ts with comprehensive OWASP-based scanning
 * Integrates OWASP ASVS, MITRE ATLAS, Semgrep, gitleaks, and OWASP ZAP
 * Requirements: 6.1, 6.3, 6.4, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6
 */

import {
  ASVSComplianceEngine,
  type ASVSLevel,
} from "../security/asvs-compliance.js";
import { ATLASThreatDetector } from "../security/atlas-threat-detector.js";
import { GitleaksIntegration } from "../security/gitleaks-integration.js";
import { SecurityValidator } from "../security/security-validator.js";
import { SemgrepIntegration } from "../security/semgrep-integration.js";
import { ZAPIntegration } from "../security/zap-integration.js";
import {
  annotateControlEvidence,
  buildCoverageGapDescription,
  getMissingControls,
  summarizeCoverage,
} from "../security/control-mappings.js";
import type {
  DiagnosticContext,
  DiagnosticPlugin,
  Finding,
} from "@brainwav/cortexdx-core";

/**
 * System prompt for LLM-assisted security analysis
 * Used when enhanced analysis is enabled for vulnerability assessment
 *
 * @remarks
 * This constant is reserved for future LLM integration in the security-scanner plugin.
 * It will be used as the system prompt for vulnerability assessment workflows.
 * TODO: Integrate with LLM adapter in a future release.
 */
export const SECURITY_SCANNER_PROMPT = `You are CortexDx's security analysis engine.

## Classification Rules
- CRITICAL: RCE, auth bypass, data exfiltration, privilege escalation
- HIGH: SQLi, XSS, SSRF, insecure deserialization, broken access control
- MEDIUM: CSRF, information disclosure, weak crypto, missing security headers
- LOW: Verbose errors, deprecated functions, minor misconfigurations

## Output Schema
\`\`\`json
{
  "findings": [{
    "id": "VULN-001",
    "severity": "critical|high|medium|low",
    "owasp": "A01:2021-Broken Access Control",
    "cwe": "CWE-79",
    "location": {"file": "", "line": 0, "function": ""},
    "description": "Clear description of the vulnerability",
    "impact": "What could happen if exploited",
    "remediation": "Specific fix instructions",
    "codefix": "Code snippet showing the fix",
    "references": ["URLs to relevant documentation"]
  }],
  "summary": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "totalRisk": "critical|high|medium|low"
  },
  "priorityOrder": ["finding IDs in recommended fix order"],
  "attackVectors": ["Potential attack scenarios"],
  "complianceImpact": {
    "asvs": ["Affected ASVS requirements"],
    "owasp": ["Affected OWASP categories"],
    "cwe": ["Related CWE entries"]
  }
}
\`\`\`

## Tool Chain
After security analysis, recommend these CortexDx tools:
- threat-model: For architectural security issues
- compliance-check: For regulatory compliance concerns
- asvs-compliance: For OWASP ASVS verification
- semgrep-integration: For additional SAST coverage

## Behavioral Rules
- Always map findings to OWASP Top 10 and CWE
- Provide actionable remediation with code examples
- Prioritize fixes by exploitability and impact
- Include detection signatures where applicable
- Never recommend disabling security features as a fix`;

export const SecurityScannerPlugin: DiagnosticPlugin = {
  id: "security-scanner",
  title: "Enhanced Security Scanner (OWASP ASVS + MITRE ATLAS)",
  order: 420,

  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const startTime = Date.now();

    // Run existing OWASP security validation
    const validator = new SecurityValidator();
    const findings = await validator.validate(ctx);

    // Add ASVS compliance assessment
    const asvsFindings = await runASVSAssessment(ctx);
    findings.push(...asvsFindings);

    // Add MITRE ATLAS threat detection
    const atlasFindings = await runATLASDetection(ctx);
    findings.push(...atlasFindings);

    // Add Semgrep SAST findings
    const semgrepFindings = await runSemgrepScan(ctx);
    findings.push(...semgrepFindings);

    // Add gitleaks secrets detection
    const gitleaksFindings = await runGitleaksScan(ctx);
    findings.push(...gitleaksFindings);

    // Add OWASP ZAP DAST findings
    const zapFindings = await runZAPScan(ctx);
    findings.push(...zapFindings);

    // Deduplicate and prioritize findings
    const deduplicatedFindings = deduplicateFindings(findings);
    const prioritizedFindings = prioritizeFindings(deduplicatedFindings);

    // Add combined security score
    const securityScore = calculateCombinedSecurityScore(prioritizedFindings);
    prioritizedFindings.unshift({
      id: "combined-security-score",
      area: "security",
      severity: securityScore >= 70 ? "info" : "major",
      title: `Combined Security Score: ${securityScore}/100`,
      description:
        "Comprehensive security assessment completed. Score based on ASVS compliance, ATLAS threat detection, SAST, secrets scanning, and DAST results.",
      evidence: [{ type: "url", ref: ctx.endpoint }],
      tags: ["security-score", "combined-assessment"],
      confidence: 0.95,
    });

    // Add best practices
    const enhancedFindings = await addBestPractices(ctx, prioritizedFindings);
    const coverageTracker = new Set<string>();
    for (const finding of enhancedFindings) {
      const matched = annotateControlEvidence(finding);
      for (const controlId of matched) {
        coverageTracker.add(controlId);
      }
    }

    const coverageSummary = summarizeCoverage(coverageTracker);
    enhancedFindings.push({
      id: "security-control-summary",
      area: "security",
      severity: "info",
      title: "Security control coverage summary",
      description: coverageSummary.description,
      evidence: coverageSummary.evidence.map((ref) => ({
        type: "log",
        ref,
      })),
      tags: ["controls", "coverage"],
      confidence: 0.5,
    });

    if (process.env.CORTEXDX_ENFORCE_SECURITY === "1") {
      const missingControls = getMissingControls(coverageTracker, "high");
      if (missingControls.length > 0) {
        enhancedFindings.push({
          id: "security-control-coverage",
          area: "security",
          severity: "blocker",
          title: "High-severity security controls missing evidence",
          description: `Enable the relevant probes or provide manual evidence for:\n${buildCoverageGapDescription(missingControls)}`,
          evidence: missingControls.map((control) => ({
            type: "log",
            ref: `${control.framework} ${control.id}: ${control.title}`,
          })),
          tags: ["security", "controls", "coverage"],
          confidence: 0.5,
        });
      }
    }

    const executionTime = Date.now() - startTime;
    ctx.logger(`Security scan completed in ${executionTime}ms`);

    // Ensure execution time is under 120s requirement
    if (executionTime > 120000) {
      ctx.logger(
        `Warning: Security scan exceeded 120s requirement (${executionTime}ms)`,
      );
    }

    return enhancedFindings;
  },
};

/**
 * Run ASVS compliance assessment based on licensing tier
 */
async function runASVSAssessment(ctx: DiagnosticContext): Promise<Finding[]> {
  const asvsEngine = new ASVSComplianceEngine();

  // Determine ASVS level based on licensing tier (default to L1 for Community)
  const level: ASVSLevel = determineASVSLevel();

  try {
    const report = await asvsEngine.assessASVS(ctx, level);
    const findings: Finding[] = [];

    // Add compliance summary finding
    findings.push({
      id: "asvs-compliance-summary",
      area: "security",
      severity: report.compliancePercentage >= 80 ? "info" : "major",
      title: `ASVS ${level} Compliance: ${report.compliancePercentage}%`,
      description: `ASVS Level ${level} assessment completed. Passed: ${report.passedRequirements}/${report.totalRequirements} requirements. ${report.failedRequirements} failures detected.`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      tags: ["asvs", "compliance", `level-${level.toLowerCase()}`],
      confidence: 0.95,
    });

    // Convert ASVS findings to diagnostic findings
    for (const asvsFinding of report.findings) {
      if (!asvsFinding.passed) {
        findings.push({
          id: `asvs-${asvsFinding.requirementId.toLowerCase().replace(/\./g, "-")}`,
          area: "security",
          severity: mapASVSSeverity(asvsFinding.severity),
          title: asvsFinding.title,
          description: `${asvsFinding.description}\n\nRecommendation: ${asvsFinding.recommendation}`,
          evidence: asvsFinding.evidence.map((ref) => ({ type: "url", ref })),
          tags: ["asvs", asvsFinding.requirementId],
          confidence: asvsFinding.confidence,
        });
      }
    }

    // Add recommendations as info findings
    if (report.recommendations.length > 0) {
      findings.push({
        id: "asvs-recommendations",
        area: "security",
        severity: "info",
        title: "ASVS Compliance Recommendations",
        description: `Key recommendations:\n${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["asvs", "recommendations"],
        confidence: 0.9,
      });
    }

    return findings;
  } catch (error) {
    ctx.logger("ASVS assessment failed:", error);
    return [];
  }
}

/**
 * Run MITRE ATLAS threat detection for AI/ML-specific threats
 */
async function runATLASDetection(ctx: DiagnosticContext): Promise<Finding[]> {
  const atlasDetector = new ATLASThreatDetector();

  try {
    const report = await atlasDetector.detectThreats(ctx);
    const findings: Finding[] = [];

    // Add threat summary finding
    findings.push({
      id: "atlas-threat-summary",
      area: "security",
      severity: report.highSeverityThreats > 0 ? "major" : "info",
      title: `MITRE ATLAS: ${report.threatsDetected} AI/ML Threats Detected`,
      description: `MITRE ATLAS threat assessment completed. ${report.highSeverityThreats} high-severity threats detected. Techniques: ${report.techniques.map((t) => t.id).join(", ")}`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      tags: ["atlas", "ai-ml-security"],
      confidence: 0.9,
    });

    // Convert ATLAS findings to diagnostic findings
    for (const atlasFinding of report.findings) {
      findings.push({
        id: `atlas-${atlasFinding.techniqueId.toLowerCase().replace(/\./g, "-")}`,
        area: "security",
        severity: mapATLASSeverity(atlasFinding.severity),
        title: atlasFinding.title,
        description: `${atlasFinding.description}\n\nMitigations:\n${atlasFinding.mitigations.map((m, i) => `${i + 1}. ${m}`).join("\n")}`,
        evidence: atlasFinding.evidence.map((ref) => ({ type: "url", ref })),
        tags: ["atlas", atlasFinding.techniqueId],
        confidence: atlasFinding.confidence,
      });
    }

    // Add mitigations as info findings
    if (report.mitigations.length > 0) {
      findings.push({
        id: "atlas-mitigations",
        area: "security",
        severity: "info",
        title: "MITRE ATLAS Recommended Mitigations",
        description: `Key mitigations for AI/ML threats:\n${report.mitigations.map((m, i) => `${i + 1}. ${m}`).join("\n")}`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["atlas", "mitigations"],
        confidence: 0.85,
      });
    }

    return findings;
  } catch (error) {
    ctx.logger("ATLAS threat detection failed:", error);
    return [];
  }
}

/**
 * Determine ASVS level based on licensing tier
 * L1 = Community, L2 = Professional, L3 = Enterprise
 */
function determineASVSLevel(): ASVSLevel {
  // TODO: Integrate with licensing system when available
  // For now, default to L1 (Community)
  return "L1";
}

/**
 * Map ATLAS severity to diagnostic severity
 */
function mapATLASSeverity(
  severity: "critical" | "high" | "medium" | "low",
): "blocker" | "major" | "minor" | "info" {
  const map = {
    critical: "blocker" as const,
    high: "major" as const,
    medium: "minor" as const,
    low: "info" as const,
  };
  return map[severity];
}

/**
 * Map ASVS severity to diagnostic severity
 */
function mapASVSSeverity(
  severity: "critical" | "high" | "medium" | "low",
): "blocker" | "major" | "minor" | "info" {
  const map = {
    critical: "blocker" as const,
    high: "major" as const,
    medium: "minor" as const,
    low: "info" as const,
  };
  return map[severity];
}

async function addBestPractices(
  ctx: DiagnosticContext,
  findings: Finding[],
): Promise<Finding[]> {
  const bestPractices: Finding[] = [];

  try {
    const tools = await ctx.jsonrpc<unknown>("tools/list");
    const toolNames = extractToolNames(tools);

    if (toolNames.length > 0) {
      bestPractices.push({
        id: "bp-tool-validation",
        area: "security",
        severity: "info",
        title: "Best Practice: Tool Input Validation",
        description:
          "Ensure all tool inputs are validated and sanitized before processing",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["best-practice", "owasp"],
        confidence: 0.9,
      });
    }

    if (ctx.headers?.authorization) {
      bestPractices.push({
        id: "bp-auth-present",
        area: "security",
        severity: "info",
        title: "Best Practice: Authentication Implemented",
        description:
          "Authentication headers detected - ensure proper validation",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["best-practice", "authentication"],
        confidence: 0.85,
      });
    }
  } catch {
    // Tool listing failed, skip best practices
  }

  return [...findings, ...bestPractices];
}

/**
 * Run Semgrep SAST scan
 */
async function runSemgrepScan(ctx: DiagnosticContext): Promise<Finding[]> {
  const semgrep = new SemgrepIntegration();
  const findings: Finding[] = [];

  try {
    // Run MCP-specific checks
    const transportFindings = await semgrep.detectInsecureTransport(ctx);
    const authFindings = await semgrep.detectWeakAuthentication(ctx);
    const injectionFindings =
      await semgrep.detectPromptInjectionVulnerabilities(ctx);

    const allSemgrepFindings = [
      ...transportFindings,
      ...authFindings,
      ...injectionFindings,
    ];

    for (const finding of allSemgrepFindings) {
      findings.push({
        id: finding.ruleId,
        area: "security",
        severity: finding.severity === "ERROR" ? "major" : "minor",
        title: finding.message,
        description: `${finding.message}\n\nLocation: ${finding.path}:${finding.line}${finding.fix ? `\n\nSuggested fix: ${finding.fix}` : ""}`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["semgrep", "sast"],
        confidence: 0.9,
      });
    }
  } catch (error) {
    ctx.logger("Semgrep scan failed:", error);
  }

  return findings;
}

/**
 * Run gitleaks secrets scan
 */
async function runGitleaksScan(ctx: DiagnosticContext): Promise<Finding[]> {
  const gitleaks = new GitleaksIntegration();
  const findings: Finding[] = [];

  try {
    // Scan MCP context for exposed secrets
    const secrets = await gitleaks.scanMCPContext(ctx);

    for (const secret of secrets) {
      findings.push({
        id: `gitleaks-${secret.type.toLowerCase().replace(/\s+/g, "-")}`,
        area: "security",
        severity: "blocker",
        title: `Secret Detected: ${secret.type}`,
        description: `Exposed secret detected: ${secret.type}\nLocation: ${secret.file}:${secret.line}\nMatch: ${secret.match}`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["gitleaks", "secrets"],
        confidence: 0.95,
      });
    }
  } catch (error) {
    ctx.logger("gitleaks scan failed:", error);
  }

  return findings;
}

/**
 * Run OWASP ZAP DAST scan
 */
async function runZAPScan(ctx: DiagnosticContext): Promise<Finding[]> {
  const zap = new ZAPIntegration();
  const findings: Finding[] = [];

  try {
    // Scan MCP transport-specific vulnerabilities
    const zapFindings = await zap.scanMCPTransport(ctx);

    for (const finding of zapFindings) {
      findings.push({
        id: `zap-${finding.alertId}`,
        area: "security",
        severity: mapZAPRiskToSeverity(finding.riskLevel),
        title: finding.name,
        description: `${finding.description}\n\nSolution: ${finding.solution}\n\nCWE: ${finding.cweid}\nReference: ${finding.reference}`,
        evidence: [{ type: "url", ref: finding.url }],
        tags: ["zap", "dast", `cwe-${finding.cweid}`],
        confidence: mapZAPConfidenceToNumber(finding.confidence),
      });
    }
  } catch (error) {
    ctx.logger("ZAP scan failed:", error);
  }

  return findings;
}

/**
 * Map ZAP risk level to diagnostic severity
 */
function mapZAPRiskToSeverity(
  riskLevel: "High" | "Medium" | "Low" | "Informational",
): "blocker" | "major" | "minor" | "info" {
  const map = {
    High: "major" as const,
    Medium: "minor" as const,
    Low: "info" as const,
    Informational: "info" as const,
  };
  return map[riskLevel];
}

/**
 * Map ZAP confidence to number
 */
function mapZAPConfidenceToNumber(
  confidence: "High" | "Medium" | "Low",
): number {
  const map = {
    High: 0.9,
    Medium: 0.7,
    Low: 0.5,
  };
  return map[confidence];
}

/**
 * Deduplicate findings based on ID and description similarity
 */
function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();

  for (const finding of findings) {
    const key = `${finding.id}-${finding.title}`;
    if (!seen.has(key)) {
      seen.set(key, finding);
    }
  }

  return Array.from(seen.values());
}

/**
 * Prioritize findings by severity and confidence
 */
function prioritizeFindings(findings: Finding[]): Finding[] {
  const severityOrder = { blocker: 0, major: 1, minor: 2, info: 3 };

  return findings.sort((a, b) => {
    // Sort by severity first
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by confidence (higher confidence first)
    const confA = a.confidence || 0;
    const confB = b.confidence || 0;
    return confB - confA;
  });
}

/**
 * Calculate combined security score from all findings
 */
function calculateCombinedSecurityScore(findings: Finding[]): number {
  const weights = {
    blocker: 25,
    major: 15,
    minor: 8,
    info: 2,
  };

  let totalDeductions = 0;
  for (const finding of findings) {
    // Skip the score finding itself
    if (finding.id === "combined-security-score") continue;

    totalDeductions += weights[finding.severity] || 0;
  }

  return Math.max(0, Math.min(100, 100 - totalDeductions));
}

function extractToolNames(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const maybe = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
}
