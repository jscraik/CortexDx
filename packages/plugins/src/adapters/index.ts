/**
 * Adapter exports for CortexDx
 */

export type { EnhancedLlmAdapter } from "@brainwav/cortexdx-core";
export { httpAdapter } from "./http.js";
export {
  createIdeAdapter,
  IdeAdapter,
  type IdeAdapterConfig,
  type IdeCapabilities,
} from "./ide-adapter.js";
export { createOllamaAdapter, type OllamaConfig } from "./ollama.js";

// Embedding adapters
export { cosineSimilarity, normalizeVector } from "./embedding.js";
export type {
  EmbeddingAdapter,
  EmbeddingBatchRequest,
  EmbeddingModelInfo,
  EmbeddingRequest,
  EmbeddingVector,
} from "./embedding.js";
export {
  createOllamaEmbeddingAdapter,
  OllamaEmbeddingAdapter,
  type OllamaEmbeddingConfig,
} from "./ollama-embedding.js";

// OAuth authenticator
export {
  OAuthAuthenticator,
  oauthAuthenticator,
  type DeviceCodeResult,
  type OAuth2Config,
  type OAuth2Session,
  type TokenResult,
  type TokenValidation,
} from "./oauth-authenticator.js";

// Credential manager
export {
  CredentialManager,
  credentialManager,
  type Credentials,
  type CredentialStorage,
} from "./credential-manager.js";

// OAuth integration
export {
  createAuthenticatedContext,
  OAuthIntegration,
  oauthIntegration,
  type AuthDetectionResult,
  type AuthenticatedRequestOptions,
} from "./oauth-integration.js";

// Clinic.js adapter for Node.js performance profiling
export {
  ClinicAdapter,
  type ClinicBubbleprofResult,
  type ClinicDoctorResult,
  type ClinicFlameResult,
  type ClinicProfile,
} from "./clinic-adapter.js";

// py-spy adapter for Python performance profiling
export {
  PySpyAdapter,
  type PySpyFlameGraphData,
  type PySpyOptions,
  type PySpyProfile,
} from "./pyspy-adapter.js";

// Cloud storage adapter for diagnostic reports
export {
  CloudStorageAdapter,
  createCloudStorageFromEnv,
  type CloudStorageConfig,
  type ObjectMetadata,
  type UploadResult,
} from "./cloud-storage-adapter.js";
