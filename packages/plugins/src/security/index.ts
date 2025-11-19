/**
 * Security Module Exports
 * Local-first security framework for CortexDx
 */

export {
  LocalEncryptionService,
  SecureLocalStorage,
  type EncryptedData,
  type SecureStorageOptions,
  type SecurityConfig
} from "./local-security.js";

export {
  SecureExecutionEnvironment,
  SecureLlmAdapter,
  SecureModelStorage,
  type ExecutionContext,
  type ExecutionPolicy,
  type ModelStorageConfig
} from "./secure-execution.js";

export {
  OwaspSecurityScanner,
  SecurityValidator,
  type SecurityRecommendation,
  type SecurityScanResult,
  type VulnerabilityReport
} from "./security-validator.js";

export {
  AuditLogger,
  ComplianceReporter,
  SecurityMonitor,
  type AuditEntry,
  type ComplianceReport,
  type SecurityAlert
} from "./audit-compliance.js";

export {
  SecurityMonitoringService,
  type AlertThresholds,
  type SecurityMonitoringConfig,
  type SecurityReport,
  type SecuritySummary
} from "./security-monitoring.js";

export {
  ASVSComplianceEngine,
  type ASVSFinding,
  type ASVSLevel,
  type ASVSMapping,
  type ASVSReport,
  type ASVSRequirement
} from "./asvs-compliance.js";

export {
  ATLASThreatDetector,
  type ATLASFinding,
  type ATLASReport,
  type ATLASTechnique,
  type ExfiltrationDetection,
  type PoisoningDetection,
  type PromptInjectionResult
} from "./atlas-threat-detector.js";

export {
  normalizeSemgrepResults, SemgrepIntegration, type NormalizedFinding,
  type SemgrepFinding,
  type SemgrepResults,
  type SemgrepRule
} from "./semgrep-integration.js";

export {
  GitleaksIntegration,
  normalizeGitleaksResults,
  type GitleaksConfig,
  type GitleaksRule,
  type NormalizedSecretFinding,
  type Secret,
  type SecretFindings
} from "./gitleaks-integration.js";

export {
  normalizeZAPResults, ZAPIntegration, type NormalizedZAPFinding,
  type ZAPConfig,
  type ZAPFinding,
  type ZAPResults
} from "./zap-integration.js";

export {
  annotateControlEvidence,
  buildCoverageGapDescription,
  getMissingControls,
  type ControlMetadata,
} from "./control-mappings.js";
