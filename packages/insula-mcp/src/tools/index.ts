/**
 * MCP Tools Index
 * Exports all MCP tool definitions for the Insula MCP diagnostic system
 */

export { createAcademicIntegrationTools } from "./academic-integration-tools.js";
export { createCommercialFeatureTools } from "./commercial-feature-tools.js";
export { createDevelopmentAssistanceTools } from "./development-assistance-tools.js";
export { createDevelopmentTools } from "./development-tools.js";
export { createDiagnosticTools } from "./diagnostic-tools.js";
export { ideIntegrationTools } from "./ide-integration-tools.js";
export { createLicenseValidationTools } from "./license-validation-tools.js";
export { createPluginOrchestrationTools, executePluginOrchestrationTool } from "./plugin-orchestration-tools.js";

import type { McpTool } from "../types.js";
import { createAcademicIntegrationTools } from "./academic-integration-tools.js";
import { createCommercialFeatureTools } from "./commercial-feature-tools.js";
import { createDevelopmentAssistanceTools } from "./development-assistance-tools.js";
import { createDevelopmentTools } from "./development-tools.js";
import { createDiagnosticTools } from "./diagnostic-tools.js";
import { ideIntegrationTools } from "./ide-integration-tools.js";
import { createLicenseValidationTools } from "./license-validation-tools.js";
import { createPluginOrchestrationTools } from "./plugin-orchestration-tools.js";

/**
 * Get all MCP tools organized by category
 */
export const getAllMcpTools = (): Record<string, McpTool[]> => ({
  diagnostic: createDiagnosticTools(),
  development: createDevelopmentTools(),
  developmentAssistance: createDevelopmentAssistanceTools(),
  academic: createAcademicIntegrationTools(),
  commercial: createCommercialFeatureTools(),
  license: createLicenseValidationTools(),
  ide: ideIntegrationTools,
  orchestration: createPluginOrchestrationTools(),
});

/**
 * Get all MCP tools as a flat array
 */
export const getAllMcpToolsFlat = (): McpTool[] => {
  const toolsByCategory = getAllMcpTools();
  return Object.values(toolsByCategory).flat();
};

/**
 * Get MCP tools by category
 */
export const getMcpToolsByCategory = (category: string): McpTool[] => {
  const toolsByCategory = getAllMcpTools();
  return toolsByCategory[category] || [];
};

/**
 * Find a specific MCP tool by name
 */
export const findMcpTool = (toolName: string): McpTool | undefined => {
  const allTools = getAllMcpToolsFlat();
  return allTools.find((tool) => tool.name === toolName);
};

/**
 * Get tool categories
 */
export const getToolCategories = (): string[] => {
  return Object.keys(getAllMcpTools());
};
