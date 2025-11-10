/**
 * Dependency Update Recommendations
 * Analyzes security impact and breaking changes for dependency updates
 * Requirement: 21.5
 */

import type { CVE } from "./cve-scanner.js";
import type { Component } from "./sbom-generator.js";

export interface UpdateRecommendation {
  component: Component;
  currentVersion: string;
  recommendedVersion: string;
  updateType: "MAJOR" | "MINOR" | "PATCH";
  securityImpact: SecurityImpact;
  breakingChanges: BreakingChange[];
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  estimatedEffort: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string;
}

export interface SecurityImpact {
  cvesFixed: CVE[];
  riskReduction: number;
  severityImprovement: string;
}

export interface BreakingChange {
  type: "API" | "BEHAVIOR" | "DEPENDENCY" | "CONFIGURATION";
  description: string;
  affectedAreas: string[];
  migrationGuide?: string;
}

export interface DependencyUpdateReport {
  totalRecommendations: number;
  criticalUpdates: number;
  highPriorityUpdates: number;
  mediumPriorityUpdates: number;
  lowPriorityUpdates: number;
  recommendations: UpdateRecommendation[];
  generationTime: number;
}

/**
 * Dependency Recommendations Engine
 */
export class DependencyRecommendations {
  /**
   * Generate update recommendations for components with CVEs
   */
  async generateRecommendations(
    components: Component[],
    cveMap: Map<string, CVE[]>,
  ): Promise<DependencyUpdateReport> {
    const startTime = Date.now();
    const recommendations: UpdateRecommendation[] = [];

    for (const component of components) {
      const cves = cveMap.get(component.bomRef || component.name) || [];

      if (cves.length > 0) {
        const recommendation = await this.createRecommendation(component, cves);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const generationTime = Date.now() - startTime;

    return {
      totalRecommendations: recommendations.length,
      criticalUpdates: recommendations.filter((r) => r.priority === "CRITICAL")
        .length,
      highPriorityUpdates: recommendations.filter((r) => r.priority === "HIGH")
        .length,
      mediumPriorityUpdates: recommendations.filter(
        (r) => r.priority === "MEDIUM",
      ).length,
      lowPriorityUpdates: recommendations.filter((r) => r.priority === "LOW")
        .length,
      recommendations,
      generationTime,
    };
  }

  /**
   * Create update recommendation for a component
   */
  private async createRecommendation(
    component: Component,
    cves: CVE[],
  ): Promise<UpdateRecommendation | null> {
    // Find the recommended version (highest fixed version)
    const fixedVersions = this.extractFixedVersions(cves);
    if (fixedVersions.length === 0) {
      return null;
    }

    const recommendedVersion = this.selectRecommendedVersion(
      component.version,
      fixedVersions,
    );

    if (!recommendedVersion) {
      return null;
    }

    const updateType = this.determineUpdateType(
      component.version,
      recommendedVersion,
    );
    const securityImpact = this.analyzeSecurityImpact(cves);
    const breakingChanges = await this.detectBreakingChanges(
      component,
      component.version,
      recommendedVersion,
    );
    const priority = this.calculatePriority(
      securityImpact,
      updateType,
      breakingChanges,
    );
    const estimatedEffort = this.estimateEffort(updateType, breakingChanges);
    const reasoning = this.generateReasoning(
      component,
      cves,
      updateType,
      securityImpact,
      breakingChanges,
    );

    return {
      component,
      currentVersion: component.version,
      recommendedVersion,
      updateType,
      securityImpact,
      breakingChanges,
      priority,
      estimatedEffort,
      reasoning,
    };
  }

  /**
   * Extract fixed versions from CVEs
   */
  private extractFixedVersions(cves: CVE[]): string[] {
    const versions = new Set<string>();

    for (const cve of cves) {
      for (const version of cve.fixedVersions) {
        versions.add(version);
      }
    }

    return Array.from(versions);
  }

  /**
   * Select recommended version from fixed versions
   */
  private selectRecommendedVersion(
    currentVersion: string,
    fixedVersions: string[],
  ): string | null {
    // Sort versions and select the latest
    const sorted = fixedVersions.sort((a, b) => this.compareVersions(a, b));
    const latest = sorted[sorted.length - 1];

    // Only recommend if it's newer than current
    if (this.compareVersions(latest, currentVersion) > 0) {
      return latest;
    }

    return null;
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1
      .split(".")
      .map((p) => Number.parseInt(p.replace(/\D/g, ""), 10) || 0);
    const parts2 = v2
      .split(".")
      .map((p) => Number.parseInt(p.replace(/\D/g, ""), 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }

  /**
   * Determine update type (MAJOR, MINOR, PATCH)
   */
  private determineUpdateType(
    currentVersion: string,
    recommendedVersion: string,
  ): "MAJOR" | "MINOR" | "PATCH" {
    const current = currentVersion
      .split(".")
      .map((p) => Number.parseInt(p.replace(/\D/g, ""), 10) || 0);
    const recommended = recommendedVersion
      .split(".")
      .map((p) => Number.parseInt(p.replace(/\D/g, ""), 10) || 0);

    if (current[0] !== recommended[0]) return "MAJOR";
    if (current[1] !== recommended[1]) return "MINOR";
    return "PATCH";
  }

  /**
   * Analyze security impact of update
   */
  private analyzeSecurityImpact(cves: CVE[]): SecurityImpact {
    const criticalCVEs = cves.filter((c) => c.severity === "CRITICAL").length;
    const highCVEs = cves.filter((c) => c.severity === "HIGH").length;
    const mediumCVEs = cves.filter((c) => c.severity === "MEDIUM").length;

    let riskReduction = 0;
    riskReduction += criticalCVEs * 25;
    riskReduction += highCVEs * 15;
    riskReduction += mediumCVEs * 8;

    let severityImprovement = "";
    if (criticalCVEs > 0) {
      severityImprovement = `Fixes ${criticalCVEs} critical vulnerabilities`;
    } else if (highCVEs > 0) {
      severityImprovement = `Fixes ${highCVEs} high-severity vulnerabilities`;
    } else {
      severityImprovement = `Fixes ${mediumCVEs} medium-severity vulnerabilities`;
    }

    return {
      cvesFixed: cves,
      riskReduction,
      severityImprovement,
    };
  }

  /**
   * Detect breaking changes between versions
   */
  private async detectBreakingChanges(
    component: Component,
    currentVersion: string,
    recommendedVersion: string,
  ): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];

    // Determine update type
    const updateType = this.determineUpdateType(
      currentVersion,
      recommendedVersion,
    );

    // Major version updates typically have breaking changes
    if (updateType === "MAJOR") {
      breakingChanges.push({
        type: "API",
        description: "Major version update may include breaking API changes",
        affectedAreas: ["API", "Interfaces", "Behavior"],
        migrationGuide: `Review ${component.name} changelog for migration guide`,
      });
    }

    // Check for known breaking changes (placeholder)
    // In production, this would query a database or API for known breaking changes

    return breakingChanges;
  }

  /**
   * Calculate update priority
   */
  private calculatePriority(
    securityImpact: SecurityImpact,
    updateType: "MAJOR" | "MINOR" | "PATCH",
    breakingChanges: BreakingChange[],
  ): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
    const criticalCVEs = securityImpact.cvesFixed.filter(
      (c) => c.severity === "CRITICAL",
    ).length;
    const highCVEs = securityImpact.cvesFixed.filter(
      (c) => c.severity === "HIGH",
    ).length;

    // Critical CVEs = Critical priority
    if (criticalCVEs > 0) return "CRITICAL";

    // High CVEs with patch/minor update = High priority
    if (highCVEs > 0 && updateType !== "MAJOR") return "HIGH";

    // High CVEs with major update = Medium priority (due to breaking changes)
    if (highCVEs > 0 && updateType === "MAJOR") return "MEDIUM";

    // Medium CVEs or patch updates = Medium priority
    if (securityImpact.cvesFixed.length > 0 && updateType === "PATCH")
      return "MEDIUM";

    return "LOW";
  }

  /**
   * Estimate effort required for update
   */
  private estimateEffort(
    updateType: "MAJOR" | "MINOR" | "PATCH",
    breakingChanges: BreakingChange[],
  ): "LOW" | "MEDIUM" | "HIGH" {
    if (updateType === "PATCH" && breakingChanges.length === 0) return "LOW";
    if (updateType === "MINOR" && breakingChanges.length === 0) return "LOW";
    if (updateType === "MINOR" && breakingChanges.length > 0) return "MEDIUM";
    if (updateType === "MAJOR" && breakingChanges.length === 0) return "MEDIUM";
    return "HIGH";
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(
    component: Component,
    cves: CVE[],
    updateType: "MAJOR" | "MINOR" | "PATCH",
    securityImpact: SecurityImpact,
    breakingChanges: BreakingChange[],
  ): string {
    const parts: string[] = [];

    parts.push(
      `Update ${component.name} from ${component.version} to fix ${cves.length} vulnerabilities.`,
    );

    parts.push(securityImpact.severityImprovement);

    if (updateType === "PATCH") {
      parts.push("This is a patch update with minimal risk.");
    } else if (updateType === "MINOR") {
      parts.push("This is a minor update with low risk.");
    } else {
      parts.push("This is a major update that may require code changes.");
    }

    if (breakingChanges.length > 0) {
      parts.push(
        `${breakingChanges.length} potential breaking changes detected. Review changelog before updating.`,
      );
    }

    return parts.join(" ");
  }
}
