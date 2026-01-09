#!/usr/bin/env tsx
/**
 * Evidence Triplet Verification Tool
 * Validates that all required evidence components are present and complete
 *
 * Usage: pnpm evidence:triplet:verify --slug <task-slug>
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface TripletResult {
  component: string;
  required: boolean;
  found: boolean;
  path?: string;
  issue?: string;
}

interface VerificationResult {
  slug: string;
  passed: boolean;
  results: TripletResult[];
  missingRequired: string[];
  timestamp: string;
}

class EvidenceTripletVerifier {
  private slug: string;
  private baseDir: string;
  private results: TripletResult[] = [];

  constructor(slug: string) {
    this.slug = slug;
    this.baseDir = join(process.env.HOME || "~", "Changelog", slug);
  }

  async verify(): Promise<VerificationResult> {
    console.log(`\n🔍 Verifying Evidence Triplet for: ${this.slug}\n`);

    // Check if task directory exists
    if (!existsSync(this.baseDir)) {
      console.error(`❌ Task directory not found: ${this.baseDir}`);
      return {
        slug: this.slug,
        passed: false,
        results: [],
        missingRequired: ["Task directory"],
        timestamp: new Date().toISOString(),
      };
    }

    // Check each component
    this.checkManifest();
    this.checkMilestoneTest();
    this.checkContractSnapshot();
    this.checkReviewerJson();
    this.checkAdditionalEvidence();

    // Determine pass/fail
    const missingRequired = this.results
      .filter((r) => r.required && !r.found)
      .map((r) => r.component);

    const passed = missingRequired.length === 0;

    // Print results
    this.printResults(passed, missingRequired);

    return {
      slug: this.slug,
      passed,
      results: this.results,
      missingRequired,
      timestamp: new Date().toISOString(),
    };
  }

  private checkManifest(): void {
    const manifestPath = join(this.baseDir, "run-manifest.json");

    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

        // Check if evidence section exists
        if (manifest.evidence) {
          this.results.push({
            component: "Run Manifest",
            required: true,
            found: true,
            path: manifestPath,
          });
        } else {
          this.results.push({
            component: "Run Manifest",
            required: true,
            found: false,
            path: manifestPath,
            issue: "Missing evidence section",
          });
        }
      } catch (error) {
        this.results.push({
          component: "Run Manifest",
          required: true,
          found: false,
          path: manifestPath,
          issue: "Invalid JSON",
        });
      }
    } else {
      this.results.push({
        component: "Run Manifest",
        required: true,
        found: false,
        issue: "File not found",
      });
    }
  }

  private checkMilestoneTest(): void {
    // Check for acceptance test
    const testPath = join(
      this.baseDir,
      "tests",
      "acceptance",
      `${this.slug}.spec.ts`,
    );
    const altTestPath = join(
      this.baseDir,
      "tests",
      "acceptance",
      `${this.slug}.spec.js`,
    );

    if (existsSync(testPath)) {
      const content = readFileSync(testPath, "utf-8");

      // Check if test has actual assertions (not just TODO)
      if (content.includes("expect(true).toBe(false)")) {
        this.results.push({
          component: "Milestone Test",
          required: true,
          found: true,
          path: testPath,
          issue: "Test still contains placeholder (expect(true).toBe(false))",
        });
      } else if (content.includes("expect(") || content.includes("assert")) {
        this.results.push({
          component: "Milestone Test",
          required: true,
          found: true,
          path: testPath,
        });
      } else {
        this.results.push({
          component: "Milestone Test",
          required: true,
          found: false,
          path: testPath,
          issue: "No assertions found",
        });
      }
    } else if (existsSync(altTestPath)) {
      this.results.push({
        component: "Milestone Test",
        required: true,
        found: true,
        path: altTestPath,
      });
    } else {
      this.results.push({
        component: "Milestone Test",
        required: true,
        found: false,
        issue: "Acceptance test not found",
      });
    }
  }

  private checkContractSnapshot(): void {
    const contractDir = join(this.baseDir, "design", "contracts");

    if (existsSync(contractDir)) {
      // Look for any contract files
      const fs = require("node:fs");
      const files = fs
        .readdirSync(contractDir)
        .filter((f: string) => f.endsWith(".json") || f.endsWith(".ts"));

      if (files.length > 0) {
        this.results.push({
          component: "Contract Snapshot",
          required: true,
          found: true,
          path: join(contractDir, files[0]),
        });
      } else {
        this.results.push({
          component: "Contract Snapshot",
          required: true,
          found: false,
          path: contractDir,
          issue: "No contract files found in directory",
        });
      }
    } else {
      this.results.push({
        component: "Contract Snapshot",
        required: true,
        found: false,
        issue: "Contracts directory not found",
      });
    }
  }

  private checkReviewerJson(): void {
    const evidenceDir = join(this.baseDir, "evidence");

    if (existsSync(evidenceDir)) {
      const fs = require("node:fs");
      const files = fs
        .readdirSync(evidenceDir)
        .filter((f: string) => f.endsWith("-review.json"));

      if (files.length > 0) {
        this.results.push({
          component: "Reviewer JSON",
          required: true,
          found: true,
          path: join(evidenceDir, files[0]),
        });
      } else {
        this.results.push({
          component: "Reviewer JSON",
          required: false, // Not required until REVIEW phase
          found: false,
          issue: "Review JSON not yet created (created during REVIEW phase)",
        });
      }
    } else {
      this.results.push({
        component: "Reviewer JSON",
        required: false,
        found: false,
        issue: "Evidence directory not found",
      });
    }
  }

  private checkAdditionalEvidence(): void {
    // Check vibe-check logs
    const vibeCheckDir = join(this.baseDir, "logs", "vibe-check");
    if (existsSync(vibeCheckDir)) {
      const fs = require("node:fs");
      const files = fs
        .readdirSync(vibeCheckDir)
        .filter((f: string) => f.endsWith(".json"));

      this.results.push({
        component: "Vibe Check Log",
        required: false,
        found: files.length > 0,
        path: files.length > 0 ? join(vibeCheckDir, files[0]) : undefined,
        issue: files.length === 0 ? "No vibe-check logs found" : undefined,
      });
    }

    // Check model logs
    const modelsDir = join(this.baseDir, "logs", "models");
    if (existsSync(modelsDir)) {
      const fs = require("node:fs");
      const files = fs
        .readdirSync(modelsDir)
        .filter((f: string) => f.endsWith(".log") || f.endsWith(".json"));

      this.results.push({
        component: "Model Health Logs",
        required: false,
        found: files.length > 0,
        path: files.length > 0 ? join(modelsDir, files[0]) : undefined,
        issue: files.length === 0 ? "No model health logs found" : undefined,
      });
    }

    // Check recaps log
    const recapsPath = join(this.baseDir, "evidence", "recaps.log");
    this.results.push({
      component: "Recaps Log",
      required: false,
      found: existsSync(recapsPath),
      path: existsSync(recapsPath) ? recapsPath : undefined,
    });
  }

  private printResults(passed: boolean, missingRequired: string[]): void {
    console.log("Evidence Triplet Components:\n");

    for (const result of this.results) {
      const icon = result.found ? "✓" : result.required ? "✗" : "○";
      const status = result.found
        ? "\x1b[32m"
        : result.required
          ? "\x1b[31m"
          : "\x1b[33m";
      const reset = "\x1b[0m";
      const required = result.required ? "[REQUIRED]" : "[OPTIONAL]";

      console.log(`  ${status}${icon}${reset} ${result.component} ${required}`);

      if (result.path) {
        console.log(`     Path: ${result.path}`);
      }

      if (result.issue) {
        console.log(`     Issue: ${result.issue}`);
      }

      console.log("");
    }

    console.log("---\n");

    if (passed) {
      console.log("\x1b[32m✓ Evidence Triplet verification PASSED\x1b[0m\n");
      console.log("All required evidence components are present.");
    } else {
      console.log("\x1b[31m✗ Evidence Triplet verification FAILED\x1b[0m\n");
      console.log("Missing required components:");
      for (const missing of missingRequired) {
        console.log(`  - ${missing}`);
      }
      console.log("");
      console.log(
        "See .cortexdx/rules/agentic-coding-workflow.md for evidence requirements.",
      );
    }

    console.log("");
  }
}

// CLI Entry Point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let slug = "";
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--slug":
        slug = args[++i];
        break;
      case "--json":
        jsonOutput = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  if (!slug) {
    console.error("❌ Error: --slug is required\n");
    printHelp();
    process.exit(1);
  }

  const verifier = new EvidenceTripletVerifier(slug);
  const result = await verifier.verify();

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.passed ? 0 : 1);
}

function printHelp(): void {
  console.log(`
Evidence Triplet Verification Tool

Usage: pnpm evidence:triplet:verify --slug <task-slug> [--json]

Required:
  --slug <slug>    Task slug to verify

Options:
  --json           Output results as JSON
  --help, -h       Show this help

Verifies the Evidence Triplet:
  1. Milestone Test (red → green proof)
  2. Contract Snapshot (schema/types/route)
  3. Reviewer JSON pointer (created during REVIEW)

Also checks optional evidence:
  - Vibe check logs
  - Model health logs
  - Recaps log

Example:
  pnpm evidence:triplet:verify --slug fix-auth-bug

See: .cortexdx/rules/agentic-coding-workflow.md#evidence-triplet
  `);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
}

export { EvidenceTripletVerifier, TripletResult, VerificationResult };
