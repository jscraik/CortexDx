/**
 * Local-First Security Framework
 * Ensures all processing occurs locally without external API calls
 * Requirements: 12.1, 12.2, 6.5
 */

import { safeParseJson } from "../utils/json.js";
import type { Cipher, Decipher } from "node:crypto";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

export interface SecurityConfig {
  encryptionEnabled: boolean;
  keyDerivationIterations: number;
  algorithm: string;
  ivLength: number;
  saltLength: number;
  tagLength: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  tag: string;
}

export interface SecureStorageOptions {
  password?: string;
  autoGenerate?: boolean;
}

const DEFAULT_CONFIG: SecurityConfig = {
  encryptionEnabled: true,
  keyDerivationIterations: 100000,
  algorithm: "aes-256-gcm",
  ivLength: 16,
  saltLength: 32,
  tagLength: 16,
};

/**
 * Local-first encryption service
 * All encryption happens locally without external dependencies
 */
export class LocalEncryptionService {
  private config: SecurityConfig;
  private masterKey: Buffer | null = null;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize encryption with a password
   * Password is never stored, only used to derive keys
   */
  initialize(password: string): void {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    // Store derived key in memory only
    const salt = randomBytes(this.config.saltLength);
    this.masterKey = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  }

  /**
   * Encrypt data locally using AES-256-GCM
   */
  encrypt(data: string): EncryptedData {
    if (!this.config.encryptionEnabled) {
      return {
        encrypted: Buffer.from(data).toString("base64"),
        iv: "",
        salt: "",
        tag: "",
      };
    }

    if (!this.masterKey) {
      throw new Error("Encryption not initialized");
    }

    const iv = randomBytes(this.config.ivLength);
    const salt = randomBytes(this.config.saltLength);

    const key = scryptSync(this.masterKey, salt, 32, { N: 16384, r: 8, p: 1 });

    const cipher = createCipheriv(this.config.algorithm, key, iv);

    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Only get auth tag if the method exists (for GCM mode)
    let tag = "";
    if (this.config.algorithm.includes("gcm")) {
      // Type assertion for GCM mode ciphers
      const gcmCipher = cipher as Cipher & { getAuthTag: () => Buffer };
      tag = gcmCipher.getAuthTag().toString("base64");
    }

    return {
      encrypted,
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
      tag,
    };
  }

  /**
   * Decrypt data locally
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!this.config.encryptionEnabled) {
      return Buffer.from(encryptedData.encrypted, "base64").toString("utf8");
    }

    if (!this.masterKey) {
      throw new Error("Encryption not initialized");
    }

    const iv = Buffer.from(encryptedData.iv, "base64");
    const salt = Buffer.from(encryptedData.salt, "base64");
    const tag = Buffer.from(encryptedData.tag, "base64");

    const key = scryptSync(this.masterKey, salt, 32, { N: 16384, r: 8, p: 1 });

    const decipher = createDecipheriv(this.config.algorithm, key, iv);

    // Only set auth tag if the method exists (for GCM mode) and tag is not empty
    if (this.config.algorithm.includes("gcm") && encryptedData.tag) {
      // Type assertion for GCM mode deciphers
      const gcmDecipher = decipher as Decipher & {
        setAuthTag: (tag: Buffer) => void;
      };
      gcmDecipher.setAuthTag(tag);
    }

    let decrypted = decipher.update(encryptedData.encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Clear encryption keys from memory
   */
  clear(): void {
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
  }
}

/**
 * Secure local storage for conversation history and knowledge base
 * All data stored locally with encryption
 */
export class SecureLocalStorage {
  private encryption: LocalEncryptionService;
  private storage: Map<string, EncryptedData>;

  constructor(options: SecureStorageOptions = {}) {
    this.encryption = new LocalEncryptionService();
    this.storage = new Map();

    if (options.password) {
      this.encryption.initialize(options.password);
    } else if (options.autoGenerate) {
      const password = randomBytes(32).toString("hex");
      this.encryption.initialize(password);
    }
  }

  /**
   * Store data securely with encryption
   */
  async set(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    const encrypted = this.encryption.encrypt(serialized);
    this.storage.set(key, encrypted);
  }

  /**
   * Retrieve and decrypt data
   */
  async get<T>(key: string): Promise<T | null> {
    const encrypted = this.storage.get(key);
    if (!encrypted) return null;

    const decrypted = this.encryption.decrypt(encrypted);
    return safeParseJson(decrypted) as T;
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  /**
   * Delete data
   */
  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.storage.clear();
    this.encryption.clear();
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}
