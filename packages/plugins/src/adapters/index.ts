/**
 * Adapter exports for CortexDx
 */

export type { EnhancedLlmAdapter } from "@brainwav/cortexdx-core";
export { httpAdapter } from "./http.js";
export {
  IdeAdapter, createIdeAdapter, type IdeAdapterConfig,
  type IdeCapabilities
} from "./ide-adapter.js";
// Re-export OllamaAdapter from ml package (canonical implementation)
export { OllamaAdapter, createOllamaAdapter, type OllamaConfig } from "@brainwav/cortexdx-ml";

// Embedding adapters
export { cosineSimilarity, normalizeVector } from "./embedding.js";
export type {
  EmbeddingAdapter,
  EmbeddingBatchRequest,
  EmbeddingModelInfo,
  EmbeddingRequest,
  EmbeddingVector
} from "./embedding.js";
export {
  OllamaEmbeddingAdapter, createOllamaEmbeddingAdapter, type OllamaEmbeddingConfig
} from "./ollama-embedding.js";

// OAuth authenticator
export {
  OAuthAuthenticator,
  oauthAuthenticator,
  type DeviceCodeResult,
  type OAuth2Config,
  type OAuth2Session,
  type TokenResult,
  type TokenValidation
} from "./oauth-authenticator.js";

// Credential manager
export {
  CredentialManager,
  credentialManager, type CredentialStorage, type Credentials
} from "./credential-manager.js";

// OAuth integration
export {
  OAuthIntegration, createAuthenticatedContext, oauthIntegration,
  type AuthDetectionResult,
  type AuthenticatedRequestOptions
} from "./oauth-integration.js";

// Clinic.js adapter for Node.js performance profiling
export {
  ClinicAdapter,
  type ClinicBubbleprofResult,
  type ClinicDoctorResult,
  type ClinicFlameResult,
  type ClinicProfile
} from "./clinic-adapter.js";

// py-spy adapter for Python performance profiling
export {
  PySpyAdapter,
  type PySpyFlameGraphData,
  type PySpyOptions,
  type PySpyProfile
} from "./pyspy-adapter.js";

// Cloud storage adapter for diagnostic reports
export {
  CloudStorageAdapter,
  createCloudStorageFromEnv,
  type CloudStorageConfig,
  type ObjectMetadata,
  type UploadResult
} from "./cloud-storage-adapter.js";

