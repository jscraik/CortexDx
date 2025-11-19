/**
 * flict License Compatibility Checker Integration
 * Checks license compatibility and detects conflicts
 * Requirement: 21.4
 */

import type { License } from "./sbom-generator.js";

export interface LicenseCompatibilityResult {
  compatible: boolean;
  conflicts: LicenseConflict[];
  suggestedOutboundLicenses: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  recommendations: string[];
}

export interface LicenseConflict {
  license1: string;
  license2: string;
  conflictType: "INCOMPATIBLE" | "COPYLEFT_CONFLICT" | "PROPRIETARY_CONFLICT";
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  resolution?: string;
}

export interface CompatibilityMatrix {
  licenses: string[];
  matrix: boolean[][];
  conflicts: LicenseConflict[];
}

export interface FlictConfig {
  strictMode?: boolean;
  allowedLicenses?: string[];
  forbiddenLicenses?: string[];
  outboundLicense?: string;
}

/**
 * flict License Compatibility Checker Integration
 */
export class FlictIntegration {
  private config: FlictConfig;

  constructor(config: FlictConfig = {}) {
    this.config = config;
  }

  /**
   * Check license compatibility for a set of licenses
   */
  async checkCompatibility(
    licenses: License[],
  ): Promise<LicenseCompatibilityResult> {
    const licenseIds = this.extractLicenseIds(licenses);
    const conflicts = await this.detectConflicts(licenseIds);
    const suggestedOutboundLicenses =
      await this.suggestOutboundLicense(licenseIds);
    const riskLevel = this.calculateRiskLevel(conflicts);
    const recommendations = this.generateRecommendations(conflicts, licenseIds);

    return {
      compatible: conflicts.length === 0,
      conflicts,
      suggestedOutboundLicenses,
      riskLevel,
      recommendations,
    };
  }

  /**
   * Suggest outbound licenses based on inbound licenses
   */
  async suggestOutboundLicense(licenses: string[]): Promise<string[]> {
    const suggestions: string[] = [];

    // Check for copyleft licenses
    const copyleftLicenses = licenses.filter((l) => this.isCopyleft(l));

    if (copyleftLicenses.length > 0) {
      // If any copyleft license is present, suggest the most restrictive one
      const mostRestrictive = this.getMostRestrictiveLicense(copyleftLicenses);
      suggestions.push(mostRestrictive);
    } else {
      // If no copyleft licenses, suggest permissive licenses
      suggestions.push("MIT", "Apache-2.0", "BSD-3-Clause");
    }

    // If outbound license is configured, check compatibility
    if (this.config.outboundLicense) {
      const compatible = await this.isOutboundLicenseCompatible(
        licenses,
        this.config.outboundLicense,
      );
      if (compatible) {
        suggestions.unshift(this.config.outboundLicense);
      }
    }

    // Use a more compatible way to remove duplicates
    return Array.from(new Set(suggestions));
  }

  /**
   * Detect license conflicts
   */
  async detectConflicts(licenses: string[]): Promise<LicenseConflict[]> {
    const conflicts: LicenseConflict[] = [];

    // Check for forbidden licenses
    if (this.config.forbiddenLicenses) {
      for (const license of licenses) {
        if (this.config.forbiddenLicenses.includes(license)) {
          conflicts.push({
            license1: license,
            license2: "POLICY",
            conflictType: "PROPRIETARY_CONFLICT",
            description: `License ${license} is forbidden by organizational policy`,
            severity: "CRITICAL",
            resolution: `Remove dependency with ${license} license or obtain approval`,
          });
        }
      }
    }

    // Check for copyleft conflicts
    const copyleftLicenses = licenses.filter((l) => this.isCopyleft(l));
    const proprietaryLicenses = licenses.filter((l) => this.isProprietary(l));

    if (copyleftLicenses.length > 0 && proprietaryLicenses.length > 0) {
      for (const copyleft of copyleftLicenses) {
        for (const proprietary of proprietaryLicenses) {
          conflicts.push({
            license1: copyleft,
            license2: proprietary,
            conflictType: "COPYLEFT_CONFLICT",
            description: `Copyleft license ${copyleft} conflicts with proprietary license ${proprietary}`,
            severity: "HIGH",
            resolution:
              "Consider dual-licensing or removing one of the conflicting dependencies",
          });
        }
      }
    }

    // Check for incompatible copyleft licenses
    if (copyleftLicenses.length > 1) {
      const incompatible =
        this.findIncompatibleCopyleftLicenses(copyleftLicenses);
      conflicts.push(...incompatible);
    }

    return conflicts;
  }

  /**
   * Generate compatibility matrix
   */
  async generateCompatibilityMatrix(
    licenses: string[],
  ): Promise<CompatibilityMatrix> {
    const n = licenses.length;
    const matrix: boolean[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(true));

    const conflicts: LicenseConflict[] = [];

    // Use a more explicit approach to avoid TypeScript errors
    for (let i = 0; i < n && i < licenses.length; i++) {
      const license1 = licenses[i];
      // Skip if license1 is undefined
      if (license1 === undefined) {
        continue;
      }

      for (let j = i + 1; j < n && j < licenses.length; j++) {
        const license2 = licenses[j];
        // Skip if license2 is undefined
        if (license2 === undefined) {
          continue;
        }

        const compatible = await this.areLicensesCompatible(license1, license2);

        // Use a safer way to access matrix elements
        const rowI = matrix[i];
        const rowJ = matrix[j];
        if (rowI !== undefined && rowJ !== undefined) {
          rowI[j] = compatible;
          rowJ[i] = compatible;
        }

        if (!compatible) {
          conflicts.push({
            license1,
            license2,
            conflictType: "INCOMPATIBLE",
            description: `${license1} and ${license2} are incompatible`,
            severity: "HIGH",
          });
        }
      }
    }

    return {
      licenses,
      matrix,
      conflicts,
    };
  }

  /**
   * Check if two licenses are compatible
   */
  private async areLicensesCompatible(
    license1: string,
    license2: string,
  ): Promise<boolean> {
    // Simplified compatibility check
    // In production, use flict binary or comprehensive compatibility database

    // Same license is always compatible
    if (license1 === license2) return true;

    // Permissive licenses are generally compatible with each other
    if (this.isPermissive(license1) && this.isPermissive(license2)) return true;

    // Copyleft licenses may not be compatible with each other
    if (this.isCopyleft(license1) && this.isCopyleft(license2)) {
      return this.areCopyleftLicensesCompatible(license1, license2);
    }

    // Permissive licenses are compatible with copyleft
    if (this.isPermissive(license1) && this.isCopyleft(license2)) return true;
    if (this.isCopyleft(license1) && this.isPermissive(license2)) return true;

    // Proprietary licenses are generally incompatible with copyleft
    if (this.isProprietary(license1) && this.isCopyleft(license2)) return false;
    if (this.isCopyleft(license1) && this.isProprietary(license2)) return false;

    return true;
  }

  /**
   * Check if license is copyleft
   */
  private isCopyleft(license: string): boolean {
    const copyleftLicenses = [
      "GPL-2.0",
      "GPL-3.0",
      "AGPL-3.0",
      "LGPL-2.1",
      "LGPL-3.0",
      "MPL-2.0",
      "EPL-1.0",
      "EPL-2.0",
      "CDDL-1.0",
      "EUPL-1.2",
    ];

    return copyleftLicenses.some((cl) => license.includes(cl));
  }

  /**
   * Check if license is permissive
   */
  private isPermissive(license: string): boolean {
    const permissiveLicenses = [
      "MIT",
      "Apache-2.0",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "ISC",
      "0BSD",
      "Unlicense",
      "CC0-1.0",
    ];

    return permissiveLicenses.some((pl) => license.includes(pl));
  }

  /**
   * Check if license is proprietary
   */
  private isProprietary(license: string): boolean {
    const proprietaryIndicators = [
      "Proprietary",
      "Commercial",
      "Closed",
      "UNLICENSED",
    ];

    return proprietaryIndicators.some((pi) => license.includes(pi));
  }

  /**
   * Check if copyleft licenses are compatible
   */
  private areCopyleftLicensesCompatible(
    license1: string,
    license2: string,
  ): boolean {
    // GPL-3.0 is compatible with LGPL-3.0
    if (
      (license1.includes("GPL-3.0") && license2.includes("LGPL-3.0")) ||
      (license1.includes("LGPL-3.0") && license2.includes("GPL-3.0"))
    ) {
      return true;
    }

    // GPL-2.0 and GPL-3.0 are incompatible
    if (
      (license1.includes("GPL-2.0") && license2.includes("GPL-3.0")) ||
      (license1.includes("GPL-3.0") && license2.includes("GPL-2.0"))
    ) {
      return false;
    }

    // Same family licenses are generally compatible
    if (license1.split("-")[0] === license2.split("-")[0]) {
      return true;
    }

    return false;
  }

  /**
   * Find incompatible copyleft licenses
   */
  private findIncompatibleCopyleftLicenses(
    licenses: string[],
  ): LicenseConflict[] {
    const conflicts: LicenseConflict[] = [];

    for (let i = 0; i < licenses.length; i++) {
      // Ensure we have a valid license at index i
      if (i >= licenses.length) continue;
      const license1 = licenses[i];
      if (license1 === undefined) continue;

      for (let j = i + 1; j < licenses.length; j++) {
        // Ensure we have a valid license at index j
        if (j >= licenses.length) continue;
        const license2 = licenses[j];
        if (license2 === undefined) continue;

        if (!this.areCopyleftLicensesCompatible(license1, license2)) {
          conflicts.push({
            license1,
            license2,
            conflictType: "COPYLEFT_CONFLICT",
            description: `Copyleft licenses ${license1} and ${license2} are incompatible`,
            severity: "HIGH",
            resolution:
              "Choose dependencies with compatible licenses or obtain dual-licensing",
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Get most restrictive license
   */
  private getMostRestrictiveLicense(licenses: string[]): string {
    // Handle empty array case
    if (licenses.length === 0) return "UNKNOWN";

    const restrictiveness = {
      "AGPL-3.0": 5,
      "GPL-3.0": 4,
      "GPL-2.0": 4,
      "LGPL-3.0": 3,
      "LGPL-2.1": 3,
      "MPL-2.0": 2,
      "EPL-2.0": 2,
      "EPL-1.0": 2,
    };

    const firstLicense = licenses[0];
    let mostRestrictive = firstLicense !== undefined ? firstLicense : "UNKNOWN";
    let maxRestriction = 0;

    for (const license of licenses) {
      if (license === undefined) continue;
      for (const [key, value] of Object.entries(restrictiveness)) {
        if (license.includes(key) && value > maxRestriction) {
          maxRestriction = value;
          mostRestrictive = license;
        }
      }
    }

    return mostRestrictive;
  }

  /**
   * Check if outbound license is compatible with inbound licenses
   */
  private async isOutboundLicenseCompatible(
    inboundLicenses: string[],
    outboundLicense: string,
  ): Promise<boolean> {
    for (const inbound of inboundLicenses) {
      const compatible = await this.areLicensesCompatible(
        inbound,
        outboundLicense,
      );
      if (!compatible) return false;
    }
    return true;
  }

  /**
   * Calculate risk level based on conflicts
   */
  private calculateRiskLevel(
    conflicts: LicenseConflict[],
  ): "LOW" | "MEDIUM" | "HIGH" {
    if (conflicts.length === 0) return "LOW";

    const criticalConflicts = conflicts.filter(
      (c) => c.severity === "CRITICAL",
    );
    if (criticalConflicts.length > 0) return "HIGH";

    const highConflicts = conflicts.filter((c) => c.severity === "HIGH");
    if (highConflicts.length > 0) return "HIGH";

    return "MEDIUM";
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    conflicts: LicenseConflict[],
    licenses: string[],
  ): string[] {
    const recommendations: string[] = [];

    if (conflicts.length === 0) {
      recommendations.push("All licenses are compatible. No action required.");
      return recommendations;
    }

    // Add conflict-specific recommendations
    for (const conflict of conflicts) {
      if (conflict.resolution) {
        recommendations.push(conflict.resolution);
      }
    }

    // Add general recommendations
    if (conflicts.some((c) => c.conflictType === "COPYLEFT_CONFLICT")) {
      recommendations.push(
        "Consider using permissive licenses (MIT, Apache-2.0) to avoid copyleft conflicts",
      );
    }

    if (conflicts.some((c) => c.conflictType === "PROPRIETARY_CONFLICT")) {
      recommendations.push(
        "Review organizational licensing policy and obtain necessary approvals",
      );
    }

    // Use a more compatible way to remove duplicates
    return Array.from(new Set(recommendations));
  }

  /**
   * Extract license IDs from License objects
   */
  private extractLicenseIds(licenses: License[]): string[] {
    return licenses
      .map((l) => l.id || l.name || "UNKNOWN")
      .filter((id) => id !== "UNKNOWN");
  }
}
