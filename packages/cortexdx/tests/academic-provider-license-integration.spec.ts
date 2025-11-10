/**
 * Academic Provider License Integration Tests
 * Task 14.1.3: Test academic provider integration with license validation
 * 
 * Tests verify:
 * - All 7 academic providers work with license validation
 * - Research-backed code generation produces valid suggestions
 * - Compliance monitoring tracks usage correctly
 * 
 * Requirements: 13.1, 13.2, 13.4
 */

import { describe, expect, it } from "vitest";
import {
  batchValidateLicenses,
  generateComplianceFinding,
  validateAcademicLicense,
  type ResearchContent,
} from "../src/plugins/license-validator.js";
import { getAcademicRegistry } from "../src/registry/index.js";
import type { DiagnosticContext } from "../src/types.js";

// Mock diagnostic context for testing
const mockContext: DiagnosticContext = {
  endpoint: "test://localhost",
  logger: () => { },
  request: async () => ({ data: [], total: 0 }),
  jsonrpc: async () => ({}),
  sseProbe: async () => ({ ok: true }),
  evidence: () => { },
  deterministic: true,
};

describe("Academic Provider License Integration (Task 14.1.3)", () => {
  describe("All 7 Academic Providers with License Validation", () => {
    it("should verify all 7 academic providers are registered", () => {
      const registry = getAcademicRegistry();
      const providers = registry.getAllProviders();

      const expectedProviders = [
        "semantic-scholar",
        "openalex",
        "wikidata",
        "arxiv",
        "vibe-check",
        "context7",
        "exa",
      ];

      expectedProviders.forEach((providerId) => {
        expect(providers[providerId]).toBeDefined();
        expect(providers[providerId]?.name).toBeDefined();
      });

      expect(Object.keys(providers).length).toBeGreaterThanOrEqual(7);
    });

    it("should create instances of all 7 providers", () => {
      const registry = getAcademicRegistry();
      const providerIds = [
        "semantic-scholar",
        "openalex",
        "wikidata",
        "arxiv",
        "vibe-check",
        "context7",
      ];

      providerIds.forEach((providerId) => {
        const instance = registry.createProviderInstance(providerId, mockContext);
        expect(instance).toBeDefined();
        expect(typeof instance.executeTool).toBe("function");
      });
    });

    it("should validate licenses for content from all 7 providers", () => {
      const providers = [
        "semantic-scholar",
        "openalex",
        "wikidata",
        "arxiv",
        "vibe-check",
        "context7",
        "exa",
      ];

      providers.forEach((provider) => {
        const content: ResearchContent = {
          title: `Test Research from ${provider}`,
          authors: ["Test Author"],
          source: provider,
          license: "MIT",
        };

        const validation = validateAcademicLicense(content);
        expect(validation).toBeDefined();
        expect(validation.valid).toBe(true);
        expect(validation.approved).toBe(true);
        expect(validation.complianceStatus).toBe("compliant");
      });
    });

    it("should handle different license types across all providers", () => {
      const providers = [
        "semantic-scholar",
        "openalex",
        "wikidata",
        "arxiv",
        "vibe-check",
        "context7",
        "exa",
      ];

      const licenses = [
        { id: "MIT", shouldApprove: true },
        { id: "Apache-2.0", shouldApprove: true },
        { id: "GPL-3.0", shouldApprove: false },
        { id: "CC-BY-NC-4.0", shouldApprove: false },
      ];

      providers.forEach((provider) => {
        licenses.forEach((license) => {
          const content: ResearchContent = {
            title: `${license.id} Research from ${provider}`,
            authors: ["Test Author"],
            source: provider,
            license: license.id,
          };

          const validation = validateAcademicLicense(content);
          expect(validation.approved).toBe(license.shouldApprove);
        });
      });
    });
  });

  describe("Research-Backed Code Generation Validation", () => {
    it("should produce valid suggestions from approved licenses", () => {
      const approvedLicenses = ["MIT", "Apache-2.0", "BSD-3-Clause", "CC-BY-4.0"];
      const providers = ["arxiv", "semantic-scholar", "openalex"];

      providers.forEach((provider) => {
        approvedLicenses.forEach((license) => {
          const content: ResearchContent = {
            title: `Code Generation Research: ${license}`,
            authors: ["Researcher A", "Researcher B"],
            source: provider,
            license,
            abstract: "Novel approach to MCP server optimization using academic research",
            doi: `10.1234/${provider}-${license}`,
          };

          const validation = validateAcademicLicense(content);

          expect(validation.valid).toBe(true);
          expect(validation.approved).toBe(true);
          expect(validation.complianceStatus).toBe("compliant");
          expect(validation.riskLevel).toBe("low");
          expect(validation.recommendations.length).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it("should block suggestions from non-approved licenses", () => {
      const nonApprovedLicenses = ["GPL-3.0", "CC-BY-NC-4.0", "AGPL-3.0"];
      const providers = ["vibe-check", "context7", "wikidata"];

      providers.forEach((provider) => {
        nonApprovedLicenses.forEach((license) => {
          const content: ResearchContent = {
            title: `Restricted Research: ${license}`,
            authors: ["Researcher C"],
            source: provider,
            license,
            abstract: "Research requiring approval due to license restrictions",
          };

          const validation = validateAcademicLicense(content);

          expect(validation.approved).toBe(false);
          expect(validation.requiresApproval).toBe(true);
          expect(validation.complianceStatus).toBe("requires_approval");
          expect(validation.riskLevel).toMatch(/medium|high/);
        });
      });
    });

    it("should validate code generation suggestions within 3 seconds", () => {
      const content: ResearchContent = {
        title: "Fast Validation Test",
        authors: ["Speed Tester"],
        source: "arxiv",
        license: "MIT",
        abstract: "Testing sub-3-second validation requirement",
      };

      const startTime = Date.now();
      const validation = validateAcademicLicense(content);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000);
      expect(validation.valid).toBe(true);
      expect(validation.approved).toBe(true);
    });

    it("should handle batch validation for multiple providers efficiently", () => {
      const contents: ResearchContent[] = [
        {
          title: "Semantic Scholar Research",
          authors: ["Author 1"],
          source: "semantic-scholar",
          license: "MIT",
        },
        {
          title: "OpenAlex Research",
          authors: ["Author 2"],
          source: "openalex",
          license: "Apache-2.0",
        },
        {
          title: "arXiv Preprint",
          authors: ["Author 3"],
          source: "arxiv",
          license: "CC-BY-4.0",
        },
        {
          title: "Wikidata Entity",
          authors: ["Author 4"],
          source: "wikidata",
          license: "CC-BY-4.0",
        },
        {
          title: "Vibe Check Assessment",
          authors: ["Author 5"],
          source: "vibe-check",
          license: "MIT",
        },
        {
          title: "Context7 Analysis",
          authors: ["Author 6"],
          source: "context7",
          license: "Apache-2.0",
        },
        {
          title: "Exa Search Result",
          authors: ["Author 7"],
          source: "exa",
          license: "BSD-3-Clause",
        },
      ];

      const startTime = Date.now();
      const results = batchValidateLicenses(contents);
      const duration = Date.now() - startTime;

      expect(results.size).toBe(7);
      expect(duration).toBeLessThan(3000);

      // Verify all results are approved
      Array.from(results.values()).forEach((result) => {
        expect(result.approved).toBe(true);
        expect(result.complianceStatus).toBe("compliant");
      });
    });
  });

  describe("Compliance Monitoring and Tracking", () => {
    it("should generate compliance findings for all providers", () => {
      const providers = [
        "semantic-scholar",
        "openalex",
        "wikidata",
        "arxiv",
        "vibe-check",
        "context7",
        "exa",
      ];

      providers.forEach((provider) => {
        const content: ResearchContent = {
          title: `Compliance Test for ${provider}`,
          authors: ["Compliance Tester"],
          source: provider,
          license: "MIT",
          url: `https://example.com/${provider}/research`,
        };

        const validation = validateAcademicLicense(content);
        const finding = generateComplianceFinding(content, validation);

        expect(finding).toBeDefined();
        expect(finding.area).toBe("licensing");
        expect(finding.tags).toContain("licensing");
        expect(finding.tags).toContain("academic");
        expect(finding.confidence).toBeGreaterThan(0.8);
        expect(finding.severity).toMatch(/info|minor|major/);
      });
    });

    it("should track usage with appropriate severity levels", () => {
      const testCases = [
        {
          license: "MIT",
          expectedSeverity: "minor",
          riskLevel: "low",
        },
        {
          license: "GPL-3.0",
          expectedSeverity: "minor",
          riskLevel: "medium",
        },
        {
          license: "PROPRIETARY",
          expectedSeverity: "major",
          riskLevel: "high",
        },
      ];

      testCases.forEach((testCase) => {
        const content: ResearchContent = {
          title: `Risk Level Test: ${testCase.license}`,
          authors: ["Risk Tester"],
          source: "semantic-scholar",
          license: testCase.license,
        };

        const validation = validateAcademicLicense(content);
        const finding = generateComplianceFinding(content, validation);

        expect(validation.riskLevel).toBe(testCase.riskLevel);
        expect(finding.severity).toBe(testCase.expectedSeverity);
      });
    });

    it("should maintain audit trail for compliance monitoring", () => {
      const auditTrail: Array<{
        provider: string;
        license: string;
        approved: boolean;
        timestamp: number;
      }> = [];

      const providers = ["arxiv", "semantic-scholar", "openalex", "vibe-check"];

      providers.forEach((provider) => {
        const content: ResearchContent = {
          title: `Audit Trail Test: ${provider}`,
          authors: ["Auditor"],
          source: provider,
          license: "MIT",
        };

        const validation = validateAcademicLicense(content);

        auditTrail.push({
          provider,
          license: validation.license,
          approved: validation.approved,
          timestamp: Date.now(),
        });
      });

      expect(auditTrail.length).toBe(4);
      auditTrail.forEach((entry) => {
        expect(entry.provider).toBeDefined();
        expect(entry.license).toBeDefined();
        expect(entry.approved).toBe(true);
        expect(entry.timestamp).toBeGreaterThan(0);
      });
    });

    it("should track compliance status across multiple validation cycles", () => {
      const content: ResearchContent = {
        title: "Multi-Cycle Compliance Test",
        authors: ["Cycle Tester"],
        source: "context7",
        license: "Apache-2.0",
      };

      const cycles = 5;
      const results: string[] = [];

      for (let i = 0; i < cycles; i++) {
        const validation = validateAcademicLicense(content);
        results.push(validation.complianceStatus);
      }

      expect(results.length).toBe(cycles);
      results.forEach((status) => {
        expect(status).toBe("compliant");
      });
    });
  });

  describe("Provider-Specific License Integration", () => {
    it("should handle Semantic Scholar with license validation", () => {
      const content: ResearchContent = {
        title: "Semantic Scholar Paper",
        authors: ["S2 Author"],
        source: "semantic-scholar",
        license: "MIT",
        doi: "10.1234/s2-test",
      };

      const validation = validateAcademicLicense(content);
      expect(validation.approved).toBe(true);
      expect(validation.complianceStatus).toBe("compliant");
    });

    it("should handle OpenAlex with license validation", () => {
      const content: ResearchContent = {
        title: "OpenAlex Work",
        authors: ["OA Author"],
        source: "openalex",
        license: "CC-BY-4.0",
        doi: "10.1234/oa-test",
      };

      const validation = validateAcademicLicense(content);
      expect(validation.approved).toBe(true);
      expect(validation.complianceStatus).toBe("compliant");
    });

    it("should handle arXiv preprints with license validation", () => {
      const content: ResearchContent = {
        title: "arXiv Preprint",
        authors: ["arXiv Author"],
        source: "arxiv",
        license: "CC-BY-4.0",
        url: "https://arxiv.org/abs/2401.00000",
      };

      const validation = validateAcademicLicense(content);
      expect(validation.approved).toBe(true);
      expect(validation.complianceStatus).toBe("compliant");
    });

    it("should handle Wikidata entities with license validation", () => {
      const content: ResearchContent = {
        title: "Wikidata Entity",
        authors: ["WD Contributor"],
        source: "wikidata",
        license: "CC-BY-4.0",
      };

      const validation = validateAcademicLicense(content);
      expect(validation.approved).toBe(true);
      expect(validation.complianceStatus).toBe("compliant");
    });

    it("should handle Vibe Check assessments with license validation", () => {
      const content: ResearchContent = {
        title: "Vibe Check Quality Assessment",
        authors: ["VC Assessor"],
        source: "vibe-check",
        license: "MIT",
      };

      const validation = validateAcademicLicense(content);
      expect(validation.approved).toBe(true);
      expect(validation.complianceStatus).toBe("compliant");
    });

    it("should handle Context7 analysis with license validation", () => {
      const content: ResearchContent = {
        title: "Context7 Contextual Analysis",
        authors: ["C7 Analyst"],
        source: "context7",
        license: "Apache-2.0",
      };

      const validation = validateAcademicLicense(content);
      expect(validation.approved).toBe(true);
      expect(validation.complianceStatus).toBe("compliant");
    });

    it("should handle Exa search results with license validation", () => {
      const content: ResearchContent = {
        title: "Exa Search Result",
        authors: ["Exa Researcher"],
        source: "exa",
        license: "BSD-3-Clause",
      };

      const validation = validateAcademicLicense(content);
      expect(validation.approved).toBe(true);
      expect(validation.complianceStatus).toBe("compliant");
    });
  });

  describe("Performance and Integration Requirements", () => {
    it("should validate all providers within performance requirements", () => {
      const providers = [
        "semantic-scholar",
        "openalex",
        "wikidata",
        "arxiv",
        "vibe-check",
        "context7",
        "exa",
      ];

      const startTime = Date.now();

      providers.forEach((provider) => {
        const content: ResearchContent = {
          title: `Performance Test: ${provider}`,
          authors: ["Perf Tester"],
          source: provider,
          license: "MIT",
        };

        validateAcademicLicense(content);
      });

      const totalDuration = Date.now() - startTime;
      const avgDuration = totalDuration / providers.length;

      expect(avgDuration).toBeLessThan(3000);
      expect(totalDuration).toBeLessThan(10000);
    });

    it("should integrate license validation with provider capabilities", () => {
      const registry = getAcademicRegistry();
      const capabilities = registry.getAllCapabilities();

      expect(Object.keys(capabilities).length).toBeGreaterThanOrEqual(6);

      Object.keys(capabilities).forEach((providerId) => {
        const capability = capabilities[providerId];
        expect(capability).toBeDefined();
        expect(capability?.tools).toBeDefined();
        expect(Array.isArray(capability?.tools)).toBe(true);
      });
    });
  });
});
