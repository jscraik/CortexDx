/**
 * Interactive Debugger Plugin
 * Conversational debugging with step-by-step diagnosis and context-aware questioning
 * Requirements: 4.1, 9.1, 9.2
 * Performance: <10s response time for session start
 */

import type {
  ChatMessage,
  ConversationalPlugin,
  ConversationResponse,
  ConversationSession,
  DevelopmentContext,
  Finding,
  MultipleInputs,
  Problem,
} from "../../types.js";

interface DebuggingState extends Record<string, unknown> {
  problem?: Problem;
  currentPhase: "analysis" | "diagnosis" | "solution" | "validation";
  hypotheses: Hypothesis[];
  selectedHypothesis?: Hypothesis;
  attemptedSolutions: string[];
  multipleInputs?: MultipleInputs;
}

interface Hypothesis {
  id: string;
  description: string;
  probability: number;
  evidence: string[];
  nextSteps: string[];
}

export const InteractiveDebuggerPlugin: ConversationalPlugin = {
  id: "interactive-debugger",
  title: "Interactive MCP Debugger",
  category: "conversational",
  order: 20,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if conversational LLM is available
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "debugger.llm.missing",
        area: "development",
        severity: "minor",
        title: "Interactive debugger LLM not available",
        description:
          "No conversational LLM adapter configured for interactive debugging.",
        evidence: [{ type: "log", ref: "interactive-debugger" }],
        recommendation:
          "Configure a conversational LLM adapter to enable step-by-step debugging assistance.",
      });
      return findings;
    }

    // Analyze conversation for debugging opportunities
    const recentMessages = ctx.conversationHistory.slice(-5);
    const hasDebuggingRequest = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("debug") ||
          msg.content.toLowerCase().includes("error") ||
          msg.content.toLowerCase().includes("fail") ||
          msg.content.toLowerCase().includes("not work") ||
          msg.content.toLowerCase().includes("issue") ||
          msg.content.toLowerCase().includes("problem")),
    );

    if (hasDebuggingRequest) {
      findings.push({
        id: "debugger.session.available",
        area: "development",
        severity: "info",
        title: "Interactive debugging session available",
        description:
          "I detected you're experiencing an issue. I can help debug it step-by-step.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Start an interactive debugging session by describing:\n" +
          "- What you're trying to do\n" +
          "- What's happening instead\n" +
          "- Any error messages or logs\n" +
          "- Your configuration files (optional)\n\n" +
          "I'll analyze everything together and guide you through fixing it.",
      });
    }

    // Check for error patterns in conversation
    const errorPatterns = detectErrorPatterns(ctx);
    if (errorPatterns.length > 0) {
      findings.push({
        id: "debugger.errors.detected",
        area: "debugging",
        severity: "major",
        title: `Detected ${errorPatterns.length} error pattern(s)`,
        description: `Found patterns suggesting: ${errorPatterns.join(", ")}`,
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "Let me help you debug these issues. I can:\n" +
          "- Analyze error messages and logs together\n" +
          "- Ask targeted questions to narrow down the cause\n" +
          "- Suggest multiple solutions ranked by likelihood\n" +
          "- Validate fixes automatically",
        tags: ["debugging", "interactive", ...errorPatterns],
      });
    }

    // Validate performance requirement (<10s for session start)
    const duration = Date.now() - startTime;
    if (duration > 10000) {
      findings.push({
        id: "debugger.performance.slow",
        area: "performance",
        severity: "minor",
        title: "Debugger analysis exceeded time threshold",
        description: `Analysis took ${duration}ms, exceeding 10s requirement`,
        evidence: [{ type: "log", ref: "interactive-debugger" }],
        confidence: 1.0,
      });
    }

    return findings;
  },

  async initiateConversation(
    ctx: DevelopmentContext,
    intent: string,
  ): Promise<ConversationSession> {
    const sessionId = `debug-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Extract problem context from intent and conversation
    const problem = extractProblemFromContext(ctx, intent);

    const state: DebuggingState = {
      problem,
      currentPhase: "analysis",
      hypotheses: [],
      attemptedSolutions: [],
    };

    return {
      id: sessionId,
      pluginId: this.id,
      context: ctx,
      state,
      startTime: Date.now(),
      lastActivity: Date.now(),
    };
  },

  async continueConversation(
    session: ConversationSession,
    userInput: string,
  ): Promise<ConversationResponse> {
    const { conversationalLlm } = session.context;

    if (!conversationalLlm) {
      return {
        message:
          "I need a conversational LLM to provide debugging assistance. Please configure an LLM adapter.",
        needsInput: false,
        completed: true,
        session,
      };
    }

    const state = session.state as unknown as DebuggingState;

    // Check if user is providing multiple inputs (logs, configs, code)
    const inputs = parseMultipleInputs(userInput);
    if (inputs) {
      state.multipleInputs = inputs;
    }

    // Build debugging context
    const systemPrompt = buildDebuggingSystemPrompt(session, state);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...session.context.conversationHistory,
      { role: "user", content: userInput },
    ];

    try {
      const response = await conversationalLlm.chat(messages, {
        maxTokens: 1500,
        temperature: 0.3, // Lower temperature for more focused debugging
        systemPrompt,
      });

      // Update session state based on response
      updateDebuggingState(state, userInput, response);
      session.lastActivity = Date.now();

      // Generate actions based on current phase
      const actions = generateDebuggingActions(state, response);

      // Check if debugging is complete
      const completed =
        (state.currentPhase === "validation" &&
          response.toLowerCase().includes("fixed")) ||
        response.toLowerCase().includes("resolved");

      return {
        message: response,
        actions,
        needsInput: !completed,
        completed,
        session,
      };
    } catch (error) {
      return {
        message: `I encountered an error while debugging: ${error instanceof Error ? error.message : "Unknown error"}`,
        needsInput: true,
        completed: false,
        session,
      };
    }
  },
};

function detectErrorPatterns(ctx: DevelopmentContext): string[] {
  const patterns: string[] = [];
  const conversation = ctx.conversationHistory
    .map((m) => m.content.toLowerCase())
    .join(" ");

  if (conversation.includes("timeout") || conversation.includes("timed out")) {
    patterns.push("timeout");
  }
  if (
    conversation.includes("connection") &&
    (conversation.includes("refused") || conversation.includes("failed"))
  ) {
    patterns.push("connection-failure");
  }
  if (
    conversation.includes("json") &&
    (conversation.includes("parse") || conversation.includes("invalid"))
  ) {
    patterns.push("json-parse-error");
  }
  if (
    conversation.includes("auth") ||
    conversation.includes("unauthorized") ||
    conversation.includes("403") ||
    conversation.includes("401")
  ) {
    patterns.push("authentication");
  }
  if (conversation.includes("protocol") || conversation.includes("json-rpc")) {
    patterns.push("protocol-compliance");
  }
  if (conversation.includes("cors")) {
    patterns.push("cors");
  }

  return patterns;
}

function extractProblemFromContext(
  ctx: DevelopmentContext,
  intent: string,
): Problem | undefined {
  const recentMessages = ctx.conversationHistory.slice(-10);
  const errorMessages = recentMessages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .filter(
      (c) =>
        c.toLowerCase().includes("error") ||
        c.toLowerCase().includes("fail") ||
        c.toLowerCase().includes("problem"),
    );

  if (errorMessages.length === 0) {
    return undefined;
  }

  // Extract basic problem information
  const description = errorMessages.join("\n");
  const userLevel = ctx.userExpertiseLevel;

  return {
    id: `problem-${Date.now()}`,
    type: "development",
    severity: "major",
    description,
    userFriendlyDescription: `Issue: ${intent}`,
    context: {
      mcpVersion: "2024-11-05",
      serverType: ctx.projectContext?.type || "unknown",
      environment: "development",
      configuration: {},
      errorLogs: errorMessages,
    },
    evidence: [],
    affectedComponents: [],
    suggestedSolutions: [],
    userLevel,
  };
}

function parseMultipleInputs(userInput: string): MultipleInputs | undefined {
  const inputs: MultipleInputs = {
    format: "mixed",
  };

  let hasInputs = false;

  // Check for JSON content
  const jsonMatches = userInput.match(/```json\n([\s\S]*?)\n```/g);
  if (jsonMatches) {
    inputs.configurationFiles = jsonMatches.map((match, idx) => ({
      name: `config-${idx}.json`,
      content: match.replace(/```json\n|\n```/g, ""),
      format: "json" as const,
    }));
    hasInputs = true;
  }

  // Check for YAML content
  const yamlMatches = userInput.match(/```ya?ml\n([\s\S]*?)\n```/g);
  if (yamlMatches) {
    if (!inputs.configurationFiles) {
      inputs.configurationFiles = [];
    }
    inputs.configurationFiles.push(
      ...yamlMatches.map((match, idx) => ({
        name: `config-${idx}.yaml`,
        content: match.replace(/```ya?ml\n|\n```/g, ""),
        format: "yaml" as const,
      })),
    );
    hasInputs = true;
  }

  // Check for code snippets
  const codeMatches = userInput.match(/```(\w+)\n([\s\S]*?)\n```/g);
  if (codeMatches) {
    const snippets = codeMatches
      .filter(
        (match) =>
          !match.startsWith("```json") &&
          !match.startsWith("```yaml") &&
          !match.startsWith("```yml"),
      )
      .map((match) => {
        const langMatch = match.match(/```(\w+)\n/);
        const language = langMatch?.[1] || "text";
        const content = match.replace(/```\w+\n|\n```/g, "");
        return { language, content };
      });
    if (snippets.length > 0) {
      inputs.codeSnippets = snippets;
      hasInputs = true;
    }
  }

  // Check for error messages (lines starting with Error:, Exception:, etc.)
  const errorLines = userInput
    .split("\n")
    .filter(
      (line) =>
        line.trim().startsWith("Error:") ||
        line.trim().startsWith("Exception:") ||
        line.trim().startsWith("TypeError:") ||
        line.trim().startsWith("ReferenceError:") ||
        line.trim().match(/^\w+Error:/),
    );

  if (errorLines.length > 0) {
    inputs.errorMessages = errorLines;
    hasInputs = true;
  }

  return hasInputs ? inputs : undefined;
}

function buildDebuggingSystemPrompt(
  session: ConversationSession,
  state: DebuggingState,
): string {
  const { userExpertiseLevel } = session.context;
  const { currentPhase, problem } = state;

  let prompt = "You are an expert MCP debugging assistant. ";

  // Adjust for user level
  switch (userExpertiseLevel) {
    case "beginner":
      prompt +=
        "The user is new to MCP. Use simple language, explain concepts clearly, and provide step-by-step guidance. ";
      break;
    case "intermediate":
      prompt +=
        "The user has some experience. Balance technical accuracy with clear explanations. ";
      break;
    case "expert":
      prompt +=
        "The user is experienced. Focus on technical details and efficient problem resolution. ";
      break;
  }

  // Add phase-specific guidance
  switch (currentPhase) {
    case "analysis":
      prompt +=
        "You are analyzing the problem. Ask targeted diagnostic questions to understand the issue better. " +
        "Focus on gathering: error messages, configuration details, expected vs actual behavior, and recent changes. ";
      break;
    case "diagnosis":
      prompt +=
        "You are diagnosing the root cause. Generate hypotheses about what might be wrong, ranked by probability. " +
        "Explain your reasoning clearly and suggest specific tests to confirm each hypothesis. ";
      break;
    case "solution":
      prompt +=
        "You are providing solutions. Offer multiple approaches ranked by success likelihood. " +
        "For each solution, provide: clear steps, code examples if needed, and validation methods. ";
      break;
    case "validation":
      prompt +=
        "You are validating the fix. Guide the user through testing the solution and confirming the issue is resolved. " +
        "If the fix didn't work, analyze why and suggest alternative approaches. ";
      break;
  }

  if (problem) {
    prompt += `\n\nCurrent problem: ${problem.userFriendlyDescription}\n`;
    if (problem.context.errorLogs.length > 0) {
      prompt += `Error logs: ${problem.context.errorLogs.join("\n")}\n`;
    }
  }

  prompt +=
    "\n\nBe concise, actionable, and empathetic. Focus on solving the problem efficiently.";

  return prompt;
}

function updateDebuggingState(
  state: DebuggingState,
  userInput: string,
  response: string,
): void {
  const lowerInput = userInput.toLowerCase();
  const lowerResponse = response.toLowerCase();

  // Track attempted solutions
  if (lowerInput.includes("tried") || lowerInput.includes("attempted")) {
    state.attemptedSolutions.push(userInput);
  }

  // Progress phase based on conversation
  if (state.currentPhase === "analysis") {
    // Move to diagnosis if we have enough information
    if (
      state.multipleInputs ||
      (state.problem && state.problem.context.errorLogs.length > 0)
    ) {
      state.currentPhase = "diagnosis";
    }
  } else if (state.currentPhase === "diagnosis") {
    // Move to solution if hypotheses are generated
    if (
      lowerResponse.includes("likely") ||
      lowerResponse.includes("probably") ||
      lowerResponse.includes("cause")
    ) {
      state.currentPhase = "solution";
    }
  } else if (state.currentPhase === "solution") {
    // Move to validation if solution is provided
    if (
      lowerResponse.includes("try") ||
      lowerResponse.includes("fix") ||
      lowerResponse.includes("solution")
    ) {
      state.currentPhase = "validation";
    }
  }
}

function generateDebuggingActions(
  state: DebuggingState,
  response: string,
): Array<{
  type: "code_generation" | "file_creation" | "configuration" | "validation";
  description: string;
  data: unknown;
  conversationPrompt: string;
}> {
  const actions = [];
  const lowerResponse = response.toLowerCase();

  // Suggest code generation if solution involves code changes
  if (
    state.currentPhase === "solution" &&
    (lowerResponse.includes("code") ||
      lowerResponse.includes("implement") ||
      lowerResponse.includes("add"))
  ) {
    actions.push({
      type: "code_generation" as const,
      description: "Generate fix code",
      data: { phase: state.currentPhase },
      conversationPrompt: "Generate the code for this fix",
    });
  }

  // Suggest configuration changes
  if (lowerResponse.includes("config") || lowerResponse.includes("setting")) {
    actions.push({
      type: "configuration" as const,
      description: "Update configuration",
      data: { phase: state.currentPhase },
      conversationPrompt: "Help me update the configuration",
    });
  }

  // Suggest validation when in validation phase
  if (state.currentPhase === "validation") {
    actions.push({
      type: "validation" as const,
      description: "Validate the fix",
      data: { phase: state.currentPhase },
      conversationPrompt: "How do I test if this is fixed?",
    });
  }

  return actions;
}
