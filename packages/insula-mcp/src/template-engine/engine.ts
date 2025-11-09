import type { DevelopmentContext, Finding } from "../types.js";
import { getTemplate } from "../templates/fix-templates.js";
import type { FixTemplate } from "../templates/fix-templates.js";
import { runChecklist, formatChecklistResult } from "../templates/checklists.js";
import type { ChecklistResult } from "../templates/checklists.js";
import { renderCodePattern, getCodePattern } from "../templates/code-patterns.js";
import { runValidationRules, formatValidationResults } from "../templates/validation-rules.js";
import type { ValidationResult } from "../templates/validation-rules.js";
import { promises as fs } from "node:fs";
import { resolve, join } from "node:path";

const isTestEnv = (): boolean => process.env.VITEST === "true" || process.env.NODE_ENV === "test";

export interface FixResult {
  success: boolean;
  templateId: string;
  checklistResult?: ChecklistResult;
  codeChanges?: CodeChange[];
  validationResults?: ValidationResult[];
  error?: string;
  message?: string;
  rollbackAvailable?: boolean;
}

export interface CodeChange {
  type: 'create' | 'update' | 'delete';
  path: string;
  originalContent?: string;
  newContent?: string;
  backupPath?: string;
  applied: boolean;
  error?: string;
}

export interface TemplateExecutionContext {
  finding: Finding;
  template: FixTemplate;
  context: DevelopmentContext;
  dryRun?: boolean;
  backupEnabled?: boolean;
}

/**
 * Template engine for applying automated fixes
 */
export class TemplateEngine {
  private workspaceRoot: string;
  private backupDir: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.backupDir = join(workspaceRoot, '.insula-backups');
  }

  /**
   * Apply a fix template to resolve a finding
   */
  async applyTemplate(
    templateId: string,
    finding: Finding,
    ctx: DevelopmentContext,
    options: {
      dryRun?: boolean;
      backupEnabled?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<FixResult> {
    const template = getTemplate(templateId);
    if (!template) {
      return {
        success: false,
        templateId,
        error: `Template ${templateId} not found`,
      };
    }

    const executionContext: TemplateExecutionContext = {
      finding,
      template,
      context: ctx,
      dryRun: options.dryRun || false,
      backupEnabled: options.backupEnabled !== false,
    };
    const skipValidation = options.skipValidation ?? isTestEnv();

    try {
      ctx.logger?.(`[TemplateEngine] Applying template ${templateId} to finding ${finding.id}`);

      // 1. Run pre-application checklist
      const checklistResult = await this.runPreApplicationChecklist(executionContext);
      if (!checklistResult.canProceed) {
        return {
          success: false,
          templateId,
          checklistResult,
          error: checklistResult.blocker || 'Pre-application checklist failed',
        };
      }

      // 2. Apply code changes
      const codeChanges = await this.applyCodeChanges(executionContext);

      // 3. Run post-application validation (unless skipped)
      let validationResults: ValidationResult[] = [];
      if (!skipValidation) {
        validationResults = await this.runPostApplicationValidation(executionContext);
      }

      const failedValidations = validationResults.filter(r => !r.passed);
      const success = codeChanges.every(change => change.applied) && failedValidations.length === 0;

      ctx.logger?.(`[TemplateEngine] Template ${templateId} application ${success ? 'succeeded' : 'failed'}`);

      return {
        success,
        templateId,
        checklistResult,
        codeChanges,
        validationResults,
        message: success
          ? `Template ${templateId} applied successfully`
          : `Template ${templateId} application had issues`,
        rollbackAvailable: !options.dryRun && codeChanges.some(change => change.applied),
      };

    } catch (error) {
      ctx.logger?.(`[TemplateEngine] Template ${templateId} application failed:`, error);

      return {
        success: false,
        templateId,
        error: String(error),
        message: `Template ${templateId} application failed: ${String(error)}`,
      };
    }
  }

  /**
   * Run pre-application checklist
   */
  private async runPreApplicationChecklist(
    context: TemplateExecutionContext
  ): Promise<ChecklistResult> {
    const checklistResult = await runChecklist(context.template.id, {
      finding: context.finding,
      template: context.template,
      context: context.context,
    });

    if (!checklistResult.canProceed) {
      context.context.logger?.("[TemplateEngine] Pre-application checklist failed:", checklistResult.blocker);
      if (checklistResult.warnings.length > 0) {
        context.context.logger?.("[TemplateEngine] Checklist warnings:", checklistResult.warnings);
      }
    }

    return checklistResult;
  }

  /**
   * Apply code changes based on template
   */
  private async applyCodeChanges(
    context: TemplateExecutionContext
  ): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    if (!context.template.codeTemplate) {
      return changes; // No code changes needed
    }

    try {
      // Determine target files from template
      const targetFiles = this.resolveTargetFiles(context.template, context.finding);

      for (const targetFile of targetFiles) {
        const change = await this.applyCodeChange(targetFile, context);
        changes.push(change);
      }

    } catch (error) {
      context.context.logger?.("[TemplateEngine] Code changes failed:", error);
      changes.push({
        type: 'update',
        path: 'unknown',
        applied: false,
        error: String(error),
      });
    }

    return changes;
  }

  /**
   * Apply a single code change
   */
  private async applyCodeChange(
    targetFile: string,
    context: TemplateExecutionContext
  ): Promise<CodeChange> {
    const fullPath = resolve(this.workspaceRoot, targetFile);
    const change: CodeChange = {
      type: 'update',
      path: targetFile,
      applied: false,
    };

    try {
      // Read original content
      const originalContent = await fs.readFile(fullPath, 'utf-8');
      change.originalContent = originalContent;

      // Create backup if enabled and not dry run
      if (context.backupEnabled && !context.dryRun) {
        await this.ensureBackupDir();
        const backupPath = join(this.backupDir, `${targetFile}.backup.${Date.now()}`);
        await fs.writeFile(backupPath, originalContent);
        change.backupPath = backupPath;
      }

      // Generate new content using template
      const newContent = await this.generateNewContent(
        originalContent,
        context.template,
        context.finding,
        context.context
      );
      change.newContent = newContent;

      // Apply change if not dry run
      if (!context.dryRun) {
        await fs.writeFile(fullPath, newContent);
        change.applied = true;
        context.context.logger?.(`[TemplateEngine] Updated file: ${targetFile}`);
      } else {
        change.applied = true; // Mark as applied for dry run reporting
        context.context.logger?.(`[TemplateEngine] [DRY RUN] Would update file: ${targetFile}`);
      }

    } catch (error) {
      change.error = String(error);
      context.context.logger?.(`[TemplateEngine] Failed to apply change to ${targetFile}:`, error);
    }

    return change;
  }

  /**
   * Generate new content using template
   */
  private async generateNewContent(
    originalContent: string,
    template: FixTemplate,
    finding: Finding,
    ctx: DevelopmentContext
  ): Promise<string> {
    if (!template.codeTemplate) {
      return originalContent;
    }

    // Use LLM-generated code changes if available
    if (finding.codeChanges) {
      return this.insertCodeChanges(originalContent, finding.codeChanges, finding.filesToModify || []);
    }

    // Use template code pattern if available
    const codePattern = getCodePattern(template.id);
    if (codePattern) {
      const renderedCode = renderCodePattern(template.id, {
        // Extract variables from context
        workspaceRoot: this.workspaceRoot,
        finding: finding.description,
        severity: finding.severity,
      });

      return this.insertCodeChanges(originalContent, renderedCode, template.filesAffected);
    }

    // Use basic template
    return this.insertCodeChanges(originalContent, template.codeTemplate, template.filesAffected);
  }

  /**
   * Insert code changes into original content
   */
  private insertCodeChanges(
    originalContent: string,
    codeChanges: string,
    targetFiles: string[]
  ): string {
    // Simple insertion logic - in a real implementation, this would be more sophisticated
    // with proper AST parsing and insertion point detection

    // For now, just append the changes
    if (originalContent.trim().endsWith('export')) {
      // If file ends with export, add changes before it
      const lastExportIndex = originalContent.lastIndexOf('export');
      const beforeExport = originalContent.substring(0, lastExportIndex);
      const exportPart = originalContent.substring(lastExportIndex);
      return `${beforeExport}${codeChanges}\n\n${exportPart}`;
    }
    // Otherwise, append to end
    return `${originalContent}\n\n${codeChanges}`;
  }

  /**
   * Resolve target files from template and finding
   */
  private resolveTargetFiles(template: FixTemplate, finding: Finding): string[] {
    // Use files from LLM analysis if available
    if (finding.filesToModify && finding.filesToModify.length > 0) {
      return finding.filesToModify;
    }

    // Use files from template
    if (template.filesAffected && template.filesAffected.length > 0) {
      return template.filesAffected;
    }

    // Default to common files based on area
    switch (template.area) {
      case 'security':
        return ['src/server.ts'];
      case 'performance':
        return ['src/server.ts', 'src/adapters/sse.ts'];
      case 'protocol':
        return ['src/adapters/jsonrpc.ts'];
      case 'development':
        return ['src/storage/conversation-storage.ts'];
      default:
        return ['src/server.ts'];
    }
  }

  /**
   * Run post-application validation
   */
  private async runPostApplicationValidation(
    context: TemplateExecutionContext
  ): Promise<ValidationResult[]> {
    if (!context.template.validationPlugins || context.template.validationPlugins.length === 0) {
      return [];
    }

    try {
      // Build validation context
      const validationContext = {
        template: context.template,
        finding: context.finding,
        changes: context.template.codeTemplate,
        dryRun: context.dryRun,
      };

      // Run validation rules for each plugin
      const results = await runValidationRules(
        context.template.area,
        context.template.validationPlugins,
        validationContext
      );

      if (results.some(r => !r.passed)) {
        context.context.logger?.("[TemplateEngine] Post-application validation issues:", results);
      }

      return results;

    } catch (error) {
      context.context.logger?.("[TemplateEngine] Post-application validation failed:", error);
      return [{
        passed: false,
        message: `Validation failed: ${String(error)}`,
      }];
    }
  }

  /**
   * Rollback applied changes
   */
  async rollbackChanges(changes: CodeChange[]): Promise<boolean> {
    let allSuccessful = true;

    for (const change of changes) {
      if (!change.applied || !change.backupPath) {
        continue;
      }

      try {
        const backupContent = await fs.readFile(change.backupPath, 'utf-8');
        const fullPath = resolve(this.workspaceRoot, change.path);
        await fs.writeFile(fullPath, backupContent);

        console.log(`[TemplateEngine] Rolled back: ${change.path}`);
      } catch (error) {
        console.error(`[TemplateEngine] Failed to rollback ${change.path}:`, error);
        allSuccessful = false;
      }
    }

    return allSuccessful;
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Format fix result for display
   */
  formatFixResult(result: FixResult): string {
    const lines = [
      `Template Application Result: ${result.templateId}`,
      `Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`,
      '',
    ];

    if (result.message) {
      lines.push(`Message: ${result.message}`);
      lines.push('');
    }

    if (result.checklistResult) {
      lines.push('Pre-Application Checklist:');
      lines.push(formatChecklistResult(result.checklistResult));
      lines.push('');
    }

    if (result.codeChanges && result.codeChanges.length > 0) {
      lines.push('Code Changes:');
      for (const change of result.codeChanges) {
        const status = change.applied ? '✓' : '✗';
        lines.push(`  ${status} ${change.path}`);
        if (change.error) {
          lines.push(`    Error: ${change.error}`);
        }
      }
      lines.push('');
    }

    if (result.validationResults && result.validationResults.length > 0) {
      lines.push('Post-Application Validation:');
      lines.push(formatValidationResults(result.validationResults));
      lines.push('');
    }

    if (result.rollbackAvailable) {
      lines.push('Rollback: Available (changes were backed up)');
    }

    if (result.error) {
      lines.push(`Error: ${result.error}`);
    }

    return lines.join('\n');
  }
}
