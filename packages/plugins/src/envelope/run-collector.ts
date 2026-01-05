/**
 * Run Collector
 * Aggregates test cases and builds diagnostic envelopes
 */

import { randomUUID } from "node:crypto";
import type { CloudStorageAdapter } from "../adapters/cloud-storage-adapter.js";
import type {
  Assertion,
  Case,
  DxEnvelope,
  RunSummary,
} from "@brainwav/cortexdx-core";
import { validateEnvelope } from "./validator.js";

/**
 * Run collector that builds and validates diagnostic envelopes
 */
export class RunCollector {
  private runId: string;
  private tool: string;
  private spec?: string;
  private startedAt: Date;
  private finishedAt?: Date;
  private agentContext?: Record<string, unknown>;
  private cases: Case[] = [];
  private cloudStorage?: CloudStorageAdapter;

  constructor(
    tool: string,
    spec?: string,
    agentContext?: Record<string, unknown>,
    cloudStorage?: CloudStorageAdapter,
    runId?: string,
  ) {
    this.runId = runId || this.generateRunId();
    this.tool = tool;
    this.spec = spec;
    this.agentContext = agentContext;
    this.cloudStorage = cloudStorage;
    this.startedAt = new Date();
  }

  /**
   * Generate a unique run ID
   */
  private generateRunId(): string {
    const now = new Date();
    const timestamp = this.formatTimestamp(now);
    const shortId = randomUUID().substring(0, 8);
    return `dx_${timestamp}_${shortId}`;
  }

  /**
   * Format a Date object as a UTC timestamp string for run IDs
   */
  private formatTimestamp(date: Date): string {
    const pad = (n: number, width: number = 2) =>
      n.toString().padStart(width, "0");
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hour = pad(date.getUTCHours());
    const minute = pad(date.getUTCMinutes());
    const second = pad(date.getUTCSeconds());
    const ms = pad(date.getUTCMilliseconds(), 3);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
  }

  /**
   * Get the run ID
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Get cloud storage adapter (for use by assertion emitters)
   */
  getCloudStorage(): CloudStorageAdapter | undefined {
    return this.cloudStorage;
  }

  /**
   * Add a test case to the run
   */
  addCase(testCase: Case): this {
    this.cases.push(testCase);
    return this;
  }

  /**
   * Add multiple test cases
   */
  addCases(cases: Case[]): this {
    this.cases.push(...cases);
    return this;
  }

  /**
   * Build a test case from assertions
   */
  buildCase(
    id: string,
    name: string,
    assertions: Assertion[],
    labels?: string[],
    inputs?: Record<string, unknown>,
  ): Case {
    return {
      id,
      name,
      labels,
      inputs,
      assertions,
    };
  }

  /**
   * Calculate run summary statistics
   */
  private calculateSummary(): RunSummary {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let errored = 0;

    for (const testCase of this.cases) {
      for (const assertion of testCase.assertions) {
        total++;
        switch (assertion.status) {
          case "pass":
            passed++;
            break;
          case "fail":
            failed++;
            break;
          case "skip":
            skipped++;
            break;
          case "error":
            errored++;
            break;
        }
      }
    }

    const durationMs = this.finishedAt
      ? this.finishedAt.getTime() - this.startedAt.getTime()
      : undefined;

    return {
      total,
      passed,
      failed,
      skipped,
      errored,
      duration_ms: durationMs,
    };
  }

  /**
   * Mark the run as finished
   */
  finish(): this {
    this.finishedAt = new Date();
    return this;
  }

  /**
   * Build and validate the diagnostic envelope
   */
  build(validate = true): DxEnvelope {
    // Auto-finish if not already finished
    if (!this.finishedAt) {
      this.finish();
    }

    const envelope: DxEnvelope = {
      version: "1.0.0",
      run_id: this.runId,
      tool: this.tool,
      spec: this.spec,
      started_at: this.startedAt.toISOString(),
      finished_at: this.finishedAt?.toISOString(),
      agent_context: this.agentContext,
      cases: this.cases,
      summary: this.calculateSummary(),
    };

    // Validate schema if requested
    if (validate) {
      const result = validateEnvelope(envelope);
      if (!result.success) {
        throw new Error(
          `Invalid envelope: ${JSON.stringify(result.errors?.errors, null, 2)}`,
        );
      }
    }

    return envelope;
  }

  /**
   * Build envelope as JSON string
   */
  toJSON(pretty = false): string {
    const envelope = this.build();
    return JSON.stringify(envelope, null, pretty ? 2 : undefined);
  }

  /**
   * Upload envelope to cloud storage.
   * @returns The URL of the uploaded envelope, or null if upload fails.
   * Never throws; returns null on error.
   */
  async uploadEnvelope(): Promise<string | null> {
    if (!this.cloudStorage) {
      return null;
    }
    try {
      const envelope = this.build();
      const content = JSON.stringify(envelope, null, 2);

      const result = await this.cloudStorage.uploadReport(
        this.runId,
        content,
        "json",
      );

      return result.url;
    } catch (err) {
      console.error("Failed to upload envelope:", err);
      return null;
    }
  }

  /**
   * Get summary statistics without building full envelope
   */
  getSummary(): RunSummary {
    return this.calculateSummary();
  }

  /**
   * Get current case count
   */
  getCaseCount(): number {
    return this.cases.length;
  }

  /**
   * Get total assertion count
   */
  getAssertionCount(): number {
    return this.cases.reduce(
      (sum, testCase) => sum + testCase.assertions.length,
      0,
    );
  }

  /**
   * Check if the run has any failures
   */
  hasFailures(): boolean {
    return this.cases.some((testCase) =>
      testCase.assertions.some((a) => a.status === "fail"),
    );
  }

  /**
   * Check if the run has any errors
   */
  hasErrors(): boolean {
    return this.cases.some((testCase) =>
      testCase.assertions.some((a) => a.status === "error"),
    );
  }

  /**
   * Get all failed assertions across all cases
   */
  private getAssertionsByStatus(
    status: Assertion["status"],
  ): Array<{ case: Case; assertion: Assertion }> {
    const result: Array<{ case: Case; assertion: Assertion }> = [];
    for (const testCase of this.cases) {
      for (const assertion of testCase.assertions) {
        if (assertion.status === status) {
          result.push({ case: testCase, assertion });
        }
      }
    }
    return result;
  }

  /**
   * Get all failed assertions across all cases
   */
  getFailedAssertions(): Array<{ case: Case; assertion: Assertion }> {
    return this.getAssertionsByStatus("fail");
  }

  /**
   * Get all errored assertions across all cases
   */
  getErroredAssertions(): Array<{ case: Case; assertion: Assertion }> {
    return this.getAssertionsByStatus("error");
  }
}
