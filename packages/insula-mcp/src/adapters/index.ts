/**
 * Adapter exports for Insula MCP
 */

export type { EnhancedLlmAdapter } from "../types.js";
export { httpAdapter } from "./http.js";
export {
    createIdeAdapter,
    IdeAdapter,
    type IdeAdapterConfig,
    type IdeCapabilities
} from "./ide-adapter.js";
export { createMlxAdapter, type MlxConfig } from "./mlx.js";
export { createOllamaAdapter, type OllamaConfig } from "./ollama.js";

