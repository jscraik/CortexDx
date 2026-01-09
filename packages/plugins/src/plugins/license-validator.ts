import type {
  DiagnosticContext,
  DiagnosticPlugin,
  DiagnosticArtifacts,
  Finding,
  Severity,
} from "@brainwav/cortexdx-core";

// Academic license types
export interface AcademicLicense {
  id: string;
  name: string;
  type: "permissive" | "copyleft" | "proprietary" | "public-domain";
  approved: boolean;
  restrictions: string[];
  requiresAttribution: boolean;
  allowsCommercialUse: boolean;
  allowsModification: boolean;
  allowsDistribution: boolean;
}

export interface ResearchContent {
  title: string;
  authors: string[];
  source: string;
  license?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  year?: number;
}

export interface LicenseValidationResult {
  valid: boolean;
  license: string;
  approved: boolean;
  restrictions: string[];
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  recommendations: string[];
  complianceStatus: "compliant" | "requires_approval" | "non_compliant";
}

export interface ProprietaryContentFlag {
  contentId: string;
  reason: string;
  license: string;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  recommendations: string[];
}

// Database of approved licenses
const APPROVED_LICENSES: Map<string, AcademicLicense> = new Map([
  [
    "MIT",
    {
      id: "MIT",
      name: "MIT License",
      type: "permissive",
      approved: true,
      restrictions: [],
      requiresAttribution: true,
      allowsCommercialUse: true,
      allowsModification: true,
      allowsDistribution: true,
    },
  ],
  [
    "Apache-2.0",
    {
      id: "Apache-2.0",
      name: "Apache License 2.0",
      type: "permissive",
      approved: true,
      restrictions: ["patent-grant-required"],
      requiresAttribution: true,
      allowsCommercialUse: true,
      allowsModification: true,
      allowsDistribution: true,
    },
  ],
  [
    "BSD-3-Clause",
    {
      id: "BSD-3-Clause",
      name: "BSD 3-Clause License",
      type: "permissive",
      approved: true,
      restrictions: [],
      requiresAttribution: true,
      allowsCommercialUse: true,
      allowsModification: true,
      allowsDistribution: true,
    },
  ],
  [
    "CC-BY-4.0",
    {
      id: "CC-BY-4.0",
      name: "Creative Commons Attribution 4.0",
      type: "permissive",
      approved: true,
      restrictions: [],
      requiresAttribution: true,
      allowsCommercialUse: true,
      allowsModification: true,
      allowsDistribution: true,
    },
  ],
  [
    "GPL-3.0",
    {
      id: "GPL-3.0",
      name: "GNU General Public License v3.0",
      type: "copyleft",
      approved: false,
      restrictions: ["copyleft", "source-disclosure-required"],
      requiresAttribution: true,
      allowsCommercialUse: true,
      allowsModification: true,
      allowsDistribution: true,
    },
  ],
  [
    "CC-BY-NC-4.0",
    {
      id: "CC-BY-NC-4.0",
      name: "Creative Commons Attribution-NonCommercial 4.0",
      type: "proprietary",
      approved: false,
      restrictions: ["non-commercial-only"],
      requiresAttribution: true,
      allowsCommercialUse: false,
      allowsModification: true,
      allowsDistribution: true,
    },
  ],
  [
    "PROPRIETARY-NO-DIST",
    {
      id: "PROPRIETARY-NO-DIST",
      name: "Proprietary License (No Distribution)",
      type: "proprietary",
      approved: false,
      restrictions: ["distribution-prohibited"],
      requiresAttribution: false,
      allowsCommercialUse: false,
      allowsModification: false,
      allowsDistribution: false,
    },
  ],
]);

// License Validator Plugin
export const LicenseValidatorPlugin: DiagnosticPlugin = {
  id: "license-validator",
  title: "Academic License Validation",
  order: 100,
  async run(ctx: DiagnosticContext) {
    const findings: Finding[] = [];
    const researchContent = extractResearchContent(ctx.artifacts);

    if (researchContent.length === 0) {
      findings.push({
        id: "license.validator.no-content",
        area: "licensing",
        severity: "info",
        title: "No research content provided",
        description:
          "No research artifacts were supplied for license validation. Provide research content with license metadata to enable compliance checks.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["licensing", "academic", "compliance"],
      });
      return findings;
    }

    for (const content of researchContent) {
      const validation = validateAcademicLicense(content);
      const severity = getSeverityFromValidation(validation);
      findings.push({
        id: `license.validator.${validation.complianceStatus}.${content.title.slice(0, 20).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        area: "licensing",
        severity,
        title: `License validation: ${validation.license}`,
        description: `Research content "${content.title}" is ${validation.complianceStatus.replace("_", " ")}. Restrictions: ${validation.restrictions.join(", ") || "none"}.`,
        evidence: buildEvidence(content, ctx.endpoint),
        tags: ["licensing", "academic", validation.complianceStatus],
        recommendation: validation.recommendations.join(". "),
        confidence: validation.valid ? 0.95 : 0.85,
      });
    }

    return findings;
  },
};

// Validate academic research license
export function validateAcademicLicense(
  content: ResearchContent,
): LicenseValidationResult {
  const startTime = Date.now();

  if (!content.license) {
    return {
      valid: false,
      license: "unknown",
      approved: false,
      restrictions: ["license-unknown"],
      requiresApproval: true,
      riskLevel: "high",
      recommendations: [
        "Contact authors to clarify license",
        "Seek legal approval before implementation",
      ],
      complianceStatus: "requires_approval",
    };
  }

  const license = APPROVED_LICENSES.get(content.license);

  if (!license) {
    return {
      valid: false,
      license: content.license,
      approved: false,
      restrictions: ["license-not-recognized"],
      requiresApproval: true,
      riskLevel: "high",
      recommendations: [
        "Verify license with legal team",
        "Consider alternative research sources",
      ],
      complianceStatus: "requires_approval",
    };
  }

  const duration = Date.now() - startTime;
  if (duration > 3000) {
    console.warn(`License validation exceeded 3s threshold: ${duration}ms`);
  }

  if (!license.approved) {
    const nonCompliant =
      !license.allowsDistribution || !license.allowsModification;

    return {
      valid: false,
      license: license.name,
      approved: false,
      restrictions: license.restrictions,
      requiresApproval: !nonCompliant,
      riskLevel:
        nonCompliant || license.type === "proprietary" ? "high" : "medium",
      recommendations: [
        "Seek legal approval for implementation",
        "Consider alternative permissive-licensed research",
      ],
      complianceStatus: nonCompliant ? "non_compliant" : "requires_approval",
    };
  }

  return {
    valid: true,
    license: license.name,
    approved: true,
    restrictions: license.restrictions,
    requiresApproval: false,
    riskLevel: "low",
    recommendations: license.requiresAttribution
      ? ["Include proper attribution in implementation"]
      : [],
    complianceStatus: "compliant",
  };
}

// Flag proprietary content
export function flagProprietaryContent(
  content: ResearchContent,
): ProprietaryContentFlag | null {
  const validation = validateAcademicLicense(content);

  if (validation.complianceStatus === "compliant") {
    return null;
  }

  return {
    contentId: content.doi || content.url || content.title,
    reason: `License ${validation.license} requires approval`,
    license: validation.license,
    requiresApproval: validation.requiresApproval,
    riskLevel: validation.riskLevel,
    recommendations: validation.recommendations,
  };
}

// Get approved licenses
export function getApprovedLicenses(): AcademicLicense[] {
  return Array.from(APPROVED_LICENSES.values()).filter((l) => l.approved);
}

// Check if license is approved
export function isLicenseApproved(licenseId: string): boolean {
  const license = APPROVED_LICENSES.get(licenseId);
  return license?.approved ?? false;
}

// Batch validate multiple research contents
export function batchValidateLicenses(
  contents: ResearchContent[],
): Map<string, LicenseValidationResult> {
  const results = new Map<string, LicenseValidationResult>();

  for (const content of contents) {
    const id = content.doi || content.url || content.title;
    results.set(id, validateAcademicLicense(content));
  }

  return results;
}

// Generate license compliance finding
export function generateComplianceFinding(
  content: ResearchContent,
  validation: LicenseValidationResult,
): Finding {
  const severity = validation.riskLevel === "high" ? "major" : "minor";

  return {
    id: `license.${validation.complianceStatus}.${content.title.slice(0, 20)}`,
    area: "licensing",
    severity,
    title: `License validation: ${validation.license}`,
    description: `Research content "${content.title}" has ${validation.complianceStatus} status. ${validation.recommendations.join(". ")}`,
    evidence: [
      {
        type: "url",
        ref: content.url || content.doi || "unknown",
      },
    ],
    tags: ["licensing", "academic", validation.complianceStatus],
    confidence: validation.valid ? 0.95 : 0.85,
    recommendation: validation.recommendations.join(". "),
  };
}

type LicenseArtifacts = DiagnosticArtifacts & {
  researchContent?: ResearchContent[];
  researchContext?: ResearchContent[];
  research?: ResearchContent[];
};

function extractResearchContent(
  artifacts?: LicenseArtifacts,
): ResearchContent[] {
  if (!artifacts) {
    return [];
  }

  const candidates =
    artifacts.researchContent ??
    artifacts.researchContext ??
    artifacts.research ??
    [];

  return (Array.isArray(candidates) ? candidates : []).filter(
    (item): item is ResearchContent =>
      typeof item?.title === "string" &&
      Array.isArray(item?.authors) &&
      item.authors.every((author) => typeof author === "string"),
  );
}

function getSeverityFromValidation(validation: LicenseValidationResult): Severity {
  if (validation.complianceStatus === "compliant") {
    return "info";
  }

  if (validation.complianceStatus === "non_compliant") {
    return "major";
  }

  return validation.riskLevel === "high" ? "major" : "minor";
}

function buildEvidence(
  content: ResearchContent,
  endpoint: string,
): Finding["evidence"] {
  const references = [content.url, content.doi, endpoint].filter(
    Boolean,
  ) as string[];

  return references.map((ref) => ({ type: "url" as const, ref }));
}
