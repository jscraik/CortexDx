/**
 * Security Module Exports
 * Local-first security framework for Insula MCP
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

