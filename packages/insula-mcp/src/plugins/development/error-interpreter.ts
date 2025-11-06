/**
 * Error Interpreter Plugin
 * Intelligent error analysis with user-friendly explanations and troubleshooting
 * Requirements: 9.3, 6.2, 4.2
 * Performance: <5s response time
 */

import type {
  ChatMessage,
  ConversationalPlugin,
  ConversationResponse,
  ConversationSession,
  DevelopmentContext,
  Finding,
  RankedSolution,
} from "../../types.js";

interface ErrorAnalysisState extends Record<string, unknown> {
  error?: ParsedError;
  analysis?: ErrorAnalysis;
  solutions?: RankedSolution[];
  selectedSolution?: RankedSolution;
  phase: "parsing" | "analyzing" | "solutions" | "applying";
}

interface ParsedError {
  type: string;
  message: string;
  stack?: string;
  code?: string;
  context?: Record<string, unknown>;
  severity: "info" | "minor" | "major" | "blocker";
}

interface ErrorAnalysis {
  category: string;
  probableCause: string;
  userFriendlyExplanation: string;
  technicalDetails: string;
  relatedConcepts: string[];
  confidence: number;
}

export const ErrorInterpreterPlugin: ConversationalPlugin = {
  id: "error-interpreter",
  title: "Intelligent Error Interpreter",
  category: "conversational",
  order: 21,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    if (!ctx.conversationalLlm) {
      findings.push({
        id: "error-interpreter.llm.missing",
        area: "development",
        severity: "minor",
        title: "Error interpreter LLM not available",
        description:
          "No conversational LLM adapter configured for error interpretation.",
        evidence: [{ type: "log", ref: "error-interpreter" }],
        recommendation:
          "Configure a conversational LLM adapter to enable intelligent error analysis.",
      });
      return findings;
    }

    // Scan conversation for error patterns
    const errors = detectErrors(ctx);

    if (errors.length > 0) {
      findings.push({
        id: "error-interpreter.errors.found",
        area: "debugging",
        severity: "major",
        title: `Found ${errors.length} error(s) to analyze`,
        description: `Detected errors: ${errors.map((e) => e.type).join(", ")}`,
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "I can help you understand these errors:\n" +
          "- Plain English explanations\n" +
          "- Probable causes ranked by likelihood\n" +
          "- Step-by-step troubleshooting\n" +
          "- Multiple solution options\n\n" +
          "Just share the error message and I'll break it down for you.",
        tags: ["error-analysis", ...errors.map((e) => e.type)],
      });
    }

    // Validate performance requirement (<5s)
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      findings.push({
        id: "error-interpreter.performance.slow",
        area: "performance",
        severity: "minor",
        title: "Error analysis exceeded time threshold",
        description: `Analysis took ${duration}ms, exceeding 5s requirement`,
        evidence: [{ type: "log", ref: "error-interpreter" }],
        confidence: 1.0,
      });
    }

    return findings;
  },

  async initiateConversation(
    ctx: DevelopmentContext,
    intent: string,
  ): Promise<ConversationSession> {
    const sessionId = `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Try to parse error from intent
    const error = parseErrorFromText(intent);

    const state: ErrorAnalysisState = {
      error,
      phase: error ? "analyzing" : "parsing",
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
          "I need a conversational LLM to analyze errors. Please configure an LLM adapter.",
        needsInput: false,
        completed: true,
        session,
      };
    }

    const state = session.state as unknown as ErrorAnalysisState;

    // Parse error if not already done
    if (!state.error && state.phase === "parsing") {
      state.error = parseErrorFromText(userInput);
      if (state.error) {
        state.phase = "analyzing";
      }
    }

    // Build error analysis context
    const systemPrompt = buildErrorAnalysisPrompt(session, state);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...session.context.conversationHistory.slice(-5),
      { role: "user", content: userInput },
    ];

    try {
      const response = await conversationalLlm.chat(messages, {
        maxTokens: 1200,
        temperature: 0.2, // Low temperature for accurate error analysis
        systemPrompt,
      });

      // Update state based on response
      updateErrorAnalysisState(state, response);
      session.lastActivity = Date.now();

      // Generate actions
      const actions = generateErrorActions(state, response);

      // Check if analysis is complete
      const completed =
        state.phase === "applying" &&
        (response.toLowerCase().includes("resolved") ||
          response.toLowerCase().includes("fixed"));

      return {
        message: response,
        actions,
        needsInput: !completed,
        completed,
        session,
      };
    } catch (error) {
      return {
        message: `Error during analysis: ${error instanceof Error ? error.message : "Unknown error"}`,
        needsInput: true,
        completed: false,
        session,
      };
    }
  },
};

function detectErrors(ctx: DevelopmentContext): ParsedError[] {
  const errors: ParsedError[] = [];
  const conversation = ctx.conversationHistory
    .filter((m) => m.role === "user")
    .slice(-10);

  for (const msg of conversation) {
    const parsed = parseErrorFromText(msg.content);
    if (parsed) {
      errors.push(parsed);
    }
  }

  return errors;
}

function parseErrorFromText(text: string): ParsedError | undefined {
  const lowerText = text.toLowerCase();

  // Check for common error patterns
  const errorPatterns = [
    {
      regex: /(\w+Error):\s*(.+?)(?:\n|$)/i,
      type: "javascript",
    },
    {
      regex: /Exception:\s*(.+?)(?:\n|$)/i,
      type: "exception",
    },
    {
      regex: /Error\s+(\d+):\s*(.+?)(?:\n|$)/i,
      type: "numbered",
    },
    {
      regex: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i,
      type: "network",
    },
    {
      regex: /JSON\.parse|Unexpected token|Unexpected end of JSON/i,
      type: "json-parse",
    },
    {
      regex: /401|403|Unauthorized|Forbidden/i,
      type: "authentication",
    },
    {
      regex: /CORS|Cross-Origin/i,
      type: "cors",
    },
  ];

  for (const pattern of errorPatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      return {
        type: pattern.type,
        message: match[0],
        severity: determineSeverity(pattern.type),
      };
    }
  }

  // Generic error detection
  if (
    lowerText.includes("error") ||
    lowerText.includes("fail") ||
    lowerText.includes("exception")
  ) {
    return {
      type: "generic",
      message: text.substring(0, 200),
      severity: "major",
    };
  }

  return undefined;
}

function determineSeverity(
  errorType: string,
): "info" | "minor" | "major" | "blocker" {
  const severityMap: Record<string, "info" | "minor" | "major" | "blocker"> = {
    network: "major",
    authentication: "blocker",
    cors: "major",
    "json-parse": "major",
    exception: "major",
    javascript: "major",
    numbered: "minor",
    generic: "minor",
  };

  return severityMap[errorType] || "minor";
}

function buildErrorAnalysisPrompt(
  session: ConversationSession,
  state: ErrorAnalysisState,
): string {
  const { userExpertiseLevel } = session.context;
  const { error, phase } = state;

  let prompt = "You are an expert error interpreter for MCP development. ";

  // Adjust for user level
  switch (userExpertiseLevel) {
    case "beginner":
      prompt +=
        "The user is new to development. Explain errors in simple terms, avoid jargon, and provide clear step-by-step guidance. ";
      break;
    case "intermediate":
      prompt +=
        "The user has some experience. Provide balanced explanations with practical solutions. ";
      break;
    case "expert":
      prompt +=
        "The user is experienced. Focus on technical root causes and efficient solutions. ";
      break;
  }

  // Add phase-specific guidance
  switch (phase) {
    case "parsing":
      prompt +=
        "Help the user share their error message. Ask for: the full error text, when it occurs, and what they were trying to do. ";
      break;
    case "analyzing":
      prompt +=
        "Analyze the error and explain:\n" +
        "1. What the error means in plain English\n" +
        "2. The most likely cause\n" +
        "3. Why it happens\n" +
        "4. Related concepts they should understand\n";
      break;
    case "solutions":
      prompt +=
        "Provide multiple solutions ranked by likelihood of success:\n" +
        "1. Quick fixes (if available)\n" +
        "2. Standard solutions\n" +
        "3. Alternative approaches\n" +
        "For each solution, explain the steps clearly and why it works. ";
      break;
    case "applying":
      prompt +=
        "Guide the user through applying the solution. Provide validation steps to confirm the fix worked. ";
      break;
  }

  if (error) {
    prompt += `\n\nError to analyze:\nType: ${error.type}\nMessage: ${error.message}\n`;
    if (error.stack) {
      prompt += `Stack: ${error.stack.substring(0, 300)}\n`;
    }
  }

  prompt +=
    "\n\nBe clear, empathetic, and solution-focused. Respond in under 5 seconds.";

  return prompt;
}

function updateErrorAnalysisState(
  state: ErrorAnalysisState,
  response: string,
): void {
  const lowerResponse = response.toLowerCase();

  // Progress through phases
  if (state.phase === "parsing" && state.error) {
    state.phase = "analyzing";
  } else if (state.phase === "analyzing") {
    if (
      lowerResponse.includes("solution") ||
      lowerResponse.includes("fix") ||
      lowerResponse.includes("try")
    ) {
      state.phase = "solutions";
    }
  } else if (state.phase === "solutions") {
    if (
      lowerResponse.includes("apply") ||
      lowerResponse.includes("implement") ||
      lowerResponse.includes("step")
    ) {
      state.phase = "applying";
    }
  }
}

function generateErrorActions(
  state: ErrorAnalysisState,
  response: string,
): Array<{
  type: "code_generation" | "file_creation" | "configuration" | "validation";
  description: string;
  data: unknown;
  conversationPrompt: string;
}> {
  const actions = [];
  const lowerResponse = response.toLowerCase();

  // Suggest code fixes
  if (
    state.phase === "solutions" &&
    (lowerResponse.includes("code") || lowerResponse.includes("change"))
  ) {
    actions.push({
      type: "code_generation" as const,
      description: "Generate error fix code",
      data: { error: state.error },
      conversationPrompt: "Generate the code to fix this error",
    });
  }

  // Suggest configuration changes
  if (
    lowerResponse.includes("config") ||
    lowerResponse.includes("setting") ||
    lowerResponse.includes("environment")
  ) {
    actions.push({
      type: "configuration" as const,
      description: "Update configuration to fix error",
      data: { error: state.error },
      conversationPrompt: "Help me update the configuration",
    });
  }

  // Suggest validation
  if (state.phase === "applying") {
    actions.push({
      type: "validation" as const,
      description: "Validate error is fixed",
      data: { error: state.error },
      conversationPrompt: "How do I verify the error is fixed?",
    });
  }

  return actions;
}
