import { createCliLogger } from "../logging/logger.js";
import { TemplateEngine } from "../template-engine/engine.js";
import {
  getAllCodePatterns,
  renderCodePattern,
} from "../templates/code-patterns.js";
import type { FixTemplate } from "../templates/fix-templates.js";
import { getAllTemplates, getTemplate } from "../templates/fix-templates.js";
import type { DevelopmentContext } from "../types.js";

const logger = createCliLogger("templates");

/**
 * Create development context for template operations
 */
const jsonRpcStub = async <T>(
  _method: string,
  _params?: unknown,
): Promise<T> => {
  return Promise.reject(
    new Error(`JSON-RPC method ${_method} not implemented in CLI context`),
  ) as Promise<T>;
};

function createDevelopmentContext(): DevelopmentContext {
  return {
    endpoint: process.env.CORTEXDX_INTERNAL_ENDPOINT || "http://127.0.0.1:5001",
    logger: (() => { }) as (...args: unknown[]) => void,
    request: async <T>(
      _input: RequestInfo,
      _init?: RequestInit,
    ): Promise<T> => {
      const result = {} as Record<string, unknown>;
      return result as T;
    },
    jsonrpc: jsonRpcStub as <T>(method: string, params?: unknown) => Promise<T>,
    sseProbe: async () => ({ ok: true }),
    evidence: () => undefined,
    deterministic: true,
    sessionId: `templates-${Date.now()}`,
    userExpertiseLevel: "expert",
    conversationHistory: [],
  };
}

/**
 * List available templates
 */
export async function runTemplatesList(options: {
  area?: string;
  severity?: string;
}): Promise<number> {
  logger.info("[Templates] Available fix templates:\n");

  try {
    let templates = getAllTemplates();

    // Apply filters
    if (options.area) {
      templates = templates.filter((t) => t.area === options.area);
    }

    if (options.severity) {
      templates = templates.filter((t) => t.severity === options.severity);
    }

    if (templates.length === 0) {
      logger.info("No templates found matching the specified criteria.");
      return 0;
    }

    // Group by area
    const byArea = templates.reduce<Record<string, FixTemplate[]>>(
      (acc, template) => {
        const area = template.area;
        if (!acc[area]) {
          acc[area] = [];
        }
        acc[area].push(template);
        return acc;
      },
      {},
    );

    // Display templates
    for (const [area, areaTemplates] of Object.entries(byArea)) {
      logger.info(`${area.toUpperCase()} TEMPLATES:`);
      for (const template of areaTemplates) {
        logger.info(`  ${template.id}`);
        logger.info(`    Name: ${template.name}`);
        logger.info(`    Description: ${template.description}`);
        logger.info(`    Severity: ${template.severity.toUpperCase()}`);
        logger.info(`    Risk Level: ${template.riskLevel.toUpperCase()}`);
        logger.info(`    Estimated Time: ${template.estimatedTime}`);
        logger.info(`    Files Affected: ${template.filesAffected.join(", ")}`);
        logger.info(`    Checklist Items: ${template.checklist.length}`);
        logger.info("");
      }
    }

    logger.info(`Total: ${templates.length} template(s) found`);
    return 0;
  } catch (error) {
    logger.error("[Templates] Failed to list templates", { error });
    return 1;
  }
}

/**
 * Apply a template
 */
export async function runTemplateApply(
  templateId: string,
  options: {
    dryRun?: boolean;
    backup?: boolean;
    validate?: boolean;
  },
): Promise<number> {
  logger.info(`[Templates] Applying template: ${templateId}\n`);

  try {
    const template = getTemplate(templateId);
    if (!template) {
      logger.error(`[Templates] Template '${templateId}' not found`);
      logger.info(
        '[Templates] Use "cortexdx templates list" to see available templates',
      );
      return 1;
    }

    // Display template info
    logger.info(`Template: ${template.name}`);
    logger.info(`Description: ${template.description}`);
    logger.info(`Area: ${template.area}`);
    logger.info(`Severity: ${template.severity.toUpperCase()}`);
    logger.info(`Risk Level: ${template.riskLevel.toUpperCase()}`);
    logger.info(`Estimated Time: ${template.estimatedTime}`);
    logger.info(`Files to be modified: ${template.filesAffected.join(", ")}`);
    logger.info("");

    if (options.dryRun) {
      logger.info("[Templates] DRY RUN MODE - No changes will be applied");
    }

    // Create a mock finding for the template
    const mockFinding = {
      id: `template_${templateId}_${Date.now()}`,
      area: template.area,
      severity: template.severity,
      title: `Template application: ${template.name}`,
      description: `Applying fix template ${templateId}`,
      evidence: [],
      tags: ["template-applied"],
      templateId,
      canAutoFix: true,
    };

    const ctx = createDevelopmentContext();
    const templateEngine = new TemplateEngine();

    // Apply template
    const result = await templateEngine.applyTemplate(
      templateId,
      mockFinding,
      ctx,
      {
        dryRun: options.dryRun || false,
        backupEnabled: options.backup !== false,
        skipValidation: !options.validate,
      },
    );

    // Display results
    logger.info(templateEngine.formatFixResult(result));

    if (!result.success && result.error) {
      logger.error(`[Templates] Template application failed: ${result.error}`);
      return 1;
    }

    if (options.dryRun) {
      logger.info("\n[Templates] DRY RUN completed - No changes were made");
      logger.info("[Templates] Run without --dry-run to apply the changes");
    } else if (result.success) {
      logger.info(
        `\n[Templates] Template '${templateId}' applied successfully`,
      );
    }

    return result.success ? 0 : 1;
  } catch (error) {
    logger.error("[Templates] Template application failed", { error });
    return 1;
  }
}

/**
 * Show template details
 */
export async function runTemplateShow(templateId: string): Promise<number> {
  logger.info(`[Templates] Template details: ${templateId}\n`);

  try {
    const template = getTemplate(templateId);
    if (!template) {
      logger.error(`[Templates] Template '${templateId}' not found`);
      logger.info(
        '[Templates] Use "cortexdx templates list" to see available templates',
      );
      return 1;
    }

    // Display detailed template information
    logger.info("=".repeat(60));
    logger.info(`TEMPLATE: ${template.name}`);
    logger.info("=".repeat(60));

    logger.info(`ID: ${template.id}`);
    logger.info(`Area: ${template.area}`);
    logger.info(`Severity: ${template.severity.toUpperCase()}`);
    logger.info(`Risk Level: ${template.riskLevel.toUpperCase()}`);
    logger.info(`Estimated Time: ${template.estimatedTime}`);
    logger.info(`Description: ${template.description}`);
    logger.info(`Files Affected: ${template.filesAffected.join(", ")}`);

    logger.info("\nCHECKLIST:");
    template.checklist.forEach((item, index) => {
      logger.info(`  ${index + 1}. ${item}`);
    });

    if (template.validationPlugins && template.validationPlugins.length > 0) {
      logger.info(
        `\nVALIDATION PLUGINS: ${template.validationPlugins.join(", ")}`,
      );
    }

    if (template.codeTemplate) {
      logger.info("\nCODE TEMPLATE:");
      logger.info("```typescript");
      logger.info(template.codeTemplate.trim());
      logger.info("```");
    }

    // Show related code patterns if available
    const codePattern = getAllCodePatterns().find((cp) => cp.id === templateId);
    if (codePattern) {
      logger.info("\nCODE PATTERN:");
      logger.info("```typescript");
      logger.info(renderCodePattern(templateId).trim());
      logger.info("```");
    }

    logger.info("\nUSAGE:");
    logger.info(
      `  Apply this template: cortexdx templates apply ${templateId}`,
    );
    logger.info(
      `  Dry run first:     cortexdx templates apply ${templateId} --dry-run`,
    );

    return 0;
  } catch (error) {
    logger.error("[Templates] Failed to show template details", { error });
    return 1;
  }
}
