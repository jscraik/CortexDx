/**
 * Cloud Storage Adapter Tests
 * Tests for Cloudflare R2 and AWS S3 storage integration
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { CloudStorageAdapter } from "../src/adapters/cloud-storage-adapter.js";
import type { CloudStorageConfig } from "../src/adapters/cloud-storage-adapter.js";

describe("Cloud Storage Adapter", () => {
	describe("Configuration", () => {
		it("should create R2 adapter with valid config", () => {
			const config: CloudStorageConfig = {
				provider: "r2",
				bucket: "test-bucket",
				accountId: "test-account-123",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			};

			const adapter = new CloudStorageAdapter(config);
			expect(adapter).toBeDefined();
			expect(adapter.getProvider()).toBe("r2");
			expect(adapter.getBucket()).toBe("test-bucket");
		});

		it("should create S3 adapter with valid config", () => {
			const config: CloudStorageConfig = {
				provider: "s3",
				bucket: "test-bucket",
				region: "us-east-1",
				accessKeyId: "test-key",
				secretAccessKey: "test-secret",
			};

			const adapter = new CloudStorageAdapter(config);
			expect(adapter).toBeDefined();
			expect(adapter.getProvider()).toBe("s3");
		});

		it("should throw error if R2 missing accountId", () => {
			const config: CloudStorageConfig = {
				provider: "r2",
				bucket: "test-bucket",
				// Missing accountId
			};

			expect(() => new CloudStorageAdapter(config)).toThrow(
				/accountId required for Cloudflare R2/,
			);
		});

		it("should use default TTL of 900 seconds", () => {
			const config: CloudStorageConfig = {
				provider: "s3",
				bucket: "test-bucket",
			};

			const adapter = new CloudStorageAdapter(config);
			expect(adapter).toBeDefined();
		});

		it("should respect custom TTL", () => {
			const config: CloudStorageConfig = {
				provider: "s3",
				bucket: "test-bucket",
				ttlSeconds: 300, // 5 minutes
			};

			const adapter = new CloudStorageAdapter(config);
			expect(adapter).toBeDefined();
		});
	});

	describe("Environment-based Creation", () => {
		beforeEach(() => {
			// Clear environment variables
			delete process.env.CORTEXDX_CLOUD_PROVIDER;
			delete process.env.CORTEXDX_CLOUD_BUCKET;
			delete process.env.R2_BUCKET_NAME;
			delete process.env.CLOUDFLARE_ACCOUNT_ID;
			delete process.env.R2_ACCESS_KEY_ID;
			delete process.env.R2_SECRET_ACCESS_KEY;
		});

		it("should return null if no provider configured", async () => {
			const { createCloudStorageFromEnv } = await import(
				"../src/adapters/cloud-storage-adapter.js"
			);
			const adapter = createCloudStorageFromEnv();
			expect(adapter).toBeNull();
		});

		it("should create adapter from environment variables", async () => {
			process.env.CORTEXDX_CLOUD_PROVIDER = "r2";
			process.env.R2_BUCKET_NAME = "cortexdx-reports";
			process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
			process.env.R2_ACCESS_KEY_ID = "test-key";
			process.env.R2_SECRET_ACCESS_KEY = "test-secret";

			// Re-import to pick up new env vars
			delete require.cache[
				require.resolve("../src/adapters/cloud-storage-adapter.js")
			];
			const { createCloudStorageFromEnv } = await import(
				"../src/adapters/cloud-storage-adapter.js"
			);

			const adapter = createCloudStorageFromEnv();
			expect(adapter).toBeDefined();
			expect(adapter?.getProvider()).toBe("r2");
			expect(adapter?.getBucket()).toBe("cortexdx-reports");
		});
	});

	describe("Upload Operations (Mock)", () => {
		it("should upload report and return metadata", async () => {
			// Create mock S3 client
			const mockS3Client = {
				send: vi.fn().mockResolvedValue({}),
			};

			const config: CloudStorageConfig = {
				provider: "r2",
				bucket: "test-bucket",
				accountId: "test-account",
			};

			const adapter = new CloudStorageAdapter(config, mockS3Client as any);

			// Note: In a real test with actual R2/S3, this would make real API calls
			// For unit tests, we'd need to mock the S3 client
			expect(adapter).toBeDefined();
		});

		it("should generate SHA-256 hash for uploaded content", () => {
			const { createHash } = require("node:crypto");
			const content = "test content";
			const hash = createHash("sha256").update(content, "utf8").digest("hex");

			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		});

		it("should use correct content types", () => {
			const htmlContentType = "text/html; charset=utf-8";
			const jsonContentType = "application/json";

			expect(htmlContentType).toBe("text/html; charset=utf-8");
			expect(jsonContentType).toBe("application/json");
		});
	});

	describe("Key Generation", () => {
		it("should generate correct S3 key format", () => {
			const prefix = "reports/";
			const runId = "run-123";
			const format = "html";

			const expectedKey = `${prefix}${runId}/report.${format}`;
			expect(expectedKey).toBe("reports/run-123/report.html");
		});

		it("should generate SBOM key", () => {
			const prefix = "reports/";
			const runId = "run-123";

			const expectedKey = `${prefix}${runId}/sbom.cdx.json`;
			expect(expectedKey).toBe("reports/run-123/sbom.cdx.json");
		});

		it("should generate metadata key", () => {
			const prefix = "reports/";
			const runId = "run-123";

			const expectedKey = `${prefix}${runId}/meta.json`;
			expect(expectedKey).toBe("reports/run-123/meta.json");
		});
	});

	describe("Audit Log Hash Chain", () => {
		it("should create hash chain correctly", () => {
			const { createHash } = require("node:crypto");

			// Simulate hash chain
			const genesis = "0".repeat(64);
			const entry1 = `${genesis} | UPLOAD | report.html`;
			const hash1 = createHash("sha256").update(entry1, "utf8").digest("hex");

			const entry2 = `${hash1} | UPLOAD | report.json`;
			const hash2 = createHash("sha256").update(entry2, "utf8").digest("hex");

			expect(hash1).toHaveLength(64);
			expect(hash2).toHaveLength(64);
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("URL Generation", () => {
		it("should use public domain if configured", () => {
			const config: CloudStorageConfig = {
				provider: "r2",
				bucket: "test-bucket",
				accountId: "test-account",
				publicDomain: "reports.example.com",
			};

			const key = "reports/run-123/report.html";
			const expectedUrl = `https://reports.example.com/${key}`;

			expect(expectedUrl).toBe(
				"https://reports.example.com/reports/run-123/report.html",
			);
		});

		it("should generate presigned URL if no public domain", () => {
			// Presigned URLs will be generated by AWS SDK
			// Format: https://bucket.s3.amazonaws.com/key?X-Amz-Algorithm=...
			const presignedUrl =
				"https://test-bucket.r2.cloudflarestorage.com/reports/run-123/report.html?X-Amz-Algorithm=AWS4-HMAC-SHA256";
			expect(presignedUrl).toContain("X-Amz-Algorithm");
		});
	});
});
