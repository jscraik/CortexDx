/**
 * Development Assistant Plugin
 * Guided MCP development workflow with interactive tutorials and code generation
 * Requirements: 1.1, 1.3, 2.3
 * Performance: <15s for example generation, <3s for guidance
 */

import type {
  ChatMessage,
  ConversationalPlugin,
  ConversationResponse,
  ConversationSession,
  DevelopmentContext,
  Finding,
} from "../../types.js";

interface DevelopmentAssistantState extends Record<string, unknown> {
  intent: string;
  phase:
    | "initialization"
    | "planning"
    | "tutorial"
    | "implementation"
    | "validation";
  userExpertiseLevel: "beginner" | "intermediate" | "expert";
  projectType?: string;
  language?: string;
  currentTutorial?: Tutorial;
  generatedExamples?: CodeExample[];
  developmentPlan?: DevelopmentStep[];
  lastUserInput?: string;
}

interface Tutorial {
  id: string;
  title: string;
  steps: TutorialStep[];
  currentStep: number;
  estimatedTime: string;
}

interface TutorialStep {
  order: number;
  title: string;
  explanation: string;
  codeExample?: string;
  practiceTask?: string;
  completed: boolean;
}

interface CodeExample {
  title: string;
  description: string;
  language: string;
  code: string;
  explanation: string;
}

interface DevelopmentStep {
  order: number;
  description: string;
  guidance: string;
  codeTemplate?: string;
  validationCriteria: string;
  completed: boolean;
}

// Helper functions
function buildSystemPrompt(session: ConversationSession): string {
  const state = session.state as unknown as DevelopmentAssistantState;
  const { userExpertiseLevel, projectType, language, intent, phase } = state;

  let prompt = "You are an expert MCP (Model Context Protocol) development assistant. ";

  switch (userExpertiseLevel) {
    case "beginner":
      prompt += "The user is new to MCP development. Provide clear, step-by-step guidance with examples. Use simple language and explain concepts thoroughly. ";
      break;
    case "intermediate":
      prompt += "The user has development experience. Provide practical guidance with code examples and best practices. ";
      break;
    case "expert":
      prompt += "The user is experienced. Focus on advanced patterns, optimization, and technical details. ";
      break;
  }

  prompt += `The user wants to: ${intent}. `;

  if (projectType && language) {
    prompt += `They're working on a ${projectType} project in ${language}. `;
  }

  // Add phase-specific guidance
  switch (phase) {
    case "initialization":
      prompt +=
        "Help them get started by understanding their goals and suggesting a development approach. ";
      break;
    case "planning":
      prompt +=
        "Create a clear development plan with actionable steps. Break down complex tasks into manageable pieces. ";
      break;
    case "tutorial":
      prompt +=
        "Provide interactive tutorial content. Explain concepts clearly, show examples, and offer practice tasks. ";
      break;
    case "implementation":
      prompt +=
        "Guide them through implementation with code suggestions, real-time assistance, and best practices. ";
      break;
    case "validation":
      prompt +=
        "Help them validate their implementation with testing strategies and quality checks. ";
      break;
  }

  prompt += "\n\nProvide helpful, accurate, and actionable advice. Follow MCP protocol specifications (version 2024-11-05) and best practices. Be encouraging and supportive.";

  return prompt;
}

function generateActions(
  session: ConversationSession,
  response: string,
): Array<{
  type: "code_generation" | "file_creation" | "configuration" | "validation";
  description: string;
  data: unknown;
  conversationPrompt: string;
}> {
  const actions = [];
  const state = session.state as unknown as DevelopmentAssistantState;
  const lowerResponse = response.toLowerCase();

  // Check if response mentions code generation
  if (
    lowerResponse.includes("generate") ||
    lowerResponse.includes("create") ||
    lowerResponse.includes("implement")
  ) {
    actions.push({
      type: "code_generation" as const,
      description: "Generate code based on conversation",
      data: {
        language: state.language || "typescript",
        projectType: state.projectType,
        phase: state.phase,
      },
      conversationPrompt: "Generate the code we discussed",
    });
  }

  // Check if response mentions configuration
  if (
    lowerResponse.includes("config") ||
    lowerResponse.includes("setup") ||
    lowerResponse.includes("initialize")
  ) {
    actions.push({
      type: "configuration" as const,
      description: "Set up project configuration",
      data: { projectType: state.projectType },
      conversationPrompt: "Help me set up the configuration files",
    });
  }

  // Check if response mentions file creation
  if (
    lowerResponse.includes("file") ||
    lowerResponse.includes("structure") ||
    lowerResponse.includes("scaffold")
  ) {
    actions.push({
      type: "file_creation" as const,
      description: "Create project files",
      data: { projectType: state.projectType, language: state.language },
      conversationPrompt: "Create the project structure",
    });
  }

  // Check if in validation phase
  if (state.phase === "validation") {
    actions.push({
      type: "validation" as const,
      description: "Validate implementation",
      data: { projectType: state.projectType },
      conversationPrompt: "How do I test this implementation?",
    });
  }

  return actions;
}

function updateDevelopmentState(
  state: DevelopmentAssistantState,
  userInput: string,
  response: string,
): void {
  const lowerInput = userInput.toLowerCase();
  const lowerResponse = response.toLowerCase();

  // Progress through phases based on conversation
  if (state.phase === "initialization") {
    if (
      lowerResponse.includes("plan") ||
      lowerResponse.includes("step") ||
      lowerResponse.includes("approach")
    ) {
      state.phase = "planning";
    }
  } else if (state.phase === "planning") {
    if (
      lowerInput.includes("tutorial") ||
      lowerInput.includes("learn") ||
      lowerInput.includes("teach")
    ) {
      state.phase = "tutorial";
    } else if (
      lowerInput.includes("start") ||
      lowerInput.includes("implement") ||
      lowerInput.includes("code")
    ) {
      state.phase = "implementation";
    }
  } else if (state.phase === "tutorial") {
    if (
      lowerInput.includes("implement") ||
      lowerInput.includes("build") ||
      lowerInput.includes("ready")
    ) {
      state.phase = "implementation";
    }
  } else if (state.phase === "implementation") {
    if (
      lowerInput.includes("test") ||
      lowerInput.includes("validate") ||
      lowerInput.includes("check")
    ) {
      state.phase = "validation";
    }
  }
}

function generateTutorialContent(
  state: DevelopmentAssistantState,
): string | undefined {
  if (state.phase !== "tutorial" || !state.currentTutorial) {
    return undefined;
  }

  const tutorial = state.currentTutorial;
  const currentStep = tutorial.steps[tutorial.currentStep];

  if (!currentStep) {
    return undefined;
  }

  let content = `## ${tutorial.title} - Step ${currentStep.order}\n\n`;
  content += `### ${currentStep.title}\n\n`;
  content += `${currentStep.explanation}\n\n`;

  if (currentStep.codeExample) {
    content += `**Example:**\n\`\`\`${state.language || "typescript"}\n${currentStep.codeExample}\n\`\`\`\n\n`;
  }

  if (currentStep.practiceTask) {
    content += `**Practice:** ${currentStep.practiceTask}\n\n`;
  }

  const progress = `Progress: ${currentStep.order}/${tutorial.steps.length} steps`;
  content += `\n${progress}`;

  return content;
}

export const DevelopmentAssistantPlugin: ConversationalPlugin = {
  id: "development-assistant",
  title: "Interactive Development Assistant",
  category: "conversational",
  order: 1,
  requiresLlm: true,
  supportedLanguages: ["typescript", "javascript", "python", "go"],

  async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Check if conversational LLM is available
    if (!ctx.conversationalLlm) {
      findings.push({
        id: "dev-assistant.llm.missing",
        area: "development",
        severity: "minor",
        title: "Development assistant LLM not available",
        description:
          "No conversational LLM adapter configured. Interactive development assistance will be limited.",
        evidence: [{ type: "log", ref: "development-assistant" }],
        recommendation:
          "Configure the Ollama conversational adapter for guided development workflows and interactive tutorials.",
      });
      return findings;
    }

    // Analyze conversation for development assistance opportunities
    const recentMessages = ctx.conversationHistory.slice(-5);
    const hasDevelopmentIntent = recentMessages.some(
      (msg) =>
        msg.role === "user" &&
        (msg.content.toLowerCase().includes("build") ||
          msg.content.toLowerCase().includes("create") ||
          msg.content.toLowerCase().includes("implement") ||
          msg.content.toLowerCase().includes("develop") ||
          msg.content.toLowerCase().includes("how do i") ||
          msg.content.toLowerCase().includes("tutorial") ||
          msg.content.toLowerCase().includes("learn")),
    );

    if (hasDevelopmentIntent) {
      findings.push({
        id: "dev-assistant.guidance.available",
        area: "development",
        severity: "info",
        title: "Interactive development assistance available",
        description:
          "I can guide you through MCP development with step-by-step tutorials and real-time assistance.",
        evidence: [{ type: "log", ref: "conversation-history" }],
        recommendation:
          "I can help you:\n" +
          "- Learn MCP concepts with interactive tutorials\n" +
          "- Generate code examples and templates\n" +
          "- Get real-time development guidance\n" +
          "- Validate your implementation\n\n" +
          "Just tell me what you want to build!",
        tags: ["development", "tutorial", "guidance"],
      });
    }

    // Check project context for setup opportunities
    if (ctx.projectContext) {
      const { type, language, dependencies } = ctx.projectContext;

      if (type === "mcp-server" && dependencies.length === 0) {
        findings.push({
          id: "dev-assistant.project.setup",
          area: "development",
          severity: "info",
          title: "New MCP project detected",
          description: `Detected a new ${language} ${type} project ready for setup.`,
          evidence: [{ type: "log", ref: "project-context" }],
          recommendation:
            "I can guide you through:\n" +
            "1. Project structure setup\n" +
            "2. Dependency configuration\n" +
            "3. Boilerplate code generation\n" +
            "4. Best practices implementation\n\n" +
            "Would you like a tutorial or should I generate the code?",
          tags: ["setup", "tutorial", "scaffolding"],
        });
      }
    }

    // Validate performance requirement (<3s for guidance)
    const duration = Date.now() - startTime;
    if (duration > 3000) {
      findings.push({
        id: "dev-assistant.performance.slow",
        area: "performance",
        severity: "minor",
        title: "Assistant analysis exceeded time threshold",
        description: `Analysis took ${duration}ms, exceeding 3s requirement`,
        evidence: [{ type: "log", ref: "development-assistant" }],
        confidence: 1.0,
      });
    }

    return findings;
  },

  async initiateConversation(
    ctx: DevelopmentContext,
    intent: string,
  ): Promise<ConversationSession> {
    const sessionId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const state: DevelopmentAssistantState = {
      intent,
      phase: "initialization",
      userExpertiseLevel: ctx.userExpertiseLevel,
      projectType: ctx.projectContext?.type,
      language: ctx.projectContext?.language,
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
          "I need a conversational LLM to provide development assistance. Please configure an LLM adapter.",
        needsInput: false,
        completed: true,
        session,
      };
    }

    const state = session.state as unknown as DevelopmentAssistantState;

    // Check if user is requesting a tutorial
    const lowerInput = userInput.toLowerCase();
    if (
      state.phase === "initialization" &&
      (lowerInput.includes("tutorial") ||
        lowerInput.includes("learn") ||
        lowerInput.includes("teach"))
    ) {
      state.phase = "tutorial";
    }

    // Build conversation context
    const systemPrompt = buildSystemPrompt(session);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...session.context.conversationHistory.slice(-10),
      { role: "user", content: userInput },
    ];

    try {
      const startTime = Date.now();
      const response = await conversationalLlm.chat(messages, {
        maxTokens: 1500,
        temperature: 0.6, // Balanced for creativity and accuracy
        systemPrompt,
      });

      const duration = Date.now() - startTime;

      // Update session state
      updateDevelopmentState(state, userInput, response);
      session.lastActivity = Date.now();
      state.lastUserInput = userInput;

      // Add tutorial content if in tutorial phase
      let finalMessage = response;
      if (state.phase === "tutorial" && state.currentTutorial) {
        const tutorialContent = generateTutorialContent(state);
        if (tutorialContent) {
          finalMessage = `${response}\n\n---\n\n${tutorialContent}`;
        }
      }

      // Check performance requirement
      if (state.phase === "implementation" && duration > 15000) {
        finalMessage += `\n\n_Note: Response took ${duration}ms (target: <15s for examples)_`;
      }

      // Generate actions
      const actions = generateActions(session, response);

      // Check if development is complete
      const completed =
        state.phase === "validation" &&
        (response.toLowerCase().includes("complete") ||
          response.toLowerCase().includes("done") ||
          response.toLowerCase().includes("finished"));

      return {
        message: finalMessage,
        actions,
        needsInput: !completed,
        completed,
        session,
      };
    } catch (error) {
      return {
        message: `I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
        needsInput: true,
        completed: false,
        session,
      };
    }
  },
};
