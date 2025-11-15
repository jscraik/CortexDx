/**
 * Credential Manager for secure OAuth token storage
 * Implements secure credential storage with encryption and automatic refresh
 * Requirements: 14.4, 14.5
 */

import { safeParseJson } from "../utils/json.js";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TokenResult } from "./oauth-authenticator.js";

// Credentials storage types
export interface Credentials {
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
    tokenType: string;
    scope?: string[];
    serverEndpoint: string;
    clientId: string;
    tokenEndpoint: string;
}

export interface CredentialStorage {
    version: string;
    credentials: Record<string, EncryptedCredentials>;
}

interface EncryptedCredentials {
    iv: string;
    encryptedData: string;
    authTag: string;
}

/**
 * Credential Manager
 * Manages secure storage and automatic refresh of OAuth credentials
 */
export class CredentialManager {
    private storageDir: string;
    private storageFile: string;
    private encryptionKey: Buffer;
    private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly ALGORITHM = "aes-256-gcm";
    private readonly KEY_LENGTH = 32;
    private readonly IV_LENGTH = 16;
    private readonly AUTH_TAG_LENGTH = 16;

    constructor(storageDir?: string) {
        this.storageDir = storageDir || join(homedir(), ".cortexdx", "credentials");
        this.storageFile = join(this.storageDir, "credentials.enc");
        this.encryptionKey = this.deriveEncryptionKey();
    }

    /**
     * Store credentials securely with encryption
     * Requirements: 14.4
     */
    async storeCredentials(
        serverEndpoint: string,
        credentials: Credentials,
    ): Promise<void> {
        try {
            // Ensure storage directory exists
            await this.ensureStorageDir();

            // Load existing storage
            const storage = await this.loadStorage();

            // Encrypt credentials
            const encrypted = this.encryptCredentials(credentials);

            // Store encrypted credentials
            storage.credentials[serverEndpoint] = encrypted;

            // Save to disk
            await this.saveStorage(storage);

            // Schedule automatic refresh
            this.scheduleTokenRefresh(serverEndpoint, credentials.expiresAt);
        } catch (error) {
            throw new Error(
                `Failed to store credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Retrieve credentials from secure storage
     * Requirements: 14.4
     */
    async retrieveCredentials(
        serverEndpoint: string,
    ): Promise<Credentials | null> {
        try {
            const storage = await this.loadStorage();
            const encrypted = storage.credentials[serverEndpoint];

            if (!encrypted) {
                return null;
            }

            // Decrypt credentials
            const credentials = this.decryptCredentials(encrypted);

            return credentials;
        } catch (error) {
            throw new Error(
                `Failed to retrieve credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Delete credentials from storage
     * Requirements: 14.4
     */
    async deleteCredentials(serverEndpoint: string): Promise<void> {
        try {
            const storage = await this.loadStorage();

            if (storage.credentials[serverEndpoint]) {
                delete storage.credentials[serverEndpoint];
                await this.saveStorage(storage);

                // Cancel refresh timer
                const timer = this.refreshTimers.get(serverEndpoint);
                if (timer) {
                    clearTimeout(timer);
                    this.refreshTimers.delete(serverEndpoint);
                }
            }
        } catch (error) {
            throw new Error(
                `Failed to delete credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Get valid token with automatic refresh
     * Requirements: 14.4, 14.5
     */
    async getValidToken(
        serverEndpoint: string,
        refreshCallback?: (
            refreshToken: string,
            tokenEndpoint: string,
            clientId: string,
        ) => Promise<TokenResult>,
    ): Promise<string> {
        const credentials = await this.retrieveCredentials(serverEndpoint);

        if (!credentials) {
            throw new Error(`No credentials found for ${serverEndpoint}`);
        }

        // Check if token is still valid (with 5-minute buffer)
        const now = new Date();
        const expiresAt = new Date(credentials.expiresAt);
        const bufferMs = 5 * 60 * 1000; // 5 minutes

        if (expiresAt.getTime() - now.getTime() > bufferMs) {
            return credentials.accessToken;
        }

        // Token is expiring soon or expired, refresh it
        if (!credentials.refreshToken) {
            throw new Error(
                `Token expired and no refresh token available for ${serverEndpoint}`,
            );
        }

        if (!refreshCallback) {
            throw new Error("Refresh callback required for token refresh");
        }

        try {
            const newTokens = await refreshCallback(
                credentials.refreshToken,
                credentials.tokenEndpoint,
                credentials.clientId,
            );

            // Update stored credentials
            const updatedCredentials: Credentials = {
                ...credentials,
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken || credentials.refreshToken,
                expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
            };

            await this.storeCredentials(serverEndpoint, updatedCredentials);

            return newTokens.accessToken;
        } catch (error) {
            throw new Error(
                `Token refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Schedule automatic token refresh
     * Requirements: 14.4
     */
    scheduleTokenRefresh(serverEndpoint: string, expiresAt: Date): void {
        // Cancel existing timer
        const existingTimer = this.refreshTimers.get(serverEndpoint);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Calculate refresh time (5 seconds before expiration)
        const now = Date.now();
        const expiresAtMs = expiresAt.getTime();
        const refreshMs = expiresAtMs - now - 5000; // 5 seconds before expiration

        if (refreshMs <= 0) {
            // Token already expired or expiring very soon
            return;
        }

        // Schedule refresh
        const timer = setTimeout(() => {
            this.refreshTimers.delete(serverEndpoint);
            // Note: Actual refresh will happen when getValidToken is called
            // This timer is just for tracking
        }, refreshMs);

        this.refreshTimers.set(serverEndpoint, timer);
    }

    /**
     * List all stored endpoints
     * Requirements: 14.4
     */
    async listStoredEndpoints(): Promise<string[]> {
        try {
            const storage = await this.loadStorage();
            return Object.keys(storage.credentials);
        } catch (error) {
            return [];
        }
    }

    /**
     * Clear all credentials
     * Requirements: 14.4
     */
    async clearAllCredentials(): Promise<void> {
        try {
            // Clear all refresh timers
            for (const timer of this.refreshTimers.values()) {
                clearTimeout(timer);
            }
            this.refreshTimers.clear();

            // Delete storage file
            if (existsSync(this.storageFile)) {
                await unlink(this.storageFile);
            }
        } catch (error) {
            throw new Error(
                `Failed to clear credentials: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Encrypt credentials using AES-256-GCM
     */
    private encryptCredentials(credentials: Credentials): EncryptedCredentials {
        const iv = randomBytes(this.IV_LENGTH);
        const cipher = createCipheriv(this.ALGORITHM, this.encryptionKey, iv);

        const data = JSON.stringify(credentials);
        let encrypted = cipher.update(data, "utf8", "hex");
        encrypted += cipher.final("hex");

        const authTag = cipher.getAuthTag();

        return {
            iv: iv.toString("hex"),
            encryptedData: encrypted,
            authTag: authTag.toString("hex"),
        };
    }

    /**
     * Decrypt credentials using AES-256-GCM
     */
    private decryptCredentials(encrypted: EncryptedCredentials): Credentials {
        const iv = Buffer.from(encrypted.iv, "hex");
        const authTag = Buffer.from(encrypted.authTag, "hex");

        const decipher = createDecipheriv(this.ALGORITHM, this.encryptionKey, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted.encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");

        const credentials = safeParseJson<Credentials>(
            decrypted,
            "credential manager decrypt",
        );

        // Convert date strings back to Date objects
        credentials.expiresAt = new Date(credentials.expiresAt);

        return credentials;
    }

    /**
     * Derive encryption key from system-specific data
     * In production, this should use system keychain (keytar, etc.)
     */
    private deriveEncryptionKey(): Buffer {
        // For now, use a deterministic key based on system info
        // In production, integrate with system keychain (macOS Keychain, Windows Credential Manager, etc.)
        const systemInfo = `${homedir()}-${process.platform}-${process.arch}`;
        const hash = require("node:crypto")
            .createHash("sha256")
            .update(systemInfo)
            .digest();

        return hash.slice(0, this.KEY_LENGTH);
    }

    /**
     * Ensure storage directory exists
     */
    private async ensureStorageDir(): Promise<void> {
        if (!existsSync(this.storageDir)) {
            await mkdir(this.storageDir, { recursive: true, mode: 0o700 });
        }
    }

    /**
     * Load storage from disk
     */
    private async loadStorage(): Promise<CredentialStorage> {
        try {
            if (!existsSync(this.storageFile)) {
                return {
                    version: "1.0.0",
                    credentials: {},
                };
            }

            const data = await readFile(this.storageFile, "utf8");
            return safeParseJson<CredentialStorage>(
                data,
                "credential storage file",
            );
        } catch (error) {
            // If file is corrupted, start fresh
            return {
                version: "1.0.0",
                credentials: {},
            };
        }
    }

    /**
     * Save storage to disk
     */
    private async saveStorage(storage: CredentialStorage): Promise<void> {
        await this.ensureStorageDir();
        const data = JSON.stringify(storage, null, 2);
        await writeFile(this.storageFile, data, { mode: 0o600 });
    }

    /**
     * Cleanup timers on shutdown
     */
    cleanup(): void {
        for (const timer of this.refreshTimers.values()) {
            clearTimeout(timer);
        }
        this.refreshTimers.clear();
    }
}

// Export singleton instance
export const credentialManager = new CredentialManager();
