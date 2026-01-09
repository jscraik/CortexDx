import type {
  CodeAnalysis,
  Constraints,
  Context,
  ConversationContext,
  ConversationId,
  EnhancedLlmAdapter,
  Explanation,
  ModelInfo,
  Problem,
  Solution,
} from "../../src/types.js";

let sessionCounter = 0;

export function createMockLlmAdapter(): EnhancedLlmAdapter {
  const sessions = new Map<ConversationId, ConversationContext>();

  return {
    backend: "ollama",

    async complete(prompt: string): Promise<string> {
      return JSON.stringify({
        summary: "mock-response",
        promptEcho: prompt.slice(0, 120),
      });
    },

    async loadModel(): Promise<void> {
      return;
    },

    async unloadModel(): Promise<void> {
      return;
    },

    async getSupportedModels(): Promise<string[]> {
      return ["mock-llm"];
    },

    async getModelInfo(): Promise<ModelInfo> {
      return {
        name: "mock-llm",
        version: "1.0.0",
        capabilities: ["chat", "completion"],
        contextWindow: 4096,
      };
    },

    async startConversation(
      context: ConversationContext,
    ): Promise<ConversationId> {
      const sessionId = `mock-session-${++sessionCounter}`;
      sessions.set(sessionId, context);
      return sessionId;
    },

    async continueConversation(
      sessionId: ConversationId,
      message: string,
    ): Promise<string> {
      const context = sessions.get(sessionId);
      return `mock-reply:${context?.sessionType ?? "unknown"}:${message.slice(0, 32)}`;
    },

    async endConversation(sessionId: ConversationId): Promise<void> {
      sessions.delete(sessionId);
    },

    async analyzeCode(): Promise<CodeAnalysis> {
      return {
        issues: [],
        suggestions: [],
        metrics: {
          complexity: 0.2,
          maintainability: 0.9,
          testability: 0.8,
          performance: 0.85,
        },
        confidence: 0.95,
      };
    },

    async generateSolution(problem: Problem): Promise<Solution> {
      return {
        id: `mock-solution-${problem.id}`,
        type: "guided",
        confidence: 0.9,
        description: "Mock solution",
        userFriendlyDescription: "Mock solution",
        steps: [],
        codeChanges: [],
        configChanges: [],
        testingStrategy: {
          type: "manual",
          tests: [],
          coverage: 0,
          automated: false,
        },
        rollbackPlan: {
          steps: [],
          automated: false,
          backupRequired: false,
          riskLevel: "low",
        },
        licenseCompliance: {
          requiresLicenseCheck: false,
          approvedLicenses: [],
          proprietaryContent: false,
          approvalRequired: false,
          complianceStatus: "compliant",
        },
      };
    },

    async explainError(error: Error, context: Context): Promise<Explanation> {
      return {
        summary: `mock-explanation:${error.message}`,
        details: context.environment,
        userFriendlyExplanation: "Mock explanation",
        technicalDetails: "Mock technical details",
        relatedConcepts: [],
        nextSteps: ["Mock next step"],
        confidence: 0.9,
      };
    },
  };
}
