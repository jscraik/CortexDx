/**
 * License Validation Plugin
 * Validates academic research licenses and ensures legal compliance
 * Response time requirement: <3s
 */

import type {
  ComplianceRecord,
  DiagnosticContext,
  Finding,
  LicenseValidationResult,
} from "@brainwav/cortexdx-core";

export interface ApprovedLicense {
  id: string;
  name: string;
  category: "permissive" | "copyleft" | "proprietary" | "public_domain";
  allowCommercialUse: boolean;
  allowModification: boolean;
  requiresAttribution: boolean;
  url?: string;
}

export interface ResearchContent {
  id: string;
  title: string;
  authors: string[];
  source: string;
  license?: string;
  doi?: string;
  url?: string;
  abstract?: string;
}

export interface LicenseCheckResult {
  content: ResearchContent;
  validation: LicenseValidationResult;
  compliance: ComplianceRecord;
  findings: Finding[];
}

export class LicenseValidatorPlugin {
  private readonly approvedLicenses: ApprovedLicense[] = [
    {
      id: "mit",
      name: "MIT License",
      category: "permissive",
      allowCommercialUse: true,
      allowModification: true,
      requiresAttribution: true,
      url: "https://opensource.org/licenses/MIT",
    },
    {
      id: "apache-2.0",
      name: "Apache License 2.0",
      category: "permissive",
      allowCommercialUse: true,
      allowModification: true,
      requiresAttribution: true,
      url: "https://opensource.org/licenses/Apache-2.0",
    },
    {
      id: "bsd-3-clause",
      name: "BSD 3-Clause License",
      category: "permissive",
      allowCommercialUse: true,
      allowModification: true,
      requiresAttribution: true,
      url: "https://opensource.org/licenses/BSD-3-Clause",
    },
    {
      id: "cc-by-4.0",
      name: "Creative Commons Attribution 4.0",
      category: "permissive",
      allowCommercialUse: true,
      allowModification: true,
      requiresAttribution: true,
      url: "https://creativecommons.org/licenses/by/4.0/",
    },
    {
      id: "cc0-1.0",
      name: "Creative Commons Zero 1.0",
      category: "public_domain",
      allowCommercialUse: true,
      allowModification: true,
      requiresAttribution: false,
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    {
      id: "gpl-3.0",
      name: "GNU General Public License v3.0",
      category: "copyleft",
      allowCommercialUse: true,
      allowModification: true,
      requiresAttribution: true,
      url: "https://opensource.org/licenses/GPL-3.0",
    },
  ];

  constructor(private ctx: DiagnosticContext) {}

  /**
   * Validate academic research license
   * Response time: <3s
   */
  async validateLicense(
    content: ResearchContent,
  ): Promise<LicenseValidationResult> {
    const startTime = Date.now();

    const license = this.detectLicense(content);
    const approvedLicense = this.findApprovedLicense(license);

    const validation: LicenseValidationResult = {
      isValid: approvedLicense !== null,
      license: license || "unknown",
      restrictions: [],
      recommendations: [],
      riskLevel: "low",
    };

    if (!approvedLicense) {
      validation.riskLevel = "high";
      validation.restrictions.push(
        "License not in approved list",
        "Manual review required before implementation",
      );
      validation.recommendations.push(
        "Contact legal team for license approval",
        "Consider alternative research with approved licenses",
      );
    } else {
      if (approvedLicense.requiresAttribution) {
        validation.restrictions.push("Attribution required");
        validation.recommendations.push(
          `Include citation: ${content.title} by ${content.authors.join(", ")}`,
        );
      }

      if (approvedLicense.category === "copyleft") {
        validation.restrictions.push("Derivative works must use same license");
        validation.recommendations.push(
          "Ensure compatibility with project license",
        );
        validation.riskLevel = "medium";
      }

      if (!approvedLicense.allowCommercialUse) {
        validation.restrictions.push("Commercial use not allowed");
        validation.riskLevel = "high";
      }
    }

    const duration = Date.now() - startTime;
    this.ctx.logger(
      `License validation completed in ${duration}ms for ${content.id}`,
    );

    this.ctx.evidence({
      type: "log",
      ref: `License validation: ${validation.license} (${validation.riskLevel} risk)`,
    });

    return validation;
  }

  /**
   * Check implementation compliance
   */
  async checkCompliance(
    code: string,
    source: ResearchContent,
  ): Promise<boolean> {
    const validation = await this.validateLicense(source);

    if (!validation.isValid) {
      return false;
    }

    const approvedLicense = this.findApprovedLicense(validation.license);
    if (!approvedLicense) {
      return false;
    }

    if (approvedLicense.requiresAttribution) {
      const hasAttribution = this.checkAttribution(code, source);
      if (!hasAttribution) {
        this.ctx.logger(
          `Missing attribution for ${source.title} in implementation`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Get list of approved licenses
   */
  getApprovedLicenses(): ApprovedLicense[] {
    return this.approvedLicenses;
  }

  /**
   * Flag proprietary content
   */
  async flagProprietaryContent(content: ResearchContent): Promise<Finding[]> {
    const findings: Finding[] = [];
    const validation = await this.validateLicense(content);

    if (!validation.isValid || validation.riskLevel === "high") {
      findings.push({
        id: `proprietary-${content.id}`,
        area: "license-compliance",
        severity: "blocker",
        title: "Proprietary or Unapproved License Detected",
        description: `Research content "${content.title}" has license "${validation.license}" which requires approval before implementation.`,
        evidence: [
          {
            type: "url",
            ref: content.url || content.doi || content.source,
          },
        ],
        tags: ["license", "compliance", "legal"],
        confidence: 0.95,
        recommendation: validation.recommendations.join("; "),
      });
    }

    return findings;
  }

  /**
   * Create compliance record
   */
  createComplianceRecord(
    content: ResearchContent,
    validation: LicenseValidationResult,
  ): ComplianceRecord {
    return {
      timestamp: Date.now(),
      provider: content.source,
      contentUsed: `${content.title} (${content.id})`,
      licenseStatus: validation.license,
      approvalRequired: !validation.isValid || validation.riskLevel === "high",
      auditTrail: [
        `Validated at ${new Date().toISOString()}`,
        `License: ${validation.license}`,
        `Risk level: ${validation.riskLevel}`,
        `Restrictions: ${validation.restrictions.join(", ")}`,
      ],
    };
  }

  /**
   * Detect license from content metadata
   */
  private detectLicense(content: ResearchContent): string | null {
    if (content.license) {
      return this.normalizeLicense(content.license);
    }

    if (content.url) {
      if (content.url.includes("arxiv.org")) {
        return "cc-by-4.0";
      }
      if (content.url.includes("creativecommons.org")) {
        const match = content.url.match(/licenses\/([\w-]+)\//);
        return match?.[1] ? this.normalizeLicense(match[1]) : null;
      }
    }

    return null;
  }

  /**
   * Normalize license name
   */
  private normalizeLicense(license: string): string {
    const normalized = license.toLowerCase().trim();

    const mapping: Record<string, string> = {
      "mit license": "mit",
      "apache license 2.0": "apache-2.0",
      "apache 2.0": "apache-2.0",
      "bsd 3-clause": "bsd-3-clause",
      "cc by 4.0": "cc-by-4.0",
      "cc-by-4.0": "cc-by-4.0",
      "creative commons attribution 4.0": "cc-by-4.0",
      "cc0 1.0": "cc0-1.0",
      "public domain": "cc0-1.0",
      "gpl-3.0": "gpl-3.0",
      "gpl v3": "gpl-3.0",
    };

    return mapping[normalized] || normalized;
  }

  /**
   * Find approved license by ID
   */
  private findApprovedLicense(
    licenseId: string | null,
  ): ApprovedLicense | null {
    if (!licenseId) return null;
    return this.approvedLicenses.find((l) => l.id === licenseId) || null;
  }

  /**
   * Check if code contains proper attribution
   */
  private checkAttribution(code: string, source: ResearchContent): boolean {
    const attributionPatterns = [
      source.title,
      source.authors[0],
      source.doi || "",
      source.url || "",
    ];

    return attributionPatterns.some(
      (pattern) => pattern && code.includes(pattern),
    );
  }
}

export const createLicenseValidator = (
  ctx: DiagnosticContext,
): LicenseValidatorPlugin => {
  return new LicenseValidatorPlugin(ctx);
};
