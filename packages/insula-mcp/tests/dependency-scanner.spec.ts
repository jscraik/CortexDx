/**
 * Dependency Scanner Plugin Tests
 * Tests SBOM generation, CVE scanning, license checking, and recommendations
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5
 */

import { describe, expect, it } from "vitest";
import { CVEScanner } from "../src/security/cve-scanner.js";
import { DependencyRecommendations } from "../src/security/dependency-recommendations.js";
import { FlictIntegration } from "../src/security/flict-integration.js";
import { SBOMGenerator, type PackageManifest } from "../src/security/sbom-generator.js";

describe("Dependency Scanner Plugin", () => {
    describe("SBOM Generation (Req 21.1)", () => {
        it("should generate CycloneDX SBOM from npm package.json", async () => {
            const generator = new SBOMGenerator();

            const manifest: PackageManifest = {
                type: "npm",
                path: "package.json",
                content: JSON.stringify({
                    name: "test-package",
                    version: "1.0.0",
                    dependencies: {
                        express: "^4.18.0",
                        lodash: "^4.17.21",
                    },
                }),
            };

            const sbom = await generator.generateSBOM(manifest, { format: "cyclonedx" });

            expect(sbom.bomFormat).toBe("CycloneDX");
            expect(sbom.components).toHaveLength(2);
            expect(sbom.components[0].name).toBe("express");
            expect(sbom.components[1].name).toBe("lodash");
        });

        it("should generate SBOM from pip requirements.txt", async () => {
            const generator = new SBOMGenerator();

            const manifest: PackageManifest = {
                type: "pip",
                path: "requirements.txt",
                content: "requests==2.28.0\nflask==2.2.0\n",
            };

            const sbom = await generator.generateSBOM(manifest, { format: "cyclonedx" });

            expect(sbom.bomFormat).toBe("CycloneDX");
            expect(sbom.components).toHaveLength(2);
            expect(sbom.components[0].name).toBe("requests");
            expect(sbom.components[1].name).toBe("flask");
        });

        it("should generate SBOM from Maven pom.xml", async () => {
            const generator = new SBOMGenerator();

            const manifest: PackageManifest = {
                type: "maven",
                path: "pom.xml",
                content: `
          <project>
            <dependencies>
              <dependency>
                <groupId>org.springframework</groupId>
                <artifactId>spring-core</artifactId>
                <version>5.3.0</version>
              </dependency>
            </dependencies>
          </project>
        `,
            };

            const sbom = await generator.generateSBOM(manifest, { format: "cyclonedx" });

            expect(sbom.bomFormat).toBe("CycloneDX");
            expect(sbom.components).toHaveLength(1);
            expect(sbom.components[0].name).toBe("spring-core");
            expect(sbom.components[0].group).toBe("org.springframework");
        });

        it("should include licenses when requested", async () => {
            const generator = new SBOMGenerator();

            const manifest: PackageManifest = {
                type: "npm",
                path: "package.json",
                content: JSON.stringify({
                    dependencies: {
                        express: "^4.18.0",
                    },
                }),
            };

            const sbom = await generator.generateSBOM(manifest, {
                format: "cyclonedx",
                includeLicenses: true,
            });

            expect(sbom.components[0].licenses).toBeDefined();
            expect(sbom.components[0].licenses?.length).toBeGreaterThan(0);
        });

        it("should export SBOM to JSON", () => {
            const generator = new SBOMGenerator();

            const sbom = {
                bomFormat: "CycloneDX" as const,
                specVersion: "1.5",
                version: 1,
                metadata: {
                    timestamp: new Date().toISOString(),
                    tools: [{ name: "test" }],
                },
                components: [],
                dependencies: [],
            };

            const json = generator.exportToJSON(sbom);

            expect(json).toContain("CycloneDX");
            expect(JSON.parse(json)).toEqual(sbom);
        });
    });

    describe("CVE Scanning (Req 21.3)", () => {
        it("should scan components for CVEs", async () => {
            const scanner = new CVEScanner();

            const components = [
                {
                    type: "library" as const,
                    name: "test-package",
                    version: "1.0.0",
                    purl: "pkg:npm/test-package@1.0.0",
                },
            ];

            const result = await scanner.scanComponents(components);

            expect(result.totalComponents).toBe(1);
            expect(result.scanDuration).toBeGreaterThan(0);
        });

        it("should calculate risk levels correctly", async () => {
            const scanner = new CVEScanner();

            const components = [
                {
                    type: "library" as const,
                    name: "vulnerable-package",
                    version: "1.0.0",
                    purl: "pkg:npm/vulnerable-package@1.0.0",
                },
            ];

            const result = await scanner.scanComponents(components);

            expect(result).toHaveProperty("criticalCVEs");
            expect(result).toHaveProperty("highCVEs");
            expect(result).toHaveProperty("mediumCVEs");
            expect(result).toHaveProperty("lowCVEs");
        });

        it("should generate remediation recommendations", async () => {
            const scanner = new CVEScanner();

            const components = [
                {
                    type: "library" as const,
                    name: "test-package",
                    version: "1.0.0",
                    purl: "pkg:npm/test-package@1.0.0",
                },
            ];

            const result = await scanner.scanComponents(components);

            for (const match of result.matches) {
                expect(match.remediationRecommendations).toBeDefined();
                expect(Array.isArray(match.remediationRecommendations)).toBe(true);
            }
        });
    });

    describe("License Compatibility (Req 21.4)", () => {
        it("should check license compatibility", async () => {
            const flict = new FlictIntegration();

            const licenses = [
                { id: "MIT", name: "MIT License" },
                { id: "Apache-2.0", name: "Apache License 2.0" },
            ];

            const result = await flict.checkCompatibility(licenses);

            expect(result.compatible).toBe(true);
            expect(result.conflicts).toHaveLength(0);
            expect(result.riskLevel).toBe("LOW");
        });

        it("should detect copyleft conflicts", async () => {
            const flict = new FlictIntegration();

            const licenses = [
                { id: "GPL-3.0", name: "GNU General Public License v3.0" },
                { name: "Proprietary" },
            ];

            const result = await flict.checkCompatibility(licenses);

            expect(result.compatible).toBe(false);
            expect(result.conflicts.length).toBeGreaterThan(0);
            expect(result.riskLevel).not.toBe("LOW");
        });

        it("should suggest outbound licenses", async () => {
            const flict = new FlictIntegration();

            const licenses = [
                { id: "MIT", name: "MIT License" },
                { id: "BSD-3-Clause", name: "BSD 3-Clause License" },
            ];

            const result = await flict.checkCompatibility(licenses);

            expect(result.suggestedOutboundLicenses).toBeDefined();
            expect(result.suggestedOutboundLicenses.length).toBeGreaterThan(0);
        });

        it("should generate compatibility matrix", async () => {
            const flict = new FlictIntegration();

            const licenses = ["MIT", "Apache-2.0", "GPL-3.0"];

            const matrix = await flict.generateCompatibilityMatrix(licenses);

            expect(matrix.licenses).toEqual(licenses);
            expect(matrix.matrix).toHaveLength(3);
            expect(matrix.matrix[0]).toHaveLength(3);
        });
    });

    describe("Dependency Recommendations (Req 21.5)", () => {
        it("should generate update recommendations", async () => {
            const recommender = new DependencyRecommendations();

            const components = [
                {
                    type: "library" as const,
                    name: "vulnerable-package",
                    version: "1.0.0",
                    bomRef: "pkg:npm/vulnerable-package@1.0.0",
                },
            ];

            const cveMap = new Map([
                [
                    "pkg:npm/vulnerable-package@1.0.0",
                    [
                        {
                            id: "CVE-2023-12345",
                            source: "NVD" as const,
                            severity: "HIGH" as const,
                            cvssScore: 7.5,
                            description: "Test vulnerability",
                            publishedDate: "2023-01-01",
                            lastModifiedDate: "2023-01-02",
                            affectedVersions: ["1.0.0"],
                            fixedVersions: ["1.0.1"],
                            references: [],
                        },
                    ],
                ],
            ]);

            const report = await recommender.generateRecommendations(components, cveMap);

            expect(report.totalRecommendations).toBeGreaterThan(0);
            expect(report.recommendations[0].currentVersion).toBe("1.0.0");
            expect(report.recommendations[0].recommendedVersion).toBe("1.0.1");
        });

        it("should calculate update priorities correctly", async () => {
            const recommender = new DependencyRecommendations();

            const components = [
                {
                    type: "library" as const,
                    name: "critical-vuln",
                    version: "1.0.0",
                    bomRef: "pkg:npm/critical-vuln@1.0.0",
                },
            ];

            const cveMap = new Map([
                [
                    "pkg:npm/critical-vuln@1.0.0",
                    [
                        {
                            id: "CVE-2023-99999",
                            source: "NVD" as const,
                            severity: "CRITICAL" as const,
                            cvssScore: 9.8,
                            description: "Critical vulnerability",
                            publishedDate: "2023-01-01",
                            lastModifiedDate: "2023-01-02",
                            affectedVersions: ["1.0.0"],
                            fixedVersions: ["1.0.1"],
                            references: [],
                        },
                    ],
                ],
            ]);

            const report = await recommender.generateRecommendations(components, cveMap);

            expect(report.criticalUpdates).toBeGreaterThan(0);
            expect(report.recommendations[0].priority).toBe("CRITICAL");
        });

        it("should complete within 90 seconds", async () => {
            const recommender = new DependencyRecommendations();

            const components = Array.from({ length: 100 }, (_, i) => ({
                type: "library" as const,
                name: `package-${i}`,
                version: "1.0.0",
                bomRef: `pkg:npm/package-${i}@1.0.0`,
            }));

            const cveMap = new Map<string, never[]>();

            const startTime = Date.now();
            const report = await recommender.generateRecommendations(components, cveMap);
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(90000); // 90 seconds
            expect(report.generationTime).toBeLessThan(90000);
        });
    });

    describe("Integration Tests", () => {
        it("should complete full dependency scan workflow", async () => {
            const generator = new SBOMGenerator();
            const scanner = new CVEScanner();
            const flict = new FlictIntegration();
            const recommender = new DependencyRecommendations();

            // Generate SBOM
            const manifest: PackageManifest = {
                type: "npm",
                path: "package.json",
                content: JSON.stringify({
                    dependencies: {
                        express: "^4.18.0",
                    },
                }),
            };

            const sbom = await generator.generateSBOM(manifest, {
                format: "cyclonedx",
                includeLicenses: true,
            });

            expect(sbom.components).toHaveLength(1);

            // Scan for CVEs
            const cveResult = await scanner.scanComponents(sbom.components);
            expect(cveResult.totalComponents).toBe(1);

            // Check license compatibility
            const licenses = sbom.components.flatMap((c) => c.licenses || []);
            const licenseResult = await flict.checkCompatibility(licenses);
            expect(licenseResult).toBeDefined();

            // Generate recommendations
            const cveMap = new Map(
                cveResult.matches.map((m) => [m.component.bomRef || m.component.name, m.cves]),
            );
            const recommendations = await recommender.generateRecommendations(
                sbom.components,
                cveMap,
            );
            expect(recommendations).toBeDefined();
        });
    });
});
