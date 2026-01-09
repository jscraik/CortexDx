/**
 * Persistent Conversation Storage
 * Provides SQLite-based persistence for conversation sessions
 * Requirement 12.5: Maintain conversation context across sessions
 */

import type {
  ChatMessage,
  ConversationSession,
  DevelopmentContext,
} from "@brainwav/cortexdx-core";
import { logging } from "@brainwav/cortexdx-core";
import { safeParseJson } from "@brainwav/cortexdx-core/utils/json";
import Database, { type Database as DatabaseType } from "better-sqlite3";

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

const logger = logging.createLogger("conversation-storage");

/**
 * Persistent storage for conversation sessions
 * Uses in-memory Map with optional file-based persistence
 */
export class ConversationStorage {
  private storage = new Map<string, StoredConversation>();
  private persistencePath?: string;
  private db?: DatabaseType;

  constructor(persistencePath?: string) {
    this.persistencePath = persistencePath;
    if (persistencePath) {
      this.initializeDatabase(persistencePath);
    }
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

    if (this.db) {
      this.persistToDatabase(stored);
    }
  }

  /**
   * Load a conversation session by ID
   */
  async loadConversation(
    sessionId: string,
  ): Promise<ConversationSession | null> {
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

    if (deleted && this.db) {
      this.deleteFromDatabase(sessionId);
    }

    return deleted;
  }

  /**
   * Export conversations to JSON
   */
  async exportConversations(
    sessionIds?: string[],
  ): Promise<ConversationExport> {
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

    if (this.db && imported > 0) {
      for (const conversation of exportData.conversations) {
        this.persistToDatabase(conversation);
      }
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

    if (cleaned > 0 && this.db) {
      this.deleteOlderThan(now - maxAgeMs);
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
    return this.restoreFromSQLite();
  }

  async restoreFromSQLite(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const rows = this.db
        .prepare(
          "SELECT id, plugin_id as pluginId, context, state, start_time as startTime, last_activity as lastActivity, messages FROM conversations",
        )
        .all();
      let restored = 0;
      for (const row of rows as StoredConversation[]) {
        this.storage.set(row.id, {
          id: row.id,
          pluginId: row.pluginId,
          context: row.context,
          state: row.state,
          startTime: row.startTime,
          lastActivity: row.lastActivity,
          messages: row.messages,
        });
        restored++;
      }
      return restored;
    } catch (error) {
      logger.error({ error }, "Failed to restore conversations from SQLite");
      return 0;
    }
  }

  private initializeDatabase(path: string): void {
    try {
      this.db = new Database(path);
      this.db.pragma("journal_mode = WAL");
      this.db
        .prepare(
          `CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    plugin_id TEXT NOT NULL,
                    context TEXT NOT NULL,
                    state TEXT NOT NULL,
                    start_time INTEGER NOT NULL,
                    last_activity INTEGER NOT NULL,
                    messages TEXT NOT NULL
                )`,
        )
        .run();
    } catch (error) {
      logger.error({ error }, "Failed to initialize conversation database");
      this.db = undefined;
    }
  }

  private persistToDatabase(conversation: StoredConversation): void {
    if (!this.db) {
      return;
    }
    try {
      this.db
        .prepare(
          `INSERT INTO conversations (id, plugin_id, context, state, start_time, last_activity, messages)
                 VALUES (@id, @pluginId, @context, @state, @startTime, @lastActivity, @messages)
                 ON CONFLICT(id) DO UPDATE SET
                    plugin_id=excluded.plugin_id,
                    context=excluded.context,
                    state=excluded.state,
                    start_time=excluded.start_time,
                    last_activity=excluded.last_activity,
                    messages=excluded.messages`,
        )
        .run(conversation);
    } catch (error) {
      logger.error({ error }, "Failed to persist conversation");
    }
  }

  private deleteFromDatabase(sessionId: string): void {
    if (!this.db) {
      return;
    }
    try {
      this.db.prepare("DELETE FROM conversations WHERE id = ?").run(sessionId);
    } catch (error) {
      logger.error({ error }, "Failed to delete conversation");
    }
  }

  private deleteOlderThan(threshold: number): void {
    if (!this.db) {
      return;
    }
    try {
      this.db
        .prepare("DELETE FROM conversations WHERE last_activity < ?")
        .run(threshold);
    } catch (error) {
      logger.error({ error }, "Failed to cleanup old conversations");
    }
  }

  /**
   * Deserialize stored conversation to session
   */
  private deserializeConversation(
    stored: StoredConversation,
  ): ConversationSession | null {
    try {
      const context: DevelopmentContext = safeParseJson(stored.context);
      const messages: ChatMessage[] = safeParseJson(stored.messages);

      // Restore conversation history
      context.conversationHistory = messages;

      return {
        id: stored.id,
        pluginId: stored.pluginId,
        context,
        state: safeParseJson(stored.state),
        startTime: stored.startTime,
        lastActivity: stored.lastActivity,
      };
    } catch (error) {
      logger.error(
        { error, conversationId: stored.id },
        "Failed to deserialize conversation",
      );
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
