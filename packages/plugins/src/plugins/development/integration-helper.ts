/**
 * Integration Helper Plugin
 * Assists with deployment and CI/CD pipeline generation for MCP servers
 * Requirements: 7.1, 7.2, 7.4
 * Performance: Production-ready configuration validation
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "@brainwav/cortexdx-core";

export const IntegrationHelperPlugin: DevelopmentPlugin = {
  id: "integration-helper",
  title: "MCP Integration & Deployment Helper",
  category: "development",
  order: 21,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "integration.llm.missing",
        area: "development",
        severity: "minor",
        title: "Integration assistance LLM not available",
        description: "No LLM adapter configured for deployment assistance.",
        evidence: [{ type: "log", ref: "integration-helper" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered deployment assistance.",
      });
      return findings;
    }

    if (ctx.projectContext) {
      const { type, language, configFiles, sourceFiles } = ctx.projectContext;

      // Check for Docker configuration
      const hasDockerfile = configFiles.some(
        (f) => f.toLowerCase() === "dockerfile",
      );
      const hasDockerCompose = configFiles.some((f) =>
        f.toLowerCase().includes("docker-compose"),
      );

      if (!hasDockerfile && type === "mcp-server") {
        findings.push({
          id: "integration.docker.missing",
          area: "development",
          severity: "minor",
          title: "Missing Docker configuration",
          description: "No Dockerfile found for containerized deployment.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate Docker configuration including:\n" +
            "- Optimized multi-stage Dockerfile\n" +
            "- Docker Compose for local development\n" +
            "- .dockerignore for efficient builds\n" +
            "- Health check configuration\n" +
            "- Environment variable management",
          remediation: {
            filePlan: generateDockerFilePlan(language),
            steps: [
              "Create optimized Dockerfile with multi-stage build",
              "Generate Docker Compose configuration",
              "Add .dockerignore file",
              "Configure health checks and readiness probes",
              "Set up environment variable management",
              "Add Docker build and run scripts",
            ],
          },
        });
      }

      // Check for Kubernetes configuration
      const hasK8sConfig = configFiles.some(
        (f) =>
          f.includes("k8s") ||
          f.includes("kubernetes") ||
          (f.endsWith(".yaml") && f.includes("deployment")),
      );

      if (!hasK8sConfig && hasDockerfile) {
        findings.push({
          id: "integration.k8s.missing",
          area: "development",
          severity: "info",
          title: "Kubernetes deployment configuration available",
          description:
            "Docker configuration exists but no Kubernetes manifests found.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate Kubernetes deployment configuration:\n" +
            "- Deployment manifest with resource limits\n" +
            "- Service configuration for MCP server\n" +
            "- ConfigMap for environment variables\n" +
            "- Secret management setup\n" +
            "- Horizontal Pod Autoscaler (HPA)\n" +
            "- Ingress configuration",
          remediation: {
            filePlan: generateK8sFilePlan(),
            steps: [
              "Create Kubernetes deployment manifest",
              "Generate service configuration",
              "Set up ConfigMap and Secrets",
              "Add resource limits and requests",
              "Configure health checks",
              "Create HPA for auto-scaling",
            ],
          },
        });
      }

      // Check for CI/CD configuration
      const hasCIConfig = configFiles.some(
        (f) =>
          f.includes(".github/workflows") ||
          f.includes(".gitlab-ci") ||
          f.includes("jenkins") ||
          f.includes(".circleci"),
      );

      if (!hasCIConfig) {
        findings.push({
          id: "integration.cicd.missing",
          area: "development",
          severity: "minor",
          title: "Missing CI/CD pipeline configuration",
          description:
            "No continuous integration or deployment pipeline found.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate CI/CD pipeline configuration for:\n" +
            "- GitHub Actions (recommended)\n" +
            "- GitLab CI\n" +
            "- Jenkins\n" +
            "- CircleCI\n\n" +
            "Pipeline will include:\n" +
            "- Automated testing on pull requests\n" +
            "- Code quality checks and linting\n" +
            "- Docker image building and pushing\n" +
            "- Automated deployment to staging/production\n" +
            "- Security scanning and vulnerability checks",
          remediation: {
            filePlan: generateCICDFilePlan("github"),
            steps: [
              "Create CI/CD workflow configuration",
              "Add automated testing jobs",
              "Configure code quality checks",
              "Set up Docker image building",
              "Add deployment automation",
              "Configure security scanning",
            ],
          },
        });
      }

      // Check for production configuration validation
      const hasEnvExample = configFiles.some(
        (f) => f === ".env.example" || f === ".env.template",
      );

      if (!hasEnvExample && sourceFiles.length > 0) {
        findings.push({
          id: "integration.env.missing",
          area: "development",
          severity: "minor",
          title: "Missing environment configuration template",
          description:
            "No .env.example file found for environment variable documentation.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate environment configuration:\n" +
            "- .env.example with all required variables\n" +
            "- Documentation for each variable\n" +
            "- Validation schema for configuration\n" +
            "- Default values for development",
        });
      }

      // Check for deployment documentation
      const hasDeploymentDocs = sourceFiles.some(
        (f) =>
          f.toLowerCase().includes("deploy") &&
          (f.endsWith(".md") || f.endsWith(".txt")),
      );

      if (!hasDeploymentDocs && (hasDockerfile || hasCIConfig)) {
        findings.push({
          id: "integration.docs.missing",
          area: "development",
          severity: "info",
          title: "Missing deployment documentation",
          description:
            "Deployment configuration exists but no deployment guide found.",
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate comprehensive deployment documentation:\n" +
            "- Step-by-step deployment guide\n" +
            "- Environment setup instructions\n" +
            "- Troubleshooting common issues\n" +
            "- Monitoring and logging setup\n" +
            "- Rollback procedures\n" +
            "- Security best practices",
        });
      }

      // Validate production readiness
      if (hasDockerfile || hasCIConfig) {
        const productionChecks = validateProductionReadiness(ctx);
        if (productionChecks.length > 0) {
          findings.push({
            id: "integration.production.validation",
            area: "development",
            severity: "minor",
            title: "Production configuration validation",
            description: `Found ${productionChecks.length} production readiness issues.`,
            evidence: [{ type: "file", ref: "project-root" }],
            recommendation: `Production readiness checks:\n${productionChecks.map((check) => `- ${check}`).join("\n")}\n\nI can help you address these issues to ensure production readiness.`,
          });
        }
      }
    }

    // Check conversation for deployment requests
    const recentMessages = ctx.conversationHistory.slice(-3);
    const hasDeploymentRequest = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("deploy") ||
          msg.content.toLowerCase().includes("docker") ||
          msg.content.toLowerCase().includes("kubernetes") ||
          msg.content.toLowerCase().includes("ci/cd") ||
          msg.content.toLowerCase().includes("production")),
    );

    if (hasDeploymentRequest) {
      findings.push({
        id: "integration.request.detected",
        area: "development",
        severity: "info",
        title: "Deployment assistance request detected",
        description:
          "I can help you set up deployment and CI/CD for your MCP server.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Available deployment options:\n" +
          "- Docker containerization\n" +
          "- Kubernetes orchestration\n" +
          "- CI/CD pipeline setup (GitHub Actions, GitLab CI, etc.)\n" +
          "- Production configuration validation\n" +
          "- Monitoring and logging setup\n\n" +
          "Tell me which deployment option you need or ask me to set up a complete deployment pipeline.",
      });
    }

    // Validate performance
    const duration = Date.now() - startTime;
    ctx.logger(`Integration helper analysis completed in ${duration}ms`);

    return findings;
  },
};

function generateDockerFilePlan(language: string): FilePlan {
  const plan: FilePlan = [];

  plan.push(
    {
      action: "new",
      path: "Dockerfile",
      description: `Optimized multi-stage Dockerfile for ${language}`,
    },
    {
      action: "new",
      path: "docker-compose.yml",
      description: "Docker Compose for local development",
    },
    {
      action: "new",
      path: ".dockerignore",
      description: "Docker ignore patterns for efficient builds",
    },
  );

  return plan;
}

function generateK8sFilePlan(): FilePlan {
  const plan: FilePlan = [];

  plan.push(
    {
      action: "new",
      path: "k8s/deployment.yaml",
      description: "Kubernetes deployment manifest",
    },
    {
      action: "new",
      path: "k8s/service.yaml",
      description: "Kubernetes service configuration",
    },
    {
      action: "new",
      path: "k8s/configmap.yaml",
      description: "ConfigMap for environment variables",
    },
    {
      action: "new",
      path: "k8s/secret.yaml",
      description: "Secret management configuration",
    },
    {
      action: "new",
      path: "k8s/hpa.yaml",
      description: "Horizontal Pod Autoscaler",
    },
  );

  return plan;
}

function generateCICDFilePlan(platform: string): FilePlan {
  const plan: FilePlan = [];

  if (platform === "github") {
    plan.push(
      {
        action: "new",
        path: ".github/workflows/ci.yml",
        description: "Continuous integration workflow",
      },
      {
        action: "new",
        path: ".github/workflows/cd.yml",
        description: "Continuous deployment workflow",
      },
      {
        action: "new",
        path: ".github/workflows/security.yml",
        description: "Security scanning workflow",
      },
    );
  } else if (platform === "gitlab") {
    plan.push({
      action: "new",
      path: ".gitlab-ci.yml",
      description: "GitLab CI/CD pipeline configuration",
    });
  }

  return plan;
}

function validateProductionReadiness(ctx: DevelopmentContext): string[] {
  const issues: string[] = [];
  const { configFiles, sourceFiles } = ctx.projectContext || {};

  if (!configFiles || !sourceFiles) {
    return issues;
  }

  // Check for health check endpoint
  const hasHealthCheck = sourceFiles.some(
    (f) =>
      f.includes("health") || f.includes("readiness") || f.includes("liveness"),
  );
  if (!hasHealthCheck) {
    issues.push("Missing health check endpoint for monitoring");
  }

  // Check for logging configuration
  const hasLogging = sourceFiles.some(
    (f) => f.includes("log") || f.includes("logger"),
  );
  if (!hasLogging) {
    issues.push("No structured logging configuration found");
  }

  // Check for error handling
  const hasErrorHandling = sourceFiles.some(
    (f) => f.includes("error") || f.includes("exception"),
  );
  if (!hasErrorHandling) {
    issues.push("Centralized error handling not detected");
  }

  // Check for security headers
  issues.push("Verify security headers are configured (CORS, CSP, etc.)");

  // Check for rate limiting
  issues.push("Ensure rate limiting is implemented for production");

  // Check for monitoring
  const hasMonitoring = configFiles.some(
    (f) =>
      f.includes("prometheus") ||
      f.includes("grafana") ||
      f.includes("datadog"),
  );
  if (!hasMonitoring) {
    issues.push("No monitoring configuration found");
  }

  return issues;
}
