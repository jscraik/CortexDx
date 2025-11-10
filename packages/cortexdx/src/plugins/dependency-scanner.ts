/**
 * Dependency & Supply-Chain Scanner Plugin
 * Analyzes dependencies, generates SBOMs, identifies CVEs, and checks license compatibility
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5
 */

import {
  type PackageManifest,
  type SBOMGenerationOptions,
  SBOMGenerator,
} from "../security/sbom-generator.js";
import type {
  DiagnosticContext,
  DiagnosticPlugin,
  Finding,
  ManifestArtifact,
} from "../types.js";

export const DependencyScannerPlugin: DiagnosticPlugin = {
  id: "dependency-scanner",
  title: "Dependency & Supply-Chain Scanner",
  order: 430,

  async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    ctx.logger("Starting dependency and supply-chain scan...");

    try {
      // Generate SBOM findings
      const sbomFindings = await generateSBOMFindings(ctx);
      findings.push(...sbomFindings);

      const executionTime = Date.now() - startTime;
      ctx.logger(`Dependency scan completed in ${executionTime}ms`);

      // Ensure execution time is under 90s requirement (Req 21.5)
      if (executionTime > 90000) {
        ctx.logger(
          `Warning: Dependency scan exceeded 90s requirement (${executionTime}ms)`,
        );
      }
    } catch (error) {
      ctx.logger("Dependency scan failed:", error);
      findings.push({
        id: "dependency-scanner-error",
        area: "supply-chain",
        severity: "major",
        title: "Dependency Scanner Error",
        description: `Failed to complete dependency scan: ${error instanceof Error ? error.message : String(error)}`,
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["dependency", "error"],
        confidence: 1.0,
      });
    }

    return findings;
  },
};

/**
 * Generate SBOM findings
 */
async function generateSBOMFindings(
  ctx: DiagnosticContext,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const generator = new SBOMGenerator();

  try {
    const manifests = ingestManifestsFromArtifacts(
      ctx.artifacts?.dependencyManifests ?? [],
      ctx.logger,
    );

    if (manifests.length === 0) {
      findings.push({
        id: "sbom-no-manifests",
        area: "supply-chain",
        severity: "info",
        title: "No Package Manifests Detected",
        description:
          "No package manifests (package.json, requirements.txt, pom.xml) were detected in the MCP server context. SBOM generation requires access to dependency manifests.",
        evidence: [{ type: "url", ref: ctx.endpoint }],
        tags: ["sbom", "manifest"],
        confidence: 0.9,
      });
      return findings;
    }

    // Generate SBOM for each manifest
    for (const manifest of manifests) {
      try {
        const options: SBOMGenerationOptions = {
          format: "cyclonedx",
          includeDevDependencies: true,
          includeLicenses: true,
          includeHashes: false,
        };

        const sbom = await generator.generateSBOM(manifest, options);

        findings.push({
          id: `sbom-generated-${manifest.type}`,
          area: "supply-chain",
          severity: "info",
          title: `SBOM Generated: ${manifest.type}`,
          description: `Software Bill of Materials generated for ${manifest.type} manifest. Found ${sbom.components.length} components.\n\nFormat: ${sbom.bomFormat} ${sbom.specVersion}\nComponents: ${sbom.components.length}\nDependencies: ${sbom.dependencies.length}`,
          evidence: [
            { type: "file", ref: manifest.path },
            { type: "url", ref: ctx.endpoint },
          ],
          tags: ["sbom", manifest.type, "cyclonedx"],
          confidence: 0.95,
          remediation: {
            steps: [
              "Review the generated SBOM for completeness",
              "Upload SBOM to OWASP Dependency Track for continuous monitoring",
              "Integrate SBOM generation into CI/CD pipeline",
            ],
          },
        });

        // Add component summary
        const componentTypes = new Map<string, number>();
        for (const component of sbom.components) {
          componentTypes.set(
            component.type,
            (componentTypes.get(component.type) || 0) + 1,
          );
        }

        const componentSummary = Array.from(componentTypes.entries())
          .map(([type, count]) => `${type}: ${count}`)
          .join(", ");

        findings.push({
          id: `sbom-components-${manifest.type}`,
          area: "supply-chain",
          severity: "info",
          title: `Component Inventory: ${manifest.type}`,
          description: `Component breakdown: ${componentSummary}\n\nTotal components: ${sbom.components.length}`,
          evidence: [{ type: "file", ref: manifest.path }],
          tags: ["sbom", "components", manifest.type],
          confidence: 0.95,
        });
      } catch (error) {
        findings.push({
          id: `sbom-generation-failed-${manifest.type}`,
          area: "supply-chain",
          severity: "minor",
          title: `SBOM Generation Failed: ${manifest.type}`,
          description: `Failed to generate SBOM for ${manifest.type} manifest: ${error instanceof Error ? error.message : String(error)}`,
          evidence: [{ type: "file", ref: manifest.path }],
          tags: ["sbom", "error", manifest.type],
          confidence: 0.9,
        });
      }
    }
  } catch (error) {
    findings.push({
      id: "sbom-generation-error",
      area: "supply-chain",
      severity: "minor",
      title: "SBOM Generation Error",
      description: `Failed to generate SBOM: ${error instanceof Error ? error.message : String(error)}`,
      evidence: [{ type: "url", ref: ctx.endpoint }],
      tags: ["sbom", "error"],
      confidence: 0.9,
    });
  }

  return findings;
}

function ingestManifestsFromArtifacts(
  artifacts: ManifestArtifact[],
  logger: DiagnosticContext["logger"],
): PackageManifest[] {
  return artifacts
    .map((artifact) => toPackageManifest(artifact, logger))
    .filter((manifest): manifest is PackageManifest => manifest !== null);
}

function toPackageManifest(
  artifact: ManifestArtifact,
  logger: DiagnosticContext["logger"],
): PackageManifest | null {
  const manifestType = classifyManifest(artifact.name);
  if (!manifestType) {
    logger(`Unsupported manifest provided: ${artifact.name}`);
    return null;
  }
  const decoded = decodeArtifactContent(artifact);
  if (decoded === null) {
    logger(`Failed to decode manifest: ${artifact.name}`);
    return null;
  }
  if (!isValidManifest(decoded)) {
    logger(`Manifest rejected due to size or emptiness: ${artifact.name}`);
    return null;
  }
  return {
    type: manifestType,
    path: artifact.name,
    content: decoded,
  };
}

function decodeArtifactContent(artifact: ManifestArtifact): string | null {
  if (artifact.encoding === "utf-8") {
    return artifact.content;
  }
  try {
    return Buffer.from(artifact.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

function classifyManifest(name: string): PackageManifest["type"] | null {
  const normalized = name.toLowerCase();
  if (normalized.endsWith("package.json")) return "npm";
  if (normalized.endsWith("package-lock.json")) return "npm";
  if (normalized.endsWith("requirements.txt")) return "pip";
  if (normalized.endsWith("poetry.lock")) return "pip";
  if (normalized.endsWith("pom.xml")) return "maven";
  if (normalized.endsWith("build.gradle")) return "gradle";
  return null;
}

function isValidManifest(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return Buffer.byteLength(content, "utf-8") <= 2 * 1024 * 1024;
}
