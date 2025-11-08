/**
 * OWASP Dependency Track Integration
 * Uploads SBOMs and queries vulnerability data
 * Requirement: 21.2
 */

import type { SBOM } from "./sbom-generator.js";

export interface DependencyTrackConfig {
  apiUrl: string;
  apiKey: string;
  projectName?: string;
  projectVersion?: string;
}

export interface Project {
  uuid: string;
  name: string;
  version: string;
  active: boolean;
}

export interface Vulnerability {
  uuid: string;
  vulnId: string;
  source: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNASSIGNED";
  cvssV3Score?: number;
  description: string;
  recommendation?: string;
  affectedComponents: string[];
}

export interface ProjectMetrics {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unassigned: number;
  vulnerabilities: number;
  components: number;
  suppressed: number;
  findingsTotal: number;
  findingsAudited: number;
  findingsUnaudited: number;
  inheritedRiskScore: number;
}

export interface UploadResult {
  token: string;
  success: boolean;
  message?: string;
}

export interface Subscription {
  uuid: string;
  webhook: string;
  active: boolean;
}

/**
 * OWASP Dependency Track Integration class
 */
export class DependencyTrackIntegration {
  private config: DependencyTrackConfig;

  constructor(config: DependencyTrackConfig) {
    this.config = config;
  }

  /**
   * Create a new project in Dependency Track
   */
  async createProject(name: string, version: string): Promise<Project> {
    const response = await this.request<Project>("/api/v1/project", {
      method: "PUT",
      body: JSON.stringify({
        name,
        version,
        classifier: "APPLICATION",
        active: true,
      }),
    });

    return response;
  }

  /**
   * Upload SBOM to Dependency Track
   */
  async uploadSBOM(projectId: string, sbom: SBOM): Promise<UploadResult> {
    const sbomBase64 = Buffer.from(JSON.stringify(sbom)).toString("base64");

    const response = await this.request<{ token: string }>("/api/v1/bom", {
      method: "PUT",
      body: JSON.stringify({
        project: projectId,
        bom: sbomBase64,
      }),
    });

    return {
      token: response.token,
      success: true,
      message: "SBOM uploaded successfully",
    };
  }

  /**
   * Get vulnerabilities for a project
   */
  async getVulnerabilities(projectId: string): Promise<Vulnerability[]> {
    const response = await this.request<Vulnerability[]>(
      `/api/v1/vulnerability/project/${projectId}`,
    );

    return response;
  }

  /**
   * Get project metrics
   */
  async getMetrics(projectId: string): Promise<ProjectMetrics> {
    const response = await this.request<ProjectMetrics>(
      `/api/v1/metrics/project/${projectId}/current`,
    );

    return response;
  }

  /**
   * Subscribe to project alerts
   */
  async subscribeToAlerts(
    projectId: string,
    webhook: string,
  ): Promise<Subscription> {
    const response = await this.request<Subscription>(
      "/api/v1/notification/rule",
      {
        method: "PUT",
        body: JSON.stringify({
          name: `Insula MCP Alert - ${projectId}`,
          scope: "PORTFOLIO",
          notificationLevel: "INFORMATIONAL",
          projects: [{ uuid: projectId }],
          notifyOn: ["NEW_VULNERABILITY", "NEW_VULNERABLE_DEPENDENCY"],
          publisher: {
            name: "Webhook",
            publisherClass:
              "org.dependencytrack.notification.publisher.WebhookPublisher",
            template: webhook,
          },
        }),
      },
    );

    return response;
  }

  /**
   * Get project by name and version
   */
  async getProjectByNameAndVersion(
    name: string,
    version: string,
  ): Promise<Project | null> {
    try {
      const response = await this.request<Project[]>("/api/v1/project");
      const project = response.find(
        (p) => p.name === name && p.version === version,
      );
      return project || null;
    } catch {
      return null;
    }
  }

  /**
   * Make HTTP request to Dependency Track API
   */
  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;

    const headers: Record<string, string> = {
      "X-Api-Key": this.config.apiKey,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Dependency Track API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }
}
