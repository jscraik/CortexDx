/**
 * ML module exports for Insula MCP
 */

export { hasMlx, hasOllama } from "./detect.js";
export {
  LlmOrchestrator,
  createLlmOrchestrator,
  createOrchestratorEvidence,
  type OrchestratorConfig,
} from "./orchestrator.js";
export {
  createLlmAdapter,
  getEnhancedLlmAdapter,
  getLlmAdapter,
  pickLocalLLM,
} from "./router.js";
