/**
 * MCP Tools Index
 * Exports all MCP tool definitions for the CortexDx diagnostic system
 */

export { createAcademicIntegrationTools, executeAcademicIntegrationTool } from "./academic-integration-tools";
export { createAgentOrchestrationTools, executeAgentOrchestrationTool } from "./agent-orchestration-tools";
export { createCommercialFeatureTools } from "./commercial-feature-tools";
export { createDeepContextTools, executeDeepContextTool } from "./deepcontext-tools";
export { createDevelopmentAssistanceTools } from "./development-assistance-tools";
export { createDevelopmentTools } from "./development-tools";
export { createDiagnosticTools } from "./diagnostic-tools";
export { ideIntegrationTools } from "./ide-integration-tools";
export { createLicenseValidationTools } from "./license-validation-tools";
export { createPluginOrchestrationTools, executePluginOrchestrationTool } from "./plugin-orchestration-tools";
export { createMcpDocsTools, executeMcpDocsTool } from "./mcp-docs-tools";
export { reportTools, handleGetLatest, handleGetByRun, type ReportRef, type GetLatestParams, type GetByRunParams } from "./report-tools";
export { mcpProbeTools, executeMcpProbeTool } from "./mcp-probe-tools";

import type { McpTool } from "../types";
import { createAcademicIntegrationTools } from "./academic-integration-tools";
import { createAgentOrchestrationTools } from "./agent-orchestration-tools";
import { createCommercialFeatureTools } from "./commercial-feature-tools";
import { createDeepContextTools } from "./deepcontext-tools";
import { createDevelopmentAssistanceTools } from "./development-assistance-tools";
import { createDevelopmentTools } from "./development-tools";
import { createDiagnosticTools } from "./diagnostic-tools";
import { ideIntegrationTools } from "./ide-integration-tools";
import { createLicenseValidationTools } from "./license-validation-tools";
import { createPluginOrchestrationTools } from "./plugin-orchestration-tools";
import { createMcpDocsTools } from "./mcp-docs-tools";
import { reportTools } from "./report-tools";
import { mcpProbeTools } from "./mcp-probe-tools";

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
  deepcontext: createDeepContextTools(),
  ide: ideIntegrationTools,
  orchestration: createPluginOrchestrationTools(),
  agentOrchestration: createAgentOrchestrationTools(),
  mcpDocs: createMcpDocsTools(),
  reports: reportTools,
  probe: mcpProbeTools,
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
