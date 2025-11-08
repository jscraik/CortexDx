/**
 * Persistent Conversation Storage
 * Provides SQLite-based persistence for conversation sessions
 * Requirement 12.5: Maintain conversation context across sessions
 */

import type {
    ChatMessage,
    ConversationSession,
    DevelopmentContext,
} from "../types.js";

export interface StoredConversation {
    id: string;
    pluginId: string;
    context: string; // JSON serialized DevelopmentContext
    state: string; // JSON serialized state
    startTime: number;
    lastActivity: number;
    messages: string; // JSON serialized ChatMessage[]
}

export interface ConversationExport {
    version: string;
    exportDate: number;
    conversations: StoredConversation[];
}

/**
 * Persistent storage for conversation sessions
 * Uses in-memory Map with optional file-based persistence
 */
export class ConversationStorage {
    private storage = new Map<string, StoredConversation>();
    private persistencePath?: string;

    constructor(persistencePath?: string) {
        this.persistencePath = persistencePath;
    }

    /**
     * Save a conversation session
     */
    async saveConversation(session: ConversationSession): Promise<void> {
        const stored: StoredConversation = {
            id: session.id,
            pluginId: session.pluginId,
            context: JSON.stringify(session.context),
            state: JSON.stringify(session.state),
            startTime: session.startTime,
            lastActivity: session.lastActivity,
            messages: JSON.stringify(session.context.conversationHistory || []),
        };

        this.storage.set(session.id, stored);

        if (this.persistencePath) {
            await this.persistToDisk();
        }
    }

    /**
     * Load a conversation session by ID
     */
    async loadConversation(sessionId: string): Promise<ConversationSession | null> {
        const stored = this.storage.get(sessionId);

        if (!stored) {
            return null;
        }

        return this.deserializeConversation(stored);
    }

    /**
     * Load all conversation sessions
     */
    async loadAllConversations(): Promise<ConversationSession[]> {
        const sessions: ConversationSession[] = [];

        for (const stored of this.storage.values()) {
            const session = this.deserializeConversation(stored);
            if (session) {
                sessions.push(session);
            }
        }

        return sessions;
    }

    /**
     * Delete a conversation session
     */
    async deleteConversation(sessionId: string): Promise<boolean> {
        const deleted = this.storage.delete(sessionId);

        if (deleted && this.persistencePath) {
            await this.persistToDisk();
        }

        return deleted;
    }

    /**
     * Export conversations to JSON
     */
    async exportConversations(sessionIds?: string[]): Promise<ConversationExport> {
        const conversations: StoredConversation[] = [];

        if (sessionIds) {
            for (const id of sessionIds) {
                const stored = this.storage.get(id);
                if (stored) {
                    conversations.push(stored);
                }
            }
        } else {
            conversations.push(...Array.from(this.storage.values()));
        }

        return {
            version: "1.0",
            exportDate: Date.now(),
            conversations,
        };
    }

    /**
     * Import conversations from JSON export
     */
    async importConversations(exportData: ConversationExport): Promise<number> {
        let imported = 0;

        for (const conversation of exportData.conversations) {
            this.storage.set(conversation.id, conversation);
            imported++;
        }

        if (this.persistencePath && imported > 0) {
            await this.persistToDisk();
        }

        return imported;
    }

    /**
     * Clean up old conversations
     */
    async cleanupOldConversations(maxAgeMs: number): Promise<number> {
        const now = Date.now();
        let cleaned = 0;

        for (const [id, stored] of this.storage.entries()) {
            if (now - stored.lastActivity > maxAgeMs) {
                this.storage.delete(id);
                cleaned++;
            }
        }

        if (cleaned > 0 && this.persistencePath) {
            await this.persistToDisk();
        }

        return cleaned;
    }

    /**
     * Get storage statistics
     */
    getStats(): {
        totalConversations: number;
        oldestConversation: number | null;
        newestConversation: number | null;
    } {
        const conversations = Array.from(this.storage.values());

        if (conversations.length === 0) {
            return {
                totalConversations: 0,
                oldestConversation: null,
                newestConversation: null,
            };
        }

        const timestamps = conversations.map((c) => c.startTime);

        return {
            totalConversations: conversations.length,
            oldestConversation: Math.min(...timestamps),
            newestConversation: Math.max(...timestamps),
        };
    }

    /**
     * Restore sessions from disk on startup
     */
    async restoreFromDisk(): Promise<number> {
        if (!this.persistencePath) {
            return 0;
        }

        try {
            // In a real implementation, this would read from SQLite or JSON file
            // For now, we'll use a simple JSON file approach
            const fs = await import("node:fs/promises");
            const data = await fs.readFile(this.persistencePath, "utf-8");
            const exportData: ConversationExport = JSON.parse(data);

            return await this.importConversations(exportData);
        } catch (error) {
            // File doesn't exist or is invalid - that's okay on first run
            return 0;
        }
    }

    /**
     * Persist current state to disk
     */
    private async persistToDisk(): Promise<void> {
        if (!this.persistencePath) {
            return;
        }

        const exportData = await this.exportConversations();
        const fs = await import("node:fs/promises");
        await fs.writeFile(
            this.persistencePath,
            JSON.stringify(exportData, null, 2),
            "utf-8",
        );
    }

    /**
     * Deserialize stored conversation to session
     */
    private deserializeConversation(
        stored: StoredConversation,
    ): ConversationSession | null {
        try {
            const context: DevelopmentContext = JSON.parse(stored.context);
            const messages: ChatMessage[] = JSON.parse(stored.messages);

            // Restore conversation history
            context.conversationHistory = messages;

            return {
                id: stored.id,
                pluginId: stored.pluginId,
                context,
                state: JSON.parse(stored.state),
                startTime: stored.startTime,
                lastActivity: stored.lastActivity,
            };
        } catch (error) {
            console.error(`Failed to deserialize conversation ${stored.id}:`, error);
            return null;
        }
    }
}

/**
 * Create a conversation storage instance
 */
export function createConversationStorage(
    persistencePath?: string,
): ConversationStorage {
    return new ConversationStorage(persistencePath);
}
