#!/usr/bin/env node

/**
 * Broken Link Detection and Reporting System for Insula MCP
 * Monitors documentation links and provides detailed reporting on link health
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class BrokenLinkMonitor {
  constructor() {
    this.results = {
      total: 0,
      working: 0,
      broken: 0,
      slow: 0,
      skipped: 0
    };
    this.brokenLinks = [];
    this.slowLinks = [];
    this.linkHistory = this.loadLinkHistory();
    this.config = this.loadConfig();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      error: '❌ ERROR',
      warning: '⚠️  WARNING',
      info: 'ℹ️  INFO',
      success: '✅ SUCCESS',
      monitor: '🔍 MONITOR'
    }[type];
    
    console.log(`[${timestamp}] ${prefix}: ${message}`);
  }

  loadConfig() {
    // Default configuration
    return {
      timeout: 10000,
      retryCount: 3,
      retryDelay: 1000,
      slowThreshold: 5000,
      ignorePatterns: [
        'localhost',
        '127.0.0.1',
        'example.com',
        'example.org',
        '*.local'
      ],
      userAgent: 'Insula-MCP-Link-Monitor/1.0'
    };
  }

  loadLinkHistory() {
    const historyFile = 'link-history.json';
    if (fs.existsSync(historyFile)) {
      try {
        return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      } catch (error) {
        this.log(`Failed to load link history: ${error.message}`, 'warning');
      }
    }
    return {};
  }

  saveLinkHistory() {
    try {
      fs.writeFileSync('link-history.json', JSON.stringify(this.linkHistory, null, 2));
    } catch (error) {
      this.log(`Failed to save link history: ${error.message}`, 'warning');
    }
  }

  shouldIgnoreLink(url) {
    return this.config.ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(url);
      }
      return url.includes(pattern);
    });
  }

  async checkExternalLink(url, retryCount = 0) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        timeout: this.config.timeout,
        headers: {
          'User-Agent': this.config.userAgent
        }
      };

      const req = client.request(options, (res) => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        if (statusCode >= 200 && statusCode < 400) {
          resolve({
            success: true,
            statusCode,
            duration,
            redirected: statusCode >= 300 && statusCode < 400
          });
        } else {
          resolve({
            success: false,
            statusCode,
            duration,
            error: `HTTP ${statusCode}`
          });
        }
      });

      req.on('error', (error) => {
        const duration = Date.now() - startTime;
        
        // Retry on certain errors
        if (retryCount < this.config.retryCount && 
            (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
          setTimeout(() => {
            this.checkExternalLink(url, retryCount + 1).then(resolve);
          }, this.config.retryDelay);
          return;
        }
        
        resolve({
          success: false,
          duration,
          error: error.message,
          code: error.code
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const duration = Date.now() - startTime;
        
        if (retryCount < this.config.retryCount) {
          setTimeout(() => {
            this.checkExternalLink(url, retryCount + 1).then(resolve);
          }, this.config.retryDelay);
          return;
        }
        
        resolve({
          success: false,
          duration,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }

  checkInternalLink(linkPath, basePath) {
    // Remove anchor from path
    const filePath = linkPath.split('#')[0];
    
    // Resolve relative path
    const resolvedPath = path.resolve(basePath, filePath);
    const relativePath = path.relative('.', resolvedPath);
    
    return {
      success: fs.existsSync(relativePath),
      resolvedPath: relativePath,
      exists: fs.existsSync(relativePath)
    };
  }

  extractLinksFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const links = [];
    
    // Extract markdown links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const linkText = match[1];
      const linkUrl = match[2];
      
      // Skip anchors and mailto links
      if (linkUrl.startsWith('#') || linkUrl.startsWith('mailto:')) {
        continue;
      }
      
      links.push({
        text: linkText,
        url: linkUrl,
        line: this.getLineNumber(content, match.index),
        file: filePath
      });
    }
    
    return links;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  async monitorDocumentationLinks() {
    this.log('Starting comprehensive link monitoring...', 'monitor');
    
    const markdownFiles = this.findMarkdownFiles();
    const allLinks = [];
    
    // Extract all links from documentation
    for (const filePath of markdownFiles) {
      const links = this.extractLinksFromFile(filePath);
      allLinks.push(...links);
    }
    
    this.log(`Found ${allLinks.length} links to check`);
    this.results.total = allLinks.length;
    
    // Check each link
    for (const link of allLinks) {
      await this.checkLink(link);
    }
    
    // Update link history
    this.updateLinkHistory(allLinks);
    this.saveLinkHistory();
    
    this.log(`Link monitoring completed: ${this.results.working} working, ${this.results.broken} broken, ${this.results.slow} slow`);
  }

  async checkLink(link) {
    const { url, file, line, text } = link;
    
    if (url.startsWith('http')) {
      // External link
      if (this.shouldIgnoreLink(url)) {
        this.results.skipped++;
        return;
      }
      
      const result = await this.checkExternalLink(url);
      
      if (result.success) {
        this.results.working++;
        
        if (result.duration > this.config.slowThreshold) {
          this.results.slow++;
          this.slowLinks.push({
            ...link,
            duration: result.duration,
            statusCode: result.statusCode
          });
        }
      } else {
        this.results.broken++;
        this.brokenLinks.push({
          ...link,
          error: result.error,
          statusCode: result.statusCode,
          type: 'external'
        });
      }
    } else {
      // Internal link
      const basePath = path.dirname(file);
      const result = this.checkInternalLink(url, basePath);
      
      if (result.success) {
        this.results.working++;
      } else {
        this.results.broken++;
        this.brokenLinks.push({
          ...link,
          error: 'File not found',
          resolvedPath: result.resolvedPath,
          type: 'internal'
        });
      }
    }
  }

  updateLinkHistory(links) {
    const now = new Date().toISOString();
    
    links.forEach(link => {
      const linkKey = `${link.file}:${link.url}`;
      
      if (!this.linkHistory[linkKey]) {
        this.linkHistory[linkKey] = {
          url: link.url,
          file: link.file,
          firstSeen: now,
          checkHistory: []
        };
      }
      
      // Add current check result
      const isBroken = this.brokenLinks.some(broken => 
        broken.file === link.file && broken.url === link.url
      );
      
      const isSlow = this.slowLinks.some(slow => 
        slow.file === link.file && slow.url === link.url
      );
      
      this.linkHistory[linkKey].checkHistory.push({
        timestamp: now,
        status: isBroken ? 'broken' : (isSlow ? 'slow' : 'working'),
        lastChecked: now
      });
      
      // Keep only last 30 check results
      if (this.linkHistory[linkKey].checkHistory.length > 30) {
        this.linkHistory[linkKey].checkHistory = 
          this.linkHistory[linkKey].checkHistory.slice(-30);
      }
    });
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

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results,
      brokenLinks: this.brokenLinks,
      slowLinks: this.slowLinks,
      recommendations: this.generateRecommendations()
    };
    
    // Write JSON report
    fs.writeFileSync('broken-link-report.json', JSON.stringify(report, null, 2));
    
    // Write markdown report
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync('broken-link-report.md', markdownReport);
    
    this.log('Generated broken link reports: broken-link-report.json, broken-link-report.md');
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.brokenLinks.length > 0) {
      recommendations.push('Fix broken links to improve documentation reliability');
    }
    
    if (this.slowLinks.length > 0) {
      recommendations.push('Consider replacing slow external links with faster alternatives');
    }
    
    const externalBroken = this.brokenLinks.filter(link => link.type === 'external');
    if (externalBroken.length > 0) {
      recommendations.push('Review external link dependencies and consider archival alternatives');
    }
    
    const internalBroken = this.brokenLinks.filter(link => link.type === 'internal');
    if (internalBroken.length > 0) {
      recommendations.push('Update internal links to reflect current file structure');
    }
    
    return recommendations;
  }

  generateMarkdownReport(report) {
    let markdown = `# Broken Link Monitoring Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Total Links Checked:** ${report.summary.total}\n`;
    markdown += `**Working Links:** ${report.summary.working}\n`;
    markdown += `**Broken Links:** ${report.summary.broken}\n`;
    markdown += `**Slow Links:** ${report.summary.slow}\n`;
    markdown += `**Skipped Links:** ${report.summary.skipped}\n\n`;
    
    if (report.brokenLinks.length > 0) {
      markdown += `## Broken Links (${report.brokenLinks.length})\n\n`;
      
      const internalBroken = report.brokenLinks.filter(link => link.type === 'internal');
      const externalBroken = report.brokenLinks.filter(link => link.type === 'external');
      
      if (internalBroken.length > 0) {
        markdown += `### Internal Links\n\n`;
        internalBroken.forEach(link => {
          markdown += `- **${link.file}:${link.line}** - "${link.text}"\n`;
          markdown += `  - URL: \`${link.url}\`\n`;
          markdown += `  - Error: ${link.error}\n`;
          if (link.resolvedPath) {
            markdown += `  - Resolved to: \`${link.resolvedPath}\`\n`;
          }
          markdown += `\n`;
        });
      }
      
      if (externalBroken.length > 0) {
        markdown += `### External Links\n\n`;
        externalBroken.forEach(link => {
          markdown += `- **${link.file}:${link.line}** - "${link.text}"\n`;
          markdown += `  - URL: \`${link.url}\`\n`;
          markdown += `  - Error: ${link.error}\n`;
          if (link.statusCode) {
            markdown += `  - Status Code: ${link.statusCode}\n`;
          }
          markdown += `\n`;
        });
      }
    }
    
    if (report.slowLinks.length > 0) {
      markdown += `## Slow Links (${report.slowLinks.length})\n\n`;
      markdown += `Links that took longer than ${this.config.slowThreshold}ms to respond:\n\n`;
      
      report.slowLinks.forEach(link => {
        markdown += `- **${link.file}:${link.line}** - "${link.text}"\n`;
        markdown += `  - URL: \`${link.url}\`\n`;
        markdown += `  - Response Time: ${link.duration}ms\n`;
        markdown += `  - Status Code: ${link.statusCode}\n\n`;
      });
    }
    
    if (report.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;
      report.recommendations.forEach((rec, index) => {
        markdown += `${index + 1}. ${rec}\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `## Link Health Summary\n\n`;
    const healthPercentage = ((report.summary.working / report.summary.total) * 100).toFixed(1);
    markdown += `- **Overall Health:** ${healthPercentage}% (${report.summary.working}/${report.summary.total} working)\n`;
    markdown += `- **Broken Link Rate:** ${((report.summary.broken / report.summary.total) * 100).toFixed(1)}%\n`;
    markdown += `- **Slow Link Rate:** ${((report.summary.slow / report.summary.total) * 100).toFixed(1)}%\n\n`;
    
    markdown += `## Next Steps\n\n`;
    if (report.summary.broken > 0) {
      markdown += `1. **Priority**: Fix ${report.summary.broken} broken links\n`;
      markdown += `2. Review and update link destinations\n`;
      markdown += `3. Consider implementing link redirects where appropriate\n`;
    } else {
      markdown += `1. ✅ No broken links found - documentation links are healthy\n`;
    }
    
    if (report.summary.slow > 0) {
      markdown += `4. Optimize ${report.summary.slow} slow-loading links\n`;
    }
    
    return markdown;
  }

  async run() {
    this.log('Starting broken link monitoring system...', 'monitor');
    
    try {
      await this.monitorDocumentationLinks();
      const report = this.generateReport();
      
      if (report.summary.broken === 0) {
        this.log('Link monitoring completed successfully - no broken links found!', 'success');
        process.exit(0);
      } else {
        this.log(`Link monitoring completed with ${report.summary.broken} broken links`, 'warning');
        process.exit(1);
      }
    } catch (error) {
      this.log(`Link monitoring failed with unexpected error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new BrokenLinkMonitor();
  monitor.run();
}

module.exports = BrokenLinkMonitor;