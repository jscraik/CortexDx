#!/usr/bin/env node

/**
 * Advanced documentation validation script for Insula MCP
 * Validates documentation structure, cross-references, and content quality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.requiredFiles = [
      'README.md',
      'CONTRIBUTING.md',
      'packages/insula-mcp/README.md',
      'packages/insula-mcp/docs/GETTING_STARTED.md',
      'packages/insula-mcp/docs/USER_GUIDE.md',
      'packages/insula-mcp/docs/API_REFERENCE.md',
      'packages/insula-mcp/docs/CONTRIBUTING.md',
      'packages/insula-mcp/docs/TROUBLESHOOTING.md',
      'packages/insula-mcp/docs/DEPLOYMENT.md',
      'packages/insula-mcp/docs/IDE_INTEGRATION.md',
      'packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md'
    ];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      error: '❌ ERROR',
      warning: '⚠️  WARNING',
      info: 'ℹ️  INFO',
      success: '✅ SUCCESS'
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

  validateFileStructure() {
    this.log('Validating documentation file structure...');
    
    const missingFiles = this.requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length > 0) {
      this.addError(`Missing required documentation files: ${missingFiles.join(', ')}`);
    } else {
      this.log('All required documentation files are present', 'success');
    }
  }

  validateMarkdownSyntax() {
    this.log('Validating markdown syntax...');
    
    try {
      execSync('markdownlint-cli2 "**/*.md" "#node_modules" "#.nx" "#dist" "#reports" "#enhanced-reports"', {
        stdio: 'pipe'
      });
      this.log('Markdown syntax validation passed', 'success');
    } catch (error) {
      this.addError(`Markdown syntax validation failed: ${error.stdout || error.message}`);
    }
  }

  validateLinks() {
    this.log('Validating documentation links...');
    
    const markdownFiles = this.findMarkdownFiles();
    let linkErrors = 0;
    
    markdownFiles.forEach(file => {
      try {
        execSync(`markdown-link-check "${file}"`, { stdio: 'pipe' });
      } catch (error) {
        linkErrors++;
        this.addWarning(`Link validation failed for ${file}: ${error.stdout || error.message}`);
      }
    });
    
    if (linkErrors === 0) {
      this.log('All links validated successfully', 'success');
    }
  }

  validateSpelling() {
    this.log('Validating spelling...');
    
    try {
      execSync('cspell "**/*.md" --exclude "node_modules/**" --exclude ".nx/**" --exclude "dist/**" --exclude "reports/**" --exclude "enhanced-reports/**"', {
        stdio: 'pipe'
      });
      this.log('Spelling validation passed', 'success');
    } catch (error) {
      this.addWarning(`Spelling validation found issues: ${error.stdout || error.message}`);
    }
  }

  validateCrossReferences() {
    this.log('Validating cross-references...');
    
    const markdownFiles = this.findMarkdownFiles();
    let brokenRefs = 0;
    
    markdownFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const relativeLinkRegex = /\[([^\]]+)\]\(([^)]+\.md[^)]*)\)/g;
      
      let match;
      while ((match = relativeLinkRegex.exec(content)) !== null) {
        const linkPath = match[2];
        
        // Skip external links and anchors
        if (linkPath.startsWith('http') || linkPath.startsWith('#')) {
          continue;
        }
        
        // Resolve relative path
        const basePath = path.dirname(file);
        const resolvedPath = path.resolve(basePath, linkPath.split('#')[0]);
        const relativePath = path.relative('.', resolvedPath);
        
        if (!fs.existsSync(relativePath)) {
          brokenRefs++;
          this.addError(`${file}: Broken internal link "${linkPath}" (resolved to "${relativePath}")`);
        }
      }
    });
    
    if (brokenRefs === 0) {
      this.log('All cross-references validated successfully', 'success');
    }
  }

  validateContentQuality() {
    this.log('Validating content quality...');
    
    const markdownFiles = this.findMarkdownFiles();
    
    markdownFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for empty files
      if (content.trim().length === 0) {
        this.addWarning(`${file}: File is empty`);
        return;
      }
      
      // Check for proper heading structure
      const headings = content.match(/^#+\s+.+$/gm) || [];
      if (headings.length === 0) {
        this.addWarning(`${file}: No headings found`);
      }
      
      // Check for TODO/FIXME comments
      const todos = content.match(/TODO|FIXME|XXX/gi) || [];
      if (todos.length > 0) {
        this.addWarning(`${file}: Contains ${todos.length} TODO/FIXME comments`);
      }
      
      // Check for minimum content length (excluding code blocks)
      const contentWithoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
      if (contentWithoutCode.trim().length < 100) {
        this.addWarning(`${file}: Very short content (${contentWithoutCode.trim().length} characters)`);
      }
    });
  }

  findMarkdownFiles() {
    const fs = require('fs');
    const path = require('path');
    
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

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        status: this.errors.length === 0 ? 'PASSED' : 'FAILED'
      },
      errors: this.errors,
      warnings: this.warnings
    };
    
    // Write JSON report
    fs.writeFileSync('docs-validation-report.json', JSON.stringify(report, null, 2));
    
    // Write markdown report
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync('docs-validation-report.md', markdownReport);
    
    this.log(`Generated validation report: docs-validation-report.json`, 'info');
    this.log(`Generated markdown report: docs-validation-report.md`, 'info');
    
    return report;
  }

  generateMarkdownReport(report) {
    let markdown = `# Documentation Validation Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Status:** ${report.summary.status}\n`;
    markdown += `**Errors:** ${report.summary.errors}\n`;
    markdown += `**Warnings:** ${report.summary.warnings}\n\n`;
    
    if (report.errors.length > 0) {
      markdown += `## Errors\n\n`;
      report.errors.forEach(error => {
        markdown += `- ❌ ${error}\n`;
      });
      markdown += `\n`;
    }
    
    if (report.warnings.length > 0) {
      markdown += `## Warnings\n\n`;
      report.warnings.forEach(warning => {
        markdown += `- ⚠️ ${warning}\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `## Validation Steps Performed\n\n`;
    markdown += `- [x] File structure validation\n`;
    markdown += `- [x] Markdown syntax validation\n`;
    markdown += `- [x] Link validation\n`;
    markdown += `- [x] Spelling validation\n`;
    markdown += `- [x] Cross-reference validation\n`;
    markdown += `- [x] Content quality validation\n`;
    
    return markdown;
  }

  async run() {
    this.log('Starting documentation validation...', 'info');
    
    try {
      this.validateFileStructure();
      this.validateMarkdownSyntax();
      this.validateLinks();
      this.validateSpelling();
      this.validateCrossReferences();
      this.validateContentQuality();
      
      const report = this.generateReport();
      
      if (report.summary.status === 'PASSED') {
        this.log('Documentation validation completed successfully!', 'success');
        process.exit(0);
      } else {
        this.log(`Documentation validation failed with ${report.summary.errors} errors`, 'error');
        process.exit(1);
      }
    } catch (error) {
      this.log(`Validation failed with unexpected error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new DocumentationValidator();
  validator.run();
}

module.exports = DocumentationValidator;