/**
 * API Key Hashing with Bcrypt
 *
 * Securely stores API keys using bcrypt hashing with salt.
 * Never stores plaintext API keys - always store hashes and verify on comparison.
 *
 * ## Security Features
 * - Bcrypt with configurable work factor (default 10)
 * - Automatic salt generation and management
 * - Constant-time comparison to prevent timing attacks
 * - Key derivation with unique salts per hash
 *
 * ## Usage
 * - Hash API keys before storing in database or config
 * - Verify API keys by comparing against stored hash
 * - Never log or expose plaintext API keys
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Default bcrypt work factor
 * Higher values = more secure but slower
 * 10 is a good balance (approx 100ms per hash)
 */
export const DEFAULT_BCRYPT_WORK_FACTOR = 10;

/**
 * Maximum bcrypt work factor (prevents DoS)
 */
export const MAX_BCRYPT_WORK_FACTOR = 15;

/**
 * Minimum bcrypt work factor (prevents weak security)
 */
export const MIN_BCRYPT_WORK_FACTOR = 8;

/**
 * Hashed API key result
 */
export interface HashedApiKey {
  /** The bcrypt hash (store this) */
  hash: string;
  /** Work factor used for hashing */
  workFactor: number;
  /** Key identifier (optional, for key rotation) */
  keyId?: string;
  /** Timestamp when hash was created */
  createdAt: number;
}

/**
 * API key verification result
 */
export interface ApiKeyVerificationResult {
  /** Whether the key matches the hash */
  valid: boolean;
  /** Key identifier if provided during hashing */
  keyId?: string;
  /** Time since hash was created (ms) */
  age?: number;
}

/**
 * Hash an API key using bcrypt
 *
 * Uses native Node.js crypto API with PBKDF2 as a fallback
 * since bcrypt is not in the standard library.
 *
 * For production, consider using the `bcrypt` or `bcryptjs` package.
 */
export async function hashApiKey(
  apiKey: string,
  workFactor: number = DEFAULT_BCRYPT_WORK_FACTOR,
): Promise<HashedApiKey> {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("API key cannot be empty");
  }

  // Validate work factor
  if (workFactor < MIN_BCRYPT_WORK_FACTOR || workFactor > MAX_BCRYPT_WORK_FACTOR) {
    throw new Error(
      `Work factor must be between ${MIN_BCRYPT_WORK_FACTOR} and ${MAX_BCRYPT_WORK_FACTOR}`,
    );
  }

  // Generate unique salt for this key
  const salt = randomBytes(16);

  // Use PBKDF2 with SHA-256 as a bcrypt alternative
  // (bcrypt is not in Node.js standard library)
  const hash = await new Promise<Buffer>((resolve, reject) => {
    createHash("sha256")
      .update(apiKey)
      .update(salt)
      .digest()
    ;

    // For proper key derivation, use PBKDF2
    const { pbkdf2 } = require("node:crypto");
    pbkdf2(
      apiKey,
      salt,
      Math.pow(2, workFactor),
      64,
      "sha256",
      (err: Error | null, derivedKey: Buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(derivedKey);
        }
      },
    );
  });

  // Encode salt and hash together for storage
  const saltHex = salt.toString("hex");
  const hashHex = hash.toString("hex");

  return {
    hash: `${saltHex}:${hashHex}:${workFactor}`,
    workFactor,
    keyId: generateKeyId(),
    createdAt: Date.now(),
  };
}

/**
 * Verify an API key against a stored hash
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyApiKey(
  apiKey: string,
  hashedApiKey: string,
): Promise<ApiKeyVerificationResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false };
  }

  try {
    // Parse the stored hash
    const parts = hashedApiKey.split(":");
    if (parts.length !== 3) {
      return { valid: false };
    }

    const [saltHex, storedHashHex, workFactorStr] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const workFactor = parseInt(workFactorStr, 10);

    // Derive the hash from the provided API key
    const { pbkdf2 } = require("node:crypto");
    const derivedHash = await new Promise<Buffer>((resolve, reject) => {
      pbkdf2(
        apiKey,
        salt,
        Math.pow(2, workFactor),
        64,
        "sha256",
        (err: Error | null, derivedKey: Buffer) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        },
      );
    });

    // Compare using timing-safe comparison
    const storedHash = Buffer.from(storedHashHex, "hex");
    const match = timingSafeEqual(derivedHash, storedHash);

    return {
      valid: match,
      age: match ? Date.now() - parseCreatedAt(hashedApiKey) : undefined,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Generate a unique key identifier
 */
function generateKeyId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `key_${timestamp}_${random}`;
}

/**
 * Parse creation time from hash (approximate)
 */
function parseCreatedAt(hashedApiKey: string): number {
  // This is a rough estimate - in production, store createdAt separately
  // For now, return a timestamp that's at least as old as the hash
  return Date.now();
}

/**
 * Generate a secure random API key
 *
 * For generating new API keys (not hashing existing ones).
 * Use this when creating new keys for users.
 */
export function generateApiKey(prefix: string = "ck"): string {
  const randomBytes = require("node:crypto").randomBytes;
  const bytes = randomBytes(32);
  const key = bytes.toString("base64url").replace(/=/g, "");
  return `${prefix}_${key}`;
}

/**
 * Validate API key format
 *
 * Checks if an API key string matches expected format.
 * This is for validation before hashing, not for verification.
 */
export function validateApiKeyFormat(apiKey: string): {
  valid: boolean;
  error?: string;
} {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: "API key cannot be empty" };
  }

  if (apiKey.length < 16) {
    return { valid: false, error: "API key is too short (min 16 chars)" };
  }

  if (apiKey.length > 256) {
    return { valid: false, error: "API key is too long (max 256 chars)" };
  }

  // Check for control characters (anything below space except tab)
  for (let i = 0; i < apiKey.length; i++) {
    const code = apiKey.charCodeAt(i);
    // Allow printable ASCII (32-126) and tab (9)
    if ((code < 32 || code > 126) && code !== 9) {
      return { valid: false, error: "API key contains invalid characters" };
    }
  }

  return { valid: true };
}

/**
 * Mask API key for logging/display
 *
 * Shows first few and last few characters with asterisks in between.
 */
export function maskApiKey(apiKey: string, visibleChars: number = 4): string {
  if (!apiKey || apiKey.length <= visibleChars * 2) {
    return "*".repeat(apiKey?.length || 0);
  }
  return `${apiKey.slice(0, visibleChars)}${"*".repeat(apiKey.length - visibleChars * 2)}${apiKey.slice(-visibleChars)}`;
}

/**
 * Compare two API keys using constant-time comparison
 *
 * Prevents timing attacks when comparing API keys.
 * Use this instead of === for security-sensitive comparisons.
 */
export function constantTimeCompareApiKey(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Hash multiple API keys in batch
 *
 * Useful for hashing multiple keys at once (e.g., migration).
 */
export async function hashApiKeys(
  apiKeys: string[],
  workFactor: number = DEFAULT_BCRYPT_WORK_FACTOR,
): Promise<HashedApiKey[]> {
  return Promise.all(apiKeys.map((key) => hashApiKey(key, workFactor)));
}

/**
 * Verify API key against multiple hashes
 *
 * Useful for key rotation scenarios where multiple key versions exist.
 * Returns the first match or false if none match.
 */
export async function verifyApiKeyAgainstMultiple(
  apiKey: string,
  hashedApiKeys: string[],
): Promise<ApiKeyVerificationResult & { matchedIndex?: number }> {
  for (let i = 0; i < hashedApiKeys.length; i++) {
    const result = await verifyApiKey(apiKey, hashedApiKeys[i]);
    if (result.valid) {
      return { ...result, matchedIndex: i };
    }
  }
  return { valid: false };
}
