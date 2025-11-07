import type { DevelopmentPlugin, DiagnosticPlugin } from "../types.js";

import { AuthPlugin } from "./auth.js";
import { CorsPlugin } from "./cors.js";
import { DevtoolEnvPlugin } from "./devtool-env.js";
import { DiscoveryPlugin } from "./discovery.js";
import { GovernancePlugin } from "./governance.js";
import { JsonRpcBatchPlugin } from "./jsonrpc-batch.js";
import { PerformancePlugin } from "./performance.js";
import { PermissioningPlugin } from "./permissioning.js";
import { ProtocolPlugin } from "./protocol.js";
import { RateLimitPlugin } from "./ratelimit.js";
import { SseReconnectPlugin } from "./sse-reconnect.js";
import { StreamingSsePlugin } from "./streaming-sse.js";
import { ThreatModelPlugin } from "./threat-model.js";
import { ToolDriftPlugin } from "./tool-drift.js";

// Commercial and licensing plugins
import { CommercialLicensingPlugin } from "./commercial-licensing.js";
import { CommercialSecurityPlugin } from "./commercial-security.js";
import { ComplianceMonitorPlugin } from "./compliance-monitor.js";
import { LicenseValidatorPlugin } from "./license-validator.js";

// Development plugins
import { ApiCodeGeneratorPlugin } from "./development/api-code-generator.js";
import { CodeGenerationPlugin } from "./development/code-generation.js";
import { ComplianceCheckPlugin } from "./development/compliance-check.js";
import { DocumentationGeneratorPlugin } from "./development/documentation-generator.js";
import { IdeIntegrationPlugin } from "./development/ide-integration.js";
import { IntegrationHelperPlugin } from "./development/integration-helper.js";
import { LearningAdaptationPlugin } from "./development/learning-adaptation.js";
import { PerformanceAnalysisPlugin } from "./development/performance-analysis.js";
import { PerformanceTestingPlugin } from "./development/performance-testing.js";
import { ProblemResolverPlugin } from "./development/problem-resolver.js";
import { SelfImprovementPlugin } from "./development/self-improvement.js";
import { TemplateGeneratorPlugin } from "./development/template-generator.js";
import { TestingFrameworkPlugin } from "./development/testing-framework.js";

export const BUILTIN_PLUGINS: DiagnosticPlugin[] = [
  DevtoolEnvPlugin,
  AuthPlugin,
  DiscoveryPlugin,
  ProtocolPlugin,
  JsonRpcBatchPlugin,
  PermissioningPlugin,
  StreamingSsePlugin,
  SseReconnectPlugin,
  CorsPlugin,
  RateLimitPlugin,
  ToolDriftPlugin,
  GovernancePlugin,
  ThreatModelPlugin,
  PerformancePlugin,
  CommercialLicensingPlugin,
  CommercialSecurityPlugin,
  LicenseValidatorPlugin,
  ComplianceMonitorPlugin,
];

export const DEVELOPMENT_PLUGINS: DevelopmentPlugin[] = [
  CodeGenerationPlugin,
  PerformanceAnalysisPlugin,
  ComplianceCheckPlugin,
  TemplateGeneratorPlugin,
  ApiCodeGeneratorPlugin,
  ProblemResolverPlugin,
  LearningAdaptationPlugin,
  DocumentationGeneratorPlugin,
  TestingFrameworkPlugin,
  IntegrationHelperPlugin,
  PerformanceTestingPlugin,
  IdeIntegrationPlugin,
  SelfImprovementPlugin,
];

export function getPluginById(id: string): DiagnosticPlugin | undefined {
  return BUILTIN_PLUGINS.find((p) => p.id === id);
}

export function getDevelopmentPluginById(
  id: string,
): DevelopmentPlugin | undefined {
  return DEVELOPMENT_PLUGINS.find((p) => p.id === id);
}
