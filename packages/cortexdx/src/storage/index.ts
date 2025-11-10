/**
 * Storage exports for CortexDx
 */

// Conversation storage
export {
  ConversationStorage,
  createConversationStorage,
  type ConversationExport,
  type StoredConversation
} from "./conversation-storage.js";

// Pattern storage
export {
  createInMemoryStorage,
  createPersistentStorage,
  type CommonIssuePattern,
  type EnhancedPatternStorage,
  type FeedbackEntry,
  type PatternRetrievalOptions,
  type PatternStatistics,
  type PatternStorage,
  type ResolutionPattern
} from "./pattern-storage.js";

// SQLite pattern storage with encryption and anonymization
export {
  PatternAnonymizer,
  PatternEncryption, createSQLitePatternStorage
} from "./pattern-storage-sqlite.js";

// Vector storage
export {
  VectorStorage, createPatternDocument,
  createProblemDocument,
  createSolutionDocument,
  createVectorStorage, type DocumentMetadata,
  type SearchOptions,
  type SearchResult,
  type VectorDocument,
  type VectorStorageStats
} from "./vector-storage.js";

// Report management
export {
  ReportManager,
  type DiagnosticReport,
  type ReportConfig,
  type ReportFilters,
  type ReportFormat,
  type ReportMetadata,
  type StorageOptions
} from "./report-manager.js";

// Report configuration
export {
  ReportConfigManager,
  type ReportConfigOptions
} from "./report-config.js";

// Report optimization
export {
  ReportOptimizer,
  type FindingSummary,
  type OptimizedResponse,
  type ReportSearchResult
} from "./report-optimizer.js";

