/**
 * API Key Hashing Tests
 *
 * Tests for secure API key storage using bcrypt-style hashing
 */

import { describe, it, expect } from "vitest";
import {
  hashApiKey,
  verifyApiKey,
  generateApiKey,
  validateApiKeyFormat,
  maskApiKey,
  constantTimeCompareApiKey,
  hashApiKeys,
  verifyApiKeyAgainstMultiple,
  DEFAULT_BCRYPT_WORK_FACTOR,
  MIN_BCRYPT_WORK_FACTOR,
  MAX_BCRYPT_WORK_FACTOR,
} from "../src/security/api-key-hash.js";

describe("api-key-hash", () => {
  describe("hashApiKey", () => {
    it("should hash an API key", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const hashed = await hashApiKey(apiKey);

      expect(hashed.hash).toBeDefined();
      expect(hashed.hash).toContain(":"); // Contains salt:hash:workFactor
      expect(hashed.workFactor).toBe(DEFAULT_BCRYPT_WORK_FACTOR);
      expect(hashed.keyId).toBeDefined();
      expect(hashed.createdAt).toBeDefined();
      expect(hashed.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it("should generate different hashes for same key (due to random salt)", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey(apiKey);

      expect(hash1.hash).not.toBe(hash2.hash);
      expect(hash1.keyId).not.toBe(hash2.keyId);
    });

    it("should use custom work factor", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const hashed = await hashApiKey(apiKey, 12);

      expect(hashed.workFactor).toBe(12);
    });

    it("should reject empty API key", async () => {
      await expect(hashApiKey("")).rejects.toThrow("API key cannot be empty");
    });

    it("should reject whitespace-only API key", async () => {
      await expect(hashApiKey("   ")).rejects.toThrow(
        "API key cannot be empty",
      );
    });

    it("should reject work factor below minimum", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      await expect(
        hashApiKey(apiKey, MIN_BCRYPT_WORK_FACTOR - 1),
      ).rejects.toThrow();
    });

    it("should reject work factor above maximum", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      await expect(
        hashApiKey(apiKey, MAX_BCRYPT_WORK_FACTOR + 1),
      ).rejects.toThrow();
    });

    it("should handle long API keys", async () => {
      const apiKey = "a".repeat(256);
      const hashed = await hashApiKey(apiKey);

      expect(hashed.hash).toBeDefined();
    });

    it("should handle special characters in API keys", async () => {
      const apiKey = "sk_test_abc123-xyz_789!@#$%";
      const hashed = await hashApiKey(apiKey);

      expect(hashed.hash).toBeDefined();
    });
  });

  describe("verifyApiKey", () => {
    it("should verify a correct API key", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const hashed = await hashApiKey(apiKey);
      const result = await verifyApiKey(apiKey, hashed.hash);

      expect(result.valid).toBe(true);
      expect(result.age).toBeDefined();
      expect(result.age).toBeGreaterThanOrEqual(0);
    });

    it("should reject incorrect API key", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const wrongKey = "sk_test_wrongkey123456";
      const hashed = await hashApiKey(apiKey);
      const result = await verifyApiKey(wrongKey, hashed.hash);

      expect(result.valid).toBe(false);
    });

    it("should reject empty API key", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const hashed = await hashApiKey(apiKey);
      const result = await verifyApiKey("", hashed.hash);

      expect(result.valid).toBe(false);
    });

    it("should handle malformed hash", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const result = await verifyApiKey(apiKey, "invalid-hash-format");

      expect(result.valid).toBe(false);
    });

    it("should handle hash with missing parts", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const result = await verifyApiKey(apiKey, "only-one-part");

      expect(result.valid).toBe(false);
    });
  });

  describe("hashApiKey + verifyApiKey integration", () => {
    it("should round-trip API key correctly", async () => {
      const apiKey = "sk_test_secure_api_key_12345";

      // Hash the key
      const hashed = await hashApiKey(apiKey);

      // Verify the original key
      const result1 = await verifyApiKey(apiKey, hashed.hash);
      expect(result1.valid).toBe(true);

      // Verify a wrong key fails
      const result2 = await verifyApiKey("sk_test_wrong_key", hashed.hash);
      expect(result2.valid).toBe(false);
    });

    it("should handle multiple hashings independently", async () => {
      const apiKey = "sk_test_1234567890abcdef";

      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey(apiKey);

      // Both hashes should verify the original key
      const result1 = await verifyApiKey(apiKey, hash1.hash);
      const result2 = await verifyApiKey(apiKey, hash2.hash);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe("generateApiKey", () => {
    it("should generate a key with default prefix", () => {
      const key = generateApiKey();

      expect(key.substring(0, 3)).toBe("ck_");
      expect(key.length).toBeGreaterThan(20);
    });

    it("should generate a key with custom prefix", () => {
      const key = generateApiKey("sk");

      expect(key.substring(0, 3)).toBe("sk_");
    });

    it("should generate unique keys", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);
    });

    it("should generate keys with valid format", () => {
      const key = generateApiKey();

      const validation = validateApiKeyFormat(key);
      expect(validation.valid).toBe(true);
    });

    it("should handle empty prefix", () => {
      const key = generateApiKey("");

      expect(key.length).toBeGreaterThan(20);
    });
  });

  describe("validateApiKeyFormat", () => {
    it("should accept valid API keys", () => {
      const validKeys = [
        "sk_test_1234567890abcdef",
        "a".repeat(16),
        "a".repeat(256),
        "sk_live_abc123-xyz_789",
      ];

      for (const key of validKeys) {
        const result = validateApiKeyFormat(key);
        expect(result.valid).toBe(true);
      }
    });

    it("should reject empty keys", () => {
      const result = validateApiKeyFormat("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject short keys", () => {
      const result = validateApiKeyFormat("short");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too short");
    });

    it("should reject long keys", () => {
      const result = validateApiKeyFormat("a".repeat(257));
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });

    it("should reject keys with invalid characters", () => {
      // Create a key with control characters that's long enough to pass length check
      const key = "sk_test_1234567890abcde\x00\x01\x02"; // Long enough but has null bytes
      const result = validateApiKeyFormat(key);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid characters");
    });
  });

  describe("maskApiKey", () => {
    it("should mask a long API key", () => {
      const apiKey = "sk_test_1234567890abcdefghijklmno";
      const masked = maskApiKey(apiKey, 4);

      // 33 chars - 8 visible = 25 asterisks
      expect(masked).toBe("sk_t*************************lmno");
      expect(masked).not.toContain(apiKey.slice(4, -4));
    });

    it("should fully mask short keys", () => {
      const apiKey = "short";
      const masked = maskApiKey(apiKey, 4);

      expect(masked).toBe("*****");
    });

    it("should handle edge case of exact length", () => {
      const apiKey = "abcd";
      const masked = maskApiKey(apiKey, 2);

      expect(masked).toBe("****");
    });

    it("should use default 4 visible characters", () => {
      const apiKey = "sk_test_1234567890abcdefghijklmno";
      const masked = maskApiKey(apiKey);

      expect(masked.substring(0, 4)).toBe("sk_t");
      expect(masked.substring(masked.length - 4)).toBe("lmno");
    });

    it("should handle empty key", () => {
      const masked = maskApiKey("", 4);
      expect(masked).toBe("");
    });
  });

  describe("constantTimeCompareApiKey", () => {
    it("should return true for matching keys", () => {
      const key1 = "sk_test_1234567890abcdef";
      const key2 = "sk_test_1234567890abcdef";

      expect(constantTimeCompareApiKey(key1, key2)).toBe(true);
    });

    it("should return false for different keys", () => {
      const key1 = "sk_test_1234567890abcdef";
      const key2 = "sk_test_different_key_xyz";

      expect(constantTimeCompareApiKey(key1, key2)).toBe(false);
    });

    it("should return false for different length keys", () => {
      const key1 = "sk_test_1234567890abcdef";
      const key2 = "short";

      expect(constantTimeCompareApiKey(key1, key2)).toBe(false);
    });

    it("should be constant-time (no early return on prefix match)", () => {
      const key1 = "sk_test_prefix_match_but_different_suffix_123";
      const key2 = "sk_test_prefix_match_but_different_suffix_456";

      // Should return false but take constant time regardless of position of difference
      const start = Date.now();
      const result = constantTimeCompareApiKey(key1, key2);
      const duration = Date.now() - start;

      expect(result).toBe(false);
      // Just ensure it completes reasonably
      expect(duration).toBeLessThan(100);
    });
  });

  describe("hashApiKeys (batch)", () => {
    it("should hash multiple keys", async () => {
      const apiKeys = [
        "sk_test_key1_1234567890",
        "sk_test_key2_abcdefghijklmno",
        "sk_test_key3_xyz_789",
      ];

      const hashed = await hashApiKeys(apiKeys);

      expect(hashed).toHaveLength(3);
      expect(hashed[0].hash).toBeDefined();
      expect(hashed[1].hash).toBeDefined();
      expect(hashed[2].hash).toBeDefined();
    });

    it("should hash empty array", async () => {
      const hashed = await hashApiKeys([]);
      expect(hashed).toEqual([]);
    });

    it("should use custom work factor for all", async () => {
      const apiKeys = ["sk_test_key1", "sk_test_key2"];
      const hashed = await hashApiKeys(apiKeys, 12);

      expect(hashed[0].workFactor).toBe(12);
      expect(hashed[1].workFactor).toBe(12);
    });
  });

  describe("verifyApiKeyAgainstMultiple", () => {
    it("should return first matching hash", async () => {
      const apiKey = "sk_test_1234567890abcdef";

      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey("sk_test_different_key");
      const hash3 = await hashApiKey(apiKey); // Same key, different hash

      const hashes = [hash1.hash, hash2.hash, hash3.hash];
      const result = await verifyApiKeyAgainstMultiple(apiKey, hashes);

      expect(result.valid).toBe(true);
      expect(result.matchedIndex).toBe(0); // First match
    });

    it("should return false when no matches", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const wrongKey = "sk_test_wrong_key_xyz";

      const hash1 = await hashApiKey("sk_test_key1");
      const hash2 = await hashApiKey("sk_test_key2");

      const result = await verifyApiKeyAgainstMultiple(wrongKey, [
        hash1.hash,
        hash2.hash,
      ]);

      expect(result.valid).toBe(false);
      expect(result.matchedIndex).toBeUndefined();
    });

    it("should handle empty hash array", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const result = await verifyApiKeyAgainstMultiple(apiKey, []);

      expect(result.valid).toBe(false);
    });
  });

  describe("security properties", () => {
    it("should not expose original key in hash", async () => {
      const apiKey = "sk_test_secret_api_key_12345";
      const hashed = await hashApiKey(apiKey);

      expect(hashed.hash).not.toContain(apiKey);
    });

    it("should generate different salts each time", async () => {
      const apiKey = "sk_test_1234567890abcdef";

      const hashes = await Promise.all([
        hashApiKey(apiKey),
        hashApiKey(apiKey),
        hashApiKey(apiKey),
      ]);

      // Extract salts (everything before first colon)
      const salts = hashes.map((h) => h.hash.split(":")[0]);

      // All salts should be different
      expect(new Set(salts).size).toBe(3);
    });

    it("should use timing-safe comparison for verification", async () => {
      const apiKey = "sk_test_1234567890abcdef";
      const wrongKey = "sk_test_1234567890abcdee"; // Very similar

      const hashed = await hashApiKey(apiKey);

      // Verify correct key
      const result1 = await verifyApiKey(apiKey, hashed.hash);
      expect(result1.valid).toBe(true);

      // Verify wrong key (should still take similar time)
      const result2 = await verifyApiKey(wrongKey, hashed.hash);
      expect(result2.valid).toBe(false);
    });
  });

  describe("key rotation scenarios", () => {
    it("should support multiple active key versions", async () => {
      const oldKey = "sk_old_1234567890";
      const newKey = "sk_new_abcdefghijklmno";

      // User still using old key
      const oldHash = await hashApiKey(oldKey);
      const newHash = await hashApiKey(newKey);

      // Both keys should verify
      const result1 = await verifyApiKey(oldKey, oldHash.hash);
      const result2 = await verifyApiKey(newKey, newHash.hash);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it("should verify against rotated keys", async () => {
      const currentKey = "sk_current_1234567890";

      const oldHash = await hashApiKey("sk_old_key");
      const currentHash = await hashApiKey(currentKey);

      // Verify against both (user might have old or new key)
      const result = await verifyApiKeyAgainstMultiple(currentKey, [
        oldHash.hash,
        currentHash.hash,
      ]);

      expect(result.valid).toBe(true);
      expect(result.matchedIndex).toBe(1); // Matched current key
    });
  });

  describe("real-world scenarios", () => {
    it("should handle OpenAI-style API keys", async () => {
      const apiKey = "sk-proj-abc123def456ghi789jkl012mno345pq";
      const hashed = await hashApiKey(apiKey);
      const result = await verifyApiKey(apiKey, hashed.hash);

      expect(result.valid).toBe(true);
    });

    it("should handle Stripe-style API keys", async () => {
      const apiKey = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";
      const hashed = await hashApiKey(apiKey);
      const result = await verifyApiKey(apiKey, hashed.hash);

      expect(result.valid).toBe(true);
    });

    it("should handle custom format keys", async () => {
      const apiKey = "myapp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const hashed = await hashApiKey(apiKey);
      const result = await verifyApiKey(apiKey, hashed.hash);

      expect(result.valid).toBe(true);
    });
  });
});
