import type { VersionInfo } from "@brainwav/cortexdx-core";

export interface VersionManager {
  /**
   * Get list of available versions
   */
  getVersions(): Promise<VersionInfo[]>;

  /**
   * Get the latest available version
   */
  getLatestVersion(): Promise<VersionInfo>;

  /**
   * Check if a version is supported/valid
   */
  isValidVersion(version: string): Promise<boolean>;

  /**
   * Compare two versions
   * @returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  compare(v1: string, v2: string): number;

  /**
   * Resolve a version alias (e.g., "latest", "stable") to a specific version
   */
  resolveVersion(alias: string): Promise<string>;
}

export class SemverVersionManager implements VersionManager {
  private versions: VersionInfo[] = [];
  private lastFetch = 0;
  private readonly ttl = 1000 * 60 * 60; // 1 hour

  constructor(private fetchVersions: () => Promise<VersionInfo[]>) {}

  async getVersions(): Promise<VersionInfo[]> {
    if (Date.now() - this.lastFetch > this.ttl || this.versions.length === 0) {
      this.versions = await this.fetchVersions();
      this.lastFetch = Date.now();
      // Sort descending
      this.versions.sort((a, b) => this.compare(b.version, a.version));
    }
    return this.versions;
  }

  async getLatestVersion(): Promise<VersionInfo> {
    const versions = await this.getVersions();
    const latest = versions.find((v) => v.isLatest) || versions[0];
    if (!latest) throw new Error("No versions available");
    return latest;
  }

  async isValidVersion(version: string): Promise<boolean> {
    const versions = await this.getVersions();
    return versions.some((v) => v.version === version);
  }

  compare(v1: string, v2: string): number {
    // Simple date-based comparison (YYYY-MM-DD) or SemVer
    // Assuming YYYY-MM-DD for MCP specs based on context, but could be semver
    return v1.localeCompare(v2);
  }

  async resolveVersion(alias: string): Promise<string> {
    if (alias === "latest") {
      const latest = await this.getLatestVersion();
      return latest.version;
    }
    // Add more aliases if needed
    return alias;
  }
}
