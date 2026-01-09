#!/usr/bin/env tsx
/**
 * Governance Validation Script
 * Checks governance files for common issues and inconsistencies
 *
 * Usage: pnpm tsx scripts/governance/validate.ts [--fix] [--verbose]
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

const GOVERNANCE_ROOT = ".cortexdx/rules";
const TOOLS_DOC = ".cortexdx/MISSING_TOOLS.md";
const PACKAGE_JSON = "package.json";
const ROOT_PACKAGE_JSON = "package.json";
const CORTEXDX_PACKAGE_JSON = "packages/cortexdx/package.json";

interface ValidationIssue {
  file: string;
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
  category: string;
}

interface ValidationResult {
  issues: ValidationIssue[];
  stats: {
    filesChecked: number;
    errorsFound: number;
    warningsFound: number;
    infoFound: number;
  };
}

class GovernanceValidator {
  private issues: ValidationIssue[] = [];
  private filesChecked = 0;
  private verbose = false;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  addIssue(issue: ValidationIssue): void {
    this.issues.push(issue);
  }

  /**
   * Check for duplicate content in markdown files
   */
  checkDuplicateContent(filePath: string, content: string): void {
    const lines = content.split("\n");
    const seenBlocks = new Map<string, number>();

    // Check for duplicate numbered list items (like "8. **Rule**")
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\d+)\.\s+\*\*(.*?)\*\*/);
      if (match) {
        const [, num, title] = match;
        const blockKey = `${num}-${title}`;

        if (seenBlocks.has(blockKey)) {
          this.addIssue({
            file: filePath,
            line: i + 1,
            severity: "error",
            category: "duplicate-content",
            message: `Duplicate numbered item found: "${num}. **${title}**" (first seen at line ${seenBlocks.get(blockKey)})`,
          });
        } else {
          seenBlocks.set(blockKey, i + 1);
        }
      }
    }

    // Check for duplicate multi-line blocks (5+ consecutive lines)
    const blockSize = 5;
    const blocks = new Map<string, number>();

    for (let i = 0; i <= lines.length - blockSize; i++) {
      const block = lines
        .slice(i, i + blockSize)
        .join("\n")
        .trim();
      if (block.length > 100) {
        // Only check substantial blocks
        if (blocks.has(block)) {
          this.addIssue({
            file: filePath,
            line: i + 1,
            severity: "warning",
            category: "duplicate-content",
            message: `Possible duplicate content block (${blockSize} lines, first occurrence at line ${blocks.get(block)})`,
          });
        } else {
          blocks.set(block, i + 1);
        }
      }
    }
  }

  /**
   * Check for broken internal references
   */
  checkBrokenReferences(filePath: string, content: string): void {
    // Find all markdown links: [text](path) or [text](path#anchor)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const [fullMatch, , linkPath] = match;

      // Skip external URLs
      if (linkPath.startsWith("http://") || linkPath.startsWith("https://")) {
        continue;
      }

      // Skip mailto and other protocols
      if (linkPath.includes(":")) {
        continue;
      }

      // Parse path and anchor
      const [path, anchor] = linkPath.split("#");

      // Check if file exists (relative to governance root)
      if (path && !path.startsWith("/")) {
        const resolvedPath = join(".cortexdx/rules", path);
        if (!existsSync(resolvedPath)) {
          this.addIssue({
            file: filePath,
            severity: "warning",
            category: "broken-reference",
            message: `Broken link to "${path}" - file not found`,
          });
        }
      }
    }
  }

  /**
   * Check for tool references that don't exist in package.json
   */
  checkToolReferences(filePath: string, content: string): void {
    // Load package.json scripts
    const rootScripts = this.loadPackageScripts(ROOT_PACKAGE_JSON);
    const cortexdxScripts = this.loadPackageScripts(CORTEXDX_PACKAGE_JSON);
    const allScripts = { ...rootScripts, ...cortexdxScripts };

    // Find pnpm commands: `pnpm command:name`
    const commandRegex = /`pnpm\s+([a-z0-9:_-]+)/g;
    let match: RegExpExecArray | null;

    while ((match = commandRegex.exec(content)) !== null) {
      const [, command] = match;

      // Skip common nx commands that are dynamically generated
      if (command.includes(":smart") || command.includes("affected")) {
        continue;
      }

      if (!allScripts[command]) {
        this.addIssue({
          file: filePath,
          severity: "info",
          category: "missing-tool",
          message: `Referenced tool "pnpm ${command}" not found in package.json scripts (check .cortexdx/MISSING_TOOLS.md)`,
        });
      }
    }
  }

  private loadPackageScripts(packagePath: string): Record<string, string> {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
      return pkg.scripts || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Check governance-index.json SHA256 hashes
   */
  checkGovernanceIndex(): void {
    const indexPath = join(GOVERNANCE_ROOT, "governance-index.json");
    if (!existsSync(indexPath)) {
      this.addIssue({
        file: indexPath,
        severity: "warning",
        category: "missing-file",
        message: "governance-index.json not found",
      });
      return;
    }

    const index = JSON.parse(readFileSync(indexPath, "utf-8"));

    for (const [fileName, fileInfo] of Object.entries(index.docs || {})) {
      const doc = fileInfo as { path: string; sha256: string };
      const filePath = doc.path.replace(/^\//, "");

      if (!existsSync(filePath)) {
        this.addIssue({
          file: indexPath,
          severity: "error",
          category: "missing-file",
          message: `File referenced in index not found: ${filePath}`,
        });
        continue;
      }

      const content = readFileSync(filePath, "utf-8");
      const actualHash = createHash("sha256").update(content).digest("hex");

      if (actualHash !== doc.sha256) {
        this.addIssue({
          file: indexPath,
          severity: "warning",
          category: "stale-hash",
          message: `SHA256 mismatch for ${fileName}: index has ${doc.sha256.substring(0, 8)}..., actual is ${actualHash.substring(0, 8)}...`,
        });
      }
    }
  }

  /**
   * Check for outdated grace period dates
   */
  checkGracePeriods(filePath: string, content: string): void {
    const today = new Date("2025-11-16"); // Current date from context

    // Find grace period date references
    const gracePeriodRegex = /grace.*?period.*?(\d{4}-\d{2}-\d{2})/gi;
    let match: RegExpExecArray | null;

    while ((match = gracePeriodRegex.exec(content)) !== null) {
      const [, dateStr] = match;
      const graceDate = new Date(dateStr);

      if (graceDate < today) {
        this.addIssue({
          file: filePath,
          severity: "warning",
          category: "outdated-date",
          message: `Grace period date ${dateStr} is in the past`,
        });
      }
    }
  }

  /**
   * Check for inconsistent numbering in numbered lists
   */
  checkNumbering(filePath: string, content: string): void {
    const lines = content.split("\n");
    let expectedNum = 1;
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\d+)\.\s+\*\*/);

      if (match) {
        const num = Number.parseInt(match[1], 10);

        if (!inList) {
          // Start of new list
          inList = true;
          expectedNum = num;
        } else if (num !== expectedNum) {
          this.addIssue({
            file: filePath,
            line: i + 1,
            severity: "warning",
            category: "numbering",
            message: `Numbering inconsistency: expected ${expectedNum}, found ${num}`,
          });
        }

        expectedNum = num + 1;
      } else if (
        inList &&
        !lines[i].trim().startsWith("-") &&
        lines[i].trim()
      ) {
        // End of list (non-empty line that's not a bullet)
        if (!lines[i].match(/^\s+[a-zA-Z-]/)) {
          // Not a continuation
          inList = false;
          expectedNum = 1;
        }
      }
    }
  }

  /**
   * Check for required evidence tokens in phase policy
   */
  checkEvidenceTokens(): void {
    const phasePolicyPath = join(GOVERNANCE_ROOT, "agentic-phase-policy.md");
    if (!existsSync(phasePolicyPath)) {
      return;
    }

    const content = readFileSync(phasePolicyPath, "utf-8");
    const requiredTokens = [
      "AGENTS_MD_SHA",
      "PHASE_TRANSITION",
      "brAInwav-vibe-check",
      "TIME_FRESHNESS:OK",
      "MODELS:LIVE:OK",
      "TRACE_CONTEXT:OK",
      "SUPPLY_CHAIN:OK",
    ];

    for (const token of requiredTokens) {
      if (!content.includes(token)) {
        this.addIssue({
          file: phasePolicyPath,
          severity: "warning",
          category: "missing-token",
          message: `Required evidence token "${token}" not found in phase policy`,
        });
      }
    }
  }

  /**
   * Validate all governance files
   */
  validate(): ValidationResult {
    this.log("Starting governance validation...\n");

    // Check governance-index.json first
    this.log("Checking governance-index.json...");
    this.checkGovernanceIndex();

    // Check evidence tokens
    this.log("Checking evidence tokens...");
    this.checkEvidenceTokens();

    // Check all markdown files in governance root
    const files = this.getMarkdownFiles(GOVERNANCE_ROOT);

    for (const file of files) {
      this.filesChecked++;
      this.log(`Checking ${file}...`);

      const content = readFileSync(file, "utf-8");

      this.checkDuplicateContent(file, content);
      this.checkBrokenReferences(file, content);
      this.checkToolReferences(file, content);
      this.checkGracePeriods(file, content);
      this.checkNumbering(file, content);
    }

    const stats = {
      filesChecked: this.filesChecked,
      errorsFound: this.issues.filter((i) => i.severity === "error").length,
      warningsFound: this.issues.filter((i) => i.severity === "warning").length,
      infoFound: this.issues.filter((i) => i.severity === "info").length,
    };

    return { issues: this.issues, stats };
  }

  private getMarkdownFiles(dir: string): string[] {
    const files: string[] = [];

    if (!existsSync(dir)) {
      return files;
    }

    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getMarkdownFiles(fullPath));
      } else if (entry.endsWith(".md")) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

// CLI Entry Point
function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const fix = args.includes("--fix");

  console.log("🔍 CortexDx Governance Validator\n");

  const validator = new GovernanceValidator(verbose);
  const result = validator.validate();

  // Print results
  console.log("\n📊 Validation Results:\n");
  console.log(`Files checked: ${result.stats.filesChecked}`);
  console.log(`Errors: ${result.stats.errorsFound}`);
  console.log(`Warnings: ${result.stats.warningsFound}`);
  console.log(`Info: ${result.stats.infoFound}`);

  if (result.issues.length === 0) {
    console.log("\n✅ No issues found! Governance files are clean.\n");
    process.exit(0);
  }

  // Group issues by category
  const byCategory = result.issues.reduce(
    (acc, issue) => {
      if (!acc[issue.category]) {
        acc[issue.category] = [];
      }
      acc[issue.category].push(issue);
      return acc;
    },
    {} as Record<string, ValidationIssue[]>,
  );

  console.log("\n📋 Issues Found:\n");

  for (const [category, issues] of Object.entries(byCategory)) {
    console.log(
      `\n${getCategoryIcon(category)} ${category.toUpperCase().replace(/-/g, " ")} (${issues.length})`,
    );
    console.log("─".repeat(60));

    for (const issue of issues) {
      const severity = getSeverityIcon(issue.severity);
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.log(`${severity} ${location}`);
      console.log(`   ${issue.message}`);
    }
  }

  console.log("\n");

  // Exit with error code if there are errors
  if (result.stats.errorsFound > 0) {
    console.log("❌ Validation failed with errors.\n");
    process.exit(1);
  } else if (result.stats.warningsFound > 0) {
    console.log("⚠️  Validation completed with warnings.\n");
    process.exit(0);
  } else {
    console.log("ℹ️  Validation completed with informational messages.\n");
    process.exit(0);
  }
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "duplicate-content": "📋",
    "broken-reference": "🔗",
    "missing-tool": "🔧",
    "stale-hash": "🔄",
    "outdated-date": "📅",
    numbering: "🔢",
    "missing-token": "🏷️",
    "missing-file": "📁",
  };
  return icons[category] || "❓";
}

function getSeverityIcon(severity: string): string {
  const icons: Record<string, string> = {
    error: "❌",
    warning: "⚠️ ",
    info: "ℹ️ ",
  };
  return icons[severity] || "  ";
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { GovernanceValidator, ValidationResult, ValidationIssue };
