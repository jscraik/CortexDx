import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createCliLogger } from "../logging/logger.js";
import {
  type DependencyTrackConfig,
  DependencyTrackIntegration,
} from "../security/dependency-track-integration.js";
import type { SBOM } from "../security/sbom-generator.js";
import { type PackageManifest, SBOMGenerator } from "../security/sbom-generator.js";
import { safeParseJson } from "../utils/json.js";

const logger = createCliLogger("sbom");

interface SbomCliOptions {
  manifest?: string;
  type?: string;
  format?: "cyclonedx" | "spdx";
  out?: string;
  includeDev?: boolean;
  includeLicenses?: boolean;
  includeHashes?: boolean;
  xml?: boolean;
  dtUrl?: string;
  dtApiKey?: string;
  dtProject?: string;
  dtVersion?: string;
  dtWebhook?: string;
  dtSubscribe?: boolean;
}

const DEFAULT_MANIFEST_CANDIDATES = [
  "package.json",
  "requirements.txt",
  "pom.xml",
];

const TYPE_HINTS: Record<string, PackageManifest["type"]> = {
  "package.json": "npm",
  "package-lock.json": "npm",
  "pnpm-lock.yaml": "npm",
  "yarn.lock": "npm",
  "requirements.txt": "pip",
  "pom.xml": "maven",
};
const SUPPORTED_MANIFEST_TYPES: ReadonlySet<PackageManifest["type"]> = new Set([
  "npm",
  "pip",
  "maven",
]);

export async function runGenerateSbom(opts: SbomCliOptions): Promise<number> {
  try {
    const manifestPath = findManifestPath(opts.manifest);
    if (!manifestPath) {
      logger.error(
        "No manifest found. Specify --manifest or place a package.json/requirements.txt/pom.xml in the working directory."
      );
      return 1;
    }

    const manifestType = detectManifestType(manifestPath, opts.type);
    if (!manifestType) {
      logger.error(
        "Unsupported manifest type. Use --type to specify one of: npm, pip, maven."
      );
      return 1;
    }

    const manifestContent = await readFile(manifestPath, "utf8");
    const manifest: PackageManifest = {
      type: manifestType,
      path: manifestPath,
      content: manifestContent,
    };
    const inferredVersion =
      parseManifestVersion(manifest) ?? new Date().toISOString();

    const generator = new SBOMGenerator();
    const sbom = await generator.generateSBOM(manifest, {
      format: opts.format ?? "cyclonedx",
      includeDevDependencies: Boolean(opts.includeDev),
      includeLicenses: opts.includeLicenses ?? true,
      includeHashes: Boolean(opts.includeHashes),
    });

    const outputDir = await prepareOutputDir(opts.out);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const targetDir = join(
      outputDir,
      manifestType,
      `${sbom.bomFormat.toLowerCase()}-${stamp}`,
    );
    await mkdir(targetDir, { recursive: true });

    const jsonPath = join(targetDir, "sbom.json");
    await writeFile(jsonPath, JSON.stringify(sbom, null, 2), "utf8");

    if (opts.xml || sbom.bomFormat === "CycloneDX") {
      const xmlPath = join(targetDir, "sbom.xml");
      await writeFile(xmlPath, generator.exportToXML(sbom), "utf8");
    }

    const summary = {
      manifest: manifestPath,
      type: manifestType,
      format: sbom.bomFormat,
      specVersion: sbom.specVersion,
      components: sbom.components.length,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(
      join(targetDir, "summary.json"),
      JSON.stringify(summary, null, 2),
      "utf8",
    );

    await maybeUploadToDependencyTrack({
      sbom,
      manifest,
      projectVersion: opts.dtVersion ?? inferredVersion,
      config: resolveDtConfig(opts),
      subscribe: Boolean(opts.dtSubscribe),
      webhook: opts.dtWebhook,
    });

    logger.info(
      `Generated ${sbom.bomFormat} ${sbom.specVersion} SBOM with ${sbom.components.length} components at ${targetDir}`,
      { format: sbom.bomFormat, specVersion: sbom.specVersion, components: sbom.components.length, outputDir: targetDir }
    );
    return 0;
  } catch (error) {
    logger.error(
      `Generation failed: ${error instanceof Error ? error.message : error}`,
      { error }
    );
    return 1;
  }
}

function findManifestPath(provided?: string): string | null {
  if (provided) {
    const absolute = resolve(provided);
    return existsSync(absolute) ? absolute : null;
  }
  for (const candidate of DEFAULT_MANIFEST_CANDIDATES) {
    const absolute = resolve(candidate);
    if (existsSync(absolute)) {
      return absolute;
    }
  }
  return null;
}

export function detectManifestType(
  filePath: string,
  override?: string,
): PackageManifest["type"] | null {
  if (override) {
    const normalized = override.toLowerCase();
    if (SUPPORTED_MANIFEST_TYPES.has(normalized as PackageManifest["type"])) {
      return normalized as PackageManifest["type"];
    }
    return null;
  }

  const basename = filePath.split(/[/\\]/).pop() ?? filePath;
  const mapped = TYPE_HINTS[basename];
  return mapped || null;
}

async function prepareOutputDir(out?: string): Promise<string> {
  const target = resolve(out ?? "reports/sbom");
  await mkdir(target, { recursive: true });
  return target;
}

function resolveDtConfig(opts: SbomCliOptions): DependencyTrackConfig | null {
  const apiUrl =
    opts.dtUrl?.trim() ?? process.env.CORTEXDX_DT_API_URL?.trim() ?? "";
  const apiKey =
    opts.dtApiKey?.trim() ?? process.env.CORTEXDX_DT_API_KEY?.trim() ?? "";
  const projectName =
    opts.dtProject?.trim() ?? process.env.CORTEXDX_DT_PROJECT?.trim();
  const projectVersion =
    opts.dtVersion?.trim() ?? process.env.CORTEXDX_DT_PROJECT_VERSION?.trim();
  if (!apiUrl || !apiKey || !projectName) {
    return null;
  }
  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    apiKey,
    projectName,
    projectVersion,
  };
}

async function maybeUploadToDependencyTrack(params: {
  sbom: SBOM;
  manifest: PackageManifest;
  projectVersion: string;
  config: DependencyTrackConfig | null;
  subscribe: boolean;
  webhook?: string;
}): Promise<void> {
  if (!params.config) {
    return;
  }
  try {
    const integration = new DependencyTrackIntegration(params.config);
    const projectName = params.config.projectName ?? params.manifest.path;
    const version = params.config.projectVersion ?? params.projectVersion;
    const project =
      (await integration.getProjectByNameAndVersion(projectName, version)) ??
      (await integration.createProject(projectName, version));
    const upload = await integration.uploadSBOM(project.uuid, params.sbom);
    logger.info(
      `Uploaded to Dependency Track project ${project.name}@${project.version} (token=${upload.token})`,
      { project: project.name, version: project.version, token: upload.token }
    );
    if (params.subscribe && params.webhook) {
      await integration.subscribeToAlerts(project.uuid, params.webhook);
      logger.info("Subscribed Dependency Track project to webhook.", { webhook: params.webhook });
    }
  } catch (error) {
    logger.warn(
      `Dependency Track upload failed: ${error instanceof Error ? error.message : String(error)}`,
      { error }
    );
  }
}
function parseManifestVersion(manifest: PackageManifest): string | undefined {
  if (manifest.type === "npm") {
    const parsed = safeParseJson<{ version?: string }>(
      manifest.content,
      "sbom manifest",
    );
    return parsed.version;
  }
  return undefined;
}
