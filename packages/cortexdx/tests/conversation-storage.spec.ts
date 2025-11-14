import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConversationStorage } from "../src/storage/conversation-storage.js";
import type { ConversationSession, DevelopmentContext } from "../src/types.js";

describe("Conversation Storage Tests", () => {
    let persistenceDir: string;
    let testPersistencePath: string;
    let storage: ConversationStorage;

    beforeEach(async () => {
        persistenceDir = await mkdtemp(join(tmpdir(), "cortexdx-conv-"));
        testPersistencePath = join(persistenceDir, "conversations.sqlite");
        storage = new ConversationStorage(testPersistencePath);
    });

    afterEach(async () => {
        await rm(persistenceDir, { recursive: true, force: true });
    });

    describe("Basic Storage Operations", () => {
        it("should save and load a conversation session", async () => {
            const session: ConversationSession = {
                id: "test-session-1",
                pluginId: "test-plugin",
                context: {
                    userExpertiseLevel: "beginner",
                    conversationHistory: [],
                } as DevelopmentContext,
                state: { phase: "initialization" },
                startTime: Date.now(),
                lastActivity: Date.now(),
            };

            await storage.saveConversation(session);
            const loaded = await storage.loadConversation("test-session-1");

            expect(loaded).not.toBeNull();
            expect(loaded?.id).toBe("test-session-1");
            expect(loaded?.pluginId).toBe("test-plugin");
        });

        it("should return null for non-existent session", async () => {
            const loaded = await storage.loadConversation("non-existent");
            expect(loaded).toBeNull();
        });

        it("should delete a conversation session", async () => {
            const session: ConversationSession = {
                id: "test-session-2",
                pluginId: "test-plugin",
                context: {
                    userExpertiseLevel: "intermediate",
                    conversationHistory: [],
                } as DevelopmentContext,
                state: {},
                startTime: Date.now(),
                lastActivity: Date.now(),
            };

            await storage.saveConversation(session);
            const deleted = await storage.deleteConversation("test-session-2");
            expect(deleted).toBe(true);

            const loaded = await storage.loadConversation("test-session-2");
            expect(loaded).toBeNull();
        });
    });

    describe("Batch Operations", () => {
        it("should load all conversations", async () => {
            const sessions: ConversationSession[] = [
                {
                    id: "session-1",
                    pluginId: "plugin-1",
                    context: {
                        userExpertiseLevel: "beginner",
                        conversationHistory: [],
                    } as DevelopmentContext,
                    state: {},
                    startTime: Date.now(),
                    lastActivity: Date.now(),
                },
                {
                    id: "session-2",
                    pluginId: "plugin-2",
                    context: {
                        userExpertiseLevel: "expert",
                        conversationHistory: [],
                    } as DevelopmentContext,
                    state: {},
                    startTime: Date.now(),
                    lastActivity: Date.now(),
                },
            ];

            for (const session of sessions) {
                await storage.saveConversation(session);
            }

            const loaded = await storage.loadAllConversations();
            expect(loaded.length).toBe(2);
        });
    });

    describe("Export and Import", () => {
        it("should export conversations to JSON", async () => {
            const session: ConversationSession = {
                id: "export-test",
                pluginId: "test-plugin",
                context: {
                    userExpertiseLevel: "intermediate",
                    conversationHistory: [
                        {
                            role: "user",
                            content: "Hello",
                            timestamp: Date.now(),
                        },
                    ],
                } as DevelopmentContext,
                state: { phase: "requirements_gathering" },
                startTime: Date.now(),
                lastActivity: Date.now(),
            };

            await storage.saveConversation(session);
            const exportData = await storage.exportConversations();

            expect(exportData.version).toBe("1.0");
            expect(exportData.conversations.length).toBe(1);
            expect(exportData.conversations[0]?.id).toBe("export-test");
        });

        it("should import conversations from JSON", async () => {
            const exportData = {
                version: "1.0",
                exportDate: Date.now(),
                conversations: [
                    {
                        id: "import-test",
                        pluginId: "test-plugin",
                        context: JSON.stringify({
                            userExpertiseLevel: "beginner",
                            conversationHistory: [],
                        }),
                        state: JSON.stringify({ phase: "initialization" }),
                        startTime: Date.now(),
                        lastActivity: Date.now(),
                        messages: JSON.stringify([]),
                    },
                ],
            };

            const imported = await storage.importConversations(exportData);
            expect(imported).toBe(1);

            const loaded = await storage.loadConversation("import-test");
            expect(loaded).not.toBeNull();
            expect(loaded?.id).toBe("import-test");
        });

        it("should export specific conversations by ID", async () => {
            const sessions: ConversationSession[] = [
                {
                    id: "session-a",
                    pluginId: "plugin-1",
                    context: {
                        userExpertiseLevel: "beginner",
                        conversationHistory: [],
                    } as DevelopmentContext,
                    state: {},
                    startTime: Date.now(),
                    lastActivity: Date.now(),
                },
                {
                    id: "session-b",
                    pluginId: "plugin-2",
                    context: {
                        userExpertiseLevel: "expert",
                        conversationHistory: [],
                    } as DevelopmentContext,
                    state: {},
                    startTime: Date.now(),
                    lastActivity: Date.now(),
                },
            ];

            for (const session of sessions) {
                await storage.saveConversation(session);
            }

            const exportData = await storage.exportConversations(["session-a"]);
            expect(exportData.conversations.length).toBe(1);
            expect(exportData.conversations[0]?.id).toBe("session-a");
        });
    });

    describe("Cleanup Operations", () => {
        it("should cleanup old conversations", async () => {
            const oldSession: ConversationSession = {
                id: "old-session",
                pluginId: "test-plugin",
                context: {
                    userExpertiseLevel: "beginner",
                    conversationHistory: [],
                } as DevelopmentContext,
                state: {},
                startTime: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
                lastActivity: Date.now() - 2 * 60 * 60 * 1000,
            };

            const newSession: ConversationSession = {
                id: "new-session",
                pluginId: "test-plugin",
                context: {
                    userExpertiseLevel: "beginner",
                    conversationHistory: [],
                } as DevelopmentContext,
                state: {},
                startTime: Date.now(),
                lastActivity: Date.now(),
            };

            await storage.saveConversation(oldSession);
            await storage.saveConversation(newSession);

            const cleaned = await storage.cleanupOldConversations(60 * 60 * 1000); // 1 hour
            expect(cleaned).toBe(1);

            const oldLoaded = await storage.loadConversation("old-session");
            const newLoaded = await storage.loadConversation("new-session");

            expect(oldLoaded).toBeNull();
            expect(newLoaded).not.toBeNull();
        });
    });

    describe("Storage Statistics", () => {
        it("should provide accurate storage statistics", async () => {
            const sessions: ConversationSession[] = [
                {
                    id: "stats-1",
                    pluginId: "plugin-1",
                    context: {
                        userExpertiseLevel: "beginner",
                        conversationHistory: [],
                    } as DevelopmentContext,
                    state: {},
                    startTime: Date.now() - 1000,
                    lastActivity: Date.now(),
                },
                {
                    id: "stats-2",
                    pluginId: "plugin-2",
                    context: {
                        userExpertiseLevel: "expert",
                        conversationHistory: [],
                    } as DevelopmentContext,
                    state: {},
                    startTime: Date.now(),
                    lastActivity: Date.now(),
                },
            ];

            for (const session of sessions) {
                await storage.saveConversation(session);
            }

            const stats = storage.getStats();
            expect(stats.totalConversations).toBe(2);
            expect(stats.oldestConversation).toBeLessThan(stats.newestConversation!);
        });

        it("should handle empty storage statistics", () => {
            const stats = storage.getStats();
            expect(stats.totalConversations).toBe(0);
            expect(stats.oldestConversation).toBeNull();
            expect(stats.newestConversation).toBeNull();
        });
    });

    describe("Persistence Across Restarts", () => {
        it("should restore conversations from disk", async () => {
            const session: ConversationSession = {
                id: "persist-test",
                pluginId: "test-plugin",
                context: {
                    userExpertiseLevel: "intermediate",
                    conversationHistory: [
                        {
                            role: "user",
                            content: "Test message",
                            timestamp: Date.now(),
                        },
                    ],
                } as DevelopmentContext,
                state: { phase: "implementation" },
                startTime: Date.now(),
                lastActivity: Date.now(),
            };

            await storage.saveConversation(session);

            // Create a new storage instance to simulate restart
            const newStorage = new ConversationStorage(testPersistencePath);
            const restored = await newStorage.restoreFromSQLite();

            expect(restored).toBe(1);

            const loaded = await newStorage.loadConversation("persist-test");
            expect(loaded).not.toBeNull();
            expect(loaded?.id).toBe("persist-test");
            expect(loaded?.context.conversationHistory.length).toBe(1);
        });
    });
});
