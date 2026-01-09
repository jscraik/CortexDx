#!/usr/bin/env node

/**
 * Version Synchronization Script for CortexDx Documentation
 * Automatically synchronizes version references across documentation files
 */

const fs = require("fs");
const path = require("path");

class VersionSynchronizer {
  constructor() {
    this.packageJsonPath = "packages/cortexdx/package.json";
    this.changes = [];
    this.errors = [];
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = {
      error: "❌ ERROR",
      warning: "⚠️  WARNING",
      info: "ℹ️  INFO",
      success: "✅ SUCCESS",
      change: "🔄 CHANGE",
    }[type];

    console.log(`[${timestamp}] ${prefix}: ${message}`);
  }

  addChange(file, oldValue, newValue, description) {
    this.changes.push({ file, oldValue, newValue, description });
    this.log(`${file}: ${description} (${oldValue} → ${newValue})`, "change");
  }

  addError(message) {
    this.errors.push(message);
    this.log(message, "error");
  }

  getCurrentVersionInfo() {
    if (!fs.existsSync(this.packageJsonPath)) {
      this.addError(`Package.json not found at ${this.packageJsonPath}`);
      return null;
    }

    try {
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, "utf8"),
      );
      return {
        version: packageJson.version,
        name: packageJson.name,
        nodeVersion: packageJson.engines?.node || ">=20.0.0",
        description: packageJson.description,
      };
    } catch (error) {
      this.addError(`Failed to parse package.json: ${error.message}`);
      return null;
    }
  }

  syncVersionInFile(filePath, versionInfo, dryRun = false) {
    if (!fs.existsSync(filePath)) {
      this.log(`File not found: ${filePath}`, "warning");
      return false;
    }

    let content = fs.readFileSync(filePath, "utf8");
    let modified = false;
    const originalContent = content;

    // Sync npm version badges
    const versionBadgeRegex =
      /(https:\/\/img\.shields\.io\/npm\/v\/)(@brainwav\/cortexdx)(\?[^)\s]*)?/g;
    const newVersionBadgeUrl = `https://img.shields.io/npm/v/${versionInfo.name}`;

    content = content.replace(
      versionBadgeRegex,
      (match, prefix, packageName, suffix) => {
        const newUrl = `${prefix}${packageName}${suffix || ""}`;
        if (match !== newUrl) {
          this.addChange(
            filePath,
            match,
            newUrl,
            "Updated npm version badge URL",
          );
          modified = true;
        }
        return newUrl;
      },
    );

    // Sync Node.js version badges
    const nodeVersionBadgeRegex =
      /(https:\/\/img\.shields\.io\/badge\/node-)([^-]+)(-[^)\s]*)/g;
    const nodeVersionForBadge = versionInfo.nodeVersion.replace(">=", "%3E%3D");

    content = content.replace(
      nodeVersionBadgeRegex,
      (match, prefix, version, suffix) => {
        const newUrl = `${prefix}${nodeVersionForBadge}${suffix}`;
        if (match !== newUrl) {
          this.addChange(
            filePath,
            match,
            newUrl,
            "Updated Node.js version badge",
          );
          modified = true;
        }
        return newUrl;
      },
    );

    // Sync version mentions in text
    const versionMentionRegex = /version\s+(\d+\.\d+\.\d+)/gi;
    content = content.replace(versionMentionRegex, (match, oldVersion) => {
      if (oldVersion !== versionInfo.version) {
        const newMatch = match.replace(oldVersion, versionInfo.version);
        this.addChange(filePath, match, newMatch, "Updated version reference");
        modified = true;
        return newMatch;
      }
      return match;
    });

    // Sync Node.js version requirements
    const nodeRequirementRegex =
      /(Node\.js\s+)(\d+\.\d+\.\d+|\>=?\d+\.\d+\.\d+)/gi;
    content = content.replace(
      nodeRequirementRegex,
      (match, prefix, oldNodeVersion) => {
        if (oldNodeVersion !== versionInfo.nodeVersion) {
          const newMatch = `${prefix}${versionInfo.nodeVersion}`;
          this.addChange(
            filePath,
            match,
            newMatch,
            "Updated Node.js version requirement",
          );
          modified = true;
          return newMatch;
        }
        return match;
      },
    );

    // Sync package name references
    const packageNameRegex = /@brainwav\/cortexdx@(\d+\.\d+\.\d+)/g;
    content = content.replace(packageNameRegex, (match, oldVersion) => {
      if (oldVersion !== versionInfo.version) {
        const newMatch = `@brainwav/cortexdx@${versionInfo.version}`;
        this.addChange(
          filePath,
          match,
          newMatch,
          "Updated package version reference",
        );
        modified = true;
        return newMatch;
      }
      return match;
    });

    // Sync installation commands
    const npmInstallRegex =
      /(npm install\s+@brainwav\/cortexdx)(@\d+\.\d+\.\d+)?/g;
    content = content.replace(npmInstallRegex, (match, command, version) => {
      if (version && version !== `@${versionInfo.version}`) {
        const newMatch = `${command}@${versionInfo.version}`;
        this.addChange(
          filePath,
          match,
          newMatch,
          "Updated npm install command",
        );
        modified = true;
        return newMatch;
      }
      return match;
    });

    // Write changes if not dry run
    if (modified && !dryRun) {
      try {
        fs.writeFileSync(filePath, content, "utf8");
        this.log(`Updated ${filePath}`, "success");
      } catch (error) {
        this.addError(`Failed to write ${filePath}: ${error.message}`);
        return false;
      }
    }

    return modified;
  }

  syncAllDocumentation(dryRun = false) {
    const versionInfo = this.getCurrentVersionInfo();
    if (!versionInfo) {
      return false;
    }

    this.log(
      `Synchronizing documentation with version ${versionInfo.version}...`,
    );

    const filesToSync = [
      "README.md",
      "packages/cortexdx/README.md",
      "packages/cortexdx/docs/GETTING_STARTED.md",
      "packages/cortexdx/docs/USER_GUIDE.md",
      "packages/cortexdx/docs/API_REFERENCE.md",
      "packages/cortexdx/docs/DEPLOYMENT.md",
      "packages/cortexdx/docs/IDE_INTEGRATION.md",
    ];

    let totalModified = 0;

    for (const filePath of filesToSync) {
      if (this.syncVersionInFile(filePath, versionInfo, dryRun)) {
        totalModified++;
      }
    }

    return totalModified > 0;
  }

  generateSyncReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        files_modified:
          this.changes.length > 0
            ? [...new Set(this.changes.map((c) => c.file))].length
            : 0,
        total_changes: this.changes.length,
        errors: this.errors.length,
        status: this.errors.length === 0 ? "SUCCESS" : "FAILED",
      },
      changes: this.changes,
      errors: this.errors,
    };

    // Write JSON report
    fs.writeFileSync(
      "version-sync-report.json",
      JSON.stringify(report, null, 2),
    );

    // Write markdown report
    const markdownReport = this.generateMarkdownSyncReport(report);
    fs.writeFileSync("version-sync-report.md", markdownReport);

    this.log(
      "Generated version sync reports: version-sync-report.json, version-sync-report.md",
    );

    return report;
  }

  generateMarkdownSyncReport(report) {
    let markdown = `# Version Synchronization Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Status:** ${report.summary.status}\n`;
    markdown += `**Files Modified:** ${report.summary.files_modified}\n`;
    markdown += `**Total Changes:** ${report.summary.total_changes}\n`;
    markdown += `**Errors:** ${report.summary.errors}\n\n`;

    if (report.changes.length > 0) {
      markdown += `## Changes Made\n\n`;

      const changesByFile = {};
      report.changes.forEach((change) => {
        if (!changesByFile[change.file]) {
          changesByFile[change.file] = [];
        }
        changesByFile[change.file].push(change);
      });

      Object.keys(changesByFile).forEach((file) => {
        markdown += `### ${file}\n\n`;
        changesByFile[file].forEach((change) => {
          markdown += `- **${change.description}**\n`;
          markdown += `  - Before: \`${change.oldValue}\`\n`;
          markdown += `  - After: \`${change.newValue}\`\n\n`;
        });
      });
    }

    if (report.errors.length > 0) {
      markdown += `## Errors\n\n`;
      report.errors.forEach((error) => {
        markdown += `- ❌ ${error}\n`;
      });
      markdown += `\n`;
    }

    if (report.changes.length === 0 && report.errors.length === 0) {
      markdown += `## Result\n\n`;
      markdown += `✅ All version references are already synchronized.\n\n`;
    }

    markdown += `## Next Steps\n\n`;
    if (report.summary.status === "SUCCESS" && report.changes.length > 0) {
      markdown += `1. Review the changes above\n`;
      markdown += `2. Test the updated documentation\n`;
      markdown += `3. Commit the synchronized files\n`;
    } else if (report.errors.length > 0) {
      markdown += `1. Address the errors listed above\n`;
      markdown += `2. Re-run version synchronization\n`;
    } else {
      markdown += `1. No action required - all versions are synchronized\n`;
    }

    return markdown;
  }

  async run(options = {}) {
    const { dryRun = false, verbose = false } = options;

    this.log(
      `Starting version synchronization${dryRun ? " (dry run)" : ""}...`,
    );

    try {
      const hasChanges = this.syncAllDocumentation(dryRun);
      const report = this.generateSyncReport();

      if (report.summary.status === "SUCCESS") {
        if (hasChanges) {
          this.log(
            `Version synchronization completed with ${report.summary.total_changes} changes`,
            "success",
          );
        } else {
          this.log(
            "Version synchronization completed - no changes needed",
            "success",
          );
        }
        process.exit(0);
      } else {
        this.log(
          `Version synchronization failed with ${report.summary.errors} errors`,
          "error",
        );
        process.exit(1);
      }
    } catch (error) {
      this.log(
        `Version synchronization failed with unexpected error: ${error.message}`,
        "error",
      );
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-n");
  const verbose = args.includes("--verbose") || args.includes("-v");

  const synchronizer = new VersionSynchronizer();
  synchronizer.run({ dryRun, verbose });
}

module.exports = VersionSynchronizer;
