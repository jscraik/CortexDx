/**
 * Assertion Emitter
 * Helper for building assertions with evidence during diagnostic runs
 */

import type { CloudStorageAdapter } from "../adapters/cloud-storage-adapter.js";
import type {
	Assertion,
	AssertionStatus,
	Evidence,
	EvidenceKind,
	Remediation,
	Severity,
} from "./types.js";

/**
 * Assertion builder that supports incremental construction
 * and automatic evidence upload to cloud storage
 */
export class AssertionEmitter {
	private assertion: Partial<Assertion>;
	private evidenceList: Evidence[] = [];
	private startTime: number;
	private runId: string;
	private caseId: string;
	private cloudStorage?: CloudStorageAdapter;

	constructor(
		id: string,
		title: string,
		runId: string,
		caseId: string,
		cloudStorage?: CloudStorageAdapter,
	) {
		this.assertion = { id, title };
		this.runId = runId;
		this.caseId = caseId;
		this.cloudStorage = cloudStorage;
		this.startTime = Date.now();
	}

	/**
	 * Set the assertion status
	 */
	status(status: AssertionStatus): this {
		this.assertion.status = status;
		return this;
	}

	/**
	 * Set severity level (typically for failed assertions)
	 */
	severity(severity: Severity): this {
		this.assertion.severity = severity;
		return this;
	}

	/**
	 * Set detailed message
	 */
	message(message: string): this {
		this.assertion.message = message;
		return this;
	}

	/**
	 * Add tags for categorization
	 */
	tags(tags: string[]): this {
		this.assertion.tags = tags;
		return this;
	}

	/**
	 * Add metadata
	 */
	metadata(metadata: Record<string, unknown>): this {
		this.assertion.metadata = metadata;
		return this;
	}

	/**
	 * Set remediation instructions
	 */
	remediation(remediation: Remediation): this {
		this.assertion.remediation = remediation;
		return this;
	}

	/**
	 * Add evidence artifact with local content (uploads to cloud if configured)
	 */
	async addEvidence(
		kind: EvidenceKind,
		content: string | Buffer,
		artifactName: string,
		contentType?: string,
	): Promise<this> {
		if (!this.cloudStorage) {
			// No cloud storage configured, create a placeholder URL
			this.evidenceList.push({
				kind,
				url: `local://${this.runId}/${this.caseId}/${this.assertion.id}/${artifactName}`,
				content_type: contentType,
			});
			return this;
		}

		// Upload to cloud storage and get presigned URL
		const evidence = await this.cloudStorage.uploadEvidence(
			this.runId,
			this.caseId,
			this.assertion.id!,
			artifactName,
			content,
			kind,
			contentType,
		);

		this.evidenceList.push(evidence);
		return this;
	}

	/**
	 * Add evidence from existing URL (e.g., external resource)
	 */
	addEvidenceUrl(
		kind: EvidenceKind,
		url: string,
		sha256?: string,
		contentType?: string,
	): this {
		this.evidenceList.push({
			kind,
			url,
			sha256,
			content_type: contentType,
		});
		return this;
	}

	/**
	 * Add evidence for a log file
	 */
	async addLog(content: string, filename = "log.json"): Promise<this> {
		return this.addEvidence("log", content, filename, "application/json");
	}

	/**
	 * Add evidence for a trace file (JSON-RPC messages)
	 */
	async addTrace(content: string, filename = "trace.json"): Promise<this> {
		return this.addEvidence("trace", content, filename, "application/json");
	}

	/**
	 * Add evidence for HTTP capture (HAR format)
	 */
	async addHttpCapture(content: string, filename = "http.har"): Promise<this> {
		return this.addEvidence("http", content, filename, "application/json");
	}

	/**
	 * Add evidence for a diff/patch
	 */
	async addDiff(
		patch: string,
		filename = "expected-vs-actual.patch",
	): Promise<this> {
		return this.addEvidence("diff", patch, filename, "text/x-diff");
	}

	/**
	 * Add evidence for a screenshot
	 */
	async addScreenshot(
		imageBuffer: Buffer,
		filename = "screenshot.png",
	): Promise<this> {
		return this.addEvidence("screenshot", imageBuffer, filename, "image/png");
	}

	/**
	 * Build and return the complete assertion
	 */
	build(): Assertion {
		// Calculate duration
		const duration_ms = Date.now() - this.startTime;

		// Ensure required fields are set
		if (!this.assertion.id || !this.assertion.title || !this.assertion.status) {
			throw new Error(
				"Assertion must have id, title, and status before building",
			);
		}

		return {
			id: this.assertion.id,
			title: this.assertion.title,
			status: this.assertion.status,
			severity: this.assertion.severity,
			duration_ms,
			message: this.assertion.message,
			evidence: this.evidenceList.length > 0 ? this.evidenceList : undefined,
			remediation: this.assertion.remediation,
			tags: this.assertion.tags,
			metadata: this.assertion.metadata,
		};
	}

	/**
	 * Convenience method: build a passing assertion
	 */
	static pass(
		id: string,
		title: string,
		runId: string,
		caseId: string,
		cloudStorage?: CloudStorageAdapter,
	): AssertionEmitter {
		return new AssertionEmitter(id, title, runId, caseId, cloudStorage).status(
			"pass",
		);
	}

	/**
	 * Convenience method: build a failing assertion
	 */
	static fail(
		id: string,
		title: string,
		runId: string,
		caseId: string,
		severity: Severity,
		message: string,
		cloudStorage?: CloudStorageAdapter,
	): AssertionEmitter {
		return new AssertionEmitter(id, title, runId, caseId, cloudStorage)
			.status("fail")
			.severity(severity)
			.message(message);
	}

	/**
	 * Convenience method: build a skipped assertion
	 */
	static skip(
		id: string,
		title: string,
		runId: string,
		caseId: string,
		message?: string,
		cloudStorage?: CloudStorageAdapter,
	): AssertionEmitter {
		const emitter = new AssertionEmitter(
			id,
			title,
			runId,
			caseId,
			cloudStorage,
		).status("skip");
		if (message) {
			emitter.message(message);
		}
		return emitter;
	}

	/**
	 * Convenience method: build an errored assertion
	 */
	static error(
		id: string,
		title: string,
		runId: string,
		caseId: string,
		message: string,
		severity: Severity = "high",
		cloudStorage?: CloudStorageAdapter,
	): AssertionEmitter {
		return new AssertionEmitter(id, title, runId, caseId, cloudStorage)
			.status("error")
			.severity(severity)
			.message(message);
	}
}
