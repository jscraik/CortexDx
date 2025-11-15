/**
 * Cloud Storage Adapter for CortexDx Reports
 * Supports AWS S3, Cloudflare R2, Google Cloud Storage, and Azure Blob Storage
 * Primary use case: Storing diagnostic reports with presigned URL access
 * Requirements: Storage, Security, Provenance tracking
 */

import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import type { Evidence, EvidenceKind } from "../envelope/types.js";

export interface CloudStorageConfig {
	provider: "s3" | "r2" | "gcs" | "azure";
	bucket: string;
	region?: string;
	prefix?: string;
	ttlSeconds?: number;

	// R2-specific (Cloudflare)
	accountId?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	endpoint?: string;

	// Custom domain (optional)
	publicDomain?: string;
}

export interface UploadResult {
	key: string;
	sha256: string;
	url: string;
	size: number;
}

export interface ObjectMetadata {
	size: number;
	sha256: string;
	contentType?: string;
	lastModified?: Date;
}

/**
 * Cloud Storage Adapter
 * Provides unified interface for cloud storage operations across multiple providers
 */
export class CloudStorageAdapter {
	private s3Client: S3Client;
	private config: CloudStorageConfig;

	constructor(config: CloudStorageConfig, s3Client?: S3Client) {
		this.config = { ttlSeconds: 900, prefix: "reports/", ...config };

		if (s3Client) {
			// Allow dependency injection for testing
			this.s3Client = s3Client;
		} else {
			this.s3Client = this.createS3Client(config);
		}
	}

	/**
	 * Create S3 client based on provider
	 */
	private createS3Client(config: CloudStorageConfig): S3Client {
		// Use statically imported S3Client for type safety and tree-shaking

		if (config.provider === "r2") {
			// Cloudflare R2 configuration
			if (!config.accountId) {
				throw new Error(
					"accountId required for Cloudflare R2. Get it from your Cloudflare dashboard.",
				);
			}

			const endpoint =
				config.endpoint ||
				`https://${config.accountId}.r2.cloudflarestorage.com`;

			return new S3Client({
				region: "auto", // R2 uses "auto" region
				endpoint,
				credentials: {
					accessKeyId:
						config.accessKeyId ||
						process.env.R2_ACCESS_KEY_ID ||
						process.env.AWS_ACCESS_KEY_ID ||
						"",
					secretAccessKey:
						config.secretAccessKey ||
						process.env.R2_SECRET_ACCESS_KEY ||
						process.env.AWS_SECRET_ACCESS_KEY ||
						"",
				},
			});
		}

		if (config.provider === "s3") {
			// AWS S3 configuration
			return new S3Client({
				region: config.region || process.env.AWS_REGION || "us-east-1",
				...(config.endpoint && { endpoint: config.endpoint }),
				...(config.accessKeyId &&
					config.secretAccessKey && {
						credentials: {
							accessKeyId: config.accessKeyId,
							secretAccessKey: config.secretAccessKey,
						},
					}),
			});
		}

		if (config.provider === "gcs") {
			// Google Cloud Storage (S3-compatible API)
			return new S3Client({
				region: "auto",
				endpoint: config.endpoint || "https://storage.googleapis.com",
				credentials: {
					accessKeyId: config.accessKeyId || "",
					secretAccessKey: config.secretAccessKey || "",
				},
			});
		}

		if (config.provider === "azure") {
			// Azure Blob Storage (via S3-compatible gateway or custom adapter)
			throw new Error(
				"Azure Blob Storage not yet implemented. Use S3 or R2 for now.",
			);
		}

		throw new Error(`Unsupported provider: ${config.provider}`);
	}

	/**
	 * Upload a report file to cloud storage
	 */
	async uploadReport(
		runId: string,
		content: string,
		format: "html" | "json",
	): Promise<UploadResult> {
		const key = `${this.config.prefix}${runId}/report.${format}`;
		const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
		const contentType =
			format === "html" ? "text/html; charset=utf-8" : "application/json";

		// Upload to cloud storage
		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
				Body: content,
				ContentType: contentType,
				Metadata: {
					sha256,
					runId,
					uploadedAt: new Date().toISOString(),
					format,
				},
				// Cache control for edge caching
				CacheControl: "public, max-age=3600",
			}),
		);

		// Generate presigned URL
		const url = await this.makePresignedUrl(key);

		return {
			key,
			sha256,
			url,
			size: Buffer.byteLength(content, "utf8"),
		};
	}

	/**
	 * Upload SBOM (CycloneDX) artifact
	 */
	async uploadSBOM(runId: string, sbom: string): Promise<UploadResult> {
		const key = `${this.config.prefix}${runId}/sbom.cdx.json`;
		const sha256 = createHash("sha256").update(sbom, "utf8").digest("hex");

		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
				Body: sbom,
				ContentType: "application/json",
				Metadata: {
					sha256,
					runId,
					type: "cyclonedx",
					uploadedAt: new Date().toISOString(),
				},
			}),
		);

		const url = await this.makePresignedUrl(key);

		return {
			key,
			sha256,
			url,
			size: Buffer.byteLength(sbom, "utf8"),
		};
	}

	/**
	 * Upload metadata JSON
	 */
	async uploadMetadata(
		runId: string,
		metadata: Record<string, unknown>,
	): Promise<UploadResult> {
		const key = `${this.config.prefix}${runId}/meta.json`;
		const content = JSON.stringify(metadata, null, 2);
		const sha256 = createHash("sha256").update(content, "utf8").digest("hex");

		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
				Body: content,
				ContentType: "application/json",
				Metadata: {
					sha256,
					runId,
					type: "metadata",
					uploadedAt: new Date().toISOString(),
				},
			}),
		);

		const url = await this.makePresignedUrl(key);

		return {
			key,
			sha256,
			url,
			size: Buffer.byteLength(content, "utf8"),
		};
	}

	/**
	 * Upload evidence artifact for envelope diagnostics
	 * Supports multiple evidence kinds: log, trace, http, screenshot, diff, artifact
	 */
	async uploadEvidence(
		runId: string,
		caseId: string,
		assertionId: string,
		artifactName: string,
		content: string | Buffer,
		kind: EvidenceKind,
		contentType?: string,
	): Promise<Evidence> {
		const key = `${this.config.prefix}runs/${runId}/${caseId}/${assertionId}/${artifactName}`;

		// Compute SHA-256 hash
		const sha256 = createHash("sha256")
			.update(content)
			.digest("hex");

		// Determine content type based on kind if not provided
		const inferredContentType = contentType || this.inferContentType(kind, artifactName);

		// Upload to cloud storage
		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
				Body: content,
				ContentType: inferredContentType,
				Metadata: {
					sha256,
					runId,
					caseId,
					assertionId,
					evidenceKind: kind,
					uploadedAt: new Date().toISOString(),
				},
				// Evidence is short-lived, cache accordingly
				CacheControl: "public, max-age=3600",
			}),
		);

		// Generate presigned URL with expiration
		const url = await this.makePresignedUrl(key);
		const expiresAt = new Date();
		expiresAt.setSeconds(expiresAt.getSeconds() + (this.config.ttlSeconds || 900));

		return {
			kind,
			url,
			sha256,
			content_type: inferredContentType,
			expires_at: expiresAt.toISOString(),
		};
	}

	/**
	 * Infer content type from evidence kind and artifact name
	 */
	private inferContentType(kind: EvidenceKind, artifactName: string): string {
		// Check file extension first
		const ext = artifactName.split(".").pop()?.toLowerCase();

		if (ext === "json") return "application/json";
		if (ext === "txt" || ext === "log") return "text/plain";
		if (ext === "png") return "image/png";
		if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
		if (ext === "patch" || ext === "diff") return "text/x-diff";
		if (ext === "har") return "application/json";

		// Fallback to kind-based inference
		switch (kind) {
			case "log":
			case "trace":
			case "http":
				return "application/json";
			case "diff":
				return "text/x-diff";
			case "screenshot":
				return "image/png";
			case "artifact":
			default:
				return "application/octet-stream";
		}
	}

	/**
	 * Append to hash-chained audit log
	 * Note: R2/S3 don't support append, so we read-modify-write
	 */
	async appendAuditLog(runId: string, logEntry: string): Promise<void> {
		const key = `${this.config.prefix}${runId}/chain.log`;

		// Try to read existing log
		let existingLog = "";
		try {
			const existing = await this.s3Client.send(
				new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
			);
			existingLog = (await existing.Body?.transformToString()) || "";
		} catch (error) {
			// File doesn't exist yet, start fresh with GENESIS
			const now = new Date().toISOString();
			existingLog = `${"0".repeat(64)} | GENESIS | ts=${now}\n`;
		}

		// Compute hash of previous entry (last line)
		const lines = existingLog.trim().split("\n");
		const prevLine = lines[lines.length - 1] || "";
		const prevHash = createHash("sha256")
			.update(prevLine, "utf8")
			.digest("hex");

		// Append new entry with hash chain
		const updatedLog = `${existingLog}${prevHash} | ${logEntry}\n`;

		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: this.config.bucket,
				Key: key,
				Body: updatedLog,
				ContentType: "text/plain",
			}),
		);
	}

	/**
	 * Get object metadata (HEAD request)
	 */
	async headObject(key: string): Promise<ObjectMetadata> {
		const response = await this.s3Client.send(
			new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
		);

		return {
			size: response.ContentLength || 0,
			sha256: response.Metadata?.sha256 || "",
			contentType: response.ContentType,
			lastModified: response.LastModified,
		};
	}

	/**
	 * Generate presigned URL for object access
	 */
	async makePresignedUrl(key: string, customTtl?: number): Promise<string> {
		const ttl = customTtl || this.config.ttlSeconds || 900;

		// If custom public domain is configured, use it
		if (this.config.publicDomain) {
			// For public domains (e.g., R2 with custom domain), return direct URL
			// This assumes the bucket is publicly accessible via the domain
			return `https://${this.config.publicDomain}/${key}`;
		}

		// Generate presigned URL
		const url = await getSignedUrl(
			this.s3Client,
			new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
			{ expiresIn: ttl },
		);

		return url;
	}

	/**
	 * Batch upload: Report + SBOM + Metadata
	 */
	async uploadReportBundle(
		runId: string,
		reportContent: { html: string; json: string },
		sbom: string,
		metadata: Record<string, unknown>,
	): Promise<{
		html: UploadResult;
		json: UploadResult;
		sbom: UploadResult;
		meta: UploadResult;
	}> {
		// Upload all in parallel
		const [html, json, sbomResult, meta] = await Promise.all([
			this.uploadReport(runId, reportContent.html, "html"),
			this.uploadReport(runId, reportContent.json, "json"),
			this.uploadSBOM(runId, sbom),
			this.uploadMetadata(runId, metadata),
		]);

		// Append to audit log
		await this.appendAuditLog(
			runId,
			`UPLOAD | report.html sha256=${html.sha256} bytes=${html.size}`,
		);
		await this.appendAuditLog(
			runId,
			`UPLOAD | report.json sha256=${json.sha256} bytes=${json.size}`,
		);
		await this.appendAuditLog(
			runId,
			`UPLOAD | sbom.cdx.json sha256=${sbomResult.sha256} bytes=${sbomResult.size}`,
		);
		await this.appendAuditLog(runId, "CLOSE | all artifacts sealed");

		return { html, json, sbom: sbomResult, meta };
	}

	/**
	 * Get bucket name
	 */
	getBucket(): string {
		return this.config.bucket;
	}

	/**
	 * Get storage provider
	 */
	getProvider(): string {
		return this.config.provider;
	}
}

/**
 * Factory function to create CloudStorageAdapter from environment variables
 */
export function createCloudStorageFromEnv(): CloudStorageAdapter | null {
	const provider = process.env.CORTEXDX_CLOUD_PROVIDER as
		| "s3"
		| "r2"
		| "gcs"
		| "azure"
		| undefined;

	if (!provider) {
		return null; // Cloud storage not configured
	}

	const config: CloudStorageConfig = {
		provider,
		bucket:
			process.env.CORTEXDX_CLOUD_BUCKET ||
			process.env.R2_BUCKET_NAME ||
			"cortexdx-reports",
		region: process.env.AWS_REGION || process.env.CORTEXDX_CLOUD_REGION,
		prefix: process.env.CORTEXDX_REPORT_PREFIX || "reports/",
		ttlSeconds: Number(process.env.CORTEXDX_REPORT_TTL_SECONDS) || 900,
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
		accessKeyId:
			process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey:
			process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
		endpoint: process.env.CORTEXDX_CLOUD_ENDPOINT,
		publicDomain: process.env.R2_PUBLIC_DOMAIN,
	};

	return new CloudStorageAdapter(config);
}
