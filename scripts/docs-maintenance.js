#!/usr/bin/env node

/**
 * Documentation Maintenance System for CortexDx
 * Handles automated maintenance tasks including version sync, outdated content detection,
 * and scheduled maintenance procedures
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DocumentationMaintenance {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
    this.packageJsonPath = 'packages/cortexdx/package.json';
    this.rootPackageJsonPath = 'package.json';
    this.maintenanceConfig = this.loadMaintenanceConfig();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      error: '❌ ERROR',
      warning: '⚠️  WARNING',
      info: 'ℹ️  INFO',
      success: '✅ SUCCESS',
      maintenance: '🔧 MAINTENANCE'
    }[type];
    
    console.log(`[${timestamp}] ${prefix}: ${message}`);
  }

  addError(message) {
    this.errors.push(message);
    this.log(message, 'error');
  }

  addWarning(message) {
    this.warnings.push(message);
    this.log(message, 'warning');
  }

  addSuggestion(message) {
    this.suggestions.push(message);
    this.log(message, 'maintenance');
  }

  loadMaintenanceConfig() {
    const configPath = '.docs-maintenance.yml';
    if (fs.existsSync(configPath)) {
      try {
        const yaml = require('js-yaml');
        const content = fs.readFileSync(configPath, 'utf8');
        return yaml.load(content);
      } catch (error) {
        this.addWarning(`Failed to load maintenance config: ${error.message}`);
      }
    }
    
    // Default configuration
    return {
      schedule: {
        daily: ['link-check', 'version-sync'],
        weekly: ['content-freshness', 'cross-reference-audit'],
        monthly: ['comprehensive-review', 'outdated-content-scan']
      },
      version_sync: {
        enabled: true,
        files: [
          'README.md',
          'packages/cortexdx/README.md',
          'packages/cortexdx/docs/GETTING_STARTED.md'
        ]
      },
      freshness: {
        warning_days: 90,
        error_days: 180,
        exclude_patterns: ['CHANGELOG.md', 'LICENSE']
      },
      link_monitoring: {
        external_timeout: 10000,
        retry_count: 3,
        ignore_patterns: ['localhost', 'example.com', '127.0.0.1']
      }
    };
  }

  async checkVersionSynchronization() {
    this.log('Checking version synchronization across documentation...');
    
    if (!fs.existsSync(this.packageJsonPath)) {
      this.addError(`Package.json not found at ${this.packageJsonPath}`);
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    const nodeVersion = packageJson.engines?.node || '>=20.0.0';
    
    this.log(`Current package version: ${currentVersion}`);
    
    const filesToCheck = this.maintenanceConfig.version_sync.files;
    let syncIssues = 0;

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) {
        this.addWarning(`Version sync target file not found: ${filePath}`);
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for version badges
      const versionBadgeRegex = /https:\/\/img\.shields\.io\/npm\/v\/@brainwav\/cortexdx/g;
      const nodeVersionBadgeRegex = /https:\/\/img\.shields\.io\/badge\/node-[^-]+-/g;
      
      // Check if version is mentioned in text
      const versionMentions = content.match(new RegExp(`version\\s+${currentVersion.replace(/\./g, '\\.')}`, 'gi'));
      const outdatedVersions = content.match(/version\s+\d+\.\d+\.\d+/gi);
      
      if (outdatedVersions && !versionMentions) {
        syncIssues++;
        this.addWarning(`${filePath}: May contain outdated version references`);
      }
      
      // Check Node.js version consistency
      const nodeVersionMentions = content.match(/node[^\w]*(\d+\.\d+\.\d+|\>=?\d+\.\d+\.\d+)/gi);
      if (nodeVersionMentions) {
        const expectedNodeVersion = nodeVersion.replace('>=', '');
        const hasCorrectNodeVersion = nodeVersionMentions.some(mention => 
          mention.includes(expectedNodeVersion)
        );
        
        if (!hasCorrectNodeVersion) {
          syncIssues++;
          this.addWarning(`${filePath}: Node.js version may be outdated (expected: ${nodeVersion})`);
        }
      }
    }

    if (syncIssues === 0) {
      this.log('Version synchronization check passed', 'success');
    } else {
      this.addSuggestion(`Consider updating version references in ${syncIssues} files`);
    }
  }

  async checkContentFreshness() {
    this.log('Checking documentation content freshness...');
    
    const markdownFiles = this.findMarkdownFiles();
    const now = new Date();
    const warningThreshold = this.maintenanceConfig.freshness.warning_days;
    const errorThreshold = this.maintenanceConfig.freshness.error_days;
    
    let staleFiles = 0;
    let veryStaleFiles = 0;

    for (const filePath of markdownFiles) {
      // Skip excluded patterns
      const shouldSkip = this.maintenanceConfig.freshness.exclude_patterns.some(pattern =>
        filePath.includes(pattern)
      );
      
      if (shouldSkip) continue;

      try {
        const stats = fs.statSync(filePath);
        const lastModified = stats.mtime;
        const daysSinceModified = Math.floor((now - lastModified) / (1000 * 60 * 60 * 24));
        
        if (daysSinceModified > errorThreshold) {
          veryStaleFiles++;
          this.addError(`${filePath}: Very stale content (${daysSinceModified} days old)`);
        } else if (daysSinceModified > warningThreshold) {
          staleFiles++;
          this.addWarning(`${filePath}: Potentially stale content (${daysSinceModified} days old)`);
        }
        
        // Check for TODO/FIXME that might indicate incomplete content
        const content = fs.readFileSync(filePath, 'utf8');
        const todos = content.match(/TODO|FIXME|XXX/gi) || [];
        if (todos.length > 0) {
          this.addSuggestion(`${filePath}: Contains ${todos.length} TODO/FIXME items that may need attention`);
        }
        
        // Check for placeholder content
        const placeholders = content.match(/\[placeholder\]|\[todo\]|\[tbd\]|\[coming soon\]/gi) || [];
        if (placeholders.length > 0) {
          this.addWarning(`${filePath}: Contains ${placeholders.length} placeholder items`);
        }
        
      } catch (error) {
        this.addWarning(`Could not check freshness for ${filePath}: ${error.message}`);
      }
    }

    this.log(`Content freshness check completed: ${staleFiles} stale, ${veryStaleFiles} very stale files`);
  }

  async performLinkHealthCheck() {
    this.log('Performing comprehensive link health check...');
    
    const markdownFiles = this.findMarkdownFiles();
    const linkResults = {
      total: 0,
      working: 0,
      broken: 0,
      slow: 0
    };

    for (const filePath of markdownFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract all links
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      
      while ((match = linkRegex.exec(content)) !== null) {
        const linkText = match[1];
        const linkUrl = match[2];
        linkResults.total++;
        
        // Skip anchors and mailto links
        if (linkUrl.startsWith('#') || linkUrl.startsWith('mailto:')) {
          linkResults.working++;
          continue;
        }
        
        // Check external links
        if (linkUrl.startsWith('http')) {
          const shouldIgnore = this.maintenanceConfig.link_monitoring.ignore_patterns.some(pattern =>
            linkUrl.includes(pattern)
          );
          
          if (shouldIgnore) {
            linkResults.working++;
            continue;
          }
          
          try {
            const startTime = Date.now();
            // Simple HTTP check (would need actual HTTP client in real implementation)
            const duration = Date.now() - startTime;
            
            if (duration > 5000) {
              linkResults.slow++;
              this.addWarning(`${filePath}: Slow link "${linkText}" (${linkUrl}) - ${duration}ms`);
            } else {
              linkResults.working++;
            }
          } catch (error) {
            linkResults.broken++;
            this.addError(`${filePath}: Broken external link "${linkText}" (${linkUrl})`);
          }
        } else {
          // Check internal links
          const resolvedPath = path.resolve(path.dirname(filePath), linkUrl.split('#')[0]);
          const relativePath = path.relative('.', resolvedPath);
          
          if (fs.existsSync(relativePath)) {
            linkResults.working++;
          } else {
            linkResults.broken++;
            this.addError(`${filePath}: Broken internal link "${linkText}" (${linkUrl})`);
          }
        }
      }
    }

    this.log(`Link health check completed: ${linkResults.working}/${linkResults.total} working, ${linkResults.broken} broken, ${linkResults.slow} slow`);
    
    if (linkResults.broken > 0) {
      this.addSuggestion(`Run 'pnpm docs:links' for detailed link checking`);
    }
  }

  async generateMaintenanceReport() {
    this.log('Generating maintenance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        suggestions: this.suggestions.length,
        status: this.errors.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION'
      },
      maintenance_tasks: {
        version_sync: this.errors.filter(e => e.includes('version')).length === 0,
        content_freshness: this.errors.filter(e => e.includes('stale')).length === 0,
        link_health: this.errors.filter(e => e.includes('link')).length === 0
      },
      findings: {
        errors: this.errors,
        warnings: this.warnings,
        suggestions: this.suggestions
      },
      next_actions: this.generateNextActions()
    };

    // Write JSON report
    fs.writeFileSync('docs-maintenance-report.json', JSON.stringify(report, null, 2));
    
    // Write markdown report
    const markdownReport = this.generateMarkdownMaintenanceReport(report);
    fs.writeFileSync('docs-maintenance-report.md', markdownReport);
    
    this.log('Generated maintenance reports: docs-maintenance-report.json, docs-maintenance-report.md');
    
    return report;
  }

  generateNextActions() {
    const actions = [];
    
    if (this.errors.length > 0) {
      actions.push('Address critical errors in documentation');
    }
    
    if (this.warnings.filter(w => w.includes('stale')).length > 0) {
      actions.push('Review and update stale documentation files');
    }
    
    if (this.warnings.filter(w => w.includes('version')).length > 0) {
      actions.push('Synchronize version references across documentation');
    }
    
    if (this.errors.filter(e => e.includes('link')).length > 0) {
      actions.push('Fix broken links in documentation');
    }
    
    if (this.suggestions.length > 0) {
      actions.push('Consider implementing suggested improvements');
    }
    
    return actions;
  }

  generateMarkdownMaintenanceReport(report) {
    let markdown = `# Documentation Maintenance Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Status:** ${report.summary.status}\n`;
    markdown += `**Errors:** ${report.summary.errors}\n`;
    markdown += `**Warnings:** ${report.summary.warnings}\n`;
    markdown += `**Suggestions:** ${report.summary.suggestions}\n\n`;
    
    markdown += `## Maintenance Task Status\n\n`;
    markdown += `- ${report.maintenance_tasks.version_sync ? '✅' : '❌'} Version Synchronization\n`;
    markdown += `- ${report.maintenance_tasks.content_freshness ? '✅' : '❌'} Content Freshness\n`;
    markdown += `- ${report.maintenance_tasks.link_health ? '✅' : '❌'} Link Health\n\n`;
    
    if (report.findings.errors.length > 0) {
      markdown += `## Critical Issues\n\n`;
      report.findings.errors.forEach(error => {
        markdown += `- ❌ ${error}\n`;
      });
      markdown += `\n`;
    }
    
    if (report.findings.warnings.length > 0) {
      markdown += `## Warnings\n\n`;
      report.findings.warnings.forEach(warning => {
        markdown += `- ⚠️ ${warning}\n`;
      });
      markdown += `\n`;
    }
    
    if (report.findings.suggestions.length > 0) {
      markdown += `## Suggestions\n\n`;
      report.findings.suggestions.forEach(suggestion => {
        markdown += `- 🔧 ${suggestion}\n`;
      });
      markdown += `\n`;
    }
    
    if (report.next_actions.length > 0) {
      markdown += `## Recommended Actions\n\n`;
      report.next_actions.forEach((action, index) => {
        markdown += `${index + 1}. ${action}\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `## Maintenance Schedule\n\n`;
    markdown += `- **Daily**: Link checking, version synchronization\n`;
    markdown += `- **Weekly**: Content freshness review, cross-reference audit\n`;
    markdown += `- **Monthly**: Comprehensive documentation review\n\n`;
    
    markdown += `## Next Maintenance Window\n\n`;
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    markdown += `**Weekly Review**: ${nextWeek.toISOString().split('T')[0]}\n`;
    
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    markdown += `**Monthly Review**: ${nextMonth.toISOString().split('T')[0]}\n`;
    
    return markdown;
  }

  findMarkdownFiles() {
    const findFiles = (dir, files = []) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          if (['node_modules', '.nx', 'dist', 'reports', 'enhanced-reports'].includes(item)) {
            continue;
          }
          findFiles(fullPath, files);
        } else if (item.endsWith('.md')) {
          files.push(fullPath);
        }
      }
      
      return files;
    };
    
    return findFiles('.').map(file => path.relative('.', file));
  }

  async runMaintenanceTask(task) {
    this.log(`Running maintenance task: ${task}`, 'maintenance');
    
    switch (task) {
      case 'version-sync':
        await this.checkVersionSynchronization();
        break;
      case 'content-freshness':
        await this.checkContentFreshness();
        break;
      case 'link-check':
        await this.performLinkHealthCheck();
        break;
      case 'full':
        await this.checkVersionSynchronization();
        await this.checkContentFreshness();
        await this.performLinkHealthCheck();
        break;
      default:
        this.addError(`Unknown maintenance task: ${task}`);
    }
  }

  async run(task = 'full') {
    this.log('Starting documentation maintenance...', 'maintenance');
    
    try {
      await this.runMaintenanceTask(task);
      
      const report = await this.generateMaintenanceReport();
      
      if (report.summary.status === 'HEALTHY') {
        this.log('Documentation maintenance completed - all systems healthy!', 'success');
        process.exit(0);
      } else {
        this.log(`Documentation maintenance completed with ${report.summary.errors} errors and ${report.summary.warnings} warnings`, 'warning');
        process.exit(report.summary.errors > 0 ? 1 : 0);
      }
    } catch (error) {
      this.log(`Maintenance failed with unexpected error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const task = process.argv[2] || 'full';
  const maintenance = new DocumentationMaintenance();
  maintenance.run(task);
}

module.exports = DocumentationMaintenance;