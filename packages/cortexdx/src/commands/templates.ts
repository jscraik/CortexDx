import { TemplateEngine } from "../template-engine/engine.js";
import {
  getAllCodePatterns,
  renderCodePattern,
} from "../templates/code-patterns.js";
import type { FixTemplate } from "../templates/fix-templates.js";
import { getAllTemplates, getTemplate } from "../templates/fix-templates.js";
import type { DevelopmentContext } from "../types.js";

/**
 * Create development context for template operations
 */
const jsonRpcStub = async <T>(method: string, params?: unknown): Promise<T> => {
  return Promise.reject(
    new Error(`JSON-RPC method ${method} not implemented in CLI context`),
  ) as Promise<T>;
};

function createDevelopmentContext(): DevelopmentContext {
  return {
    endpoint: process.env.CORTEXDX_INTERNAL_ENDPOINT || "http://127.0.0.1:5001",
    logger: (...args) => console.log("[Templates]", ...args),
    request: async (input, init) => {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return text.length ? JSON.parse(text) : {};
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
  console.log("[Templates] Available fix templates:\n");

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
      console.log("No templates found matching the specified criteria.");
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
      console.log(`${area.toUpperCase()} TEMPLATES:`);
      for (const template of areaTemplates) {
        console.log(`  ${template.id}`);
        console.log(`    Name: ${template.name}`);
        console.log(`    Description: ${template.description}`);
        console.log(`    Severity: ${template.severity.toUpperCase()}`);
        console.log(`    Risk Level: ${template.riskLevel.toUpperCase()}`);
        console.log(`    Estimated Time: ${template.estimatedTime}`);
        console.log(`    Files Affected: ${template.filesAffected.join(", ")}`);
        console.log(`    Checklist Items: ${template.checklist.length}`);
        console.log("");
      }
    }

    console.log(`Total: ${templates.length} template(s) found`);
    return 0;
  } catch (error) {
    console.error("[Templates] Failed to list templates:", error);
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
  console.log(`[Templates] Applying template: ${templateId}\n`);

  try {
    const template = getTemplate(templateId);
    if (!template) {
      console.error(`[Templates] Template '${templateId}' not found`);
      console.log(
        '[Templates] Use "cortexdx templates list" to see available templates',
      );
      return 1;
    }

    // Display template info
    console.log(`Template: ${template.name}`);
    console.log(`Description: ${template.description}`);
    console.log(`Area: ${template.area}`);
    console.log(`Severity: ${template.severity.toUpperCase()}`);
    console.log(`Risk Level: ${template.riskLevel.toUpperCase()}`);
    console.log(`Estimated Time: ${template.estimatedTime}`);
    console.log(`Files to be modified: ${template.filesAffected.join(", ")}`);
    console.log("");

    if (options.dryRun) {
      console.log("[Templates] DRY RUN MODE - No changes will be applied");
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
    console.log(templateEngine.formatFixResult(result));

    if (!result.success && result.error) {
      console.error(`[Templates] Template application failed: ${result.error}`);
      return 1;
    }

    if (options.dryRun) {
      console.log("\n[Templates] DRY RUN completed - No changes were made");
      console.log("[Templates] Run without --dry-run to apply the changes");
    } else if (result.success) {
      console.log(
        `\n[Templates] Template '${templateId}' applied successfully`,
      );
    }

    return result.success ? 0 : 1;
  } catch (error) {
    console.error("[Templates] Template application failed:", error);
    return 1;
  }
}

/**
 * Show template details
 */
export async function runTemplateShow(templateId: string): Promise<number> {
  console.log(`[Templates] Template details: ${templateId}\n`);

  try {
    const template = getTemplate(templateId);
    if (!template) {
      console.error(`[Templates] Template '${templateId}' not found`);
      console.log(
        '[Templates] Use "cortexdx templates list" to see available templates',
      );
      return 1;
    }

    // Display detailed template information
    console.log("=".repeat(60));
    console.log(`TEMPLATE: ${template.name}`);
    console.log("=".repeat(60));

    console.log(`ID: ${template.id}`);
    console.log(`Area: ${template.area}`);
    console.log(`Severity: ${template.severity.toUpperCase()}`);
    console.log(`Risk Level: ${template.riskLevel.toUpperCase()}`);
    console.log(`Estimated Time: ${template.estimatedTime}`);
    console.log(`Description: ${template.description}`);
    console.log(`Files Affected: ${template.filesAffected.join(", ")}`);

    console.log("\nCHECKLIST:");
    template.checklist.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });

    if (template.validationPlugins && template.validationPlugins.length > 0) {
      console.log(
        `\nVALIDATION PLUGINS: ${template.validationPlugins.join(", ")}`,
      );
    }

    if (template.codeTemplate) {
      console.log("\nCODE TEMPLATE:");
      console.log("```typescript");
      console.log(template.codeTemplate.trim());
      console.log("```");
    }

    // Show related code patterns if available
    const codePattern = getAllCodePatterns().find((cp) => cp.id === templateId);
    if (codePattern) {
      console.log("\nCODE PATTERN:");
      console.log("```typescript");
      console.log(renderCodePattern(templateId).trim());
      console.log("```");
    }

    console.log("\nUSAGE:");
    console.log(
      `  Apply this template: cortexdx templates apply ${templateId}`,
    );
    console.log(
      `  Dry run first:     cortexdx templates apply ${templateId} --dry-run`,
    );

    return 0;
  } catch (error) {
    console.error("[Templates] Failed to show template details:", error);
    return 1;
  }
}
