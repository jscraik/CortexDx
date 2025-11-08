/**
 * Template Generator Plugin
 * Generates customizable MCP server templates for different use cases and organizations
 * Requirements: 1.2, 1.4, 10.1
 * Performance: <5s response time
 * 
 * ENHANCEMENTS (Req 24.6):
 * - Template marketplace with sharing and discovery features
 * - Template versioning aligned with MCP releases
 * - Live preview with diff/file tree before finalization
 * - Validation against organization security policies
 */

import type {
  DevelopmentContext,
  DevelopmentPlugin,
  FilePlan,
  Finding,
} from "../../types.js";

// Template marketplace interfaces
interface TemplateMarketplace {
  templates: MarketplaceTemplate[];
  categories: string[];
  tags: string[];
}

interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  mcpVersion: string;
  category: string;
  tags: string[];
  downloads: number;
  rating: number;
  verified: boolean;
  lastUpdated: Date;
  files: TemplateFile[];
  dependencies: string[];
  securityScore: number;
}

interface TemplateFile {
  path: string;
  content: string;
  description: string;
}

// Template versioning
interface TemplateVersion {
  version: string;
  mcpVersion: string;
  releaseDate: Date;
  changelog: string[];
  breaking: boolean;
  deprecated: boolean;
}

// Live preview
interface TemplatePreview {
  fileTree: FileTreeNode[];
  diffs: FileDiff[];
  summary: PreviewSummary;
}

interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileTreeNode[];
  size?: number;
  action: 'create' | 'update' | 'delete';
}

interface FileDiff {
  path: string;
  action: 'create' | 'update' | 'delete';
  oldContent?: string;
  newContent?: string;
  additions: number;
  deletions: number;
}

interface PreviewSummary {
  totalFiles: number;
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  totalAdditions: number;
  totalDeletions: number;
  estimatedSize: number;
}

// Security policy validation
interface SecurityPolicy {
  allowedLicenses: string[];
  forbiddenPackages: string[];
  requiredHeaders: string[];
  maxFileSize: number;
  scanForSecrets: boolean;
  enforceCodeSigning: boolean;
}

interface PolicyViolation {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  file?: string;
  suggestion: string;
}

export const TemplateGeneratorPlugin: DevelopmentPlugin = {
  id: "template-generator",
  title: "MCP Template Generator",
  category: "development",
  order: 10,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if LLM is available for template generation
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "template.llm.missing",
        area: "development",
        severity: "minor",
        title: "Template generation LLM not available",
        description:
          "No LLM adapter configured for template generation capabilities.",
        evidence: [{ type: "log", ref: "template-generator" }],
        recommendation:
          "Configure an LLM adapter to enable AI-powered template generation features.",
      });
      return findings;
    }

    // Analyze project context for template opportunities
    if (ctx.projectContext) {
      const { type, language, sourceFiles } = ctx.projectContext;

      // Detect new project needing template
      if (sourceFiles.length === 0) {
        const templateType = detectTemplateType(type, ctx);

        findings.push({
          id: "template.new_project",
          area: "development",
          severity: "info",
          title: `${templateType} template available`,
          description: `I can generate a ${language} ${templateType} template with best practices and team conventions.`,
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation: `Generate a customized ${templateType} template that includes:\n- Standard project structure\n- MCP protocol implementation\n- Tool definitions and handlers\n- Configuration files\n- Testing setup\n- Documentation`,
          remediation: {
            filePlan: generateTemplatePlan(templateType, language),
            steps: [
              "Select template type and customization options",
              "Generate project structure and core files",
              "Add tool definitions and implementations",
              "Configure build and test setup",
              "Generate documentation and examples",
            ],
          },
        });
      }

      // Detect missing standard files
      const missingStandards = detectMissingStandardFiles(ctx);
      if (missingStandards.length > 0) {
        findings.push({
          id: "template.missing_standards",
          area: "development",
          severity: "minor",
          title: "Missing standard project files",
          description: `Project is missing ${missingStandards.length} standard files: ${missingStandards.join(", ")}`,
          evidence: [{ type: "file", ref: "project-root" }],
          recommendation:
            "I can generate these standard files following your team conventions.",
          remediation: {
            filePlan: missingStandards.map((file) => ({
              action: "new" as const,
              path: file,
              description: `Generate standard ${file} file`,
            })),
            steps: [
              "Review missing files",
              "Generate with team conventions",
              "Validate against standards",
            ],
          },
        });
      }
    }

    // Check conversation for template requests
    const recentMessages = ctx.conversationHistory.slice(-3);
    const hasTemplateRequest = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("template") ||
          msg.content.toLowerCase().includes("boilerplate") ||
          msg.content.toLowerCase().includes("scaffold") ||
          msg.content.toLowerCase().includes("starter")),
    );

    if (hasTemplateRequest) {
      findings.push({
        id: "template.request.detected",
        area: "development",
        severity: "info",
        title: "Template generation request detected",
        description:
          "I can help you generate customized templates for your MCP project.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Available templates:\n- Basic MCP Server\n- MCP Server with Resources\n- MCP Client\n- API-to-MCP Connector\n- Custom Organization Template\n\nTell me which template you need and any specific requirements.",
      });
    }

    // Validate performance requirement (<5s)
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      findings.push({
        id: "template.performance.slow",
        area: "performance",
        severity: "minor",
        title: "Template analysis exceeded time threshold",
        description: `Analysis took ${duration}ms, exceeding 5s requirement`,
        evidence: [{ type: "log", ref: "template-generator" }],
        confidence: 1.0,
      });
    }

    return findings;
  },
};

function detectTemplateType(
  projectType: string,
  ctx: DevelopmentContext,
): string {
  const conversation = ctx.conversationHistory
    .map((m) => m.content.toLowerCase())
    .join(" ");

  if (conversation.includes("api") || conversation.includes("connector")) {
    return "API-to-MCP Connector";
  }
  if (conversation.includes("resource")) {
    return "MCP Server with Resources";
  }
  if (conversation.includes("client")) {
    return "MCP Client";
  }
  if (projectType === "mcp-server") {
    return "MCP Server";
  }
  if (projectType === "mcp-client") {
    return "MCP Client";
  }
  if (projectType === "mcp-connector") {
    return "MCP Connector";
  }

  return "Basic MCP Server";
}

function generateTemplatePlan(
  templateType: string,
  language: string,
): FilePlan {
  const plan: FilePlan = [];

  // Common files for all templates
  plan.push(
    { action: "new", path: "README.md", description: "Project documentation" },
    { action: "new", path: ".gitignore", description: "Git ignore patterns" },
  );

  if (language === "typescript" || language === "javascript") {
    plan.push(
      {
        action: "new",
        path: "package.json",
        description: "Node.js package configuration",
      },
      {
        action: "new",
        path: "tsconfig.json",
        description: "TypeScript configuration",
      },
    );

    if (templateType.includes("Server")) {
      plan.push(
        {
          action: "new",
          path: "src/index.ts",
          description: "Main server entry point",
        },
        {
          action: "new",
          path: "src/server.ts",
          description: "MCP server implementation",
        },
        {
          action: "new",
          path: "src/tools/index.ts",
          description: "Tool definitions",
        },
        {
          action: "new",
          path: "src/types.ts",
          description: "Type definitions",
        },
      );
    }

    if (templateType.includes("Client")) {
      plan.push(
        {
          action: "new",
          path: "src/client.ts",
          description: "MCP client implementation",
        },
        {
          action: "new",
          path: "src/connection.ts",
          description: "Connection handling",
        },
      );
    }

    if (templateType.includes("Connector")) {
      plan.push(
        {
          action: "new",
          path: "src/connector.ts",
          description: "API connector implementation",
        },
        {
          action: "new",
          path: "src/api-client.ts",
          description: "API client wrapper",
        },
        {
          action: "new",
          path: "src/auth.ts",
          description: "Authentication handling",
        },
      );
    }
  }

  if (language === "python") {
    plan.push(
      {
        action: "new",
        path: "pyproject.toml",
        description: "Python project configuration",
      },
      {
        action: "new",
        path: "requirements.txt",
        description: "Python dependencies",
      },
    );

    if (templateType.includes("Server")) {
      plan.push(
        {
          action: "new",
          path: "src/__init__.py",
          description: "Package initialization",
        },
        {
          action: "new",
          path: "src/server.py",
          description: "MCP server implementation",
        },
        {
          action: "new",
          path: "src/tools.py",
          description: "Tool implementations",
        },
      );
    }
  }

  return plan;
}

function detectMissingStandardFiles(ctx: DevelopmentContext): string[] {
  const missing: string[] = [];
  const { sourceFiles, configFiles, language } = ctx.projectContext || {};

  if (!sourceFiles || !configFiles) {
    return missing;
  }

  const allFiles = [...sourceFiles, ...configFiles];

  // Check for README
  if (!allFiles.some((f) => f.toLowerCase().includes("readme"))) {
    missing.push("README.md");
  }

  // Check for .gitignore
  if (!allFiles.some((f) => f === ".gitignore")) {
    missing.push(".gitignore");
  }

  // Language-specific checks
  if (language === "typescript" || language === "javascript") {
    if (!allFiles.some((f) => f === "package.json")) {
      missing.push("package.json");
    }
    if (
      language === "typescript" &&
      !allFiles.some((f) => f === "tsconfig.json")
    ) {
      missing.push("tsconfig.json");
    }
  }

  if (language === "python") {
    if (!allFiles.some((f) => f === "pyproject.toml" || f === "setup.py")) {
      missing.push("pyproject.toml");
    }
  }

  return missing;
}

/**
 * ENHANCEMENT: Template Marketplace (Req 24.6)
 */
class TemplateMarketplaceManager {
  private templates: Map<string, MarketplaceTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Add default verified templates
    const basicServer: MarketplaceTemplate = {
      id: 'basic-mcp-server',
      name: 'Basic MCP Server',
      description: 'Minimal MCP server with essential features',
      author: 'Insula MCP Team',
      version: '1.0.0',
      mcpVersion: '2024-11-05',
      category: 'server',
      tags: ['basic', 'starter', 'typescript'],
      downloads: 1250,
      rating: 4.8,
      verified: true,
      lastUpdated: new Date(),
      files: [],
      dependencies: ['@modelcontextprotocol/sdk'],
      securityScore: 95
    };

    const apiConnector: MarketplaceTemplate = {
      id: 'api-connector',
      name: 'API-to-MCP Connector',
      description: 'Convert REST APIs to MCP tools automatically',
      author: 'Insula MCP Team',
      version: '1.2.0',
      mcpVersion: '2024-11-05',
      category: 'connector',
      tags: ['api', 'rest', 'connector', 'typescript'],
      downloads: 890,
      rating: 4.6,
      verified: true,
      lastUpdated: new Date(),
      files: [],
      dependencies: ['@modelcontextprotocol/sdk', 'axios'],
      securityScore: 92
    };

    this.templates.set(basicServer.id, basicServer);
    this.templates.set(apiConnector.id, apiConnector);
  }

  async searchTemplates(query: string, filters?: {
    category?: string;
    tags?: string[];
    minRating?: number;
    verifiedOnly?: boolean;
  }): Promise<MarketplaceTemplate[]> {
    let results = Array.from(this.templates.values());

    // Apply search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        results = results.filter(t => t.category === filters.category);
      }
      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(t =>
          filters.tags!.some(tag => t.tags.includes(tag))
        );
      }
      if (filters.minRating) {
        results = results.filter(t => t.rating >= filters.minRating!);
      }
      if (filters.verifiedOnly) {
        results = results.filter(t => t.verified);
      }
    }

    // Sort by relevance (downloads * rating)
    return results.sort((a, b) => {
      const scoreA = a.downloads * a.rating;
      const scoreB = b.downloads * b.rating;
      return scoreB - scoreA;
    });
  }

  async getTemplate(id: string): Promise<MarketplaceTemplate | undefined> {
    return this.templates.get(id);
  }

  async publishTemplate(template: MarketplaceTemplate): Promise<{ success: boolean; message: string }> {
    // Validate template before publishing
    const validation = await this.validateTemplateForPublishing(template);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Add to marketplace
    this.templates.set(template.id, template);
    return { success: true, message: 'Template published successfully' };
  }

  private async validateTemplateForPublishing(template: MarketplaceTemplate): Promise<{ valid: boolean; message: string }> {
    // Check required fields
    if (!template.name || !template.description || !template.version) {
      return { valid: false, message: 'Missing required fields' };
    }

    // Check security score
    if (template.securityScore < 70) {
      return { valid: false, message: 'Security score too low (minimum 70)' };
    }

    // Check for malicious patterns
    const hasMaliciousCode = template.files.some(f =>
      f.content.includes('eval(') ||
      f.content.includes('exec(') ||
      f.content.match(/password\s*=\s*["'][^"']+["']/)
    );

    if (hasMaliciousCode) {
      return { valid: false, message: 'Potentially malicious code detected' };
    }

    return { valid: true, message: 'Template validation passed' };
  }
}

/**
 * ENHANCEMENT: Template Versioning (Req 24.6)
 */
class TemplateVersionManager {
  private versions: Map<string, TemplateVersion[]> = new Map();

  async getVersions(templateId: string): Promise<TemplateVersion[]> {
    return this.versions.get(templateId) || [];
  }

  async getLatestVersion(templateId: string, mcpVersion?: string): Promise<TemplateVersion | undefined> {
    const versions = await this.getVersions(templateId);

    if (mcpVersion) {
      // Find latest version compatible with specified MCP version
      const compatible = versions.filter(v => v.mcpVersion === mcpVersion);
      return compatible.sort((a, b) =>
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
      )[0];
    }

    // Return absolute latest version
    return versions.sort((a, b) =>
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    )[0];
  }

  async addVersion(templateId: string, version: TemplateVersion): Promise<void> {
    const versions = this.versions.get(templateId) || [];
    versions.push(version);
    this.versions.set(templateId, versions);
  }

  async checkForUpdates(templateId: string, currentVersion: string): Promise<{
    hasUpdate: boolean;
    latestVersion?: string;
    breaking: boolean;
    changelog?: string[];
  }> {
    const versions = await this.getVersions(templateId);
    const latest = versions.sort((a, b) =>
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    )[0];

    if (!latest || latest.version === currentVersion) {
      return { hasUpdate: false, breaking: false };
    }

    return {
      hasUpdate: true,
      latestVersion: latest.version,
      breaking: latest.breaking,
      changelog: latest.changelog
    };
  }
}

/**
 * ENHANCEMENT: Live Preview (Req 24.6)
 */
async function generateLivePreview(
  template: MarketplaceTemplate,
  targetPath: string,
  existingFiles: string[]
): Promise<TemplatePreview> {
  const fileTree: FileTreeNode[] = [];
  const diffs: FileDiff[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  let filesCreated = 0;
  let filesUpdated = 0;
  let filesDeleted = 0;

  // Build file tree and diffs
  for (const file of template.files) {
    const fullPath = `${targetPath}/${file.path}`;
    const exists = existingFiles.includes(fullPath);

    // Add to file tree
    addToFileTree(fileTree, file.path, exists ? 'update' : 'create');

    // Generate diff
    const diff: FileDiff = {
      path: file.path,
      action: exists ? 'update' : 'create',
      newContent: file.content,
      additions: file.content.split('\n').length,
      deletions: 0
    };

    if (exists) {
      // Simulate existing content for diff
      diff.oldContent = '// Existing content\n';
      diff.deletions = 1;
      filesUpdated++;
    } else {
      filesCreated++;
    }

    totalAdditions += diff.additions;
    totalDeletions += diff.deletions;
    diffs.push(diff);
  }

  const summary: PreviewSummary = {
    totalFiles: template.files.length,
    filesCreated,
    filesUpdated,
    filesDeleted,
    totalAdditions,
    totalDeletions,
    estimatedSize: template.files.reduce((sum, f) => sum + f.content.length, 0)
  };

  return { fileTree, diffs, summary };
}

function addToFileTree(tree: FileTreeNode[], path: string, action: 'create' | 'update' | 'delete'): void {
  const parts = path.split('/');
  let current = tree;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isFile = i === parts.length - 1;

    let node = current.find(n => n.name === part);
    if (!node) {
      node = {
        name: part,
        type: isFile ? 'file' : 'directory',
        path: parts.slice(0, i + 1).join('/'),
        action,
        children: isFile ? undefined : []
      };
      current.push(node);
    }

    if (!isFile && node.children) {
      current = node.children;
    }
  }
}

/**
 * ENHANCEMENT: Security Policy Validation (Req 24.6)
 */
async function validateAgainstSecurityPolicy(
  template: MarketplaceTemplate,
  policy: SecurityPolicy
): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];

  // Check licenses
  for (const dep of template.dependencies) {
    const license = await getLicenseForPackage(dep);
    if (license && !policy.allowedLicenses.includes(license)) {
      violations.push({
        severity: 'error',
        rule: 'allowed-licenses',
        message: `Dependency ${dep} uses forbidden license: ${license}`,
        suggestion: `Use packages with allowed licenses: ${policy.allowedLicenses.join(', ')}`
      });
    }
  }

  // Check forbidden packages
  for (const dep of template.dependencies) {
    if (policy.forbiddenPackages.includes(dep)) {
      violations.push({
        severity: 'error',
        rule: 'forbidden-packages',
        message: `Forbidden package detected: ${dep}`,
        suggestion: 'Remove this package or use an approved alternative'
      });
    }
  }

  // Check file headers
  for (const file of template.files) {
    if (file.path.endsWith('.ts') || file.path.endsWith('.js')) {
      const hasRequiredHeaders = policy.requiredHeaders.every(header =>
        file.content.includes(header)
      );

      if (!hasRequiredHeaders) {
        violations.push({
          severity: 'warning',
          rule: 'required-headers',
          message: `File ${file.path} missing required headers`,
          file: file.path,
          suggestion: `Add required headers: ${policy.requiredHeaders.join(', ')}`
        });
      }
    }
  }

  // Check file sizes
  for (const file of template.files) {
    if (file.content.length > policy.maxFileSize) {
      violations.push({
        severity: 'warning',
        rule: 'max-file-size',
        message: `File ${file.path} exceeds maximum size (${policy.maxFileSize} bytes)`,
        file: file.path,
        suggestion: 'Split large files into smaller modules'
      });
    }
  }

  // Scan for secrets
  if (policy.scanForSecrets) {
    for (const file of template.files) {
      const secrets = scanForSecrets(file.content);
      for (const secret of secrets) {
        violations.push({
          severity: 'error',
          rule: 'no-secrets',
          message: `Potential secret detected in ${file.path}: ${secret.type}`,
          file: file.path,
          suggestion: 'Remove hardcoded secrets and use environment variables'
        });
      }
    }
  }

  return violations;
}

async function getLicenseForPackage(packageName: string): Promise<string | undefined> {
  // Simulate license lookup
  const licenses: Record<string, string> = {
    '@modelcontextprotocol/sdk': 'MIT',
    'axios': 'MIT',
    'express': 'MIT',
    'some-gpl-package': 'GPL-3.0'
  };
  return licenses[packageName];
}

function scanForSecrets(content: string): Array<{ type: string; value: string }> {
  const secrets: Array<{ type: string; value: string }> = [];

  // Check for API keys
  const apiKeyPattern = /api[_-]?key\s*[:=]\s*["']([^"']+)["']/gi;
  let match = apiKeyPattern.exec(content);
  while (match) {
    secrets.push({ type: 'API Key', value: match[1] });
    match = apiKeyPattern.exec(content);
  }

  // Check for passwords
  const passwordPattern = /password\s*[:=]\s*["']([^"']+)["']/gi;
  match = passwordPattern.exec(content);
  while (match) {
    secrets.push({ type: 'Password', value: match[1] });
    match = passwordPattern.exec(content);
  }

  // Check for tokens
  const tokenPattern = /token\s*[:=]\s*["']([^"']+)["']/gi;
  match = tokenPattern.exec(content);
  while (match) {
    secrets.push({ type: 'Token', value: match[1] });
    match = tokenPattern.exec(content);
  }

  return secrets;
}

// Global instances
const marketplaceManager = new TemplateMarketplaceManager();
const versionManager = new TemplateVersionManager();
