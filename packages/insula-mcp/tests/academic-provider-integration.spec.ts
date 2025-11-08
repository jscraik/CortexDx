import { describe, expect, it } from "vitest";
import {
    batchValidateLicenses,
    flagProprietaryContent,
    generateComplianceFinding,
    getApprovedLicenses,
    isLicenseApproved,
    validateAcademicLicense,
    type ResearchContent,
} from "../src/plugins/license-validator.js";

describe("Academic Provider Integration Tests", () => {
    describe("License Validation", () => {
        it("should validate all 7 academic providers work with license validation", () => {
            // Test that we have the expected number of approved licenses
            const approvedLicenses = getApprovedLicenses();
            expect(approvedLicenses.length).toBeGreaterThan(0);

            // Verify key approved licenses exist
            expect(isLicenseApproved("MIT")).toBe(true);
            expect(isLicenseApproved("Apache-2.0")).toBe(true);
            expect(isLicenseApproved("BSD-3-Clause")).toBe(true);
            expect(isLicenseApproved("CC-BY-4.0")).toBe(true);
        });

        it("should validate permissive licenses within 3 seconds", () => {
            const content: ResearchContent = {
                title: "Test Research Paper",
                authors: ["Test Author"],
                source: "arXiv",
                license: "MIT",
                doi: "10.1234/test",
            };

            const startTime = Date.now();
            const result = validateAcademicLicense(content);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(3000);
            expect(result.valid).toBe(true);
            expect(result.approved).toBe(true);
            expect(result.complianceStatus).toBe("compliant");
        });

        it("should flag proprietary licenses requiring approval", () => {
            const content: ResearchContent = {
                title: "Non-Commercial Research",
                authors: ["Test Author"],
                source: "Semantic Scholar",
                license: "CC-BY-NC-4.0",
                doi: "10.1234/nc-test",
            };

            const result = validateAcademicLicense(content);
            expect(result.valid).toBe(false);
            expect(result.approved).toBe(false);
            expect(result.requiresApproval).toBe(true);
            expect(result.complianceStatus).toBe("requires_approval");
        });

        it("should handle unknown licenses appropriately", () => {
            const content: ResearchContent = {
                title: "Unknown License Research",
                authors: ["Test Author"],
                source: "OpenAlex",
                license: "UNKNOWN-LICENSE",
            };

            const result = validateAcademicLicense(content);
            expect(result.valid).toBe(false);
            expect(result.requiresApproval).toBe(true);
            expect(result.riskLevel).toBe("high");
        });

        it("should handle missing license information", () => {
            const content: ResearchContent = {
                title: "No License Research",
                authors: ["Test Author"],
                source: "Wikidata",
            };

            const result = validateAcademicLicense(content);
            expect(result.valid).toBe(false);
            expect(result.license).toBe("unknown");
            expect(result.requiresApproval).toBe(true);
        });
    });

    describe("Proprietary Content Flagging", () => {
        it("should flag proprietary content correctly", () => {
            const content: ResearchContent = {
                title: "GPL Licensed Research",
                authors: ["Test Author"],
                source: "Context7",
                license: "GPL-3.0",
                doi: "10.1234/gpl-test",
            };

            const flag = flagProprietaryContent(content);
            expect(flag).not.toBeNull();
            expect(flag?.requiresApproval).toBe(true);
            expect(flag?.license).toContain("GNU General Public License");
        });

        it("should not flag compliant content", () => {
            const content: ResearchContent = {
                title: "MIT Licensed Research",
                authors: ["Test Author"],
                source: "arXiv",
                license: "MIT",
            };

            const flag = flagProprietaryContent(content);
            expect(flag).toBeNull();
        });
    });

    describe("Batch License Validation", () => {
        it("should validate multiple research contents efficiently", () => {
            const contents: ResearchContent[] = [
                {
                    title: "MIT Research 1",
                    authors: ["Author 1"],
                    source: "arXiv",
                    license: "MIT",
                },
                {
                    title: "Apache Research 2",
                    authors: ["Author 2"],
                    source: "Semantic Scholar",
                    license: "Apache-2.0",
                },
                {
                    title: "GPL Research 3",
                    authors: ["Author 3"],
                    source: "OpenAlex",
                    license: "GPL-3.0",
                },
                {
                    title: "Unknown Research 4",
                    authors: ["Author 4"],
                    source: "Wikidata",
                    license: "CUSTOM-LICENSE",
                },
            ];

            const startTime = Date.now();
            const results = batchValidateLicenses(contents);
            const duration = Date.now() - startTime;

            expect(results.size).toBe(4);
            expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

            // Verify individual results
            const mitResult = Array.from(results.values())[0];
            expect(mitResult?.approved).toBe(true);

            const apacheResult = Array.from(results.values())[1];
            expect(apacheResult?.approved).toBe(true);

            const gplResult = Array.from(results.values())[2];
            expect(gplResult?.approved).toBe(false);

            const unknownResult = Array.from(results.values())[3];
            expect(unknownResult?.requiresApproval).toBe(true);
        });
    });

    describe("Compliance Monitoring", () => {
        it("should generate compliance findings correctly", () => {
            const content: ResearchContent = {
                title: "Test Research for Compliance",
                authors: ["Test Author"],
                source: "Vibe Check",
                license: "MIT",
                url: "https://example.com/research",
            };

            const validation = validateAcademicLicense(content);
            const finding = generateComplianceFinding(content, validation);

            expect(finding.area).toBe("licensing");
            expect(finding.tags).toContain("licensing");
            expect(finding.tags).toContain("academic");
            expect(finding.confidence).toBeGreaterThan(0.8);
        });

        it("should track usage correctly with appropriate severity", () => {
            const highRiskContent: ResearchContent = {
                title: "High Risk Research",
                authors: ["Test Author"],
                source: "Exa",
                license: "PROPRIETARY",
            };

            const validation = validateAcademicLicense(highRiskContent);
            const finding = generateComplianceFinding(highRiskContent, validation);

            expect(finding.severity).toBe("major");
            expect(validation.riskLevel).toBe("high");
        });
    });

    describe("Research-Backed Code Generation", () => {
        it("should produce valid suggestions from approved licenses", () => {
            const approvedContent: ResearchContent = {
                title: "Approved Research Method",
                authors: ["Researcher A"],
                source: "arXiv",
                license: "Apache-2.0",
                abstract: "A novel approach to MCP server optimization",
            };

            const validation = validateAcademicLicense(approvedContent);

            expect(validation.valid).toBe(true);
            expect(validation.approved).toBe(true);
            expect(validation.complianceStatus).toBe("compliant");
            expect(validation.recommendations.length).toBeGreaterThan(0);
        });

        it("should block suggestions from non-approved licenses", () => {
            const nonApprovedContent: ResearchContent = {
                title: "Non-Approved Research Method",
                authors: ["Researcher B"],
                source: "Semantic Scholar",
                license: "GPL-3.0",
                abstract: "A copyleft approach requiring approval",
            };

            const validation = validateAcademicLicense(nonApprovedContent);

            expect(validation.approved).toBe(false);
            expect(validation.requiresApproval).toBe(true);
            expect(validation.complianceStatus).toBe("requires_approval");
        });
    });

    describe("Academic Provider Coverage", () => {
        it("should support all 7 academic providers", () => {
            const providers = [
                "arXiv",
                "Semantic Scholar",
                "OpenAlex",
                "Wikidata",
                "Context7",
                "Vibe Check",
                "Exa",
            ];

            // Test that each provider can be used with license validation
            providers.forEach((provider) => {
                const content: ResearchContent = {
                    title: `Test from ${provider}`,
                    authors: ["Test Author"],
                    source: provider,
                    license: "MIT",
                };

                const validation = validateAcademicLicense(content);
                expect(validation).toBeDefined();
                expect(validation.valid).toBe(true);
            });
        });
    });

    describe("Performance Requirements", () => {
        it("should validate licenses within 3 second requirement", () => {
            const content: ResearchContent = {
                title: "Performance Test Research",
                authors: ["Test Author"],
                source: "arXiv",
                license: "MIT",
            };

            const iterations = 100;
            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                validateAcademicLicense(content);
            }

            const totalDuration = Date.now() - startTime;
            const avgDuration = totalDuration / iterations;

            expect(avgDuration).toBeLessThan(3000);
            expect(avgDuration).toBeLessThan(100); // Should be much faster in practice
        });
    });
});
