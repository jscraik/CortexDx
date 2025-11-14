/**
 * SBOM Generator
 * Generates Software Bill of Materials in CycloneDX and SPDX formats
 * Requirement: 21.1
 */

export interface SBOM {
  bomFormat: "CycloneDX" | "SPDX";
  specVersion: string;
  version: number;
  serialNumber?: string;
  metadata: SBOMMetadata;
  components: Component[];
  dependencies: DependencyRelationship[];
}

export interface SBOMMetadata {
  timestamp: string;
  tools: Tool[];
  component?: Component;
  authors?: Author[];
  supplier?: OrganizationalEntity;
  manufacturer?: OrganizationalEntity;
}

export interface Tool {
  vendor?: string;
  name: string;
  version?: string;
}

export interface Author {
  name: string;
  email?: string;
}

export interface OrganizationalEntity {
  name: string;
  url?: string[];
  contact?: OrganizationalContact[];
}

export interface OrganizationalContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface Component {
  type:
    | "library"
    | "framework"
    | "application"
    | "container"
    | "operating-system"
    | "device"
    | "firmware"
    | "file";
  bomRef?: string;
  supplier?: OrganizationalEntity;
  author?: string;
  publisher?: string;
  group?: string;
  name: string;
  version: string;
  description?: string;
  scope?: "required" | "optional";
  hashes?: Hash[];
  licenses?: License[];
  copyright?: string;
  cpe?: string;
  purl?: string;
  externalReferences?: ExternalReference[];
  properties?: Property[];
}

export interface Hash {
  alg:
    | "MD5"
    | "SHA-1"
    | "SHA-256"
    | "SHA-384"
    | "SHA-512"
    | "SHA3-256"
    | "SHA3-384"
    | "SHA3-512"
    | "BLAKE2b-256"
    | "BLAKE2b-384"
    | "BLAKE2b-512"
    | "BLAKE3";
  content: string;
}

export interface License {
  id?: string;
  name?: string;
  text?: LicenseText;
  url?: string;
}

export interface LicenseText {
  contentType?: string;
  encoding?: string;
  content: string;
}

export interface ExternalReference {
  type:
    | "vcs"
    | "issue-tracker"
    | "website"
    | "advisories"
    | "bom"
    | "mailing-list"
    | "social"
    | "chat"
    | "documentation"
    | "support"
    | "distribution"
    | "license"
    | "build-meta"
    | "build-system"
    | "release-notes"
    | "other";
  url: string;
  comment?: string;
  hashes?: Hash[];
}

export interface Property {
  name: string;
  value: string;
}

export interface DependencyRelationship {
  ref: string;
  dependsOn?: string[];
}

export interface PackageManifest {
  type:
    | "npm"
    | "pip"
    | "maven";
  path: string;
  content: string;
}

export interface SBOMGenerationOptions {
  format: "cyclonedx" | "spdx";
  specVersion?: string;
  includeDevDependencies?: boolean;
  includeLicenses?: boolean;
  includeHashes?: boolean;
  includeVulnerabilities?: boolean;
}

/**
 * SBOM Generator class
 */
export class SBOMGenerator {
  /**
   * Generate SBOM from package manifest
   */
  async generateSBOM(
    manifest: PackageManifest,
    options: SBOMGenerationOptions = { format: "cyclonedx" },
  ): Promise<SBOM> {
    const components = await this.parseManifest(manifest, options);
    const dependencies = this.buildDependencyGraph(components);

    const sbom: SBOM = {
      bomFormat: options.format === "spdx" ? "SPDX" : "CycloneDX",
      specVersion:
        options.specVersion || (options.format === "spdx" ? "SPDX-2.3" : "1.5"),
      version: 1,
      serialNumber: this.generateSerialNumber(),
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [
          {
            vendor: "brAInwav",
            name: "CortexDx Dependency Scanner",
            version: "1.0.0",
          },
        ],
      },
      components,
      dependencies,
    };

    return sbom;
  }

  /**
   * Parse package manifest and extract components
   */
  private async parseManifest(
    manifest: PackageManifest,
    options: SBOMGenerationOptions,
  ): Promise<Component[]> {
    switch (manifest.type) {
      case "npm":
        return this.parseNpmManifest(manifest, options);
      case "pip":
        return this.parsePipManifest(manifest, options);
      case "maven":
        return this.parseMavenManifest(manifest, options);
      default:
        throw new Error(`Unsupported manifest type: ${manifest.type}`);
    }
  }

  /**
   * Parse npm package.json
   */
  private async parseNpmManifest(
    manifest: PackageManifest,
    options: SBOMGenerationOptions,
  ): Promise<Component[]> {
    const components: Component[] = [];

    try {
      const packageJson = JSON.parse(manifest.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        name?: string;
        version?: string;
      };

      // Parse production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(
          packageJson.dependencies,
        )) {
          components.push(
            this.createNpmComponent(name, version, "required", options),
          );
        }
      }

      // Parse dev dependencies if requested
      if (options.includeDevDependencies && packageJson.devDependencies) {
        for (const [name, version] of Object.entries(
          packageJson.devDependencies,
        )) {
          components.push(
            this.createNpmComponent(name, version, "optional", options),
          );
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to parse npm manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return components;
  }

  /**
   * Create npm component
   */
  private createNpmComponent(
    name: string,
    version: string,
    scope: "required" | "optional",
    options: SBOMGenerationOptions,
  ): Component {
    const cleanVersion = version.replace(/^[\^~]/, "");
    const bomRef = `pkg:npm/${name}@${cleanVersion}`;

    const component: Component = {
      type: "library",
      bomRef,
      name,
      version: cleanVersion,
      scope,
      purl: bomRef,
      externalReferences: [
        {
          type: "distribution",
          url: `https://registry.npmjs.org/${name}/-/${name}-${cleanVersion}.tgz`,
        },
        {
          type: "website",
          url: `https://www.npmjs.com/package/${name}`,
        },
      ],
    };

    // Add licenses if requested
    if (options.includeLicenses) {
      component.licenses = [
        {
          id: "UNKNOWN",
          name: "License information not available in manifest",
        },
      ];
    }

    return component;
  }

  /**
   * Parse pip requirements.txt
   */
  private async parsePipManifest(
    manifest: PackageManifest,
    options: SBOMGenerationOptions,
  ): Promise<Component[]> {
    const components: Component[] = [];

    try {
      const lines = manifest.content.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const match = trimmed.match(/^([a-zA-Z0-9_-]+)([=<>!]+)(.+)$/);
        if (match?.[1] && match?.[3]) {
          const name = match[1];
          const version = match[3];
          components.push(this.createPipComponent(name, version, options));
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to parse pip manifest: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return components;
  }

  /**
   * Create pip component
   */
  private createPipComponent(
    name: string,
    version: string,
    options: SBOMGenerationOptions,
  ): Component {
    const bomRef = `pkg:pypi/${name}@${version}`;

    const component: Component = {
      type: "library",
      bomRef,
      name,
      version,
      scope: "required",
      purl: bomRef,
      externalReferences: [
        {
          type: "distribution",
          url: `https://pypi.org/project/${name}/${version}/`,
        },
      ],
    };

    if (options.includeLicenses) {
      component.licenses = [
        {
          id: "UNKNOWN",
          name: "License information not available in manifest",
        },
      ];
    }

    return component;
  }

  /**
   * Parse Maven pom.xml
   */
  private async parseMavenManifest(
    manifest: PackageManifest,
    options: SBOMGenerationOptions,
  ): Promise<Component[]> {
    const components: Component[] = [];

    // Basic XML parsing for Maven dependencies
    // In production, use a proper XML parser
    const dependencyMatches = Array.from(
      manifest.content.matchAll(
        /<dependency>[\s\S]*?<groupId>(.*?)<\/groupId>[\s\S]*?<artifactId>(.*?)<\/artifactId>[\s\S]*?<version>(.*?)<\/version>[\s\S]*?<\/dependency>/g,
      ),
    );

    for (const match of dependencyMatches) {
      if (match[1] && match[2] && match[3]) {
        const groupId = match[1];
        const artifactId = match[2];
        const version = match[3];
        components.push(
          this.createMavenComponent(groupId, artifactId, version, options),
        );
      }
    }

    return components;
  }

  /**
   * Create Maven component
   */
  private createMavenComponent(
    groupId: string,
    artifactId: string,
    version: string,
    options: SBOMGenerationOptions,
  ): Component {
    const bomRef = `pkg:maven/${groupId}/${artifactId}@${version}`;

    const component: Component = {
      type: "library",
      bomRef,
      group: groupId,
      name: artifactId,
      version,
      scope: "required",
      purl: bomRef,
      externalReferences: [
        {
          type: "distribution",
          url: `https://repo1.maven.org/maven2/${groupId.replace(/\./g, "/")}/${artifactId}/${version}/`,
        },
      ],
    };

    if (options.includeLicenses) {
      component.licenses = [
        {
          id: "UNKNOWN",
          name: "License information not available in manifest",
        },
      ];
    }

    return component;
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(
    components: Component[],
  ): DependencyRelationship[] {
    const dependencies: DependencyRelationship[] = [];

    for (const component of components) {
      if (component.bomRef) {
        dependencies.push({
          ref: component.bomRef,
          dependsOn: [],
        });
      }
    }

    return dependencies;
  }

  /**
   * Generate serial number for SBOM
   */
  private generateSerialNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `urn:uuid:${timestamp}-${random}`;
  }

  /**
   * Export SBOM to JSON string
   */
  exportToJSON(sbom: SBOM): string {
    return JSON.stringify(sbom, null, 2);
  }

  /**
   * Export SBOM to XML string (CycloneDX format)
   */
  exportToXML(sbom: SBOM): string {
    if (sbom.bomFormat !== "CycloneDX") {
      throw new Error("XML export only supported for CycloneDX format");
    }

    // Basic XML generation
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<bom xmlns="http://cyclonedx.org/schema/bom/${sbom.specVersion}" version="${sbom.version}">\n`;

    // Metadata
    xml += "  <metadata>\n";
    xml += `    <timestamp>${sbom.metadata.timestamp}</timestamp>\n`;
    xml += "    <tools>\n";
    for (const tool of sbom.metadata.tools) {
      xml += "      <tool>\n";
      if (tool.vendor) xml += `        <vendor>${tool.vendor}</vendor>\n`;
      xml += `        <name>${tool.name}</name>\n`;
      if (tool.version) xml += `        <version>${tool.version}</version>\n`;
      xml += "      </tool>\n";
    }
    xml += "    </tools>\n";
    xml += "  </metadata>\n";

    // Components
    xml += "  <components>\n";
    for (const component of sbom.components) {
      xml += `    <component type="${component.type}">\n`;
      if (component.group) xml += `      <group>${component.group}</group>\n`;
      xml += `      <name>${component.name}</name>\n`;
      xml += `      <version>${component.version}</version>\n`;
      if (component.purl) xml += `      <purl>${component.purl}</purl>\n`;
      xml += "    </component>\n";
    }
    xml += "  </components>\n";

    xml += "</bom>\n";

    return xml;
  }
}
