/**
 * Conversation Manager for Development Assistance
 * Manages conversational sessions for MCP development guidance
 * Enhanced with persistent storage for cross-session learning
 */

import type {
    ChatMessage,
    ConversationResponse,
    ConversationSession,
    DevelopmentContext
} from "../types.js";
import { ConversationStorage } from "../storage/conversation-storage.js";
import type { ConversationExport } from "../storage/conversation-storage.js";
import { createLogger } from "../logging/logger.js";

const logger = createLogger("conversation-manager");

export class ConversationManager {
    private sessions = new Map<string, ConversationSession>();
    private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
    private storage: ConversationStorage;

    constructor(persistencePath?: string) {
        this.storage = new ConversationStorage(persistencePath);
        // Restore sessions from disk on startup
        this.restoreSessions();
    }

    private async restoreSessions(): Promise<void> {
        try {
            const restored = await this.storage.restoreFromDisk();
            if (restored > 0) {
                const sessions = await this.storage.loadAllConversations();
                for (const session of sessions) {
                    this.sessions.set(session.id, session);
                }
                logger.info({ restoredCount: restored }, `Restored ${restored} conversation sessions from disk`);
            }
        } catch (error) {
            logger.error({ error }, "Failed to restore sessions");
        }
    }

    async startConversation(
        ctx: DevelopmentContext,
        intent: string,
        context?: string
    ): Promise<ConversationSession> {
        const sessionId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const session: ConversationSession = {
            id: sessionId,
            pluginId: "conversational-assistant",
            context: ctx,
            state: {
                intent,
                context,
                phase: "initialization",
                userExpertiseLevel: ctx.userExpertiseLevel
            },
            startTime: Date.now(),
            lastActivity: Date.now()
        };

        this.sessions.set(sessionId, session);

        // Persist to storage
        await this.storage.saveConversation(session);

        // Clean up old sessions
        this.cleanupExpiredSessions();

        return session;
    }

    async continueConversation(
        sessionId: string,
        userInput: string
    ): Promise<ConversationResponse> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Conversation session not found: ${sessionId}`);
        }

        // Update session activity
        session.lastActivity = Date.now();

        // Add user message to conversation history
        const userMessage: ChatMessage = {
            role: "user",
            content: userInput,
            timestamp: Date.now()
        };

        session.context.conversationHistory.push(userMessage);

        // Process the conversation (this would integrate with LLM)
        const response = await this.processConversation(session, userInput);

        // Add assistant response to history
        const assistantMessage: ChatMessage = {
            role: "assistant",
            content: response.message,
            timestamp: Date.now()
        };

        session.context.conversationHistory.push(assistantMessage);

        // Persist updated session
        await this.storage.saveConversation(session);

        return response;
    }

    private async processConversation(
        session: ConversationSession,
        userInput: string
    ): Promise<ConversationResponse> {
        const { intent, phase, userExpertiseLevel } = session.state;

        // This is a simplified implementation
        // In a full implementation, this would use the LLM adapter
        let message = "";
        let needsInput = true;
        let completed = false;

        switch (phase) {
            case "initialization":
                message = this.generateInitializationResponse(intent as string, userExpertiseLevel as string);
                session.state.phase = "requirements_gathering";
                break;

            case "requirements_gathering":
                message = this.generateRequirementsResponse(userInput, userExpertiseLevel as string);
                session.state.phase = "solution_planning";
                break;

            case "solution_planning":
                message = this.generateSolutionResponse(userInput, userExpertiseLevel as string);
                session.state.phase = "implementation";
                break;

            case "implementation":
                message = this.generateImplementationResponse(userInput, userExpertiseLevel as string);
                completed = true;
                needsInput = false;
                break;

            default:
                message = "I'm not sure how to help with that. Could you clarify what you're trying to achieve?";
        }

        return {
            message,
            needsInput,
            completed,
            session,
            actions: this.generateActions(session, userInput)
        };
    }

    private generateInitializationResponse(intent: string, expertiseLevel: string): string {
        const greeting = expertiseLevel === "beginner"
            ? "Hi! I'm here to help you with MCP development. Don't worry if you're new to this - I'll guide you through everything step by step."
            : "Hello! I'm ready to assist you with your MCP development needs.";

        return `${greeting}\n\nI understand you want to: ${intent}\n\nTo get started, could you tell me more about:\n1. What type of MCP component you're building (server, client, or connector)?\n2. What programming language you prefer?\n3. Any specific requirements or constraints you have?`;
    }

    private generateRequirementsResponse(userInput: string, expertiseLevel: string): string {
        return `Thanks for that information! Based on what you've told me, I can help you create a solution.\n\nLet me clarify a few more details:\n1. What data sources or services will your MCP component interact with?\n2. Do you have any authentication requirements?\n3. Are there any performance or scalability considerations?\n\nOnce I understand these requirements, I can suggest the best approach and help you implement it.`;
    }

    private generateSolutionResponse(userInput: string, expertiseLevel: string): string {
        const technical = expertiseLevel === "expert"
            ? "I'll provide detailed technical implementation guidance."
            : "I'll walk you through the implementation with clear explanations.";

        return `Perfect! Based on your requirements, here's what I recommend:\n\n1. **Architecture**: I suggest using a modular approach with separate handlers for each capability\n2. **Implementation**: We'll start with the core MCP protocol implementation and then add your specific features\n3. **Testing**: I'll help you set up proper testing to ensure everything works correctly\n\n${technical}\n\nShall we start with the basic project structure, or do you have questions about the approach?`;
    }

    private generateImplementationResponse(userInput: string, expertiseLevel: string): string {
        return `Great! I'll help you implement this step by step. Let me generate the initial code structure for you.\n\nI'll create:\n1. The main server/client files\n2. Configuration setup\n3. Basic tool implementations\n4. Testing framework\n\nWould you like me to start with the code generation, or do you have any final questions about the implementation?`;
    }

    private generateActions(session: ConversationSession, userInput: string) {
        const { phase } = session.state;

        if (phase === "implementation") {
            return [
                {
                    type: "code_generation" as const,
                    description: "Generate MCP server boilerplate",
                    data: { language: "typescript", framework: "fastify" },
                    conversationPrompt: "Generate the basic MCP server structure"
                },
                {
                    type: "file_creation" as const,
                    description: "Create configuration files",
                    data: { files: ["package.json", "tsconfig.json", ".env.example"] },
                    conversationPrompt: "Set up the project configuration"
                }
            ];
        }

        return [];
    }

    private cleanupExpiredSessions(): void {
        const now = Date.now();

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
                // Also delete from persistent storage
                this.storage.deleteConversation(sessionId);
            }
        }
    }

    getSession(sessionId: string): ConversationSession | undefined {
        return this.sessions.get(sessionId);
    }

    getAllSessions(): ConversationSession[] {
        return Array.from(this.sessions.values());
    }

    async endSession(sessionId: string): Promise<boolean> {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            await this.storage.deleteConversation(sessionId);
        }
        return deleted;
    }

    /**
     * Export conversations for backup or transfer
     */
    async exportConversations(sessionIds?: string[]) {
        return await this.storage.exportConversations(sessionIds);
    }

    /**
     * Import conversations from backup
     */
    async importConversations(exportData: ConversationExport) {
        const imported = await this.storage.importConversations(exportData);
        // Reload sessions into memory
        const sessions = await this.storage.loadAllConversations();
        for (const session of sessions) {
            this.sessions.set(session.id, session);
        }
        return imported;
    }

    /**
     * Get storage statistics
     */
    getStorageStats() {
        return this.storage.getStats();
    }
}
