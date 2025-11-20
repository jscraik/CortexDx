/**
 * License Validation MCP Tools
 * Provides MCP tool definitions for academic research license validation, compliance monitoring, and IP tracking
 * Requirements: 13.1, 13.2, 13.4
 */

import type { McpTool } from "../types";

export const createLicenseValidationTools = (): McpTool[] => [
  {
    name: "validate_academic_license",
    description:
      "Validate academic research license before implementation suggestions. Checks against approved open-source and permissive licenses within 3 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        researchContent: {
          type: "string",
          description: "Research content or paper to validate",
        },
        sourceProvider: {
          type: "string",
          enum: [
            "arxiv",
            "semantic-scholar",
            "openalex",
            "context7",
            "wikidata",
          ],
          description: "Academic provider source",
        },
        sourceId: {
          type: "string",
          description: "Source identifier (DOI, arXiv ID, etc.)",
        },
        intendedUsage: {
          type: "string",
          enum: ["research", "citation", "methodology", "implementation"],
          description: "Intended usage of the content",
        },
        checkProprietaryContent: {
          type: "boolean",
          description:
            "Check for proprietary content requiring approval (default: true)",
        },
      },
      required: ["researchContent", "sourceProvider"],
    },
  },
  {
    name: "check_license_compatibility",
    description:
      "Check compatibility between multiple licenses for combined usage. Identifies conflicts and restrictions.",
    inputSchema: {
      type: "object",
      properties: {
        licenses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              source: { type: "string" },
              usage: { type: "string" },
            },
          },
          description: "List of licenses to check compatibility for",
        },
        targetLicense: {
          type: "string",
          description: "Target license for the combined work (optional)",
        },
        identifyConflicts: {
          type: "boolean",
          description: "Identify license conflicts (default: true)",
        },
        suggestResolution: {
          type: "boolean",
          description: "Suggest conflict resolution strategies (default: true)",
        },
      },
      required: ["licenses"],
    },
  },
  {
    name: "flag_proprietary_content",
    description:
      "Identify and flag proprietary research content requiring licensing approval. Prevents unauthorized usage.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content to check for proprietary restrictions",
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: { type: "string" },
              id: { type: "string" },
              license: { type: "string" },
            },
          },
          description: "Sources used in the content",
        },
        checkPatents: {
          type: "boolean",
          description: "Check for patent-protected content (default: true)",
        },
        checkTrademarks: {
          type: "boolean",
          description: "Check for trademark restrictions (default: true)",
        },
        checkCopyright: {
          type: "boolean",
          description: "Check for copyright restrictions (default: true)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "get_approved_licenses",
    description:
      "Retrieve database of approved licenses for academic research implementation. Includes usage guidelines and restrictions.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["open-source", "permissive", "copyleft", "academic", "all"],
          description: "License category to retrieve (default: all)",
        },
        includeRestrictions: {
          type: "boolean",
          description:
            "Include detailed restrictions for each license (default: true)",
        },
        includeUsageGuidelines: {
          type: "boolean",
          description: "Include usage guidelines (default: true)",
        },
        includeCompatibility: {
          type: "boolean",
          description: "Include compatibility information (default: true)",
        },
      },
      required: [],
    },
  },
  {
    name: "track_license_compliance",
    description:
      "Track license compliance for all academic integrations. Maintains audit trail and compliance records.",
    inputSchema: {
      type: "object",
      properties: {
        implementation: {
          type: "string",
          description: "Implementation to track compliance for",
        },
        researchSources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: { type: "string" },
              sourceId: { type: "string" },
              license: { type: "string" },
              usage: { type: "string" },
              approvalStatus: { type: "string" },
            },
          },
          description: "Research sources used in implementation",
        },
        generateAuditTrail: {
          type: "boolean",
          description: "Generate detailed audit trail (default: true)",
        },
        checkOngoingCompliance: {
          type: "boolean",
          description: "Check ongoing compliance status (default: true)",
        },
      },
      required: ["implementation", "researchSources"],
    },
  },
  {
    name: "generate_compliance_report",
    description:
      "Generate comprehensive compliance report for academic integrations. Includes license status, violations, and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["project", "organization", "implementation"],
          description: "Scope of compliance report",
        },
        targetId: {
          type: "string",
          description: "ID of project, organization, or implementation",
        },
        reportPeriod: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start date (ISO 8601)" },
            end: { type: "string", description: "End date (ISO 8601)" },
          },
          description: "Report period (optional, defaults to all time)",
        },
        format: {
          type: "string",
          enum: ["json", "markdown", "pdf", "html"],
          description: "Report output format (default: markdown)",
        },
        includeViolations: {
          type: "boolean",
          description: "Include license violations (default: true)",
        },
        includeRecommendations: {
          type: "boolean",
          description: "Include compliance recommendations (default: true)",
        },
        includeRiskAssessment: {
          type: "boolean",
          description: "Include risk assessment (default: true)",
        },
      },
      required: ["scope", "targetId"],
    },
  },
  {
    name: "request_license_approval",
    description:
      "Submit request for approval of proprietary or restricted research content. Initiates approval workflow.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content requiring approval",
        },
        source: {
          type: "object",
          properties: {
            provider: { type: "string" },
            id: { type: "string" },
            license: { type: "string" },
            authors: { type: "array", items: { type: "string" } },
          },
          description: "Source information",
        },
        intendedUsage: {
          type: "string",
          description: "Detailed description of intended usage",
        },
        justification: {
          type: "string",
          description: "Justification for using this content",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Urgency level for approval (default: medium)",
        },
        alternativesConsidered: {
          type: "array",
          items: { type: "string" },
          description: "Alternative sources considered (optional)",
        },
      },
      required: ["content", "source", "intendedUsage", "justification"],
    },
  },
  {
    name: "check_approval_status",
    description:
      "Check status of license approval requests. Returns current status and any feedback from reviewers.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "Approval request ID to check",
        },
        includeHistory: {
          type: "boolean",
          description: "Include approval history and comments (default: true)",
        },
        includeReviewerFeedback: {
          type: "boolean",
          description: "Include reviewer feedback (default: true)",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "validate_implementation_compliance",
    description:
      "Validate that implementation complies with all license requirements from research sources. Checks attribution, usage restrictions, and modifications.",
    inputSchema: {
      type: "object",
      properties: {
        implementation: {
          type: "string",
          description: "Implementation code or design to validate",
        },
        researchSources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: { type: "string" },
              sourceId: { type: "string" },
              license: { type: "string" },
              requiredAttribution: { type: "string" },
            },
          },
          description: "Research sources used in implementation",
        },
        checkAttribution: {
          type: "boolean",
          description: "Check for proper attribution (default: true)",
        },
        checkUsageRestrictions: {
          type: "boolean",
          description:
            "Check compliance with usage restrictions (default: true)",
        },
        checkModificationRights: {
          type: "boolean",
          description: "Check modification rights compliance (default: true)",
        },
      },
      required: ["implementation", "researchSources"],
    },
  },
  {
    name: "assess_ip_risk",
    description:
      "Assess intellectual property risk for using specific research content. Provides risk level and mitigation recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content to assess IP risk for",
        },
        source: {
          type: "object",
          properties: {
            provider: { type: "string" },
            id: { type: "string" },
            license: { type: "string" },
            jurisdiction: { type: "string" },
          },
          description: "Source information",
        },
        intendedUsage: {
          type: "string",
          enum: ["research", "commercial", "educational", "internal"],
          description: "Intended usage context",
        },
        includePatentRisk: {
          type: "boolean",
          description: "Include patent risk assessment (default: true)",
        },
        includeCopyrightRisk: {
          type: "boolean",
          description: "Include copyright risk assessment (default: true)",
        },
        suggestMitigation: {
          type: "boolean",
          description: "Suggest risk mitigation strategies (default: true)",
        },
      },
      required: ["content", "source", "intendedUsage"],
    },
  },
  {
    name: "maintain_license_database",
    description:
      "Maintain and update database of approved licenses and usage restrictions. Administrative tool for legal team.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["add", "update", "remove", "list"],
          description: "Database maintenance action",
        },
        license: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            restrictions: { type: "array", items: { type: "string" } },
            compatibleWith: { type: "array", items: { type: "string" } },
            requiresAttribution: { type: "boolean" },
            allowsCommercialUse: { type: "boolean" },
            allowsModification: { type: "boolean" },
          },
          description: "License information (required for add/update actions)",
        },
        licenseId: {
          type: "string",
          description: "License ID (required for update/remove actions)",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "generate_attribution_text",
    description:
      "Generate proper attribution text for research sources used in implementation. Ensures compliance with license requirements.",
    inputSchema: {
      type: "object",
      properties: {
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: { type: "string" },
              sourceId: { type: "string" },
              title: { type: "string" },
              authors: { type: "array", items: { type: "string" } },
              year: { type: "string" },
              license: { type: "string" },
              url: { type: "string" },
            },
          },
          description: "Research sources to generate attribution for",
        },
        format: {
          type: "string",
          enum: ["markdown", "html", "plain-text", "bibtex"],
          description: "Attribution text format (default: markdown)",
        },
        citationStyle: {
          type: "string",
          enum: ["apa", "mla", "chicago", "ieee"],
          description: "Citation style (default: apa)",
        },
        includeLinks: {
          type: "boolean",
          description: "Include links to original sources (default: true)",
        },
      },
      required: ["sources"],
    },
  },
  {
    name: "monitor_license_changes",
    description:
      "Monitor for changes in licenses of research sources used in implementations. Alerts on license updates that may affect compliance.",
    inputSchema: {
      type: "object",
      properties: {
        implementation: {
          type: "string",
          description: "Implementation to monitor",
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              provider: { type: "string" },
              sourceId: { type: "string" },
              currentLicense: { type: "string" },
            },
          },
          description: "Sources to monitor for license changes",
        },
        checkFrequency: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          description: "Monitoring frequency (default: weekly)",
        },
        alertOnChange: {
          type: "boolean",
          description: "Send alerts when licenses change (default: true)",
        },
      },
      required: ["implementation", "sources"],
    },
  },
];
